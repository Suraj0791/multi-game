import "dotenv/config";
import { createServer } from "http"; // Built-in Node module
import { Server } from "socket.io";  // The library we just installed
import app from "./src/app.js";

const port = Number(process.env.PORT) || 3000;

// 1. Wrap our Express app in a standard HTTP server
const httpServer = createServer(app);

// 2. Attach the Socket.io "Switchboard" to that server
export const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow any frontend to call us
  }
});

// 3. Hire the Switchboard Operator!
// Every time a new user connects, this function runs.
io.on("connection", (socket) => {
  console.log(`📞 New phone call! User connected with ID: ${socket.id}`);

  // Listen for the user hanging up
  socket.on("disconnect", () => {
    console.log(`❌ User hung up: ${socket.id}`);
  });
});

// 4. IMPORTANT: Change app.listen to httpServer.listen!
httpServer.listen(port, () => {
  console.log(`🚀 Backend (HTTP & WebSockets) listening on port ${port}`);
});
