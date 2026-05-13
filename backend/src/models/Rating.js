import { query } from '../config/database.js';

/*
  IMPORTANT: You need to run this SQL in your Neon Dashboard to create the table!
  
  CREATE TABLE rating_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    rating_change INTEGER NOT NULL,
    new_rating INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
*/

// Save a rating change after a match
export async function logRatingChange(userId, matchId, ratingChange, newRating) {
  const result = await query(
    `INSERT INTO rating_history (user_id, match_id, rating_change, new_rating) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [userId, matchId, ratingChange, newRating]
  );
  return result.rows[0];
}

// Get the last 20 rating changes for a graph/chart
export async function getRatingHistory(userId) {
  const result = await query(
    `SELECT rating_change, new_rating, created_at 
     FROM rating_history 
     WHERE user_id = $1 
     ORDER BY created_at ASC 
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}
