import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import app, { setDebugIO } from "./src/app.js";

const port = Number(process.env.PORT) || 3000;

import setupSocketEvents from "./src/socket/socketEvents.js";

// 1. Wrap our Express app in a standard HTTP server
const httpServer = createServer(app);

// 2. Attach the Socket.io "Switchboard" to that server
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
  }
});

// 3. Expose IO to debug endpoint for test instrumentation
setDebugIO(io);

// 4. Hand the Switchboard over to our Instruction Manual!
setupSocketEvents(io);

// 5. IMPORTANT: Change app.listen to httpServer.listen!
httpServer.listen(port, () => {
  console.log(`🚀 Backend (HTTP & WebSockets) listening on port ${port}`);
});
