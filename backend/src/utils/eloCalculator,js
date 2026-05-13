// src/utils/eloCalculator.js

// The K-factor determines how aggressively scores change.
// 32 is standard for new/average players.
const K_FACTOR = 32;

export function calculateNewRatings(winnerRating, loserRating) {
  // 1. Calculate Expected Win Probability (between 0.0 and 1.0)
  // This is the crazy math formula used by Chess!
  const winnerExpected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const loserExpected = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  // 2. Calculate the new ratings
  // Formula: OldRating + K * (ActualScore - ExpectedScore)
  // Actual score for winner is 1, loser is 0.
  const newWinnerRating = Math.round(winnerRating + K_FACTOR * (1 - winnerExpected));
  const newLoserRating = Math.round(loserRating + K_FACTOR * (0 - loserExpected));

  // 3. Return the exact amount they gained/lost (e.g. +14, -14)
  return {
    winnerNew: newWinnerRating,
    loserNew: newLoserRating,
    winnerDiff: newWinnerRating - winnerRating,
    loserDiff: newLoserRating - loserRating
  };
}
