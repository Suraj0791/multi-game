import { query } from "../config/database.js";

// Create a new match in the database
export async function createMatch(
  tournamentId,
  player1Id,
  player2Id,
  roundNumber,
  matchNumber
) {
  const result = await query(
    `INSERT INTO matches (tournament_id, player_1_id, player_2_id, round_number, match_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tournamentId, player1Id, player2Id, roundNumber, matchNumber]
  );
  return result.rows[0];
}

// Get all matches for a tournament, including the names of the players
export async function getMatchesByTournament(tournamentId) {
  const result = await query(
    `SELECT m.*, 
            u1.username AS player_1_name,
            u2.username AS player_2_name,
            t.game_type
     FROM matches m
     LEFT JOIN users u1 ON m.player_1_id = u1.id
     LEFT JOIN users u2 ON m.player_2_id = u2.id
     LEFT JOIN tournaments t ON m.tournament_id = t.id
     WHERE m.tournament_id = $1
     ORDER BY m.round_number ASC, m.match_number ASC`,
    [tournamentId]
  );
  return result.rows;
}

// Get ONE match by its ID (includes player emails for bot detection)
export async function getMatchById(matchId) {
  const result = await query(
    `SELECT m.*, u1.email AS player_1_email, u2.email AS player_2_email
     FROM matches m
     LEFT JOIN users u1 ON m.player_1_id = u1.id
     LEFT JOIN users u2 ON m.player_2_id = u2.id
     WHERE m.id = $1`,
    [matchId]
  );
  return result.rows[0];
}

// Update a match to be completed and set the winner
export async function updateMatchWinner(matchId, winnerId) {
  const result = await query(
    `UPDATE matches 
     SET status = 'COMPLETED', winner_id = $2
     WHERE id = $1
     RETURNING *`,
    [matchId, winnerId]
  );
  return result.rows[0];
}

// Find a specific match by its tournament, round, and match number
// (Used to find the neighbor match!)
export async function getMatchByRoundAndNumber(
  tournamentId,
  roundNumber,
  matchNumber
) {
  const result = await query(
    `SELECT * FROM matches 
     WHERE tournament_id = $1 AND round_number = $2 AND match_number = $3`,
    [tournamentId, roundNumber, matchNumber]
  );
  return result.rows[0];
}

// Count how many matches are still not completed in a tournament
export async function countIncompleteMatches(tournamentId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM matches
     WHERE tournament_id = $1 AND status <> 'COMPLETED'`,
    [tournamentId]
  );
  return result.rows[0]?.count ?? 0;
}
