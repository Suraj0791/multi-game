// ============================================================
// TOURNAMENT API — HTTP calls for tournament data
// ============================================================
// Same pattern as authApi.js — pure HTTP, no React, no state.
//
// IMPORTANT: These functions return the DATA, not the axios response.
// We do response.data here so the components get clean data.
// Our backend wraps everything in { success: true, data: ... }

import api from "./axiosClient";

// GET /tournaments → array of tournament objects
export async function getTournaments() {
  console.log("Fetching /tournaments...");
  const response = await api.get('/tournaments')
  console.log("Response from /tournaments:", response);
  console.log("Response data from /tournaments:", response.data);
  return response.data  // backend returns raw array directly
}

// GET /tournaments/:id → single tournament object
export async function getTournamentById(id) {
  const response = await api.get(`/tournaments/${id}`);
  return response.data;
}

// POST /tournaments → create a new tournament
export async function createTournament(tournamentData) {
  const response = await api.post("/tournaments", tournamentData);
  return response.data;
}

// ============================================================
// PLAYER ENDPOINTS
// ============================================================

// GET /tournaments/:id/players → array of player objects
export async function getPlayers(tournamentId) {
  const response = await api.get(`/tournaments/${tournamentId}/players`);
  return response.data;
}

// POST /tournaments/:id/join → join a tournament
export async function joinTournament(tournamentId) {
  const response = await api.post(`/tournaments/${tournamentId}/join`);
  return response.data;
}

// DELETE /tournaments/:id/leave → leave a tournament
export async function leaveTournament(tournamentId) {
  const response = await api.delete(`/tournaments/${tournamentId}/leave`);
  return response.data;
}

// ============================================================
// TOURNAMENT ACTIONS
// ============================================================

// PUT /tournaments/:id/start → start the tournament (host only)
export async function startTournament(tournamentId) {
  const response = await api.put(`/tournaments/${tournamentId}/start`);
  return response.data;
}

// GET /tournaments/:id/bracket → bracket with rounds and matches
export async function getBracket(tournamentId) {
  const response = await api.get(`/tournaments/${tournamentId}/bracket`);
  return response.data;
}
