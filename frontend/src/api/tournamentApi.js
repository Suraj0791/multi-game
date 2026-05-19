// ============================================================
// TOURNAMENT API — HTTP calls for tournament data
// ============================================================
// Same pattern as authApi.js — pure HTTP, no React, no state.
//
// IMPORTANT: These functions return the DATA, not the axios response.
// We do response.data here so the components get clean data.
// Our backend wraps everything in { success: true, data: ... }

import api from './axiosClient'

// GET /tournaments → array of tournament objects
export async function getTournaments() {
  const response = await api.get('/tournaments')
  return response.data.data  // response.data = { success, data: [...] }
}

// GET /tournaments/:id → single tournament object
export async function getTournamentById(id) {
  const response = await api.get(`/tournaments/${id}`)
  return response.data.data
}

// POST /tournaments → create a new tournament
export async function createTournament(tournamentData) {
  const response = await api.post('/tournaments', tournamentData)
  return response.data
}
