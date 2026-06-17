import { addPlayer, findPlayer, getPlayersByTournament, removePlayer, countPlayers, updatePlayerPaymentStatus } from '../models/TournamentPlayer.js';
import { getTournamentById as fetchTournamentById } from '../models/Tournament.js';
import { startTournament, getTournamentMatches } from './tournamentService.js';
import { getIO } from '../socket/socketEvents.js';
import { pool } from '../config/database.js';


// JOIN a tournament
// Business rules: tournament must exist, be in REGISTRATION, not full, player not already in
export async function joinTournament(tournamentId, playerId) {
  const client = await pool.connect();
  let tournament;

  try {
    // Open a transaction
    await client.query('BEGIN');

    // Rule 1: Lock the tournament row to serialize concurrent join attempts (Race Condition Fix)
    const tRes = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [tournamentId]);
    if (tRes.rows.length === 0) {
      throw new Error('Tournament not found');
    }
    tournament = tRes.rows[0];

    // Rule 2: Is it still accepting players?
    if (tournament.status !== 'REGISTRATION') {
      throw new Error('Tournament is not accepting players');
    }

    // Rule 3: Is the tournament full? (Checking under the FOR UPDATE lock)
    const pCountRes = await client.query('SELECT COUNT(*) as count FROM tournament_players WHERE tournament_id = $1', [tournamentId]);
    const playerCount = parseInt(pCountRes.rows[0].count, 10);
    if (playerCount >= tournament.max_players) {
      throw new Error('Tournament is full');
    }

    // Rule 4: Has this player already joined?
    const existingRes = await client.query('SELECT * FROM tournament_players WHERE tournament_id = $1 AND player_id = $2', [tournamentId, playerId]);
    if (existingRes.rows.length > 0) {
      throw new Error('Already joined this tournament');
    }

    // All checks passed — insert the player
    await client.query('INSERT INTO tournament_players (tournament_id, player_id) VALUES ($1, $2)', [tournamentId, playerId]);

    // If the tournament is free, auto-complete the player's payment status
    if (Number(tournament.entry_fee) === 0) {
      await client.query('UPDATE tournament_players SET payment_status = $1 WHERE tournament_id = $2 AND player_id = $3', ['COMPLETED', tournamentId, playerId]);
    }

    // Commit the transaction, releasing the lock
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Emit tournament update socket event
  const io = getIO();
  if (io) {
    io.to(`tournament_${tournamentId}`).emit("tournament:updated");
  }

  // --- AUTO START QUICK MATCH ---
  // If this is a 2-player tournament and is in registration, auto-start it when full
  const finalPlayerCount = await countPlayers(tournamentId);
  if (tournament.max_players === 2 && finalPlayerCount === 2) {
    try {
      console.log(`⚡ Auto-starting quick match tournament ${tournamentId}...`);
      const started = await startTournament(tournamentId, tournament.host_id);
      if (started.bracketGenerated) {
        const matches = await getTournamentMatches(tournamentId);
        if (matches && matches.length > 0) {
          const matchId = matches[0].id;
          const io = getIO();
          if (io) {
            console.log(`📢 Broadcasting tournament:started for tournament ${tournamentId} with match ${matchId}`);
            io.to(`tournament_${tournamentId}`).emit("tournament:started", {
              tournamentId: Number(tournamentId),
              matchId: Number(matchId)
            });
          }
        }
      }
    } catch (err) {
      console.error(`❌ Failed to auto-start quick match tournament ${tournamentId}:`, err.message);
    }
  }

  return {
    tournamentId: tournament.id,
    joined: true,
    message: 'Successfully joined tournament',
  };
}

// LIST players in a tournament
export async function listPlayers(tournamentId) {
  // Check tournament exists first
  const tournament = await fetchTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  const players = await getPlayersByTournament(tournamentId);

  return players.map(p => ({
    playerId: p.player_id,
    username: p.username,
    eloRating: p.elo_rating,
    isGuest: p.is_guest || false,
    joinedAt: p.joined_at,
    paymentStatus: p.payment_status,
  }));
}

// LEAVE a tournament
// Business rules: tournament must be in REGISTRATION (can't leave mid-game)
export async function leaveTournament(tournamentId, playerId) {
  const tournament = await fetchTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Can only leave during registration — once started, you're committed
  if (tournament.status !== 'REGISTRATION') {
    throw new Error('Cannot leave a tournament that already started');
  }

  // Prevent host from leaving
  if (Number(playerId) === Number(tournament.host_id)) {
    throw new Error('Host cannot leave the tournament');
  }

  // Check player is actually in this tournament
  const existing = await findPlayer(tournamentId, playerId);
  if (!existing) {
    throw new Error('You are not in this tournament');
  }

  await removePlayer(tournamentId, playerId);

  // Emit tournament update socket event
  const io = getIO();
  if (io) {
    io.to(`tournament_${tournamentId}`).emit("tournament:updated");
  }

  return { left: true, message: 'Left tournament' };
}