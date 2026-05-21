import { getRandomWord } from "../games/gameConstants.js";
import { completeMatch } from "../services/matchService.js";
import { getMatchById } from "../models/Match.js";
import { TriviaGame } from "../games/TriviaGame.js";
import { sendMessage } from "../services/chatService.js";
import { findById } from "../models/User.js";
import { setSocketIO } from "../services/notificationService.js";
import {
  isBotByEmail, checkBotOpponent, pickBotTriviaAnswer,
  botQuickDrawGuess, generateBotStroke
} from "../games/BotPlayer.js";

const activeGames = {};
const activeTriviaGames = {};
const announcedChatUsers = {}; // { roomName: Set(userIds) }

// Chat state — stored in memory, per socket connection
const chatUsernames = {}; // { socketId: username } — cached so we don't query DB every message
const lastChatTime = {}; // { socketId: timestamp } — for rate limiting (1 msg/sec)
const socketJoinedRooms = {}; // { socketId: { roomName: true } }

function checkTriviaBothAnswered(io, matchId, player1Id, player2Id, roomName) {
  const game = activeTriviaGames[matchId];
  if (!game || game.roundEnded) return;

  const allAnswered = Object.values(game.hasAnsweredCurrent).every(Boolean);
  if (allAnswered) {
    game.roundEnded = true;
    if (game.timeoutId) {
      clearTimeout(game.timeoutId);
      game.timeoutId = null;
    }
    if (game.botTimeoutId) {
      clearTimeout(game.botTimeoutId);
      game.botTimeoutId = null;
    }

    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });

    game.nextRound();

    game.timeoutId = setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 1000);
  }
}

async function sendNextTriviaQuestion(io, matchId, player1Id, player2Id) {
  const game = activeTriviaGames[matchId];
  if (!game) return;

  const roomName = `match_${matchId}`;

  if (game.isGameOver()) {
    if (game.timeoutId) {
      clearTimeout(game.timeoutId);
      game.timeoutId = null;
    }
    delete activeTriviaGames[matchId];

    const winnerId = game.getWinner(player1Id, player2Id);
    try {
      const result = await completeMatch(matchId, winnerId);

      io.to(roomName).emit("trivia:match_over", {
        winnerId,
        scores: game.scores,
        bracketUpdate: result.message,
      });
    } catch (err) {
      console.error("Error completing trivia match:", err);
    }
    return;
  }

  const question = game.getCurrentQuestion();
  game.questionStartTime = Date.now();
  game.roundEnded = false;
  io.to(roomName).emit("trivia:new_question", { question, timerSeconds: 10 });

  // If one player is a bot, schedule its answer
  const botId = [player1Id, player2Id].find(id => game.playerBotMap?.[id]);
  if (botId) {
    const delay = 2000 + Math.random() * 5000;
    game.botTimeoutId = setTimeout(() => {
      if (game.roundEnded) return;
      const botChoice = pickBotTriviaAnswer(game);
      const result = game.submitAnswer(Number(botId), botChoice.answer, botChoice.timeTakenMs);
      io.to(roomName).emit("trivia:answer_feedback", { ...result, playerId: botId });
      io.to(roomName).emit("trivia:score_update", { scores: game.scores });
      checkTriviaBothAnswered(io, matchId, player1Id, player2Id, roomName);
    }, delay);
  }

  game.timeoutId = setTimeout(() => {
    if (game.roundEnded) return;
    game.roundEnded = true;
    if (game.botTimeoutId) {
      clearTimeout(game.botTimeoutId);
      game.botTimeoutId = null;
    }

    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });

    game.nextRound();

    game.timeoutId = setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 3000);
  }, 10000);
}

