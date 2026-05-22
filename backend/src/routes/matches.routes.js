import { Router } from 'express';
import { completeMatch, createQuickMatch } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// POST /matches/quick — public quick match (NO auth required)
router.post('/quick', createQuickMatch);

// PUT /matches/:id/complete
router.put('/:id/complete', authenticate, completeMatch);

export default router;
