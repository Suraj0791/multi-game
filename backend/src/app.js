import express from "express";
import cors from "cors";
import authRoutes from './routes/auth.routes.js';
import tournamnentRoutes from './routes/tournaments.routes.js'


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes (we'll add these later)
app.get("/", (req, res) => {
  res.json({ message: "TourneyHub API is running" });
});

app.use('/auth', authRoutes);
app.use('/tournaments',tournamnentRoutes);


export default app;
