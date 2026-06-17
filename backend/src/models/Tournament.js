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
    `SELECT t.*, u.username AS host_name, u.is_guest AS host_is_guest,
            (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS player_count
     FROM tournaments t
     JOIN users u ON t.host_id = u.id
     ORDER BY t.created_at DESC`
  );
  return result.rows;
}

// Find one tournament by ID (with host name)
// Same JOIN as above, but WHERE filters to one specific tournament
export async function getTournamentById(id) {
  const result = await query(
    `SELECT t.*, u.username AS host_name, u.is_guest AS host_is_guest
     FROM tournaments t
     JOIN users u ON t.host_id = u.id
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0];
}



export async function updateTournamentStatus(id, newStatus) {
  const result = await query(
    `UPDATE tournaments 
     SET status = $2 
     WHERE id = $1 
     RETURNING *`,
    [id, newStatus]
  );
  return result.rows[0];
}

