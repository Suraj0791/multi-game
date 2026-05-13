import { registerUser } from '../services/userService.js';
import { getUserBadges } from '../services/userService.js';
import { getRatingHistory } from '../models/Rating.js';

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;
    const result = await registerUser(username, email, password);
    res.status(201).json({
      userId: result.userId,
      token: result.token,
      message: 'User registered'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function fetchUserBadges(req, res) {
  try {
    const userId = req.params.id;
    const badges = await getUserBadges(userId);
    res.status(200).json(badges);
  } catch (error) {
    console.error("Error fetching badges:", error);
    res.status(404).json({ error: error.message });
  }
}

export async function fetchRatingHistory(req, res) {
  try {
    const userId = req.params.id;
    const history = await getRatingHistory(userId);
    res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch rating history" });
  }
}
