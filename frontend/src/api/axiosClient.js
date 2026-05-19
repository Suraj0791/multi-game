// ============================================================
// AXIOS CLIENT — Base HTTP client for talking to our backend
// ============================================================
// Backend parallel: This is like database.js (connection pool).
// database.js creates ONE pool shared by all models.
// axiosClient creates ONE axios instance shared by all API files.
//
// KEY FEATURE: Interceptors
// - Request interceptor: auto-attaches JWT token to every request
// - Response interceptor: auto-logouts if backend returns 401
// ============================================================

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

// Before EVERY request: attach the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// After EVERY response: if 401, force logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