function setupBotQuickDraw(io, matchId, game, roomName, botPlayerId) {
  if (game.drawerId === botPlayerId) {
    // Bot is the drawer — draw random strokes every 600-900ms for 12 seconds
    let drawCount = 0;
    const maxDraws = 15;
    game.botDrawInterval = setInterval(() => {
      if (drawCount >= maxDraws) {
        clearInterval(game.botDrawInterval);
        return;
      }
      drawCount++;
      const stroke = generateBotStroke();
      io.to(roomName).emit('receive_stroke', { x: stroke.x, y: stroke.y, type: stroke.type });
    }, 400);
  } else {
    // Bot is the guesser — submit guesses every 4-7 seconds
    const doBotGuess = () => {
      if (game._botGuessStopped) return;
      const guess = botQuickDrawGuess(game);
      if (guess.guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        if (game.timerInterval) clearInterval(game.timerInterval);
        delete activeGames[matchId];
        completeMatch(matchId, botPlayerId).then(() => {
          io.to(roomName).emit('match_over', {
            winnerId: botPlayerId,
            word: game.wordToDraw,
            bracketUpdate: 'Bot guessed correctly!',
            message: 'Bot guessed the word!'
          });
        }).catch(() => {
          io.to(roomName).emit('match_over', {
            winnerId: botPlayerId,
            word: game.wordToDraw,
            bracketUpdate: 'Result saved locally',
            message: 'Bot guessed the word!'
          });
        });
      } else {
        io.to(roomName).emit('wrong_guess', { message: `Bot guessed: "${guess.guess}" — Wrong!` });
        game.botGuessTimeout = setTimeout(doBotGuess, 4000 + Math.random() * 3000);
      }
    };
    game.botGuessTimeout = setTimeout(doBotGuess, 4000 + Math.random() * 3000);
  }
}

