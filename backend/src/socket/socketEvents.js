import { getRandomWord } from "../games/gameConstants.js";
import { completeMatch } from "../services/matchService.js";
import { getMatchById } from "../models/Match.js";
import { TriviaGame } from "../games/TriviaGame.js";
import { sendMessage } from "../services/chatService.js";
import { findById } from "../models/User.js";
import { setSocketIO } from "../services/notificationService.js";

const activeGames = {};
const activeTriviaGames = {};
const announcedChatUsers = {};
const chatUsernames = {};
const lastChatTime = {};
const socketJoinedRooms = {};

let ioInstance = null;

export function getIO() {
  return ioInstance;
}


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

    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });

    game.nextRound();

    // 🟢 FIX: Increased delay from 1s to 4s so players can read the results!
    game.timeoutId = setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 4000); 
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

  game.timeoutId = setTimeout(() => {
    if (game.roundEnded) return;
    game.roundEnded = true;

    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });

    game.nextRound();

    // 🟢 FIX: Increased delay from 3s to 4s so players can read the results!
    game.timeoutId = setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 4000);
  }, 10000);
}

export default function setupSocketEvents(io) {
  setSocketIO(io);
  ioInstance = io;

  io.on("connection", (socket) => {
    // Join tournament room
    socket.on("tournament:join", (data) => {
      const { tournamentId } = data;
      if (tournamentId) {
        socket.join(`tournament_${tournamentId}`);
        console.log(`🔌 Socket ${socket.id} joined tournament_${tournamentId}`);
      }
    });
    
    // ==========================================
    // TRIVIA GAME EVENTS
    // ==========================================
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
            activeTriviaGames[matchId] = new TriviaGame(matchId, match.player_1_id, match.player_2_id);
            activeTriviaGames[matchId].joinedPlayerIds = new Set();
            activeTriviaGames[matchId].connectedSockets = {};
            activeTriviaGames[matchId].hasStarted = false;
          }

          const game = activeTriviaGames[matchId];
          if (game.cleanupTimeoutId) {
            clearTimeout(game.cleanupTimeoutId);
            game.cleanupTimeoutId = null;
          }
          if (!game.connectedSockets) game.connectedSockets = {};
          if (!game.connectedSockets[numericPlayerId]) {
            game.connectedSockets[numericPlayerId] = new Set();
          }
          game.connectedSockets[numericPlayerId].add(socket.id);
          game.joinedPlayerIds.add(numericPlayerId);

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
                message: "Game starting in 5 seconds!",
              });

              game.timeoutId = setTimeout(() => {
                sendNextTriviaQuestion(io, matchId, match.player_1_id, match.player_2_id);
              }, 5000);
            } else {
              // Kill ghost timers
              if (game.waitingTimeoutId) clearTimeout(game.waitingTimeoutId);
              game.waitingTimeoutId = setTimeout(() => {
                const rName = `match_${matchId}`;
                io.to(rName).emit("error", {
                  message: "Match cancelled: Opponent didn't join in time"
                });
                delete activeTriviaGames[matchId];
              }, 60000);

              socket.emit("trivia:waiting", { message: "Waiting for opponent..." });
            }
          } else {
            // 🟢 FIX: The "Strict Mode Desync" Fix
            socket.emit("trivia:score_update", { scores: game.scores });

            if (game.questionStartTime && !game.roundEnded) {
              // Question is live, send it instantly
              socket.emit("trivia:started", { message: "Reconnected to active match!" });
              const question = game.getCurrentQuestion();
              const timeElapsed = Date.now() - game.questionStartTime;
              const timeLeft = Math.max(0, Math.ceil((10000 - timeElapsed) / 1000));
              socket.emit("trivia:new_question", { question, timerSeconds: timeLeft });
            } else {
              // They connected during the 3..2..1 countdown or result screen. Wait for the server!
              socket.emit("trivia:started", { message: "Game in progress..." });
            }
          }
        } else {
          // Spectator logic
          const game = activeTriviaGames[matchId];
          if (game) {
            socket.emit("trivia:score_update", { scores: game.scores });
            if (game.hasStarted) {
              socket.emit("trivia:started", { message: "Spectating active match!" });
              if (game.questionStartTime && !game.roundEnded && !game.isGameOver()) {
                const question = game.getCurrentQuestion();
                const timeElapsed = Date.now() - game.questionStartTime;
                const timeLeft = Math.max(0, Math.ceil((10000 - timeElapsed) / 1000));
                socket.emit("trivia:new_question", { question, timerSeconds: timeLeft });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error in trivia:join:", err);
      }
    });

    socket.on("trivia:answer", (data) => {
      const { matchId, playerId, answer, timeTakenMs } = data;
      const game = activeTriviaGames[matchId];
      if (!game) return;

      const numericPlayerId = Number(playerId);
      if (numericPlayerId !== game.player1Id && numericPlayerId !== game.player2Id) return;
      if (game.hasAnsweredCurrent[numericPlayerId]) return;
      if (game.roundEnded) return;

      const result = game.submitAnswer(numericPlayerId, answer, timeTakenMs);
      socket.emit("trivia:answer_feedback", result);
      io.to(`match_${matchId}`).emit("trivia:score_update", { scores: game.scores });

      const allAnswered = Object.values(game.hasAnsweredCurrent).every(Boolean);
      if (allAnswered && !game.roundEnded) {
        game.roundEnded = true;

        if (game.timeoutId) {
          clearTimeout(game.timeoutId);
          game.timeoutId = null;
        }

        const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
        io.to(`match_${matchId}`).emit("trivia:round_over", { correctAnswer: correctAns });

        game.nextRound();

        // 🟢 FIX: Increased delay from 1s to 4s
        game.timeoutId = setTimeout(() => {
          sendNextTriviaQuestion(io, matchId, game.player1Id, game.player2Id);
        }, 4000);
      }
    });

    socket.on("trivia:request_scores", (data) => {
      const game = activeTriviaGames[data.matchId];
      if (game) socket.emit("trivia:score_update", { scores: game.scores });
    });

    // ==========================================
    // QUICK DRAW EVENTS
    // ==========================================
    socket.on("join_match", async (data) => {
      const { matchId, playerId } = data;
      const numericPlayerId = Number(playerId);
      if (isNaN(numericPlayerId) || !matchId) return;

      try {
        const match = await getMatchById(matchId);
        if (!match) return;

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
              connectedSockets: {},
              hasStarted: false,
              maxAttempts: 5,
              wrongAttempts: {},
              timeLimit: 60,
              timeRemaining: 60,
            };
          }

          const game = activeGames[matchId];
          if (game.cleanupTimeoutId) {
            clearTimeout(game.cleanupTimeoutId);
            game.cleanupTimeoutId = null;
          }
          if (!game.connectedSockets) game.connectedSockets = {};
          if (!game.connectedSockets[numericPlayerId]) {
            game.connectedSockets[numericPlayerId] = new Set();
          }
          game.connectedSockets[numericPlayerId].add(socket.id);
          game.joinedPlayerIds.add(numericPlayerId);

          socket.matchId = matchId;
          socket.playerId = numericPlayerId;

          if (!game.hasStarted) {
            if (game.joinedPlayerIds.size === 2) {
              game.hasStarted = true;

              if (game.waitingTimeoutId) {
                clearTimeout(game.waitingTimeoutId);
                game.waitingTimeoutId = null;
              }

              io.to(roomName).emit("game_status", { message: "Game starting in 5 seconds!" });

              setTimeout(async () => {
                if (!activeGames[matchId]) return;
                io.to(roomName).emit("game_status", { message: "Match started!" });

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
                      completeMatch(matchId, winnerId).catch(() => { });
                      io.to(roomName).emit("match_over", {
                        winnerId,
                        word: game.wordToDraw,
                        message: "Time's up!",
                      });
                    }
                  }
                }, 1000);

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
              }, 5000);
            } else {
              if (game.waitingTimeoutId) clearTimeout(game.waitingTimeoutId);
              game.waitingTimeoutId = setTimeout(() => {
                const rName = `match_${matchId}`;
                io.to(rName).emit("error", {
                  message: "Match cancelled: Opponent didn't join in time"
                });
                delete activeGames[matchId];
              }, 60000);

              socket.emit("game_status_waiting", { message: "Waiting for opponent..." });
            }
          } else {
            socket.emit("game_status", { message: "Reconnected to match!" });
            if (numericPlayerId === Number(game.drawerId)) {
              socket.emit("game_status", {
                message: "You are the drawer. Start drawing!",
                wordToDraw: game.wordToDraw,
              });
            }
            if (game.strokes && game.strokes.length > 0) {
              socket.emit("draw_history", { strokes: game.strokes });
            }
          }
        } else {
          const game = activeGames[matchId];
          if (game) {
            if (game.hasStarted) socket.emit("game_status", { message: "Spectating match!" });
            if (game.strokes && game.strokes.length > 0) socket.emit("draw_history", { strokes: game.strokes });
          }
        }
      } catch (err) {
        console.error("Error in join_match:", err);
      }
    });

    socket.on("draw_stroke", (data) => {
      const { matchId, playerId, x, y, type } = data;
      const game = activeGames[matchId];
      if (!game) return;
      if (Number(playerId) !== Number(game.drawerId)) return;
      game.strokes.push({ x, y, type });
      socket.to(`match_${matchId}`).emit("receive_stroke", data);
    });

    socket.on("submit_guess", async (data) => {
      const { matchId, guess, playerId } = data;
      const game = activeGames[matchId];
      if (!game) return;

      const numericPlayerId = Number(playerId);
      if (numericPlayerId !== game.player1Id && numericPlayerId !== game.player2Id) return;
      if (numericPlayerId === Number(game.drawerId)) return;

      if (guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        if (game.timerInterval) clearInterval(game.timerInterval);
        delete activeGames[matchId];
        
        io.to(`match_${matchId}`).emit("quickdraw:guess_attempt", {
          playerId: numericPlayerId, guess: guess.trim(), correct: true,
          attemptsLeft: game.maxAttempts - (game.wrongAttempts[numericPlayerId] || 0),
        });

        try {
          const result = await completeMatch(matchId, numericPlayerId);
          io.to(`match_${matchId}`).emit("match_over", {
            winnerId: numericPlayerId, word: game.wordToDraw, bracketUpdate: result.message,
          });
        } catch (error) {
          io.to(`match_${matchId}`).emit("match_over", {
            winnerId: numericPlayerId, word: game.wordToDraw, bracketUpdate: "Result saved locally",
          });
        }
      } else {
        game.wrongAttempts[numericPlayerId] = (game.wrongAttempts[numericPlayerId] || 0) + 1;
        const remaining = game.maxAttempts - game.wrongAttempts[numericPlayerId];
        
        io.to(`match_${matchId}`).emit("quickdraw:attempt_update", { playerId: numericPlayerId, attemptsLeft: remaining });
        io.to(`match_${matchId}`).emit("quickdraw:guess_attempt", {
          playerId: numericPlayerId, guess: guess.trim(), correct: false, attemptsLeft: remaining,
        });

        if (remaining <= 0) {
          if (game.timerInterval) clearInterval(game.timerInterval);
          delete activeGames[matchId];
          const winnerId = game.player1Id === numericPlayerId ? game.player2Id : game.player1Id;
          try {
            const result = await completeMatch(matchId, winnerId);
            io.to(`match_${matchId}`).emit("match_over", { winnerId, word: game.wordToDraw, bracketUpdate: result.message, message: "Too many wrong guesses!" });
          } catch {
            io.to(`match_${matchId}`).emit("match_over", { winnerId, word: game.wordToDraw, bracketUpdate: "Result saved locally", message: "Too many wrong guesses!" });
          }
        } else {
          socket.emit("wrong_guess", { message: `Wrong! ${remaining} guess${remaining > 1 ? 'es' : ''} left`, attemptsLeft: remaining });
        }
      }
    });

    // ==========================================
    // CHAT & NOTIFICATIONS
    // ==========================================
    socket.on("chat:join", async (data) => {
      const { tournamentId, userId } = data;
      const roomName = `chat_tournament_${tournamentId}`;
      const numericUserId = Number(userId);
      if (!userId || isNaN(numericUserId) || numericUserId <= 0) return;

      try {
        socket.join(roomName);
        if (!socketJoinedRooms[socket.id]) socketJoinedRooms[socket.id] = {};
        socketJoinedRooms[socket.id][roomName] = true;

        const user = await findById(numericUserId);
        const username = user?.username || "Anonymous";
        chatUsernames[socket.id] = username;

        if (!announcedChatUsers[roomName]) announcedChatUsers[roomName] = new Set();
        const alreadyAnnounced = announcedChatUsers[roomName].has(numericUserId);
        announcedChatUsers[roomName].add(numericUserId);

        if (!alreadyAnnounced) {
          io.to(roomName).emit("chat:user_joined", { username: username, message: `${username} joined the chat` });
        }
      } catch (error) {
        console.error("Chat join error:", error);
      }
    });

    socket.on("chat:leave", (data) => {
      const { tournamentId } = data;
      socket.leave(`chat_tournament_${tournamentId}`);
      if (socketJoinedRooms[socket.id]) delete socketJoinedRooms[socket.id][`chat_tournament_${tournamentId}`];
    });

    socket.on("chat:send", async (data) => {
      const { tournamentId, userId, text } = data;
      const numericUserId = Number(userId);
      if (!userId || isNaN(numericUserId) || numericUserId <= 0) return;

      const now = Date.now();
      if (lastChatTime[socket.id] && now - lastChatTime[socket.id] < 1000) {
        socket.emit("chat:error", { message: "Slow down! 1 message per second." });
        return;
      }
      lastChatTime[socket.id] = now;

      try {
        const saved = await sendMessage(tournamentId, numericUserId, text);
        io.to(`chat_tournament_${tournamentId}`).emit("chat:message", {
          id: saved.id, userId: saved.user_id, username: chatUsernames[socket.id] || "Anonymous", message: saved.message, createdAt: saved.created_at,
        });
      } catch (error) {
        socket.emit("chat:error", { message: error.message });
      }
    });

    socket.on("notifications:subscribe", (data) => {
      socket.join(`user_${data.userId}`);
    });

    socket.on("disconnect", () => {
      delete chatUsernames[socket.id];
      delete lastChatTime[socket.id];
      delete socketJoinedRooms[socket.id];

      if (socket.matchId && socket.playerId) {
        const matchId = socket.matchId;
        const playerId = Number(socket.playerId);

        // TRIVIA CLEANUP
        const triviaGame = activeTriviaGames[matchId];
        if (triviaGame) {
          if (triviaGame.connectedSockets && triviaGame.connectedSockets[playerId]) {
            triviaGame.connectedSockets[playerId].delete(socket.id);
            if (triviaGame.connectedSockets[playerId].size === 0) {
              delete triviaGame.connectedSockets[playerId];
              triviaGame.joinedPlayerIds.delete(playerId);
            }
          } else {
            triviaGame.joinedPlayerIds.delete(playerId);
          }

          if (triviaGame.joinedPlayerIds.size === 0) {
            if (!triviaGame.cleanupTimeoutId) {
              triviaGame.cleanupTimeoutId = setTimeout(() => {
                if (activeTriviaGames[matchId]) {
                  if (triviaGame.timeoutId) clearTimeout(triviaGame.timeoutId);
                  if (triviaGame.waitingTimeoutId) clearTimeout(triviaGame.waitingTimeoutId);
                  delete activeTriviaGames[matchId];
                }
              }, 10000);
            }
          }
        }

        // QUICK DRAW CLEANUP
        const quickDrawGame = activeGames[matchId];
        if (quickDrawGame) {
          if (quickDrawGame.connectedSockets && quickDrawGame.connectedSockets[playerId]) {
            quickDrawGame.connectedSockets[playerId].delete(socket.id);
            if (quickDrawGame.connectedSockets[playerId].size === 0) {
              delete quickDrawGame.connectedSockets[playerId];
              quickDrawGame.joinedPlayerIds.delete(playerId);
            }
          } else {
            quickDrawGame.joinedPlayerIds.delete(playerId);
          }

          if (quickDrawGame.joinedPlayerIds.size === 0) {
            if (!quickDrawGame.cleanupTimeoutId) {
              quickDrawGame.cleanupTimeoutId = setTimeout(() => {
                if (activeGames[matchId]) {
                  if (quickDrawGame.timerInterval) clearInterval(quickDrawGame.timerInterval);
                  if (quickDrawGame.waitingTimeoutId) clearTimeout(quickDrawGame.waitingTimeoutId);
                  delete activeGames[matchId];
                }
              }, 10000);
            }
          }
        }
      }
    });
  });
}