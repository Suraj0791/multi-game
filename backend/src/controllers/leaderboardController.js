import { getLeaderboard } from '../services/leaderboardService.js';

export async function fetchLeaderboard(req, res) {
  try {
    // Optional query param: ?limit=50
    const limit = parseInt(req.query.limit) || 10;
    
    const leaderboard = await getLeaderboard(limit);
    
    res.status(200).json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}
