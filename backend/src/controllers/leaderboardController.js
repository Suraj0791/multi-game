import { getLeaderboard } from '../services/leaderboardService.js';
import cache from '../utils/cache.js';

export async function fetchLeaderboard(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const cacheKey = `leaderboard_${limit}`;

    // 1. Check Cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ leaderboard: cachedData });
    }

    // 2. Cache Miss — Fetch from DB
    const leaderboard = await getLeaderboard(limit);
    
    // 3. Save to Cache (leaderboard updates slowly, 30s TTL is fine)
    cache.set(cacheKey, leaderboard);
    
    res.status(200).json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}
