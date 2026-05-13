const K_FACTOR = 32;

export function calculateNewRatings(winnerRating, loserRating) {
  const winnerExpected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const loserExpected = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  const newWinnerRating = Math.round(winnerRating + K_FACTOR * (1 - winnerExpected));
  const newLoserRating = Math.round(loserRating + K_FACTOR * (0 - loserExpected));

  return {
    winnerNew: newWinnerRating,
    loserNew: newLoserRating,
    winnerDiff: newWinnerRating - winnerRating,
    loserDiff: newLoserRating - loserRating
  };
}
