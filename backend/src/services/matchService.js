import { getMatchById, updateMatchWinner, getMatchByRoundAndNumber, createMatch } from '../models/Match.js';
import { getUserStats, updateUserStats } from '../models/User.js'; // IMPORT THIS!
import { calculateNewRatings } from '../utils/eloCalculator.js'; // IMPORT THIS!

export async function completeMatch(matchId, winnerId) {
  // 1. Fetch the match
  const match = await getMatchById(matchId);
  if (!match) throw new Error('Match not found');
  
  if (match.status === 'COMPLETED') {
    throw new Error('Match is already completed');
  }

  // 2. Update the match to COMPLETED and set the winner
  const updatedMatch = await updateMatchWinner( matchId, winnerId);

  // --- ELO RATING LOGIC ---
  // Figure out who the loser is.
  const loserId = (match.player_1_id === winnerId) ? match.player_2_id : match.player_1_id;

  // Fetch their current ratings from the database
  const winnerStats = await getUserStats(winnerId);
  const loserStats = await getUserStats(loserId);

  if (winnerStats && loserStats) {
      // Run the Chess Math!
      const eloResult = calculateNewRatings(winnerStats.elo_rating, loserStats.elo_rating);

      // Save the new ratings to the database (and add a win/loss)
      await updateUserStats(winnerId, eloResult.winnerNew, true);
      await updateUserStats(loserId, eloResult.loserNew, false);
      
      // We can attach the ELO change to the returned match object so the frontend can show "+15"
      updatedMatch.eloChange = eloResult;
  }
  // -------------------------

  // 3. Find the neighbor match
  let neighborMatchNumber;
  if (match.match_number % 2 === 1) { 
      // If odd (e.g. Match 1), neighbor is Match 2
      neighborMatchNumber = match.match_number + 1;
  } else { 
      // If even (e.g. Match 2), neighbor is Match 1
      neighborMatchNumber = match.match_number - 1;
  }

  // Fetch the neighbor from the DB
  // Need to pass: tournamentId, roundNumber, and the neighbor's match number we just calculated
  const neighborMatch = await getMatchByRoundAndNumber(
    match.tournament_id,      // The tournament this match belongs to
    match.round_number,       // The round this match is currently in
    neighborMatchNumber       // The neighbor's number we calculated above!
);


  // 4. Dependency Resolution Check!
  // If the neighbor match doesn't exist OR isn't completed yet, we STOP here.
  if (!neighborMatch || neighborMatch.status !== 'COMPLETED') {
      return { 
          message: "Match completed. Waiting for opponent in the next round.",
          match: updatedMatch 
      };
  }

  // 5. If we reach here, BOTH matches are completed! We can create the Next Round!
  
  // The next round is current round + 1
  const nextRoundNumber = match.round_number + 1;
  
  // The next match number is half of the current (Match 1 & 2 -> Match 1. Match 3 & 4 -> Match 2)
  const nextMatchNumber = Math.ceil(match.match_number / 2);

  // We need to create a new match between OUR winner and the NEIGHBOR'S winner
  const nextMatch = await createMatch(
      match.tournament_id, 
      updatedMatch.winner_id,       // Our winner
      neighborMatch.winner_id,      // The neighbor's winner
      nextRoundNumber, 
      nextMatchNumber
  );

  return {
      message: "Match completed AND next round created!",
      match: updatedMatch,
      nextMatch: nextMatch
  };
}
