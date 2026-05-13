import { getRandomWord } from '../games/gameConstants.js';
import { completeMatch } from '../services/matchService.js'; 
import { TriviaGame } from '../games/TriviaGame.js';

const activeGames = {};
const activeTriviaGames = {};

async function sendNextTriviaQuestion(io, matchId, player1Id, player2Id) {
  const game = activeTriviaGames[matchId];
  if (!game) return;

  const roomName = `match_${matchId}`;

  if (game.isGameOver()) {
    const winnerId = game.getWinner(player1Id, player2Id);
    const result = await completeMatch(matchId, winnerId);

    io.to(roomName).emit("trivia:match_over", { 
      winnerId, 
      scores: game.scores,
      bracketUpdate: result.message
    });
    
    delete activeTriviaGames[matchId];
    return;
  }

  const question = game.getCurrentQuestion();
  io.to(roomName).emit("trivia:new_question", { question, timerSeconds: 10 });

  game.timeoutId = setTimeout(() => {
    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });
    
    game.nextRound();

    setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 3000);

  }, 10000);
}

export default function setupSocketEvents(io) {
  io.on("connection", (socket) => {
    console.log(`📞 User connected: ${socket.id}`);

    // TRIVIA GAME EVENTS
    socket.on("trivia:join", (data) => {
      const { matchId, player1Id, player2Id } = data;
      const roomName = `match_${matchId}`;
      socket.join(roomName); 

      if (!activeTriviaGames[matchId]) {
        activeTriviaGames[matchId] = new TriviaGame(matchId, player1Id, player2Id);
        
        io.to(roomName).emit("trivia:started", { message: "Game starting in 3 seconds!" });
        
        setTimeout(() => {
          sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
        }, 3000);
      }
    });

    socket.on("trivia:answer", (data) => {
      const { matchId, playerId, answer, timeTakenMs } = data;
      const game = activeTriviaGames[matchId];
      if (!game) return;

      const result = game.submitAnswer(playerId, answer, timeTakenMs);
      socket.emit("trivia:answer_feedback", result);
      io.to(`match_${matchId}`).emit("trivia:score_update", { scores: game.scores });
    });

    // ==========================================
    // QUICK DRAW EVENTS
    // ==========================================
    socket.on("join_match", (data) => {
      const matchId = data.matchId;
      const roomName = `match_${matchId}`;
      socket.join(roomName); 

      if (!activeGames[matchId]) {
        activeGames[matchId] = {
          wordToDraw: getRandomWord(),
          playerScores: { player1: 0, player2: 0 }
        };
      }
      io.to(roomName).emit("game_status", { message: "Welcome to the match!" });
    });

    socket.on("draw_stroke", (data) => {
      const roomName = `match_${data.matchId}`;
      socket.to(roomName).emit("receive_stroke", data);
    });

    socket.on("submit_guess", async (data) => {
      const { matchId, guess, playerId } = data;
      const game = activeGames[matchId];
      if (!game) return;

      if (guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        try {
          const result = await completeMatch(matchId, playerId);
          io.to(`match_${matchId}`).emit("match_over", { 
            winnerId: playerId, 
            word: game.wordToDraw,
            bracketUpdate: result.message 
          });
          delete activeGames[matchId];
        } catch (error) {
          socket.emit("error", { message: "Failed to save match result." });
        }
      } else {
        socket.emit("wrong_guess", { message: "Try again!" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
}
