// USER API — leaderboard + profile data
import api from './axiosClient'

// GET /leaderboard → ranked array of { userId, username, eloRating, wins, losses }
export async function getLeaderboard() {
  const response = await api.get('/leaderboard')
  return response.data.data
}

// GET /users/:id → user profile { id, username, eloRating, gamesPlayed, ... }
export async function getUserProfile(userId) {
  const response = await api.get(`/users/${userId}`)
  return response.data.data
}
