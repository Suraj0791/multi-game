import { getMatchById, updateMatchWinner, getMatchByRoundAndNumber, createMatch } from '../models/Match.js';

export async function completeMatch(matchId, winnerId) {
  // 1. Fetch the match
  const match = await getMatchById(matchId);
  if (!match) throw new Error('Match not found');
  
  if (match.status === 'COMPLETED') {
    throw new Error('Match is already completed');
  }

  // 2. Update the match to COMPLETED and set the winner
  const updatedMatch = await updateMatchWinner( matchId, winnerId);

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
