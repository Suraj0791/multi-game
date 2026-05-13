// Badges logic based on TourneyHub rules

// Helper to determine the Rank Badge based on ELO
export function getRankBadge(eloRating) {
  if (eloRating >= 2000) return { name: "Grandmaster", color: "Diamond", icon: "👑" };
  if (eloRating >= 1800) return { name: "Master", color: "Gold", icon: "🥇" };
  if (eloRating >= 1500) return { name: "Veteran", color: "Silver", icon: "🥈" };
  if (eloRating >= 1200) return { name: "Competitor", color: "Bronze", icon: "🥉" };
  return { name: "Rookie", color: "Wood", icon: "🌱" };
}

// Helper to determine Achievement Badges based on wins
export function getAchievementBadges(totalWins) {
  const achievements = [];
  
  if (totalWins >= 1) achievements.push({ name: "First Blood", icon: "🩸", desc: "Won your first match" });
  if (totalWins >= 10) achievements.push({ name: "Hot Streak", icon: "🔥", desc: "Won 10 matches" });
  if (totalWins >= 50) achievements.push({ name: "Gladiator", icon: "⚔️", desc: "Won 50 matches" });
  if (totalWins >= 100) achievements.push({ name: "Centurion", icon: "💯", desc: "Won 100 matches" });
  
  return achievements;
}
