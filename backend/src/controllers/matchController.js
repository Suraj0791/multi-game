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
    
    // For Phase 2 (before we add the actual drawing game), 
    // the frontend will just tell us who won in the request body.
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

// Handle POST /matches/quick — public quick match (no auth needed)
// Creates a 2-player room. Player 1 gets the link, shares it with Player 2.
// Both join via the normal tournament flow — no bots involved.
export async function createQuickMatch(req, res) {
  try {
    const { gameType } = req.body;
    if (!gameType || !['TRIVIA', 'QUICK_DRAW'].includes(gameType)) {
      return res.status(400).json({ error: 'gameType must be TRIVIA or QUICK_DRAW' });
    }

    // Create a temp guest user + JWT
    const guest = await guestLoginService();

    // Create a 2-player tournament — host (Player 1) is auto-added by createTournament
    // Player 2 joins later via the invite link
    const tournament = await createTournament(
      `Quick ${gameType === 'TRIVIA' ? 'Trivia' : 'Quick Draw'}`,
      gameType, 2, 0, guest.userId
    );

    res.status(201).json({
      tournamentId: tournament.tournamentId,
      gameType,
      token: guest.token,
      userId: guest.userId,
      message: 'Share the tournament link with Player 2 to join',
    });
  } catch (error) {
    console.error('Error creating quick match:', error.message);
    res.status(400).json({ error: error.message });
  }
}


