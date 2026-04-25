const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { initializeApp } = require("firebase-admin/app");
const https = require("https");

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "asia-northeast3" });

const db = getFirestore();

const normalize = (s) => s.replace(/\s/g, "").toLowerCase();

const NEWBIE_PERIOD_DAYS = 7;
const NEWBIE_FIRST_SOLVE = 500;
const REFERRAL_REWARD = 500;
const REFERRAL_SHARE_RATE = 0.01;

const LEVEL_THRESHOLDS = [
  { level: 1, attempts: 0,    solved: 0,  bonus: 0.00 },
  { level: 2, attempts: 100,  solved: 1,  bonus: 0.01 },
  { level: 3, attempts: 200,  solved: 2,  bonus: 0.02 },
  { level: 4, attempts: 300,  solved: 3,  bonus: 0.03 },
  { level: 5, attempts: 500,  solved: 5,  bonus: 0.04 },
  { level: 6, attempts: 1000, solved: 10, bonus: 0.05 },
];

const calcLevel = (attempts = 0, solvedCount = 0) => {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (attempts >= t.attempts || solvedCount >= t.solved) level = t.level;
  }
  return level;
};

const getLevelBonus = (attempts = 0, solvedCount = 0) =>
  LEVEL_THRESHOLDS.find((t) => t.level === calcLevel(attempts, solvedCount))?.bonus ?? 0;

// 카카오 액세스 토큰으로 카카오 유저 정보 조회
const getKakaoProfile = (accessToken) =>
  new Promise((resolve, reject) => {
    const options = {
      hostname: "kapi.kakao.com",
      path: "/v2/user/me",
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });

// 카카오 토큰 → Firebase Custom Token 발급
exports.kakaoLogin = onCall({ enforceAppCheck: false, invoker: "public" }, async (request) => {
  const { accessToken, referredBy } = request.data;
  if (!accessToken) throw new HttpsError("invalid-argument", "accessToken 필요");

  const profile = await getKakaoProfile(accessToken);
  if (!profile.id) throw new HttpsError("unauthenticated", "카카오 인증 실패");

  const kakaoId = String(profile.id);
  const nickname = profile.kakao_account?.profile?.nickname ?? "유저";
  const profileImage = profile.kakao_account?.profile?.profile_image_url ?? null;

  // Firebase Custom Token 발급 (uid = 카카오 ID)
  const customToken = await getAuth().createCustomToken(kakaoId);

  // Firestore 유저 문서 생성 (신규만)
  const userRef = db.collection("users").doc(kakaoId);
  const snap = await userRef.get();
  if (!snap.exists()) {
    await userRef.set({
      kakaoId,
      nickname,
      profileImage,
      points: 500, // SIGNUP_REWARD
      attempts: 0,
      solvedCount: 0,
      freeTicketLastUsed: null,
      referredBy: referredBy ?? null,
      joinedAt: FieldValue.serverTimestamp(),
      newbieBonusClaimed: false,
    });
  }

  return { customToken, uid: kakaoId, nickname, profileImage };
});

exports.submitAnswer = onCall({ enforceAppCheck: false, invoker: "public" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인 필요");

  const { quizId, answer } = request.data;
  if (!quizId || !answer) throw new HttpsError("invalid-argument", "quizId, answer 필요");

  const quizRef = db.collection("quizzes").doc(quizId);
  const userRef = db.collection("users").doc(uid);

  const [quizSnap, userSnap] = await Promise.all([quizRef.get(), userRef.get()]);

  if (!quizSnap.exists) throw new HttpsError("not-found", "퀴즈 없음");
  if (!userSnap.exists) throw new HttpsError("not-found", "유저 없음");

  if (quizSnap.data().solvedBy) return { result: "already_solved" };

  const acceptedAnswers = quizSnap.data().answers ?? [];
  const isCorrect = acceptedAnswers.some((a) => normalize(a) === normalize(answer));

  if (!isCorrect) {
    const ticketType = request.data.ticketType ?? "free";
    if (ticketType === "paid") {
      await Promise.all([
        quizRef.update({
          bounty: FieldValue.increment(1),
          challengers: FieldValue.increment(1),
          wrongAnswers: FieldValue.arrayUnion(uid),
          activePlayers: FieldValue.increment(-1),
        }),
        userRef.update({
          points: FieldValue.increment(1),
          attempts: FieldValue.increment(1),
        }),
      ]);
    } else {
      await Promise.all([
        quizRef.update({
          challengers: FieldValue.increment(1),
          activePlayers: FieldValue.increment(-1),
        }),
        userRef.update({ attempts: FieldValue.increment(1) }),
      ]);
    }
    return { result: "wrong" };
  }

  // 정답 처리 - 트랜잭션
  try {
    let totalGain = 0;
    let leveledUpTo = null;
    let claimNewbie = false;

    await db.runTransaction(async (tx) => {
      const [qSnap, uSnap] = await Promise.all([
        tx.get(quizRef),
        tx.get(userRef),
      ]);

      if (qSnap.data()?.solvedBy) throw new HttpsError("already-exists", "ALREADY_SOLVED");

      const u = uSnap.data();
      const now = FieldValue.serverTimestamp();
      const lockedBounty = qSnap.data().bounty;

      const oldLevel = calcLevel(u.attempts ?? 0, u.solvedCount ?? 0);
      const newLevel = calcLevel(u.attempts ?? 0, (u.solvedCount ?? 0) + 1);
      const levelBonus = getLevelBonus(u.attempts ?? 0, u.solvedCount ?? 0);

      totalGain = lockedBounty + Math.floor(lockedBounty * levelBonus);
      if (newLevel > oldLevel) leveledUpTo = newLevel;

      if (!u.newbieBonusClaimed && u.joinedAt) {
        const joinedMs = u.joinedAt.toMillis();
        const daysSince = (Date.now() - joinedMs) / 86400000;
        if (daysSince <= NEWBIE_PERIOD_DAYS) {
          totalGain += NEWBIE_FIRST_SOLVE;
          claimNewbie = true;
        }
      }

      tx.update(quizRef, {
        solvedBy: uid,
        solvedAt: now,
        activePlayers: FieldValue.increment(-1),
      });
      tx.update(userRef, {
        points: FieldValue.increment(totalGain),
        solvedCount: FieldValue.increment(1),
        ...(claimNewbie && { newbieBonusClaimed: true }),
      });

      if (u.referredBy) {
        const referrerRef = db.collection("users").doc(u.referredBy);
        let referrerGain = Math.floor(lockedBounty * REFERRAL_SHARE_RATE);
        if (claimNewbie) referrerGain += REFERRAL_REWARD;
        if (referrerGain > 0) {
          tx.update(referrerRef, { points: FieldValue.increment(referrerGain) });
        }
      }
    });

    return { result: "correct", gain: totalGain, leveledUpTo };
  } catch (e) {
    if (e.code === "already-exists" || e.message === "ALREADY_SOLVED") {
      return { result: "already_solved" };
    }
    throw new HttpsError("internal", "정답 처리 오류");
  }
});
