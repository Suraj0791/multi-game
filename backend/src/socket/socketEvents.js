export default function setupSocketEvents(io) {
  // When a user connects to the switchboard
  io.on("connection", (socket) => {
    console.log(`📞 User connected: ${socket.id}`);

    // EVENT 1: JOINING A PRIVATE ROOM
    socket.on("join_match", (data) => {
      const matchId = data.matchId;
      const roomName = `match_${matchId}`; // e.g., "match_5"
      
      // socket.join() is a built-in Socket.io command. 
      // It locks the user inside a specific private room.
      socket.join(roomName); 
      console.log(`User ${socket.id} joined room: ${roomName}`);
    });

    // EVENT 2: DRAWING SYNC
    socket.on("draw_stroke", (data) => {
      // 'data' will contain { matchId: 5, x: 100, y: 150, color: "black" }
      const roomName = `match_${data.matchId}`;

      // socket.to().emit() sends a message to everyone in the room EXCEPT the sender.
      // So if John draws, only Jane gets the "receive_stroke" event.
      socket.to(roomName).emit("receive_stroke", data);
    });

    // Built-in disconnect event
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
}
