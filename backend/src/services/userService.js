import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findByEmail, updateLastLogin } from '../models/User.js';

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



export async function loginUser(email, password) {
  // Step 1: Find user by email
  const user = await findByEmail(email);

  // Step 2: If no user found, reject
  // SECURITY: We say "Invalid credentials" not "Email not found"
  // Why? If we say "Email not found", an attacker learns which emails exist in our system.
  // Generic message protects our users' privacy.
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Step 3: Compare the password they typed with the hash in the database
  // bcrypt.compare("123456", "$2a$10$xJk...") → true or false
  // It hashes "123456" the same way and checks if the hashes match.
  // We NEVER store or compare plain passwords — only hashes.
  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    throw new Error('Invalid credentials');  // same message — don't reveal WHICH part was wrong
  }

  // Step 4: Password correct! Create JWT token
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Step 5: Update last login time
  await updateLastLogin(user.id);

  // Step 6: Return what the controller needs
  return { userId: user.id, token };
}

export async function guestLogin() {
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const username = `Player_${randomSuffix}`;
  const email = `guest_${randomSuffix}_${Date.now()}@tourneyhub.guest`;
  const randomPassword = Math.random().toString(36).substring(2, 10);
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  const user = await createUser(username, email, hashedPassword, true);

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { userId: user.id, token, username: user.username };
}

import { getUserStats } from '../models/User.js';
import { getRankBadge, getAchievementBadges } from '../rating/badges.js';

export async function getUserBadges(userId) {
  const stats = await getUserStats(userId);
  if (!stats) throw new Error("User not found");

  const rank = getRankBadge(stats.elo_rating);
  const achievements = getAchievementBadges(stats.total_wins);

  return { rank, achievements };
}