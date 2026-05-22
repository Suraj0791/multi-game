import api from './axiosClient'

// POST /auth/register → { userId, token, message }
export async function registerUser(username, email, password) {
  const response = await api.post('/auth/register', { username, email, password })
  return response.data
}

// POST /auth/login → { userId, token, message }
export async function loginUser(email, password) {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

// POST /auth/guest → { userId, token, username, message }
export async function guestLogin() {
  const response = await api.post('/auth/guest')
  return response.data
}

