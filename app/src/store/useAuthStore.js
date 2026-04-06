import { create } from 'zustand'

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem('qwiz_user')) } catch { return null }
})()

const useAuthStore = create((set) => ({
  user: savedUser,
  isAdmin: savedUser?.uid === import.meta.env.VITE_ADMIN_UID,
  setUser: (user) => {
    localStorage.setItem('qwiz_user', JSON.stringify(user))
    set({ user, isAdmin: user?.uid === import.meta.env.VITE_ADMIN_UID })
  },
  logout: () => {
    localStorage.removeItem('qwiz_user')
    set({ user: null, isAdmin: false })
  },
}))

export default useAuthStore
