// src/games/TriviaGame.js
import { getRandomQuestions } from './questionPool.js';

export class TriviaGame {
  constructor(matchId, player1Id, player2Id) {
    this.matchId = matchId;
    
    // Grab 5 random questions for this match
    this.questions = getRandomQuestions(5); 
    this.currentQuestionIndex = 0;
    
    // The Scoreboard
    this.scores = {
      [player1Id]: 0,
      [player2Id]: 0
    };
    
    // To prevent a player from answering the same question twice
    this.hasAnsweredCurrent = {
      [player1Id]: false,
      [player2Id]: false
    };
  }

  // Gets the current question to send to the frontend (HIDES THE ANSWER!)
  getCurrentQuestion() {
    const q = this.questions[this.currentQuestionIndex];
    return {
      id: q.id,
      question: q.question,
      options: q.options,
      category: q.category
    };
  }

  // When a player guesses
  submitAnswer(playerId, answer, timeTakenMs) {
    // If they already answered this round, ignore
    if (this.hasAnsweredCurrent[playerId]) return false;
    
    this.hasAnsweredCurrent[playerId] = true;
    const currentQ = this.questions[this.currentQuestionIndex];

    // If correct, calculate points based on speed (max 100, min 10)
    if (answer === currentQ.correctAnswer) {
      // 10 seconds max. The faster you are, the more points you get.
      const timeBonus = Math.max(0, 10000 - timeTakenMs); 
      const points = 10 + Math.floor((timeBonus / 10000) * 90);
      
      this.scores[playerId] += points;
      return { correct: true, pointsEarned: points };
    }

    return { correct: false, pointsEarned: 0 };
  }

  // Move to the next round
  nextRound() {
    this.currentQuestionIndex++;
    // Reset the answering locks for the new round
    for (let key in this.hasAnsweredCurrent) {
      this.hasAnsweredCurrent[key] = false;
    }
  }

  isGameOver() {
    return this.currentQuestionIndex >= this.questions.length;
  }

  // Determine who won at the end
  getWinner(player1Id, player2Id) {
    const p1Score = this.scores[player1Id];
    const p2Score = this.scores[player2Id];
    
    if (p1Score > p2Score) return player1Id;
    if (p2Score > p1Score) return player2Id;
    return null; // Tie
  }
}
