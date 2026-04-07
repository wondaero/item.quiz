import { create } from 'zustand'
import { DEV_ACCESS } from '../constants'

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem('qwiz_user')) } catch { return null }
})()

const calcIsAdmin = (user) =>
  DEV_ACCESS.전체접근 || DEV_ACCESS.admin ||
  (!import.meta.env.VITE_ADMIN_UID || user?.uid === import.meta.env.VITE_ADMIN_UID)

const useAuthStore = create((set) => ({
  user: savedUser,
  isAdmin: calcIsAdmin(savedUser),
  setUser: (user) => {
    localStorage.setItem('qwiz_user', JSON.stringify(user))
    set({ user, isAdmin: calcIsAdmin(user) })
  },
  logout: () => {
    localStorage.removeItem('qwiz_user')
    set({ user: null, isAdmin: DEV_ACCESS.전체접근 || DEV_ACCESS.admin })
  },
}))

export default useAuthStore
