import { getRandomWord } from "../games/gameConstants.js";
import { completeMatch } from "../services/matchService.js";
import { getMatchById } from "../models/Match.js";
import { TriviaGame } from "../games/TriviaGame.js";
import { sendMessage } from "../services/chatService.js";
import { findById } from "../models/User.js";
import { setSocketIO } from "../services/notificationService.js";
// Bot imports removed

const activeGames = {};
const activeTriviaGames = {};
const announcedChatUsers = {};

const chatUsernames = {};
const lastChatTime = {};
const socketJoinedRooms = {};

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

  game.timeoutId = setTimeout(() => {
    if (game.roundEnded) return;
    game.roundEnded = true;

    const correctAns = game.questions[game.currentQuestionIndex].correctAnswer;
    io.to(roomName).emit("trivia:round_over", { correctAnswer: correctAns });

    game.nextRound();

    game.timeoutId = setTimeout(() => {
      sendNextTriviaQuestion(io, matchId, player1Id, player2Id);
    }, 3000);
  }, 10000);
}



export default function setupSocketEvents(io) {
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
        return;
      }

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



          socket.matchId = matchId;
          socket.playerId = numericPlayerId;

          if (!game.hasStarted) {
            if (game.joinedPlayerIds.size === 2) {
              game.hasStarted = true;

              if (game.waitingTimeoutId) {
                clearTimeout(game.waitingTimeoutId);
                game.waitingTimeoutId = null;
              }

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


            } else {
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
      if (!game) return;

      if (Number(playerId) !== Number(game.drawerId)) return;
      game.strokes.push({ x, y, type });
      socket.to(`match_${matchId}`).emit("receive_stroke", data);
    });

    socket.on("submit_guess", async (data) => {
      const { matchId, guess, playerId } = data;
      const game = activeGames[matchId];
      if (!game) {
        socket.emit("error", { message: "Match is not active or has already ended." });
        return;
      }

      const numericPlayerId = Number(playerId);
      if (numericPlayerId !== game.player1Id && numericPlayerId !== game.player2Id) return;
      if (numericPlayerId === Number(game.drawerId)) return;

      if (guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        if (game.timerInterval) clearInterval(game.timerInterval);
        delete activeGames[matchId];
        
        // Broadcast correct guess
        io.to(`match_${matchId}`).emit("quickdraw:guess_attempt", {
          playerId: numericPlayerId,
          guess: guess.trim(),
          correct: true,
          attemptsLeft: game.maxAttempts - (game.wrongAttempts[numericPlayerId] || 0),
        });

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
        game.wrongAttempts[numericPlayerId] = (game.wrongAttempts[numericPlayerId] || 0) + 1;
        const remaining = game.maxAttempts - game.wrongAttempts[numericPlayerId];
        
        io.to(`match_${matchId}`).emit("quickdraw:attempt_update", {
          playerId: numericPlayerId,
          attemptsLeft: remaining,
        });

        // Broadcast incorrect guess
        io.to(`match_${matchId}`).emit("quickdraw:guess_attempt", {
          playerId: numericPlayerId,
          guess: guess.trim(),
          correct: false,
          attemptsLeft: remaining,
        });

        if (remaining <= 0) {
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
          io.to(roomName).emit("chat:user_joined", {
            username: username,
            message: `${username} joined the chat`,
          });
        }
      } catch (error) {
        console.error("Chat join error:", error);
      }
    });

    socket.on("chat:leave", (data) => {
      const { tournamentId } = data;
      const roomName = `chat_tournament_${tournamentId}`;
      socket.leave(roomName);
      if (socketJoinedRooms[socket.id]) delete socketJoinedRooms[socket.id][roomName];
    });

    socket.on("chat:send", async (data) => {
      const { tournamentId, userId, text } = data;
      const roomName = `chat_tournament_${tournamentId}`;
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
        io.to(roomName).emit("chat:message", {
          id: saved.id,
          userId: saved.user_id,
          username: chatUsernames[socket.id] || "Anonymous",
          message: saved.message,
          createdAt: saved.created_at,
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
          triviaGame.joinedPlayerIds.delete(playerId);
          if (triviaGame.joinedPlayerIds.size === 0) {
            if (triviaGame.timeoutId) clearTimeout(triviaGame.timeoutId);
            if (triviaGame.waitingTimeoutId) clearTimeout(triviaGame.waitingTimeoutId);

            delete activeTriviaGames[matchId];
          }
          // BUG FIX 2: Removed instantaneous auto-forfeit to survive React Strict Mode disconnects!
        }

        // QUICK DRAW CLEANUP
        const quickDrawGame = activeGames[matchId];
        if (quickDrawGame) {
          quickDrawGame.joinedPlayerIds.delete(playerId);
          if (quickDrawGame.joinedPlayerIds.size === 0) {
            if (quickDrawGame.timerInterval) clearInterval(quickDrawGame.timerInterval);
            if (quickDrawGame.waitingTimeoutId) {
              clearTimeout(quickDrawGame.waitingTimeoutId);
              quickDrawGame.waitingTimeoutId = null;
            }
            delete activeGames[matchId];
          }
          // BUG FIX 2: Removed instantaneous auto-forfeit here too!
        }
      }
    });
  });
}