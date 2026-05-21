import {
  getMatchById,
  updateMatchWinner,
  getMatchByRoundAndNumber,
  createMatch,
  countIncompleteMatches,
} from "../models/Match.js";
import { getUserStats, updateUserStats } from "../models/User.js";
import { calculateNewRatings } from "../utils/eloCalculator.js";
import { logRatingChange } from "../models/Rating.js";
import { notify } from "../services/notificationService.js";
import { updateTournamentStatus } from "../models/Tournament.js";

export async function completeMatch(matchId, winnerId) {
  const match = await getMatchById(matchId);
  if (!match) throw new Error("Match not found");

  if (match.status === "COMPLETED") {
    throw new Error("Match is already completed");
  }

  const updatedMatch = await updateMatchWinner(matchId, winnerId);

  const loserId =
    match.player_1_id === winnerId ? match.player_2_id : match.player_1_id;

  // OPTIMIZATION 1: Parallel Fetching
  // Instead of waiting 450ms for winner, THEN 450ms for loser (900ms total),
  // we fire both at the exact same time using Promise.all (450ms total).
  const [winnerStats, loserStats] = await Promise.all([
    getUserStats(winnerId),
    getUserStats(loserId),
  ]);

  if (winnerStats && loserStats) {
    const eloResult = calculateNewRatings(
      winnerStats.elo_rating,
      loserStats.elo_rating
    );

    // OPTIMIZATION 2: Parallel Database Updates
    // These 4 updates are totally independent. They don't need to wait for each other.
    // Sequential time: 4 x 450ms = 1800ms
    // Parallel time: 450ms total
    await Promise.all([
      updateUserStats(winnerId, eloResult.winnerNew, true),
      updateUserStats(loserId, eloResult.loserNew, false),
      logRatingChange(
        winnerId,
        matchId,
        eloResult.winnerDiff,
        eloResult.winnerNew
      ),
      logRatingChange(
        loserId,
        matchId,
        eloResult.loserDiff,
        eloResult.loserNew
      ),
    ]);

    // OPTIMIZATION 3: "Fire and Forget" Background Tasks
    // We do NOT use 'await' here. Why make the winner stare at a loading screen
    // just because the server is saving a notification for the loser?
    // We fire the promise and let it run in the background. The .catch() prevents crashes if it fails.
    Promise.all([
      notify(
        winnerId,
        "MATCH_WON",
        "🏆 Victory!",
        `You won! Rating: ${winnerStats.elo_rating} → ${eloResult.winnerNew} (+${eloResult.winnerDiff})`,
        matchId
      ),
      notify(
        loserId,
        "MATCH_LOST",
        "Match Over",
        `Rating: ${loserStats.elo_rating} → ${eloResult.loserNew} (${eloResult.loserDiff})`,
        matchId
      ),
    ]).catch((err) => console.error("Background notification failed:", err));

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

  let nextMatch = null;

  // If the adjacent match in the same round is completed, we can create the next-round match
  if (neighborMatch && neighborMatch.status === "COMPLETED") {
    const nextRoundNumber = match.round_number + 1;
    const nextMatchNumber = Math.ceil(match.match_number / 2);

    nextMatch = await createMatch(
      match.tournament_id,
      updatedMatch.winner_id,
      neighborMatch.winner_id,
      nextRoundNumber,
      nextMatchNumber
    );
  }

  // If this was the final remaining match, the tournament is complete
  const remaining = await countIncompleteMatches(match.tournament_id);
  if (remaining === 0) {
    await updateTournamentStatus(match.tournament_id, "COMPLETED");
    return {
      message: "Match completed. Tournament completed!",
      match: updatedMatch,
      tournamentCompleted: true,
    };
  }

  if (!nextMatch) {
    return {
      message: "Match completed. Waiting for opponent in the next round.",
      match: updatedMatch,
    };
  }

  return {
    message: "Match completed AND next round created!",
    match: updatedMatch,
    nextMatch,
  };
}
