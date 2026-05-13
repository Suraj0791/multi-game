import { query } from '../config/database.js';

// Create a new match in the database
export async function createMatch(tournamentId, player1Id, player2Id, roundNumber, matchNumber) {
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
            u2.username AS player_2_name
     FROM matches m
     LEFT JOIN users u1 ON m.player_1_id = u1.id
     LEFT JOIN users u2 ON m.player_2_id = u2.id
     WHERE m.tournament_id = $1
     ORDER BY m.round_number ASC, m.match_number ASC`,
    [tournamentId]
  );
  return result.rows;
}
