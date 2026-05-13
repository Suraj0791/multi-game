import { getMatchById, updateMatchWinner, getMatchByRoundAndNumber, createMatch } from '../models/Match.js';
import { getUserStats, updateUserStats } from '../models/User.js';
import { calculateNewRatings } from '../utils/eloCalculator.js';
import { logRatingChange } from '../models/Rating.js';
import { notify } from '../services/notificationService.js';

export async function completeMatch(matchId, winnerId) {
  const match = await getMatchById(matchId);
  if (!match) throw new Error('Match not found');
  
  if (match.status === 'COMPLETED') {
    throw new Error('Match is already completed');
  }

  const updatedMatch = await updateMatchWinner(matchId, winnerId);

  const loserId = (match.player_1_id === winnerId) ? match.player_2_id : match.player_1_id;
  const winnerStats = await getUserStats(winnerId);
  const loserStats = await getUserStats(loserId);

  if (winnerStats && loserStats) {
      const eloResult = calculateNewRatings(winnerStats.elo_rating, loserStats.elo_rating);
      
      // Update Users Table
      await updateUserStats(winnerId, eloResult.winnerNew, true);
      await updateUserStats(loserId, eloResult.loserNew, false);
      
      // Log it to the History Table for the graphs!
      await logRatingChange(winnerId, matchId, eloResult.winnerDiff, eloResult.winnerNew);
      await logRatingChange(loserId, matchId, eloResult.loserDiff, eloResult.loserNew);

      // Notify both players about the result
      await notify(winnerId, 'MATCH_WON', '🏆 Victory!',
        `You won! Rating: ${winnerStats.elo_rating} → ${eloResult.winnerNew} (+${eloResult.winnerDiff})`, matchId);
      await notify(loserId, 'MATCH_LOST', 'Match Over',
        `Rating: ${loserStats.elo_rating} → ${eloResult.loserNew} (${eloResult.loserDiff})`, matchId);

      updatedMatch.eloChange = eloResult;
  }

  let neighborMatchNumber;
  if (match.match_number % 2 === 1) { 
      neighborMatchNumber = match.match_number + 1;
  } else { 
      neighborMatchNumber = match.match_number - 1;
  }

  const neighborMatch = await getMatchByRoundAndNumber(
    match.tournament_id,      
    match.round_number,       
    neighborMatchNumber       
  );

  if (!neighborMatch || neighborMatch.status !== 'COMPLETED') {
      return { 
          message: "Match completed. Waiting for opponent in the next round.",
          match: updatedMatch 
      };
  }

  const nextRoundNumber = match.round_number + 1;
  const nextMatchNumber = Math.ceil(match.match_number / 2);

  const nextMatch = await createMatch(
      match.tournament_id, 
      updatedMatch.winner_id,       
      neighborMatch.winner_id,      
      nextRoundNumber, 
      nextMatchNumber
  );

  return {
      message: "Match completed AND next round created!",
      match: updatedMatch,
      nextMatch: nextMatch
  };
}
