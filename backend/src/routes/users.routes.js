import { Router } from 'express';
import { fetchUserBadges, fetchRatingHistory, fetchUserProfile } from '../controllers/userController.js';
import { report, blockUserHandler, unblockUserHandler, getBlockedList } from '../controllers/moderationController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// My blocked list — MUST come before /:id routes
router.get('/blocked', authenticate, getBlockedList);

// Public profile data
router.get('/:id/badges', fetchUserBadges);
router.get('/:id/rating-history', fetchRatingHistory);
router.get('/:id', fetchUserProfile);

// Moderation — report and block users (auth required)
router.post('/:id/report', authenticate, validate([
  { field: 'reason', required: true, type: 'string', minLength: 10, maxLength: 500 }
]), report);

router.post('/:id/block', authenticate, blockUserHandler);
router.delete('/:id/block', authenticate, unblockUserHandler);

export default router;
