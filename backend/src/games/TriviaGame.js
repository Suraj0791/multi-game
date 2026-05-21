import { getRandomQuestions } from "./questionPool.js";

export class TriviaGame {
  constructor(matchId, player1Id, player2Id) {
    this.matchId = matchId;
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    this.questions = getRandomQuestions(5);
    this.currentQuestionIndex = 0;

    this.scores = {
      [player1Id]: 0,
      [player2Id]: 0,
    };

    this.hasAnsweredCurrent = {
      [player1Id]: false,
      [player2Id]: false,
    };
    this.roundEnded = false;
  }

  getCurrentQuestion() {
    const q = this.questions[this.currentQuestionIndex];
    return {
      id: q.id,
      text: q.question,     // frontend expects 'text', not 'question'
      options: q.options,
      category: q.category,
    };
  }

  submitAnswer(playerId, answer, timeTakenMs) {
    if (this.hasAnsweredCurrent[playerId]) return false;

    this.hasAnsweredCurrent[playerId] = true;
    const currentQ = this.questions[this.currentQuestionIndex];

    if (answer === currentQ.correctAnswer) {
      const timeBonus = Math.max(0, 10000 - timeTakenMs);
      const points = 10 + Math.floor((timeBonus / 10000) * 90);

      this.scores[playerId] += points;
      return { correct: true, points, correctAnswer: currentQ.correctAnswer };
    }

    return { correct: false, points: 0, correctAnswer: currentQ.correctAnswer };
  }

  nextRound() {
    this.currentQuestionIndex++;
    for (let key in this.hasAnsweredCurrent) {
      this.hasAnsweredCurrent[key] = false;
    }
  }

  isGameOver() {
    return this.currentQuestionIndex >= this.questions.length;
  }

  getWinner(player1Id, player2Id) {
    const p1Score = this.scores[player1Id];
    const p2Score = this.scores[player2Id];

    if (p1Score > p2Score) return player1Id;
    if (p2Score > p1Score) return player2Id;
    // Tiebreaker: deterministic winner to avoid null winnerId
    // (null would break match completion + bracket progression)
    return player1Id;
  }
}
