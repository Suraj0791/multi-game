
import { createTournament as insertTournament ,getTournaments as fetchTournaments } from '../models/Tournament.js';

export async function createTournament(name, game_type, max_players, entry_fee, host_id) {
  // Validate required fields (entry_fee can be 0, so we don't check it)
  if (!name || !game_type || !max_players) {
    throw new Error('Name, game_type, and max_players are required');
  }

  
  const tournament = await insertTournament(name, game_type, max_players, entry_fee, host_id);

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