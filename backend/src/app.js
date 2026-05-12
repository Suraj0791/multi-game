import express from "express";
import cors from "cors";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes (we'll add these later)
app.get("/", (req, res) => {
  res.json({ message: "TourneyHub API is running" });
});

export default app;
