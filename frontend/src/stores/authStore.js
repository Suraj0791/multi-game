import { create } from 'zustand'

const useAuthStore = create((set) => ({
  // STATE — the data we store
  token: localStorage.getItem('token') || null,
  userId: (() => {
    const stored = localStorage.getItem('userId');
    return (stored && stored !== 'null' && stored !== 'undefined') ? stored : null;
  })(),

  // DERIVED — computed from state (not stored separately)
  // We don't store isLoggedIn — we derive it from token !== null
  // This avoids the bug where token is null but isLoggedIn is somehow true

  // ACTION — login: save token to store + localStorage
  // Why localStorage? So the user stays logged in after page refresh.
  // Zustand state disappears on refresh. localStorage persists.
  login: (token, userId) => {
    if (!token || !userId || String(userId) === 'null' || String(userId) === 'undefined') {
      return;
    }
    localStorage.setItem('token', token)
    localStorage.setItem('userId', String(userId))
    set({ token, userId: String(userId) })
  },

  // ACTION — logout: clear everything
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    set({ token: null, userId: null })
  },
}))

export default useAuthStore
