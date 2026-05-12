// What goes where:
import { query } from '../config/database.js';    // the phone line to Neon

// Function 1: Insert a new user
async function createUser(username, email, hashedPassword) {
  const result = await query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
    [username, email, hashedPassword]
  );
  return result.rows[0];   // result.rows is an array, [0] gives us the first (only) row
}

// Function 2: Find a user by email
async function findByEmail(email) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];   // returns the user object, or undefined if not found
}
