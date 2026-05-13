import express from "express";
import cors from "cors";
import authRoutes from './routes/auth.routes.js';
import tournamnentRoutes from './routes/tournaments.routes.js';
import matchRoutes from './routes/matches.routes.js'; 
import leaderboardRoutes from './routes/leaderboard.routes.js'; // NEW

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ message: "TourneyHub API is running" });
});

app.use('/auth', authRoutes);
app.use('/tournaments', tournamnentRoutes);
app.use('/matches', matchRoutes); 
app.use('/leaderboard', leaderboardRoutes); // NEW

export default app;
