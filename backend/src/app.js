import express from "express";
import cors from "cors";
import authRoutes from './routes/auth.routes.js';
import tournamnentRoutes from './routes/tournaments.routes.js';
import matchRoutes from './routes/matches.routes.js'; 
import leaderboardRoutes from './routes/leaderboard.routes.js'; 
import userRoutes from './routes/users.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Middleware
app.use(cors());

// Webhook routes MUST come BEFORE express.json()
app.use('/webhooks', webhookRoutes);

// JSON parsing for ALL other routes
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ success: true, data: { message: "TourneyHub API is running" } });
});

app.use('/auth', authRoutes);
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
// Catches all errors thrown in any route/controller/service above
app.use(errorHandler);

export default app;
