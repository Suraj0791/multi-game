import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findByEmail } from '../models/User.js';

export async function registerUser(username, email, password) {
  // Step 1: Does this email already exist?
  const existingUser = await findByEmail(email);
  if (existingUser) {
    throw new Error('Email already exists');
  }

  // Step 2: Hash the password (10 = salt rounds, higher = slower but safer)
  const hashedPassword = await bcrypt.hash(password, 10);

  // Step 3: Save to database (model handles the SQL)
  const user = await createUser(username, email, hashedPassword);

  // Step 4: Create a JWT token (so user is logged in immediately after registering)
  const token = jwt.sign(
    { userId: user.id },           // payload — what data lives inside the token
    process.env.JWT_SECRET,         // secret key — used to sign/verify the token
    { expiresIn: '7d' }            // token expires in 7 days
  );

  // Step 5: Return what the controller needs to send back
  return { userId: user.id, token };
}
