// What goes where:
import { query } from '../config/database.js';    // the phone line to Neon

// Function 1: Insert a new user
export async function createUser(username, email, hashedPassword) {
  const result = await query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
    [username, email, hashedPassword]
  );
  return result.rows[0];   // result.rows is an array, [0] gives us the first (only) row
}

// Function 2: Find a user by email
export async function findByEmail(email) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];   // returns the user object, or undefined if not found
}
// Fetch a user's current rating and stats
export async function getUserStats(userId) {
  const result = await query(
    `SELECT elo_rating, total_wins, total_losses 
     FROM users 
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0];
}

// Update a user's rating and add a win/loss
export async function updateUserStats(userId, newRating, isWinner) {
  // If isWinner is true, we add 1 to wins. If false, we add 1 to losses.
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
