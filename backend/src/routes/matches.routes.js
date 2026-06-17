import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { completeMatch, createQuickMatch } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Stricter rate limit for quick match creation (20 per 15 min per IP)
const quickMatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  message: { success: false, error: 'Too many quick match attempts. Try again later.' },
  skip: () => process.env.NODE_ENV !== 'production',
});

// POST /matches/quick — public quick match (NO auth required)
router.post('/quick', quickMatchLimiter, createQuickMatch);

// PUT /matches/:id/complete
router.put('/:id/complete', authenticate, completeMatch);

export default router;
