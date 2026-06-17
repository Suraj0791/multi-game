import { joinTournament, listPlayers, leaveTournament } from '../services/playerService.js';
import { getTournamentById } from '../services/tournamentService.js';

// POST /tournaments/:id/join — join a tournament
export async function join(req, res) {
  try {
    const tournamentId = req.params.id;
    const userId = req.user.userId;
    const isGuest = req.user.isGuest;

    if (isGuest) {
      // Check if it's a paid tournament
      const tournament = await getTournamentById(tournamentId);
      if (tournament && Number(tournament.entryFee) > 0) {
        return res.status(403).json({ error: "Guest accounts cannot join paid tournaments. Please register a free account." });
      }
    }

    // tournament ID from URL params, player ID from JWT
    const result = await joinTournament(tournamentId, userId);
    res.status(201).json(result);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

// GET /tournaments/:id/players — list players in a tournament
export async function players(req, res) {
  try {
    const result = await listPlayers(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}

// DELETE /tournaments/:id/leave — leave a tournament
export async function leave(req, res) {
  try {
    const result = await leaveTournament(req.params.id, req.user.userId);
    res.status(200).json(result);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}
