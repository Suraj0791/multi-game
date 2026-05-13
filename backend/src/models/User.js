import { query } from '../config/database.js';

export async function createUser(username, email, hashedPassword) {
  const result = await query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
    [username, email, hashedPassword]
  );
  return result.rows[0];
}

export async function findByEmail(email) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function getUserStats(userId) {
  const result = await query(
    `SELECT elo_rating, total_wins, total_losses 
     FROM users 
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function updateUserStats(userId, newRating, isWinner) {
  const winAdd = isWinner ? 1 : 0;
  const lossAdd = isWinner ? 0 : 1;

  const result = await query(
    `UPDATE users 
     SET elo_rating = $2, 
         total_wins = total_wins + $3, 
         total_losses = total_losses + $4
     WHERE id = $1
     RETURNING elo_rating, total_wins, total_losses`,
    [userId, newRating, winAdd, lossAdd]
  );
  return result.rows[0];
}

export async function getTopPlayers(limit = 10) {
  const result = await query(
    `SELECT id, username, avatar_url, elo_rating, total_wins, total_losses 
     FROM users 
     ORDER BY elo_rating DESC, total_wins DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
