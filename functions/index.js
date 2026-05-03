const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onValueDeleted } = require("firebase-functions/v2/database");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");
const { initializeApp } = require("firebase-admin/app");
const https = require("https");

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "asia-northeast3" });

const db = getFirestore();

const normalize = (s) => s.replace(/\s/g, "").toLowerCase();

const getKstDate = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

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
  const { accessToken } = request.data;
  if (!accessToken) throw new HttpsError("invalid-argument", "accessToken 필요");

  const profile = await getKakaoProfile(accessToken);
  if (!profile.id) throw new HttpsError("unauthenticated", "카카오 인증 실패");

  const kakaoId = String(profile.id);
  const nickname = profile.kakao_account?.profile?.nickname ?? "유저";
  const profileImage = profile.kakao_account?.profile?.profile_image_url ?? null;

  // Firebase Custom Token 발급 (uid = 카카오 ID)
  const customToken = await getAuth().createCustomToken(kakaoId);

  return { customToken, uid: kakaoId, nickname, profileImage };
});

exports.submitAnswer = onCall({ enforceAppCheck: false, invoker: "public" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인 필요");

  const { quizId, answer } = request.data;
  if (!quizId || !answer) throw new HttpsError("invalid-argument", "quizId, answer 필요");

  // ticketType은 'free' | 'paid' 만 허용
  const ticketType = request.data.ticketType === "paid" ? "paid" : "free";

  const quizRef = db.collection("quizzes").doc(quizId);
  const userRef = db.collection("users").doc(uid);

  const [quizSnap, userSnap] = await Promise.all([quizRef.get(), userRef.get()]);

  if (!quizSnap.exists) throw new HttpsError("not-found", "퀴즈 없음");
  if (!userSnap.exists) throw new HttpsError("not-found", "유저 없음");

  if (quizSnap.data().solvedBy) return { result: "already_solved" };

  // free 티켓 서버 검증
  if (ticketType === "free") {
    const today = getKstDate();
    const lastUsed = userSnap.data().freeTicketLastUsed ?? null;
    if (lastUsed === today) throw new HttpsError("failed-precondition", "FREE_TICKET_USED");
  }

  const acceptedAnswers = quizSnap.data().answers ?? [];
  const isCorrect = acceptedAnswers.some((a) => normalize(a) === normalize(answer));

  if (!isCorrect) {
    const today = getKstDate();
    const statsRef = db.collection("dailyStats").doc(today);
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
        statsRef.set({ wrongPaid: FieldValue.increment(1) }, { merge: true }),
      ]);
    } else {
      await Promise.all([
        quizRef.update({
          challengers: FieldValue.increment(1),
          activePlayers: FieldValue.increment(-1),
        }),
        userRef.update({ attempts: FieldValue.increment(1), freeTicketLastUsed: today }),
        statsRef.set({ wrongFree: FieldValue.increment(1) }, { merge: true }),
      ]);
    }
    return { result: "wrong" };
  }

  // 정답 처리 - 트랜잭션
  try {
    let totalGain = 0;
    let leveledUpTo = null;
    let claimNewbie = false;
    const today = getKstDate();
    const statsRef = db.collection("dailyStats").doc(today);

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
        ...(ticketType === "free" && { freeTicketLastUsed: today }),
      });

      if (u.referredBy) {
        const referrerRef = db.collection("users").doc(u.referredBy);
        let referrerGain = Math.floor(lockedBounty * REFERRAL_SHARE_RATE);
        if (claimNewbie) referrerGain += REFERRAL_REWARD;
        if (referrerGain > 0) {
          tx.update(referrerRef, { points: FieldValue.increment(referrerGain) });
        }
      }

      tx.set(statsRef, {
        correct: FieldValue.increment(1),
        bountyPaid: FieldValue.increment(totalGain),
      }, { merge: true });
    });

    return { result: "correct", gain: totalGain, leveledUpTo };
  } catch (e) {
    if (e.code === "already-exists" || e.message === "ALREADY_SOLVED") {
      return { result: "already_solved" };
    }
    throw new HttpsError("internal", "정답 처리 오류");
  }
});

