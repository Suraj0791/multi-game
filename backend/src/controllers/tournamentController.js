import { createTournament, getTournaments, getTournamentById } from '../services/tournamentService.js';

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

// Handle GET /tournaments/:id — view one tournament
export async function getOne(req, res) {
  try {
    // :id from URL goes into req.params (not req.body — it's a GET request)
    const tournament = await getTournamentById(req.params.id);
    res.status(200).json(tournament);
  } catch (error) {
    // "Tournament not found" → 404, other errors → 500
    const status = error.message === 'Tournament not found' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}
// Handle GET /tournaments — list all tournaments
export async function getAll(req, res) {
  try {
    const tournaments = await getTournaments();
    // List endpoint → just send the array directly
    //tournamnets is an array not object this time that why
    res.status(200).json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });  // 500 because this isn't user's fault
  }
}



import { startTournament as startService } from '../services/tournamentService.js';

// Handle PUT /tournaments/:id/start
export async function startTournament(req, res) {
  try {
    const tournamentId = req.params.id;
    const hostId = req.user.userId; // from JWT

    const result = await startService(tournamentId, hostId);

    res.status(200).json(result);
  } catch (error) {
    // 403 Forbidden if they aren't the host, 400 Bad Request for rule violations
    const status = error.message.includes('Not eligible') ? 403 : 400;
    res.status(status).json({ error: error.message });
  }
}