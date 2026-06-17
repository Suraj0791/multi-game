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
  let isGuest = localStorage.getItem('isGuest');

  if (!token || !userId || userId === 'null' || userId === 'undefined') {
    return { token: null, userId: null, isGuest: null };
  }

  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp || decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('isGuest');
    return { token: null, userId: null, isGuest: null };
  }

  // Backward compat: if isGuest not in localStorage, decode from token
  if (isGuest === null) {
    isGuest = decoded.isGuest !== undefined ? String(decoded.isGuest) : 'false';
  }

  return { token, userId, isGuest: isGuest === 'true' };
};

const initialAuth = getValidAuth();

const useAuthStore = create((set) => ({
  token: initialAuth.token,
  userId: initialAuth.userId,
  isGuest: initialAuth.isGuest,

  login: (token, userId, isGuest) => {
    if (!token || !userId || String(userId) === 'null' || String(userId) === 'undefined') {
      return;
    }
    const decoded = parseJwt(token);
    const guest = isGuest !== undefined ? isGuest : (decoded?.isGuest || false);
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('isGuest', String(guest));
    set({ token, userId: String(userId), isGuest: guest });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('isGuest');
    set({ token: null, userId: null, isGuest: null });
  },
}))

export default useAuthStore
