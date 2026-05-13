import express from "express";
import cors from "cors";
import authRoutes from './routes/auth.routes.js';
import tournamnentRoutes from './routes/tournaments.routes.js';
import matchRoutes from './routes/matches.routes.js'; 
import leaderboardRoutes from './routes/leaderboard.routes.js'; 
import userRoutes from './routes/users.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import notificationRoutes from './routes/notifications.routes.js';

const app = express();

// Middleware
app.use(cors());

// Webhook routes MUST come BEFORE express.json()
// WHY? Webhooks need the raw body (untouched bytes) for signature verification.
// express.json() parses the body into a JS object — raw bytes are lost.
// The webhook route uses express.raw() internally to keep the raw bytes.
app.use('/webhooks', webhookRoutes);

// JSON parsing for ALL other routes (everything below this line gets parsed bodies)
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ message: "TourneyHub API is running" });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/tournaments', tournamnentRoutes);
app.use('/matches', matchRoutes); 
app.use('/leaderboard', leaderboardRoutes);
app.use('/notifications', notificationRoutes);

export default app;
