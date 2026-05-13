import { getRandomWord } from '../games/gameConstants.js';
import { completeMatch } from '../services/matchService.js'; 
import { TriviaGame } from '../games/TriviaGame.js'; // IMPORT REFEREE

const activeGames = {}; // For Quick Draw
const activeTriviaGames = {}; // For Trivia

// Helper function to run the 10-second Trivia loop
async function sendNextTriviaQuestion(io, matchId, player1Id, player2Id) {
  const game = activeTriviaGames[matchId];
  if (!game) return;

  const roomName = `match_${matchId}`;

  // Check if game is over (all 5 questions asked)
  if (game.isGameOver()) {
    const winnerId = game.getWinner(player1Id, player2Id);
    
    // 1. Tell Database game is over (Applies ELO and brackets!)
    const result = await completeMatch(matchId, winnerId);

    // 2. Shout final results
    io.to(roomName).emit("trivia:match_over", { 
      winnerId, 
      scores: game.scores,
      bracketUpdate: result.message
    });
    
    // 3. Fire the referee
    delete activeTriviaGames[matchId];
    return;
  }

  // If game is not over, send the next question!
  const question = game.getCurrentQuestion();
  io.to(roomName).emit("trivia:new_question", { question, timerSeconds: 10 });

  // Start the 10 second countdown bomb!
  game.timeoutId = setTimeout(() => {
    // 10 seconds passed! Shout the correct answer.
    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });
    
    // Move referee to next round
    game.nextRound();

    // Wait 3 seconds, then ask the next question!
    setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 3000);

  }, 10000); // 10,000 milliseconds = 10 seconds
}


export default function setupSocketEvents(io) {
  io.on("connection", (socket) => {
    console.log(`📞 User connected: ${socket.id}`);

    // ==========================================
    // TRIVIA GAME EVENTS
    // ==========================================
    
    socket.on("trivia:join", (data) => {
      const { matchId, player1Id, player2Id } = data;
      const roomName = `match_${matchId}`;
      socket.join(roomName); 

      // If game doesn't exist, hire the referee!
      if (!activeTriviaGames[matchId]) {
        activeTriviaGames[matchId] = new TriviaGame(matchId, player1Id, player2Id);
        
        io.to(roomName).emit("trivia:started", { message: "Game starting in 3 seconds!" });
        
        // Wait 3 seconds, then start the loop
        setTimeout(() => {
          sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
        }, 3000);
      }
    });

    socket.on("trivia:answer", (data) => {
      const { matchId, playerId, answer, timeTakenMs } = data;
      const game = activeTriviaGames[matchId];
      if (!game) return;

      // Ask the referee to check the answer
      const result = game.submitAnswer(playerId, answer, timeTakenMs);
      
      // Whisper to the player if they were right/wrong
      socket.emit("trivia:answer_feedback", result);
      
      // Shout the updated scores to everyone so the UI updates
      io.to(`match_${matchId}`).emit("trivia:score_update", { scores: game.scores });
    });


    // ==========================================
    // QUICK DRAW EVENTS (From Phase 2)
    // ==========================================
    socket.on("join_match", (data) => {
      const matchId = data.matchId;
      const roomName = `match_${matchId}`;
      socket.join(roomName); 
      console.log(`User ${socket.id} joined room: ${roomName}`);

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
