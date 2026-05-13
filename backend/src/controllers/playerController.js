import { joinTournament, listPlayers, leaveTournament } from '../services/playerService.js';

// POST /tournaments/:id/join — join a tournament
export async function join(req, res) {
  try {
    // tournament ID from URL params, player ID from JWT
    const result = await joinTournament(req.params.id, req.user.userId);
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
