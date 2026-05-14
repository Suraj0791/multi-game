import { getTournamentById } from '../models/Tournament.js';

// Authorization middleware — checks if the logged-in user is the HOST of this tournament
// Use on routes where only the host should act (start tournament, cancel, etc.)
//
// Usage: router.put('/:id/start', authenticate, isHost, startTournament);
//
// This runs AFTER authenticate (so req.user.userId exists)
// and BEFORE the controller (so bad actors are rejected)

export function isHost(req, res, next) {
  const tournamentId = req.params.id;
  const userId = req.user.userId;

  getTournamentById(tournamentId).then(tournament => {
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (tournament.host_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only the tournament host can do this' });
    }

    // Attach tournament to request so controller doesn't need to fetch it again
    req.tournament = tournament;
    next();
  }).catch(next);
}
