import { Router } from 'express';
import { create, getAll, getOne, startTournament } from '../controllers/tournamentController.js';
import { join, players, leave } from '../controllers/playerController.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Tournament CRUD
router.post('/', authenticate, create);       // Create tournament (auth required)
router.get('/', getAll);                       // List all tournaments (public)
router.get('/:id', getOne);                    // View one tournament (public)
router.put('/:id/start', authenticate, startTournament); // Start tournament (auth required)

// Player actions (all need :id for tournament)
router.post('/:id/join', authenticate, join);       // Join tournament (auth required)
router.get('/:id/players', players);                // List players (public)
router.delete('/:id/leave', authenticate, leave);   // Leave tournament (auth required)

export default router;
