import { completeMatch as completeMatchService } from '../services/matchService.js';
import { createTournament } from '../services/tournamentService.js';
import { createMatch } from '../models/Match.js';
import { updateTournamentStatus } from '../models/Tournament.js';
import { addPlayer, updatePlayerPaymentStatus } from '../models/TournamentPlayer.js';
import { guestLogin as guestLoginService } from '../services/userService.js';

// Handle PUT /matches/:id/complete
export async function completeMatch(req, res) {
  try {
    const matchId = req.params.id;
    
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({ error: "winnerId is required" });
    }

    const result = await completeMatchService(matchId, winnerId);

    // 200 OK
    res.status(200).json(result);
  } catch (error) {
    // 404 for not found, 400 for bad logic (like already completed)
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

import jwt from 'jsonwebtoken';

// Handle POST /matches/quick — public quick match (no auth needed)
// Creates a 2-player room. Player 1 gets the link, shares it with Player 2.
// Both join via the normal tournament flow — no bots involved.
export async function createQuickMatch(req, res) {
  try {
    const { gameType } = req.body;
    if (!gameType || !['TRIVIA', 'QUICK_DRAW'].includes(gameType)) {
      return res.status(400).json({ error: 'gameType must be TRIVIA or QUICK_DRAW' });
    }

    let hostId;
    let token = null;

    // Check if the user is already logged in
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const userToken = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
        hostId = decoded.userId;
      } catch (err) {
        // Invalid token, fallback to creating a guest
      }
    }

    // If not logged in or invalid token, create a temp guest user
    if (!hostId) {
      const guest = await guestLoginService();
      hostId = guest.userId;
      token = guest.token;
    }

    // Create a 2-player tournament — host (Player 1) is auto-added by createTournament
    const tournament = await createTournament(
      `Quick ${gameType === 'TRIVIA' ? 'Trivia' : 'Quick Draw'}`,
      gameType, 2, 0, hostId
    );

    res.status(201).json({
      tournamentId: tournament.tournamentId,
      gameType,
      token, // undefined/null if they used their own token
      userId: hostId,
      message: 'Share the tournament link with Player 2 to join',
    });
  } catch (error) {
    console.error('Error creating quick match:', error.message);
    res.status(400).json({ error: error.message });
  }
}


