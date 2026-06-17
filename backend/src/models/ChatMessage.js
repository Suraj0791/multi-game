import { query } from '../config/database.js';

// Function 1: Save a new chat message
// Accepts: tournamentId, userId, message text
// Returns: the saved message row (id, tournament_id, user_id, message, created_at)
export async function saveMessage(tournamentId, userId, message) {
  const result = await query(
    `INSERT INTO chat_messages (tournament_id, user_id, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [tournamentId, userId, message]
  );
  return result.rows[0];
}

// Function 2: Get message history for a tournament
// JOIN with users table to get the username for each message
// Returns: array of messages (newest last — ready for chat display)
export async function getMessageHistory(tournamentId, limit = 50) {
  const result = await query(
    `SELECT cm.id, cm.user_id, u.username, u.is_guest, cm.message, cm.created_at
     FROM chat_messages cm
     JOIN users u ON cm.user_id = u.id
     WHERE cm.tournament_id = $1
     ORDER BY cm.created_at DESC
     LIMIT $2`,
    [tournamentId, limit]
  );
  // Reverse: DB returns newest-first (DESC), but chat displays oldest-first (top to bottom)
  return result.rows.reverse();
}
