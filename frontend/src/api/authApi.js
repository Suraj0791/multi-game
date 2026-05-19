// AUTH API — HTTP calls for login and register
// Backend parallel: This is like a Model file. It ONLY does the network call.
// No React, no state, no UI. Just sends data and returns the response.

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

