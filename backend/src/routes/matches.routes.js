import { Router } from 'express';
import { completeMatch, createVsBotMatch } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// POST /matches/vs-bot — create a quick match against a bot opponent
router.post('/vs-bot', authenticate, createVsBotMatch);

// PUT /matches/:id/complete
// We use authenticate because only logged-in users who played the match should be able to complete it
// (We will add strict player verification later, for now just basic auth)
router.put('/:id/complete', authenticate, completeMatch);

export default router;
