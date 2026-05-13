// A simple list of words for the Quick Draw game
export const WORD_POOL = [
  "APPLE",
  "BANANA",
  "ELEPHANT",
  "CAR",
  "SUN",
  "TREE",
  "HOUSE",
  "DOG",
  "CAT",
  "BIRD",
  "PIZZA",
  "GUITAR",
  "MOUNTAIN",
  "COMPUTER",
  "BICYCLE"
];

// Helper function to pick a random word
export function getRandomWord() {
  const randomIndex = Math.floor(Math.random() * WORD_POOL.length);
  return WORD_POOL[randomIndex];
}
