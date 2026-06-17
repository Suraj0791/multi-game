import { createTournament, getTournaments, getTournamentById } from '../services/tournamentService.js';
import cache from '../utils/cache.js';

// Handle POST /tournaments — create a new tournament
export async function create(req, res) {
  try {
    // Extract user-provided fields from request body
    const { name, game_type, max_players, entry_fee } = req.body;

    // host_id comes from JWT (middleware set req.user), NOT from req.body
    // Why? Users shouldn't be able to create tournaments as someone else!
    const host_id = req.user.userId;
    const isGuest = req.user.isGuest;

    if (isGuest && Number(entry_fee) > 0) {
      return res.status(403).json({ error: "Guest accounts cannot create paid tournaments. Please register a free account." });
    }

    // Service handles validation + DB insert + formatting
    const result = await createTournament(name, game_type, max_players, entry_fee, host_id);

    // Cache Invalidation!
    // A new tournament was just created, so the old list of tournaments in memory is wrong.
    // We MUST delete it so the next person asks the database and gets the fresh list.
    cache.del('all_tournaments');

    // result is already formatted by service — just spread it into the response
    res.status(201).json({
      message: 'Tournament created',
      ...result,
    });
  } catch (error) {
    console.error('Error creating tournament:', error.message);
    if (error.message.includes('violates') || error.message.includes('syntax')) {
      return res.status(400).json({ error: 'Database error occurred. Please ensure your session is valid.' });
    }
    res.status(400).json({ error: error.message });
  }
}

// Handle GET /tournaments/:id — view one tournament
export async function getOne(req, res) {
  try {
    const id = req.params.id;
    const cacheKey = `tournament_${id}`;
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const tournament = await getTournamentById(id);
    cache.set(cacheKey, tournament, 10); // 10s TTL
    
    res.status(200).json(tournament);
  } catch (error) {
    const status = error.message === 'Tournament not found' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}
// Handle GET /tournaments — list all tournaments
export async function getAll(req, res) {
  try {
    // 1. Check Cache First (The fast path: 1ms)
    const cachedTournaments = cache.get('all_tournaments');
    if (cachedTournaments) {
      console.log('⚡ CACHE HIT: Returning tournaments from memory');
      return res.status(200).json(cachedTournaments);
    }

    // 2. Cache Miss (The slow path: 450ms)
    console.log('🐢 CACHE MISS: Fetching tournaments from Neon Database');
    const tournaments = await getTournaments();
    
    // 3. Save to Cache for the next 30 seconds
    cache.set('all_tournaments', tournaments);

    res.status(200).json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });  // 500 because this isn't user's fault
  }
}



import { startTournament as startService, getTournamentMatches, getTournamentBracket } from '../services/tournamentService.js';

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

// Handle GET /tournaments/:id/matches
export async function getMatches(req, res) {
  try {
    const id = req.params.id;
    const cacheKey = `matches_${id}`;
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const matches = await getTournamentMatches(id);
    cache.set(cacheKey, matches, 10); // 10s TTL
    
    res.status(200).json(matches);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}

// Handle GET /tournaments/:id/bracket
export async function getBracket(req, res) {
  try {
    const id = req.params.id;
    const cacheKey = `bracket_${id}`;
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const bracket = await getTournamentBracket(id);
    cache.set(cacheKey, bracket, 10); // 10s TTL
    
    res.status(200).json(bracket);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}