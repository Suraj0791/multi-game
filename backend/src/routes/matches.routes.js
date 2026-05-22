import { Router } from 'express';
import { completeMatch, createVsBotMatch, createQuickMatch } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// POST /matches/quick — public quick match (NO auth required)
router.post('/quick', createQuickMatch);

// POST /matches/vs-bot — create a quick match against a bot opponent
router.post('/vs-bot', authenticate, createVsBotMatch);

// PUT /matches/:id/complete
router.put('/:id/complete', authenticate, completeMatch);

export default router;
