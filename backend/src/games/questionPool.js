// src/games/questionPool.js

export const TRIVIA_QUESTIONS = [
  {
    id: 1,
    category: "Movies",
    difficulty: "Easy",
    question: "Who directed the movie 'Inception'?",
    options: ["Steven Spielberg", "Christopher Nolan", "Quentin Tarantino", "Martin Scorsese"],
    correctAnswer: "Christopher Nolan"
  },
  {
    id: 2,
    category: "Tech",
    difficulty: "Easy",
    question: "What does HTML stand for?",
    options: [
      "Hyper Text Markup Language",
      "High Tech Modern Language",
      "Hyperlink and Text Markup Language",
      "Home Tool Markup Language"
    ],
    correctAnswer: "Hyper Text Markup Language"
  },
  {
    id: 3,
    category: "Geography",
    difficulty: "Medium",
    question: "What is the capital city of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correctAnswer: "Canberra"
  },
  {
    id: 4,
    category: "Science",
    difficulty: "Hard",
    question: "What is the most abundant gas in Earth's atmosphere?",
    options: ["Oxygen", "Carbon Dioxide", "Hydrogen", "Nitrogen"],
    correctAnswer: "Nitrogen"
  },
  {
    id: 5,
    category: "Sports",
    difficulty: "Medium",
    question: "How many players are on a standard soccer team on the field?",
    options: ["9", "10", "11", "12"],
    correctAnswer: "11"
  }
];

// Helper function to grab random questions
export function getRandomQuestions(amount = 10) {
  // Shuffle the array and return the requested amount
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, amount);
}
