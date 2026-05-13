import { getTopPlayers } from '../models/User.js';

export async function getLeaderboard(limit = 10) {
  // We can add more business logic here later (e.g., separating by game type if we split ratings)
  const players = await getTopPlayers(limit);
  
  // Format the response, maybe calculate win rate
  return players.map((player, index) => {
    const totalGames = player.total_wins + player.total_losses;
    const winRate = totalGames > 0 ? ((player.total_wins / totalGames) * 100).toFixed(1) + '%' : '0%';

    return {
      rank: index + 1,
      id: player.id,
      username: player.username,
      avatar_url: player.avatar_url,
      eloRating: player.elo_rating,
      wins: player.total_wins,
      losses: player.total_losses,
      winRate
    };
  });
}
