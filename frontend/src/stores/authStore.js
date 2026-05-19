// ============================================================
// AUTH STORE — Zustand global state
// ============================================================
//
// This is the frontend equivalent of req.user in Express.
// When a user logs in, we save their token + userId here.
// Any component in the app can read this to check "am I logged in?"
//
// WHY Zustand and not Redux?
// Zustand is 1 file. Redux is 5 files + 3 concepts (actions, reducers, dispatch).
// For storing just a token and userId, Zustand is the right tool.
//
// WHY not just useState in App.jsx?
// Because deeply nested components (like Navbar → UserMenu) would need
// the token passed down through 5 levels of props. Zustand lets ANY
// component grab the auth state directly without prop drilling.
// ============================================================

import { create } from 'zustand'

const useAuthStore = create((set) => ({
  // STATE — the data we store
  token: localStorage.getItem('token') || null,
  userId: localStorage.getItem('userId') || null,

  // DERIVED — computed from state (not stored separately)
  // We don't store isLoggedIn — we derive it from token !== null
  // This avoids the bug where token is null but isLoggedIn is somehow true

  // ACTION — login: save token to store + localStorage
  // Why localStorage? So the user stays logged in after page refresh.
  // Zustand state disappears on refresh. localStorage persists.
  login: (token, userId) => {
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
