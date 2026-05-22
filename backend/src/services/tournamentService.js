import bcrypt from 'bcryptjs';
import {
  createTournament as insertTournament,
  getTournaments as fetchTournaments,
  getTournamentById as fetchTournamentById,
  updateTournamentStatus
} from '../models/Tournament.js';
import { getPlayersByTournament, addPlayer, updatePlayerPaymentStatus } from '../models/TournamentPlayer.js';
import { createMatch, getMatchesByTournament, updateMatchWinner } from '../models/Match.js';
import { createUser, findByEmail } from '../models/User.js';

export async function createTournament(name, game_type, max_players, entry_fee, host_id) {
  // Validate required fields (entry_fee can be 0, so we don't check it)
  if (!name || !game_type || !max_players) {
    throw new Error('Name, game_type, and max_players are required');
  }

  const tournament = await insertTournament(name, game_type, max_players, entry_fee, host_id);

  // Auto-join the host as player 1 in the tournament
  await addPlayer(tournament.id, host_id);
  // Auto-mark the host as COMPLETED upon auto-joining (exempt from entry fee)
  await updatePlayerPaymentStatus(tournament.id, host_id, 'COMPLETED');

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

  // Verify all slots are filled
  if (players.length !== tournament.maxPlayers) {
    throw new Error(`Tournament needs ${tournament.maxPlayers} players, but only ${players.length} joined`);
  }

  // Need at least 2 players to start a tournament
  if (players.length < 2) {
    throw new Error('Need at least 2 players to start the tournament');
  }

  // Check if player count is a power of 2
  if ((players.length & (players.length - 1)) !== 0) {
    throw new Error('Tournament player count must be a power of 2 to generate brackets cleanly (e.g., 2, 4, 8, 16)');
  }

  // If entryFee > 0, check if all players have completed their payments
  if (tournament.entryFee > 0) {
    const unpaidPlayers = players.filter(p => p.payment_status !== 'COMPLETED');
    if (unpaidPlayers.length > 0) {
      throw new Error('Cannot start tournament: Some players have not completed their entry fee payments');
    }
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
export const BOT_CREDENTIALS = [
  { username: 'Bot_Alice', email: 'bot_alice@tourneyhub.demo' },
  { username: 'Bot_Bob', email: 'bot_bob@tourneyhub.demo' },
  { username: 'Bot_Charlie', email: 'bot_charlie@tourneyhub.demo' },
];

export async function getOrCreateBotUser({ username, email }) {
  const existing = await findByEmail(email);
  if (existing) return existing;
  const hashedPassword = await bcrypt.hash('demo_bot_pass', 10);
  return await createUser(username, email, hashedPassword);
}

export async function createDemoTournament(hostId) {
  const name = 'Demo Tournament';
  const gameType = 'TRIVIA';
  const maxPlayers = 4;
  const entryFee = 0;

  const tournament = await insertTournament(name, gameType, maxPlayers, entryFee, hostId);

  // Add Host
  await addPlayer(tournament.id, hostId);
  await updatePlayerPaymentStatus(tournament.id, hostId, 'COMPLETED');

  // Add Bots
  const bots = await Promise.all(BOT_CREDENTIALS.map(getOrCreateBotUser));
  for (const bot of bots) {
    await addPlayer(tournament.id, bot.id);
    await updatePlayerPaymentStatus(tournament.id, bot.id, 'COMPLETED');
  }

  const players = await getPlayersByTournament(tournament.id);
  const hostAsPlayer = players.find(p => Number(p.player_id) === Number(hostId));
  const botsInTournament = players.filter(p => Number(p.player_id) !== Number(hostId));

  // Match 1: Host vs Bot Alice
  const match1 = await createMatch(tournament.id, hostAsPlayer.player_id, botsInTournament[0].player_id, 1, 1);
  // Match 2: Bot Bob vs Bot Charlie
  const match2 = await createMatch(tournament.id, botsInTournament[1].player_id, botsInTournament[2].player_id, 1, 2);

  await updateTournamentStatus(tournament.id, 'IN_PROGRESS');

  // ONLY complete the bot vs bot match so the bracket looks alive.
  // Leave match1 alone so the user can actually play it!
  await updateMatchWinner(match2.id, botsInTournament[1].player_id);

  // Return the matchId so the frontend can navigate directly into the game!
  return { 
    tournamentId: tournament.id, 
    status: 'IN_PROGRESS', 
    gameType,
    firstMatchId: match1.id // Crucial for auto-navigation
  };
}

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