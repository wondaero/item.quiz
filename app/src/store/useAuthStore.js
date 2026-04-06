import { create } from 'zustand'

const useAuthStore = create((set) => ({
  // TODO: 개발용 임시 유저 - 배포 전 null로 되돌릴 것
  user: { uid: 'dev-user', displayName: '테스트유저' },
  isAdmin: true,
  setUser: (user) => set({
    user,
    isAdmin: user?.uid === import.meta.env.VITE_ADMIN_UID
  }),
  logout: () => set({ user: null, isAdmin: false }),
}))

export default useAuthStore
