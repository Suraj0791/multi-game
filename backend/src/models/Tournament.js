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