export default function setupSocketEvents(io) {
  // Give the notification service access to io so it can push live notifications
  setSocketIO(io);

  io.on("connection", (socket) => {
    console.log(`📞 User connected: ${socket.id}`);

    // TRIVIA GAME EVENTS
    socket.on("trivia:join", async (data) => {
      const { matchId, playerId } = data;
      const numericPlayerId = Number(playerId);
      if (isNaN(numericPlayerId) || !matchId) {
        socket.emit("error", { message: "Invalid payload" });
        return;
      }

      try {
        const match = await getMatchById(matchId);
        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        const roomName = `match_${matchId}`;
        socket.join(roomName);

        const isPlayer = numericPlayerId === match.player_1_id || numericPlayerId === match.player_2_id;

        if (isPlayer) {
          if (!activeTriviaGames[matchId]) {
            activeTriviaGames[matchId] = new TriviaGame(
              matchId,
              match.player_1_id,
              match.player_2_id
            );
            activeTriviaGames[matchId].joinedPlayerIds = new Set();
            activeTriviaGames[matchId].hasStarted = false;
          }

          const game = activeTriviaGames[matchId];
          game.joinedPlayerIds.add(numericPlayerId);

          // Auto-join bot opponent if this is a match vs a bot
          if (!game.playerBotMap) {
            game.playerBotMap = {};
            const botId = isBotByEmail(match.player_1_email) ? match.player_1_id
                       : isBotByEmail(match.player_2_email) ? match.player_2_id
                       : null;
            if (botId) {
              game.playerBotMap[botId] = true;
              game.joinedPlayerIds.add(Number(botId));
            }
          }

          socket.matchId = matchId;
          socket.playerId = numericPlayerId;

          if (!game.hasStarted) {
            if (game.joinedPlayerIds.size === 2) {
              game.hasStarted = true;

              if (game.waitingTimeoutId) {
                clearTimeout(game.waitingTimeoutId);
                game.waitingTimeoutId = null;
              }

              io.to(roomName).emit("trivia:started", {
                message: "Game starting in 3 seconds!",
              });

              game.timeoutId = setTimeout(() => {
                sendNextTriviaQuestion(io, matchId, match.player_1_id, match.player_2_id);
              }, 3000);
            } else {
              // Set auto-cancel timer (30 seconds)
              game.waitingTimeoutId = setTimeout(() => {
                const rName = `match_${matchId}`;
                io.to(rName).emit("error", { 
                  message: "Match cancelled: Opponent didn't join in time" 
                });
                delete activeTriviaGames[matchId];
              }, 30000);

              socket.emit("trivia:waiting", { message: "Waiting for opponent..." });
            }
          } else {
            // Reconnection Synchronization
            socket.emit("trivia:started", { message: "Reconnected to active match!" });
            socket.emit("trivia:score_update", { scores: game.scores });

            if (!game.isGameOver() && game.questions[game.currentQuestionIndex]) {
              const question = game.getCurrentQuestion();
              const timeElapsed = game.questionStartTime ? Date.now() - game.questionStartTime : 0;
              const timeLeft = Math.max(0, Math.ceil((10000 - timeElapsed) / 1000));
              socket.emit("trivia:new_question", { question, timerSeconds: timeLeft });
            }
          }
        } else {
          // Spectator Synchronization
          const game = activeTriviaGames[matchId];
          if (game) {
            socket.emit("trivia:score_update", { scores: game.scores });
            if (game.hasStarted) {
              socket.emit("trivia:started", { message: "Spectating active match!" });
              if (!game.isGameOver() && game.questions[game.currentQuestionIndex]) {
                const question = game.getCurrentQuestion();
                const timeElapsed = game.questionStartTime ? Date.now() - game.questionStartTime : 0;
                const timeLeft = Math.max(0, Math.ceil((10000 - timeElapsed) / 1000));
                socket.emit("trivia:new_question", { question, timerSeconds: timeLeft });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error in trivia:join:", err);
        socket.emit("error", { message: "Server error" });
      }
    });

    socket.on("trivia:answer", (data) => {
      const { matchId, playerId, answer, timeTakenMs } = data;
      const game = activeTriviaGames[matchId];
      if (!game) return;

      const numericPlayerId = Number(playerId);
      if (numericPlayerId !== game.player1Id && numericPlayerId !== game.player2Id) {
        socket.emit("error", { message: "Access denied. You are not a player in this match." });
        return;
      }

      if (numericPlayerId !== Number(socket.playerId)) {
        socket.emit("error", { message: "Access denied. You cannot submit an answer for another player." });
        return;
      }

      // Check if player already answered this question
      if (game.hasAnsweredCurrent[numericPlayerId]) {
        socket.emit("trivia:error", { message: "You already answered this question" });
        return;
      }

      // Check if round already ended
      if (game.roundEnded) {
        socket.emit("trivia:error", { message: "Round has already ended" });
        return;
      }

      const result = game.submitAnswer(numericPlayerId, answer, timeTakenMs);
      socket.emit("trivia:answer_feedback", result);
      io.to(`match_${matchId}`).emit("trivia:score_update", {
        scores: game.scores,
      });

      // If both players answered, end the round early and go to the next question.
      const allAnswered = Object.values(game.hasAnsweredCurrent).every(Boolean);
      if (allAnswered && !game.roundEnded) {
        game.roundEnded = true;

        if (game.timeoutId) {
          clearTimeout(game.timeoutId);
          game.timeoutId = null;
        }

        const correctAns =
          game.questions[game.currentQuestionIndex].correctAnswer;
        io.to(`match_${matchId}`).emit("trivia:round_over", {
          correctAnswer: correctAns,
        });

        game.nextRound();

        game.timeoutId = setTimeout(() => {
          sendNextTriviaQuestion(io, matchId, game.player1Id, game.player2Id);
        }, 1000);
      }
    });

    socket.on("trivia:request_scores", (data) => {
      const game = activeTriviaGames[data.matchId];
      if (game) {
        socket.emit("trivia:score_update", { scores: game.scores });
      }
    });

    // ==========================================
    // QUICK DRAW EVENTS
    // ==========================================
    socket.on("join_match", async (data) => {
      const { matchId, playerId } = data;
      const numericPlayerId = Number(playerId);
      if (isNaN(numericPlayerId) || !matchId) {
        socket.emit("error", { message: "Invalid payload" });
        return;
      }

      try {
        const match = await getMatchById(matchId);
        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        const roomName = `match_${matchId}`;
        socket.join(roomName);

        const isPlayer = numericPlayerId === match.player_1_id || numericPlayerId === match.player_2_id;

        if (isPlayer) {
          if (!activeGames[matchId]) {
            activeGames[matchId] = {
              wordToDraw: getRandomWord(),
              playerScores: { player1: 0, player2: 0 },
              player1Id: match.player_1_id,
              player2Id: match.player_2_id,
              drawerId: match.player_1_id,
              strokes: [],
              joinedPlayerIds: new Set(),
              hasStarted: false,
              maxAttempts: 5,
              wrongAttempts: {},
              timeLimit: 60,
              timeRemaining: 60,
            };
          }

          const game = activeGames[matchId];
          game.joinedPlayerIds.add(numericPlayerId);

          // Auto-join bot opponent for Quick Draw
          if (!game.playerBotMap) {
            game.playerBotMap = {};
            const botId = isBotByEmail(match.player_1_email) ? match.player_1_id
                       : isBotByEmail(match.player_2_email) ? match.player_2_id
                       : null;
            if (botId) {
              game.playerBotMap[botId] = true;
              game.joinedPlayerIds.add(Number(botId));
            }
          }

          socket.matchId = matchId;
          socket.playerId = numericPlayerId;

          if (!game.hasStarted) {
            if (game.joinedPlayerIds.size === 2) {
              game.hasStarted = true;

              if (game.waitingTimeoutId) {
                clearTimeout(game.waitingTimeoutId);
                game.waitingTimeoutId = null;
              }

              // Broadcast start status to the room
              io.to(roomName).emit("game_status", { message: "Match started!" });

              // Start 60-second timer
              game.timeRemaining = game.timeLimit;
              io.to(roomName).emit("quickdraw:timer", { timeRemaining: game.timeRemaining });
              game.timerInterval = setInterval(() => {
                game.timeRemaining--;
                io.to(roomName).emit("quickdraw:timer", { timeRemaining: game.timeRemaining });
                if (game.timeRemaining <= 0) {
                  clearInterval(game.timerInterval);
                  game.timerInterval = null;
                  if (activeGames[matchId]) {
                    const winnerId = game.drawerId;
                    delete activeGames[matchId];
                    completeMatch(matchId, winnerId).catch(() => {});
                    io.to(roomName).emit("match_over", {
                      winnerId,
                      word: game.wordToDraw,
                      message: "Time's up!",
                    });
                  }
                }
              }, 1000);

              // Only the drawer sees the secret word (dynamically look up socket in the room to prevent reconnect issues)
              const socketsInRoom = await io.in(roomName).fetchSockets();
              for (const sock of socketsInRoom) {
                if (Number(sock.playerId) === Number(game.drawerId)) {
                  sock.emit("game_status", {
                    message: "You are the drawer. Start drawing!",
                    wordToDraw: game.wordToDraw,
                  });
                  break;
                }
              }

              // Schedule bot Quick Draw actions if opponent is a bot
              const botPlayerId = Object.keys(game.playerBotMap || {})[0];
              if (botPlayerId) {
                setupBotQuickDraw(io, matchId, game, roomName, Number(botPlayerId));
              }
            } else {
              // Set auto-cancel timer (30 seconds)
              game.waitingTimeoutId = setTimeout(() => {
                const rName = `match_${matchId}`;
                io.to(rName).emit("error", { 
                  message: "Match cancelled: Opponent didn't join in time" 
                });
                delete activeGames[matchId];
              }, 30000);

              socket.emit("game_status_waiting", { message: "Waiting for opponent..." });
            }
          } else {
            // Reconnection Synchronization
            socket.emit("game_status", { message: "Reconnected to match!" });

            if (numericPlayerId === Number(game.drawerId)) {
              socket.emit("game_status", {
                message: "You are the drawer. Start drawing!",
                wordToDraw: game.wordToDraw,
              });
            }

            // Send previous drawing strokes history to reconnecting player
            if (game.strokes && game.strokes.length > 0) {
              socket.emit("draw_history", { strokes: game.strokes });
            }
          }
        } else {
          // Spectator Synchronization
          const game = activeGames[matchId];
          if (game) {
            if (game.hasStarted) {
              socket.emit("game_status", { message: "Spectating match!" });
            }
            if (game.strokes && game.strokes.length > 0) {
              socket.emit("draw_history", { strokes: game.strokes });
            }
          }
        }
      } catch (err) {
        console.error("Error in join_match:", err);
        socket.emit("error", { message: "Server error" });
      }
    });

    socket.on("draw_stroke", (data) => {
      const { matchId, playerId, x, y, type } = data;
      const game = activeGames[matchId];
      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      const numericPlayerId = Number(playerId);
      // Validate that only the active drawer can draw
      if (numericPlayerId !== Number(game.drawerId)) {
        socket.emit("error", { message: "Only the drawer can draw" });
        return;
      }

      // Record the stroke
      game.strokes.push({ x, y, type });

      const roomName = `match_${matchId}`;
      socket.to(roomName).emit("receive_stroke", data);
    });

    socket.on("submit_guess", async (data) => {
      const { matchId, guess, playerId } = data;
      const game = activeGames[matchId];
      if (!game) return;

      const numericPlayerId = Number(playerId);
      if (numericPlayerId !== game.player1Id && numericPlayerId !== game.player2Id) {
        socket.emit("error", { message: "Access denied. You are not a player in this match." });
        return;
      }

      if (numericPlayerId !== Number(socket.playerId)) {
        socket.emit("error", { message: "Access denied. You cannot submit a guess for another player." });
        return;
      }

      // Block the drawer from submitting guesses
      if (numericPlayerId === Number(game.drawerId)) {
        socket.emit("error", { message: "Access denied. The drawer cannot guess the word." });
        return;
      }

      if (guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        // Correct guess — clean up timer + game state
        if (game.timerInterval) clearInterval(game.timerInterval);
        delete activeGames[matchId];
        try {
          const result = await completeMatch(matchId, numericPlayerId);
          io.to(`match_${matchId}`).emit("match_over", {
            winnerId: numericPlayerId,
            word: game.wordToDraw,
            bracketUpdate: result.message,
          });
        } catch (error) {
          io.to(`match_${matchId}`).emit("match_over", {
            winnerId: numericPlayerId,
            word: game.wordToDraw,
            bracketUpdate: "Result saved locally",
          });
        }
      } else {
        // Wrong guess — track attempts
        game.wrongAttempts[numericPlayerId] = (game.wrongAttempts[numericPlayerId] || 0) + 1;
        const remaining = game.maxAttempts - game.wrongAttempts[numericPlayerId];
        io.to(`match_${matchId}`).emit("quickdraw:attempt_update", {
          playerId: numericPlayerId,
          attemptsLeft: remaining,
        });
        if (remaining <= 0) {
          // Max attempts reached — other player wins
          if (game.timerInterval) clearInterval(game.timerInterval);
          delete activeGames[matchId];
          const winnerId = game.player1Id === numericPlayerId ? game.player2Id : game.player1Id;
          try {
            const result = await completeMatch(matchId, winnerId);
            io.to(`match_${matchId}`).emit("match_over", {
              winnerId,
              word: game.wordToDraw,
              bracketUpdate: result.message,
              message: "Too many wrong guesses!",
            });
          } catch {
            io.to(`match_${matchId}`).emit("match_over", {
              winnerId,
              word: game.wordToDraw,
              bracketUpdate: "Result saved locally",
              message: "Too many wrong guesses!",
            });
          }
        } else {
          socket.emit("wrong_guess", {
            message: `Wrong! ${remaining} guess${remaining > 1 ? 'es' : ''} left`,
            attemptsLeft: remaining,
          });
        }
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

      const numericUserId = Number(userId);
      if (!userId || isNaN(numericUserId) || numericUserId <= 0) {
        socket.emit("chat:error", { message: "Invalid user session. Please log in again." });
        return;
      }

      try {
        // Join the chat room (same socket, different room from match rooms)
        socket.join(roomName);

        // Keep track of which rooms this socket has joined to prevent duplicate system messages
        if (!socketJoinedRooms[socket.id]) {
          socketJoinedRooms[socket.id] = {};
        }
        socketJoinedRooms[socket.id][roomName] = true;

        // Look up username ONCE and cache it — don't query DB on every message
        const user = await findById(numericUserId);
        const username = user?.username || "Anonymous";
        chatUsernames[socket.id] = username;

        console.log(
          `💬 ${username} joined chat for tournament ${tournamentId}`
        );

        // Initialize set for this room if not exists
        if (!announcedChatUsers[roomName]) {
          announcedChatUsers[roomName] = new Set();
        }

        const alreadyAnnounced = announcedChatUsers[roomName].has(numericUserId);
        announcedChatUsers[roomName].add(numericUserId);

        // Notify everyone in the room only if this user hasn't already been announced in this room
        if (!alreadyAnnounced) {
          io.to(roomName).emit("chat:user_joined", {
            username: username,
            message: `${username} joined the chat`,
          });
        }
      } catch (error) {
        console.error("❌ Error in chat:join socket handler:", error);
        socket.emit("chat:error", { message: "Failed to join chat room." });
      }
    });

    // User leaves a tournament chat room (when navigating away)
    socket.on("chat:leave", (data) => {
      const { tournamentId } = data;
      const roomName = `chat_tournament_${tournamentId}`;
      socket.leave(roomName);
      if (socketJoinedRooms[socket.id]) {
        delete socketJoinedRooms[socket.id][roomName];
      }
      console.log(`💬 Socket ${socket.id} left room ${roomName}`);
    });

    // User sends a chat message
    socket.on("chat:send", async (data) => {
      const { tournamentId, userId, text } = data;
      const roomName = `chat_tournament_${tournamentId}`;

      const numericUserId = Number(userId);
      if (!userId || isNaN(numericUserId) || numericUserId <= 0) {
        socket.emit("chat:error", { message: "Invalid user session. Please log in again." });
        return;
      }

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
        const saved = await sendMessage(tournamentId, numericUserId, text);

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

    socket.on("disconnect", () => {
      // Clean up chat state for this socket
      delete chatUsernames[socket.id];
      delete lastChatTime[socket.id];
      delete socketJoinedRooms[socket.id];

      // Clean up match waiting state
      if (socket.matchId && socket.playerId) {
        const matchId = socket.matchId;
        const playerId = Number(socket.playerId);

        // Clean up trivia games
        const triviaGame = activeTriviaGames[matchId];
        if (triviaGame) {
          if (triviaGame.botTimeoutId) {
            clearTimeout(triviaGame.botTimeoutId);
            triviaGame.botTimeoutId = null;
          }
          triviaGame.joinedPlayerIds.delete(playerId);
          // If both players gone, DELETE the game
          if (triviaGame.joinedPlayerIds.size === 0) {
            if (triviaGame.timeoutId) {
              clearTimeout(triviaGame.timeoutId);
              triviaGame.timeoutId = null;
            }
            if (triviaGame.waitingTimeoutId) {
              clearTimeout(triviaGame.waitingTimeoutId);
              triviaGame.waitingTimeoutId = null;
            }
            delete activeTriviaGames[matchId];
          } else if (triviaGame.hasStarted) {
            // Only one player left - auto-complete match (remaining player wins)
            const winnerId = Array.from(triviaGame.joinedPlayerIds)[0];
            completeMatch(matchId, winnerId).then((result) => {
              const roomName = `match_${matchId}`;
              io.to(roomName).emit("trivia:match_over", {
                winnerId: winnerId,
                scores: triviaGame.scores,
                message: "Opponent disconnected. You win!",
                bracketUpdate: result.message,
              });
              if (triviaGame.timeoutId) {
                clearTimeout(triviaGame.timeoutId);
                triviaGame.timeoutId = null;
              }
              delete activeTriviaGames[matchId];
            }).catch((err) => {
              console.error("Error completing trivia match on disconnect:", err);
            });
          }
        }

        // Clean up quick draw games
        const quickDrawGame = activeGames[matchId];
        if (quickDrawGame) {
          if (quickDrawGame.botDrawInterval) {
            clearInterval(quickDrawGame.botDrawInterval);
            quickDrawGame.botDrawInterval = null;
          }
          if (quickDrawGame.botGuessTimeout) {
            clearTimeout(quickDrawGame.botGuessTimeout);
            quickDrawGame.botGuessTimeout = null;
          }
          if (quickDrawGame.timerInterval) {
            clearInterval(quickDrawGame.timerInterval);
            quickDrawGame.timerInterval = null;
          }
          quickDrawGame._botGuessStopped = true;
          quickDrawGame.joinedPlayerIds.delete(playerId);
          if (quickDrawGame.joinedPlayerIds.size === 0) {
            if (quickDrawGame.timeoutId) {
              clearTimeout(quickDrawGame.timeoutId);
            }
            if (quickDrawGame.waitingTimeoutId) {
              clearTimeout(quickDrawGame.waitingTimeoutId);
            }
            delete activeGames[matchId];
          } else if (quickDrawGame.hasStarted) {
            // Only one player left - auto-complete match (remaining player wins)
            const winnerId = Array.from(quickDrawGame.joinedPlayerIds)[0];
            completeMatch(matchId, winnerId).then((result) => {
              const roomName = `match_${matchId}`;
              io.to(roomName).emit("match_over", {
                winnerId: winnerId,
                word: quickDrawGame.wordToDraw,
                message: "Opponent disconnected. You win!",
                bracketUpdate: result.message,
              });
              if (quickDrawGame.timeoutId) {
                clearTimeout(quickDrawGame.timeoutId);
              }
              if (quickDrawGame.timerInterval) {
                clearInterval(quickDrawGame.timerInterval);
              }
              delete activeGames[matchId];
            }).catch((err) => {
              console.error("Error completing quick draw match on disconnect:", err);
            });
          }
        }
      }

      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
}
