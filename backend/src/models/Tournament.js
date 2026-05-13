import { query } from '../config/database.js';

// Insert a new tournament into the database
// Returns: the full tournament row (id, name, status, etc.)
export async function createTournament(name, game_type, max_players, entry_fee, host_id) {
  const result = await query(
    `INSERT INTO tournaments (name, game_type, max_players, entry_fee, host_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, game_type, max_players, entry_fee, host_id]
  );
  return result.rows[0];
}


// List all tournaments with host username
// JOIN connects tournaments with users table to get the host's name
export async function getTournaments() {
  const result = await query(
    `SELECT t.*, u.username AS host_name
     FROM tournaments t
     JOIN users u ON t.host_id = u.id
     ORDER BY t.created_at DESC`
  );
  return result.rows;
}
