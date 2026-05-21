import { completeMatch as completeMatchService } from '../services/matchService.js';
import { createTournament, getOrCreateBotUser, BOT_CREDENTIALS } from '../services/tournamentService.js';
import { createMatch } from '../models/Match.js';
import { updateTournamentStatus } from '../models/Tournament.js';
import { addPlayer, updatePlayerPaymentStatus } from '../models/TournamentPlayer.js';

// Handle PUT /matches/:id/complete
export async function completeMatch(req, res) {
  try {
    const matchId = req.params.id;
    
    // For Phase 2 (before we add the actual drawing game), 
    // the frontend will just tell us who won in the request body.
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({ error: "winnerId is required" });
    }

    const result = await completeMatchService(matchId, winnerId);

    // 200 OK
    res.status(200).json(result);
  } catch (error) {
    // 404 for not found, 400 for bad logic (like already completed)
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

// Handle POST /matches/vs-bot — create a quick match against a bot
export async function createVsBotMatch(req, res) {
  try {
    const userId = req.user.userId;
    const { gameType } = req.body;

    if (!gameType || !['TRIVIA', 'QUICK_DRAW'].includes(gameType)) {
      return res.status(400).json({ error: 'gameType must be TRIVIA or QUICK_DRAW' });
    }

    // Create a quick 2-player tournament
    const tournament = await createTournament(
      `Vs Bot ${gameType === 'TRIVIA' ? 'Trivia' : 'Quick Draw'}`,
      gameType,
      2,
      0,
      userId
    );

    // Get or create a bot player
    const botCred = BOT_CREDENTIALS[Math.floor(Math.random() * BOT_CREDENTIALS.length)];
    const bot = await getOrCreateBotUser(botCred);

    // Add bot to tournament
    await addPlayer(tournament.tournamentId, bot.id);
    await updatePlayerPaymentStatus(tournament.tournamentId, bot.id, 'COMPLETED');

    // Create a single match — bot is player1 (drawer for Quick Draw), human is player2 (guesser)
    const match = await createMatch(tournament.tournamentId, bot.id, userId, 1, 1);

    // Set tournament to IN_PROGRESS
    await updateTournamentStatus(tournament.tournamentId, 'IN_PROGRESS');

    res.status(201).json({
      tournamentId: tournament.tournamentId,
      matchId: match.id,
      gameType,
      botName: bot.username,
    });
  } catch (error) {
    console.error('Error creating vs bot match:', error.message);
    res.status(400).json({ error: error.message });
  }
}