// 새 퀴즈 등록 시 전체 유저 FCM 푸시
exports.onQuizCreated = onDocumentCreated(
  { document: "quizzes/{quizId}", region: "asia-northeast3" },
  async (event) => {
    const quiz = event.data?.data();
    if (!quiz) return;

    // publishAt이 있으면 예약 공개라서 즉시 알림 X
    if (quiz.publishAt) return;

    const hint = quiz.hints?.[0] ?? "새 문제";
    const bounty = quiz.bounty?.toLocaleString() ?? "?";

    const usersSnap = await db.collection("users")
      .where("fcmToken", "!=", null)
      .get();

    const tokens = usersSnap.docs.map((d) => d.data().fcmToken).filter(Boolean);
    if (tokens.length === 0) return;

    // 500개씩 배치 전송
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    await Promise.all(
      chunks.map((batch) =>
        getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: {
            title: `새 퀴즈 등록! 현상금 ${bounty}QW`,
            body: `힌트: ${hint} — 지금 도전하세요!`,
          },
          webpush: {
            notification: { icon: "/logo1.png" },
            fcmOptions: { link: "/" },
          },
        })
      )
    );
  }
);

const VALID_AMOUNTS = [5000, 10000, 50000, 100000];

// 상품권 재고 조회 (코드 미포함, 공개용)
exports.getGiftStock = onCall({ enforceAppCheck: false, invoker: "public" }, async () => {
  const snap = await db.collection("giftCards").where("isUsed", "==", false).get();
  const counts = {};
  snap.docs.forEach((d) => {
    const amt = d.data().amount;
    counts[amt] = (counts[amt] ?? 0) + 1;
  });
  return counts;
});

// 환전 신청 — 서버 트랜잭션으로 원자적 처리
exports.requestExchange = onCall({ enforceAppCheck: false, invoker: "public" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "LOGIN_REQUIRED");

  const amount = Number(request.data?.amount);
  if (!VALID_AMOUNTS.includes(amount)) throw new HttpsError("invalid-argument", "INVALID_AMOUNT");

  const userRef = db.collection("users").doc(uid);

  // 트랜잭션 외부에서 사용 가능한 상품권 조회 (쿼리는 트랜잭션 내 불가)
  const available = await db.collection("giftCards")
    .where("amount", "==", amount)
    .where("isUsed", "==", false)
    .limit(1)
    .get();

  if (available.empty) throw new HttpsError("unavailable", "OUT_OF_STOCK");

  const giftRef = available.docs[0].ref;
  const exchangeRef = db.collection("exchanges").doc();

  try {
    await db.runTransaction(async (tx) => {
      const [userSnap, giftSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(giftRef),
      ]);

      if (!userSnap.exists) throw new HttpsError("not-found", "USER_NOT_FOUND");

      const points = userSnap.data().points ?? 0;
      if (points < amount) throw new HttpsError("failed-precondition", "INSUFFICIENT_POINTS");

      // 트랜잭션 내 재확인 — 동시 요청으로 이미 발급됐을 경우 차단
      if (giftSnap.data().isUsed) throw new HttpsError("unavailable", "OUT_OF_STOCK");

      const code = giftSnap.data().code;
      const now = FieldValue.serverTimestamp();

      tx.update(userRef, { points: FieldValue.increment(-amount) });
      tx.update(giftRef, { isUsed: true, assignedTo: uid, assignedAt: now });
      tx.set(exchangeRef, {
        uid,
        amount,
        code,
        status: "done",
        requestedAt: now,
        completedAt: now,
      });
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", "EXCHANGE_FAILED");
  }

  return { success: true };
});

// RTDB presence 삭제 시 activePlayers 감소
exports.onPresenceDeleted = onValueDeleted(
  { ref: "presence/{quizId}/{uid}", instance: "qwiz-67f42-default-rtdb", region: "asia-southeast1" },
  async (event) => {
    const { quizId } = event.params;
    const quizRef = db.collection("quizzes").doc(quizId);
    const snap = await quizRef.get();
    if (!snap.exists || snap.data()?.solvedBy) return;
    await quizRef.update({ activePlayers: FieldValue.increment(-1) });
  }
);
