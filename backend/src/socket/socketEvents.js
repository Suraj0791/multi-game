import { getRandomWord } from '../games/gameConstants.js';

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

    // EVENT 3: GUESSING
    socket.on("submit_guess", (data) => {
      const { matchId, guess, playerId } = data;
      const game = activeGames[matchId];

      if (!game) return; // Ignore if game doesn't exist

      // Check if guess matches the word (case insensitive)
      if (guess.toUpperCase() === game.wordToDraw.toUpperCase()) {
        
        // Correct guess!
        console.log(`Match ${matchId}: Correct guess!`);
        
        // Shout to everyone in the room that someone won the round
        io.to(`match_${matchId}`).emit("round_won", { 
          winnerId: playerId, 
          word: game.wordToDraw 
        });

      } else {
        // Wrong guess. 
        // We can whisper back to just the person who guessed.
        socket.emit("wrong_guess", { message: "Try again!" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
}
