import { getRandomWord } from '../games/gameConstants.js';
import { completeMatch } from '../services/matchService.js'; // IMPORT THIS!

// The "Whiteboard" - Stores game state in temporary RAM
const activeGames = {};

export default function setupSocketEvents(io) {
  io.on("connection", (socket) => {
    console.log(`📞 User connected: ${socket.id}`);

    // EVENT 1: JOINING A PRIVATE ROOM
    socket.on("join_match", (data) => {
      const matchId = data.matchId;
      const roomName = `match_${matchId}`;
      
      socket.join(roomName); 
      console.log(`User ${socket.id} joined room: ${roomName}`);

      // If the game doesn't exist on the whiteboard yet, create it!
      if (!activeGames[matchId]) {
        activeGames[matchId] = {
          wordToDraw: getRandomWord(),
          playerScores: {
             // In a real app we'd map this to actual User IDs. 
             // For now we'll just track scores.
             player1: 0, 
             player2: 0
          }
        };
      }
      
      // Let the players know the game state (but DON'T tell the guesser the word yet!)
      // We will refine this later. For now, just send a welcome message.
      io.to(roomName).emit("game_status", { message: "Welcome to the match!" });
    });

    // EVENT 2: DRAWING SYNC
    socket.on("draw_stroke", (data) => {
      const roomName = `match_${data.matchId}`;
      socket.to(roomName).emit("receive_stroke", data);
    });

    // EVENT 3: GUESSING (Made this async!)
    socket.on("submit_guess", async (data) => {
      const { matchId, guess, playerId } = data;
      const game = activeGames[matchId];

      if (!game) return; // Ignore if game doesn't exist

      // Check if guess matches the word (case insensitive)
      if (guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        
        // Correct guess!
        console.log(`Match ${matchId}: Correct guess!`);
        
        try {
          // 1. Tell the Database that the match is over!
          const result = await completeMatch(matchId, playerId);

          // 2. Shout to everyone in the room that the game is over!
          io.to(`match_${matchId}`).emit("match_over", { 
            winnerId: playerId, 
            word: game.wordToDraw,
            bracketUpdate: result.message // Tells them if Round 2 was created!
          });

          // 3. Clean up the whiteboard (erase the game since it's over)
          delete activeGames[matchId];
          
        } catch (error) {
          console.error("Error completing match:", error);
          socket.emit("error", { message: "Failed to save match result." });
        }

      } else {
        // Wrong guess. 
        socket.emit("wrong_guess", { message: "Try again!" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
}
