import { createTournament } from '../services/tournamentService.js';

// Handle POST /tournaments — create a new tournament
export async function create(req, res) {
  try {
    // Extract user-provided fields from request body
    const { name, game_type, max_players, entry_fee } = req.body;

    // host_id comes from JWT (middleware set req.user), NOT from req.body
    // Why? Users shouldn't be able to create tournaments as someone else!
    const host_id = req.user.userId;

    // Service handles validation + DB insert + formatting
    const result = await createTournament(name, game_type, max_players, entry_fee, host_id);

    // result is already formatted by service — just spread it into the response
    res.status(201).json({
      message: 'Tournament created',
      ...result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}