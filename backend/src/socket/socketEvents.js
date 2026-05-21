import { getRandomWord } from "../games/gameConstants.js";
import { completeMatch } from "../services/matchService.js";
import { TriviaGame } from "../games/TriviaGame.js";
import { sendMessage } from "../services/chatService.js";
import { findById } from "../models/User.js";
import { setSocketIO } from "../services/notificationService.js";

const activeGames = {};
const activeTriviaGames = {};

// Chat state — stored in memory, per socket connection
const chatUsernames = {}; // { socketId: username } — cached so we don't query DB every message
const lastChatTime = {}; // { socketId: timestamp } — for rate limiting (1 msg/sec)

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
      bracketUpdate: result.message,
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
  // Give the notification service access to io so it can push live notifications
  setSocketIO(io);

  io.on("connection", (socket) => {
    console.log(`📞 User connected: ${socket.id}`);

    // TRIVIA GAME EVENTS
    socket.on("trivia:join", (data) => {
      const { matchId, player1Id, player2Id } = data;
      const roomName = `match_${matchId}`;
      socket.join(roomName);

      if (!activeTriviaGames[matchId]) {
        activeTriviaGames[matchId] = new TriviaGame(
          matchId,
          player1Id,
          player2Id
        );

        io.to(roomName).emit("trivia:started", {
          message: "Game starting in 3 seconds!",
        });

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
      io.to(`match_${matchId}`).emit("trivia:score_update", {
        scores: game.scores,
      });

      // If both players answered, end the round early and go to the next question.
      const allAnswered = Object.values(game.hasAnsweredCurrent).every(Boolean);
      if (allAnswered) {
        if (game.timeoutId) clearTimeout(game.timeoutId);

        const correctAns =
          game.questions[game.currentQuestionIndex].correctAnswer;
        io.to(`match_${matchId}`).emit("trivia:round_over", {
          correctAnswer: correctAns,
        });

        game.nextRound();

        setTimeout(() => {
          sendNextTriviaQuestion(io, matchId, game.player1Id, game.player2Id);
        }, 1000);
      }
    });

    // ==========================================
    // QUICK DRAW EVENTS
    // ==========================================
    socket.on("join_match", (data) => {
      const { matchId, playerId, player1Id, player2Id } = data;
      const roomName = `match_${matchId}`;
      socket.join(roomName);

      if (!activeGames[matchId]) {
        activeGames[matchId] = {
          wordToDraw: getRandomWord(),
          playerScores: { player1: 0, player2: 0 },
          player1Id,
          player2Id,
          drawerId: player1Id,
        };
      }

      const game = activeGames[matchId];

      // Everyone gets a status ping
      socket.emit("game_status", { message: "Welcome to the match!" });

      // Only the drawer sees the secret word
      if (
        playerId &&
        game?.drawerId &&
        Number(playerId) === Number(game.drawerId)
      ) {
        socket.emit("game_status", {
          message: "You are the drawer. Start drawing!",
          wordToDraw: game.wordToDraw,
        });
      }
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
            bracketUpdate: result.message,
          });
          delete activeGames[matchId];
        } catch (error) {
          socket.emit("error", { message: "Failed to save match result." });
        }
      } else {
        socket.emit("wrong_guess", { message: "Try again!" });
      }
    });

    // ==========================================
    // CHAT EVENTS
    // ==========================================

    // User joins a tournament chat room
    // Different from match rooms! match_5 = 2 players playing a game
    // chat_tournament_3 = 50+ users chatting about tournament 3
    socket.on("chat:join", async (data) => {
      const { tournamentId, userId } = data;
      const roomName = `chat_tournament_${tournamentId}`;

      try {
        // Join the chat room (same socket, different room from match rooms)
        socket.join(roomName);

        // Look up username ONCE and cache it — don't query DB on every message
        const user = await findById(userId);
        chatUsernames[socket.id] = user?.username || "Anonymous";

        console.log(
          `💬 ${
            chatUsernames[socket.id]
          } joined chat for tournament ${tournamentId}`
        );

        // Notify everyone in the room
        io.to(roomName).emit("chat:user_joined", {
          username: chatUsernames[socket.id],
          message: `${chatUsernames[socket.id]} joined the chat`,
        });
      } catch (error) {
        console.error("❌ Error in chat:join socket handler:", error);
        socket.emit("chat:error", { message: "Failed to join chat room." });
      }
    });

    // User sends a chat message
    socket.on("chat:send", async (data) => {
      const { tournamentId, userId, text } = data;
      const roomName = `chat_tournament_${tournamentId}`;

      // RATE LIMIT — max 1 message per second (prevents spam)
      const now = Date.now();
      if (lastChatTime[socket.id] && now - lastChatTime[socket.id] < 1000) {
        socket.emit("chat:error", {
          message: "Slow down! 1 message per second.",
        });
        return;
      }
      lastChatTime[socket.id] = now;

      try {
        // Save to DB (service validates: not empty, max 500 chars)
        const saved = await sendMessage(tournamentId, userId, text);

        // Broadcast to EVERYONE in the chat room (including sender)
        io.to(roomName).emit("chat:message", {
          id: saved.id,
          userId: saved.user_id,
          username: chatUsernames[socket.id] || "Anonymous",
          message: saved.message,
          createdAt: saved.created_at,
        });
      } catch (error) {
        console.error("❌ Error in chat:send socket handler:", error);
        // Only the sender sees the error (empty message, too long, etc.)
        socket.emit("chat:error", { message: error.message });
      }
    });

    // ==========================================
    // NOTIFICATION EVENTS
    // ==========================================

    // User subscribes to their personal notification channel
    // Each user gets their own room: "user_7" — only they are in it
    // When notify() is called anywhere in the app, it pushes to this room
    socket.on("notifications:subscribe", (data) => {
      const { userId } = data;
      socket.join(`user_${userId}`);
      console.log(`🔔 User ${userId} subscribed to notifications`);
    });

    // ==========================================
    // DISCONNECT
    // ==========================================
    socket.on("disconnect", () => {
      // Clean up chat state for this socket
      delete chatUsernames[socket.id];
      delete lastChatTime[socket.id];
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
}
