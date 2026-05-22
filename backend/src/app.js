import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// Route imports
import authRoutes from './routes/auth.routes.js';
import tournamnentRoutes from './routes/tournaments.routes.js';
import matchRoutes from './routes/matches.routes.js'; 
import leaderboardRoutes from './routes/leaderboard.routes.js'; 
import userRoutes from './routes/users.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet — sets security HTTP headers (prevents XSS, clickjacking, etc.)
// One line, instant security. No config needed.
app.use(helmet());

// CORS — controls which domains can call your API
// In development: allow localhost. In production: lock to your frontend domain.
const corsOptions = {
  origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate Limiting — prevents spam and brute force attacks
// 100 requests per 15 minutes per IP address (skipped in development/testing)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  message: { success: false, error: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,      // sends rate limit info in response headers
  skip: () => process.env.NODE_ENV !== 'production',
});

// Stricter limit for auth routes — prevents brute force password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  message: { success: false, error: 'Too many auth attempts. Try again later.' },
  skip: () => process.env.NODE_ENV !== 'production',
});

app.use(generalLimiter);  // apply to ALL routes

// ============================================================
// LOGGING
// ============================================================

// Morgan — logs every HTTP request automatically
// "dev" format: GET /tournaments 200 23ms
app.use(morgan('dev'));

// ============================================================
// BODY PARSING
// ============================================================

// Webhook routes MUST come BEFORE express.json()
app.use('/webhooks', webhookRoutes);

// JSON parsing for ALL other routes
app.use(express.json());

// ============================================================
// HEALTH CHECK — monitoring tools ping this to check if server is alive
// ============================================================
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: Math.floor(process.uptime()) + 's',
      memory: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      timestamp: new Date().toISOString()
    }
  });
});

// ============================================================
// ROUTES
// ============================================================
app.get("/", (req, res) => {
  res.json({ success: true, data: { message: "TourneyHub API is running" } });
});

// Auth routes get the STRICTER rate limiter
app.use('/auth', authLimiter, authRoutes);

app.use('/users', userRoutes);
app.use('/tournaments', tournamnentRoutes);
app.use('/matches', matchRoutes); 
app.use('/leaderboard', leaderboardRoutes);
app.use('/notifications', notificationRoutes);

// 404 handler — if no route matched above
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Centralized error handler — MUST be LAST
app.use(errorHandler);

// Debug/memory endpoint for test instrumentation
// Returns current game state counts for leak detection
let _ioRef = null;
export function setDebugIO(io) {
  _ioRef = io;
}

// Also expose a global setter for the socket test setup
if (typeof global !== 'undefined') {
  global.__setDebugIO = setDebugIO;
}

app.get('/api/debug/memory', (req, res) => {
  const memUsage = process.memoryUsage();
  let socketInfo = { rooms: 0, clients: 0, matchRooms: [] };
  try {
    if (_ioRef) {
      const rooms = _ioRef.sockets?.adapter?.rooms;
      if (rooms) {
        socketInfo.rooms = rooms.size;
        socketInfo.matchRooms = [...rooms.keys()].filter(k => k.startsWith('match_'));
      }
      const clients = _ioRef.sockets?.adapter?.sids;
      if (clients) socketInfo.clients = clients.size;
    }
  } catch (e) {
    socketInfo.error = e.message;
  }

  res.json({
    success: true,
    data: {
      process: {
        uptime: Math.floor(process.uptime()) + 's',
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        },
      },
      socket: socketInfo,
      timestamp: new Date().toISOString(),
    },
  });
});

export default app;
