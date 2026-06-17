import { create } from 'zustand'

const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

const getValidAuth = () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  if (!token || !userId || userId === 'null' || userId === 'undefined') {
    return { token: null, userId: null };
  }
  
  const decoded = parseJwt(token);
  // If token is expired or invalid, purge it immediately
  if (!decoded || !decoded.exp || decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    return { token: null, userId: null };
  }
  
  return { token, userId };
};

const initialAuth = getValidAuth();

const useAuthStore = create((set) => ({
  // STATE — the data we store (validated on boot)
  token: initialAuth.token,
  userId: initialAuth.userId,

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
