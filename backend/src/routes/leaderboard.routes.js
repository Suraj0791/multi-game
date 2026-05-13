import { Router } from 'express';
import { fetchLeaderboard } from '../controllers/leaderboardController.js';

const router = Router();

// GET /leaderboard
router.get('/', fetchLeaderboard);

export default router;
