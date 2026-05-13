import { Router } from 'express';
import { completeMatch } from '../controllers/matchController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// PUT /matches/:id/complete
// We use authenticate because only logged-in users who played the match should be able to complete it
// (We will add strict player verification later, for now just basic auth)
router.put('/:id/complete', authenticate, completeMatch);

export default router;
