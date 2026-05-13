import { Router } from 'express';
import { fetchUserBadges, fetchRatingHistory } from '../controllers/userController.js';

const router = Router();

// GET /users/:id/badges
router.get('/:id/badges', fetchUserBadges);

// GET /users/:id/rating-history
router.get('/:id/rating-history', fetchRatingHistory);

export default router;
