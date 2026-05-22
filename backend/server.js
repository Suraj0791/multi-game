import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import app, { setDebugIO } from "./src/app.js";
import { initDatabase } from "./src/config/dbInit.js";

const port = Number(process.env.PORT) || 3000;

import setupSocketEvents from "./src/socket/socketEvents.js";

// 1. Wrap our Express app in a standard HTTP server
const httpServer = createServer(app);

// 2. Attach the Socket.io "Switchboard" to that server with unified CORS settings
const corsOptions = {
  origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

export const io = new Server(httpServer, {
  cors: corsOptions
});

// 3. Expose IO to debug endpoint for test instrumentation
setDebugIO(io);

// 4. Hand the Switchboard over to our Instruction Manual!
setupSocketEvents(io);

// Initialize DB migrations & guest cleanup
initDatabase().catch((err) => {
  console.error("Failed to initialize database:", err);
});

// 5. IMPORTANT: Change app.listen to httpServer.listen!
httpServer.listen(port, () => {
  console.log(`🚀 Backend (HTTP & WebSockets) listening on port ${port}`);
});

