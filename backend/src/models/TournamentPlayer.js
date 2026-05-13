import { query } from '../config/database.js';

// Add a player to a tournament
// INSERT into the junction table (connects users ↔ tournaments)
export async function addPlayer(tournamentId, playerId) {
  const result = await query(
    `INSERT INTO tournament_players (tournament_id, player_id)
     VALUES ($1, $2)
     RETURNING *`,
    [tournamentId, playerId]
  );
  return result.rows[0];
}

// Check if a player is already in a tournament
// Used before joining to prevent duplicates
export async function findPlayer(tournamentId, playerId) {
  const result = await query(
    `SELECT * FROM tournament_players
     WHERE tournament_id = $1 AND player_id = $2`,
    [tournamentId, playerId]
  );
  return result.rows[0];  // returns the row if found, undefined if not
}

// Get all players in a tournament (with their usernames)
// JOIN with users because tournament_players only has player_id (a number)
export async function getPlayersByTournament(tournamentId) {
  const result = await query(
    `SELECT tp.*, u.username, u.elo_rating
     FROM tournament_players tp
     JOIN users u ON tp.player_id = u.id
     WHERE tp.tournament_id = $1
     ORDER BY tp.joined_at ASC`,
    [tournamentId]
  );
  return result.rows;  // array of all players
}

// Remove a player from a tournament
// DELETE removes the junction row — doesn't delete the user or tournament
export async function removePlayer(tournamentId, playerId) {
  const result = await query(
    `DELETE FROM tournament_players
     WHERE tournament_id = $1 AND player_id = $2
     RETURNING *`,
    [tournamentId, playerId]
  );
  return result.rows[0];  // returns deleted row, or undefined if nothing was deleted
}

// Count players in a tournament (for checking if full)
export async function countPlayers(tournamentId) {
  const result = await query(
    `SELECT COUNT(*) AS count FROM tournament_players
     WHERE tournament_id = $1`,
    [tournamentId]
  );
  return parseInt(result.rows[0].count);  // COUNT returns string, parseInt converts to number
}
