import { 
  createTournament as insertTournament, 
  getTournaments as fetchTournaments, 
  getTournamentById as fetchTournamentById,
  updateTournamentStatus
} from '../models/Tournament.js';
import { getPlayersByTournament, addPlayer } from '../models/TournamentPlayer.js';
import { createMatch, getMatchesByTournament } from '../models/Match.js';

export async function createTournament(name, game_type, max_players, entry_fee, host_id) {
  // Validate required fields (entry_fee can be 0, so we don't check it)
  if (!name || !game_type || !max_players) {
    throw new Error('Name, game_type, and max_players are required');
  }

  const tournament = await insertTournament(name, game_type, max_players, entry_fee, host_id);

  // Auto-join the host as player 1 in the tournament
  await addPlayer(tournament.id, host_id);

  // Return only what the controller needs
  // tournament.max_players NOT tournament.maxPlayers 
  return {
    tournamentId: tournament.id,
    name: tournament.name,
    status: tournament.status,
    maxPlayers: tournament.max_players,
    createdAt: tournament.created_at,
  };
}



// Fetch all tournaments, convert each one from snake_case to camelCase
export async function getTournaments() {
  const tournaments = await fetchTournaments();

  // tournaments is an ARRAY — use .map() to convert EACH item
  return tournaments.map(t => ({
    id: t.id,
    name: t.name,
    gameType: t.game_type,
    hostName: t.host_name,       // comes from the JOIN in the model
    maxPlayers: t.max_players,
    entryFee: t.entry_fee,
    status: t.status,
    createdAt: t.created_at,
  }));
}

// Fetch one tournament by ID
export async function getTournamentById(id) {
  const t = await fetchTournamentById(id);

  // If no tournament found, throw error (controller will send 404)
  if (!t) {
    throw new Error('Tournament not found');
  }

  return {
    id: t.id,
    name: t.name,
    gameType: t.game_type,
    hostId: t.host_id,
    hostName: t.host_name,
    maxPlayers: t.max_players,
    entryFee: t.entry_fee,
    status: t.status,
    createdAt: t.created_at,
    startsAt: t.starts_at,
  };
}



export async function startTournament(id, host_id) {
  const tournament = await getTournamentById(id);
  
  if (!tournament) {
    throw new Error('Tournament does not exist');
  }

  // tournament.hostId comes from our camelCase conversion in getTournamentById
  if (host_id !== tournament.hostId) {
    throw new Error('Not eligible to start (only the host can start it)');
  }

  // Bouncer Pattern: Throw error if it's NOT in REGISTRATION
  if (tournament.status !== 'REGISTRATION') {
    throw new Error('Tournament is not in registration phase');
  }

  // Get all players (we will need them for the bracket later)
  const players = await getPlayersByTournament(id);
  
  // Need at least 2 players to start a tournament
  if (players.length < 2) {
    throw new Error('Need at least 2 players to start the tournament');
  }

  // --- BRACKET MATH ---
  // 1. Shuffle the players so it's a random draw
  const shuffledPlayers = players.sort(() => Math.random() - 0.5);

  let matchNumber = 1;
  let matchesCreated = 0;

  // 2. Loop through the players array, jumping TWO spots at a time (i += 2)
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const player1 = shuffledPlayers[i];
    const player2 = shuffledPlayers[i + 1];

    // 3. Create the match if we have 2 players
    // (If there's an odd number of players, the last player won't have an opponent right now)
    if (player1 && player2) {
      // player_id comes from the tournament_players table (which getPlayersByTournament returns)
      await createMatch(id, player1.player_id, player2.player_id, 1, matchNumber);
      matchNumber++;
      matchesCreated++;
    }
  }

  // Update status to IN_PROGRESS
  const updatedTournament = await updateTournamentStatus(id, 'IN_PROGRESS');

  return {
    message: "Tournament started successfully",
    tournamentId: updatedTournament.id,
    status: updatedTournament.status,
    bracketGenerated: true,
    matchesCreated: matchesCreated
  };
}

// Fetch all matches as a flat array
export async function getTournamentMatches(id) {
  const tournament = await getTournamentById(id);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  const matches = await getMatchesByTournament(id);

  // Convert snake_case from DB to camelCase for API
  return matches.map(m => ({
    id: m.id,
    roundNumber: m.round_number,
    matchNumber: m.match_number,
    player1Id: m.player_1_id,
    player1Name: m.player_1_name, // from JOIN
    player2Id: m.player_2_id,
    player2Name: m.player_2_name, // from JOIN
    gameType: m.game_type,        // from tournament JOIN
    status: m.status,
    winnerId: m.winner_id
  }));
}

// Group matches by round for the bracket UI
export async function getTournamentBracket(id) {
  const matches = await getTournamentMatches(id);
  
  // Create an object where keys are "round1", "round2", etc.
  const bracket = {};
  
  matches.forEach(m => {
    const roundKey = `round${m.roundNumber}`;
    if (!bracket[roundKey]) {
      bracket[roundKey] = []; // Initialize empty array if it doesn't exist yet
    }
    bracket[roundKey].push(m);
  });

  return {
    tournamentId: parseInt(id),
    rounds: bracket
  };
}