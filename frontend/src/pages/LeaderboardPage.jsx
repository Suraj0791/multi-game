// ============================================================
// LEADERBOARD PAGE
// ============================================================
// Overhauled with premium esports lobby designs.
// Shows Top 3 players on styled podium blocks and ranks 4+ below.

import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Crown, User, Swords, Shield } from 'lucide-react'
import { useLeaderboard } from '@/hooks/useUsers'

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { data: players, isLoading, error } = useLeaderboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground animate-pulse">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger font-semibold">Failed to load leaderboard.</p>
      </div>
    )
  }

  const sortedPlayers = players || []
  const podiumPlayers = sortedPlayers.slice(0, 3)
  const remainingPlayers = sortedPlayers.slice(3)

  // Helper to render initials
  const getInitials = (name) => {
    if (!name) return '?'
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
            <p className="text-xs text-muted-foreground">Top players ranked by ELO rating</p>
          </div>
        </div>
      </div>

      {/* Podium Section */}
      {podiumPlayers.length > 0 && (
        <div className="grid grid-cols-3 gap-3 md:gap-6 items-end justify-center pt-8 pb-4 px-2 bg-gradient-to-t from-surface/20 to-transparent rounded-2xl border border-border/10">
          
          {/* 2nd Place */}
          {podiumPlayers[1] && (
            <div 
              onClick={() => navigate(`/profile/${podiumPlayers[1].userId}`)}
              className="flex flex-col items-center order-1 cursor-pointer group"
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-slate-500 via-slate-400 to-slate-600 flex items-center justify-center font-bold text-lg md:text-xl text-white border-2 border-slate-300 shadow-[0_0_15px_rgba(200,200,200,0.2)] group-hover:scale-105 transition-transform duration-300">
                  {getInitials(podiumPlayers[1].username)}
                </div>
                <div className="absolute -bottom-2 -right-1 bg-slate-400 text-white rounded-full p-1 border border-background flex items-center justify-center">
                  <Medal className="h-4 w-4" />
                </div>
              </div>
              <div className="text-center w-full px-1">
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{podiumPlayers[1].username}</p>
                <Badge variant="outline" className="mt-1 bg-slate-400/10 border-slate-400/30 text-slate-300 text-xs">
                  {podiumPlayers[1].eloRating} ELO
                </Badge>
              </div>
              
              {/* Podium Base Block */}
              <div className="w-full mt-4 h-24 md:h-32 bg-gradient-to-t from-slate-500/10 to-slate-500/20 border border-slate-500/30 rounded-t-xl flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-400/40">2</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-1">Silver</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {podiumPlayers[0] && (
            <div 
              onClick={() => navigate(`/profile/${podiumPlayers[0].userId}`)}
              className="flex flex-col items-center order-2 cursor-pointer group -translate-y-3"
            >
              <div className="relative mb-3">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-bounce">
                  <Crown className="h-6 w-6 text-amber-500 fill-amber-500" />
                </div>
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center font-bold text-xl md:text-2xl text-slate-950 border-4 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform duration-300">
                  {getInitials(podiumPlayers[0].username)}
                </div>
                <div className="absolute -bottom-2 -right-1 bg-amber-500 text-slate-950 rounded-full p-1 border-2 border-background flex items-center justify-center">
                  <Trophy className="h-4 w-4" />
                </div>
              </div>
              <div className="text-center w-full px-1">
                <p className="text-base font-bold truncate group-hover:text-amber-400 transition-colors">{podiumPlayers[0].username}</p>
                <Badge className="mt-1 bg-amber-500 text-slate-950 hover:bg-amber-500/90 text-xs font-semibold">
                  {podiumPlayers[0].eloRating} ELO
                </Badge>
              </div>
              
              {/* Podium Base Block */}
              <div className="w-full mt-4 h-32 md:h-40 bg-gradient-to-t from-amber-500/10 to-amber-500/25 border-t-2 border-x border-amber-500/40 rounded-t-xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.05)]">
                <span className="text-5xl font-black text-amber-500/40">1</span>
                <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold mt-1">Champion</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {podiumPlayers[2] && (
            <div 
              onClick={() => navigate(`/profile/${podiumPlayers[2].userId}`)}
              className="flex flex-col items-center order-3 cursor-pointer group"
            >
              <div className="relative mb-3">
                <div className="w-14 h-14 md:w-18 md:h-18 rounded-full bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 flex items-center justify-center font-bold text-base md:text-lg text-white border-2 border-amber-700 shadow-[0_0_15px_rgba(180,83,9,0.2)] group-hover:scale-105 transition-transform duration-300">
                  {getInitials(podiumPlayers[2].username)}
                </div>
                <div className="absolute -bottom-2 -right-1 bg-amber-700 text-white rounded-full p-1 border border-background flex items-center justify-center">
                  <Medal className="h-4 w-4" />
                </div>
              </div>
              <div className="text-center w-full px-1">
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{podiumPlayers[2].username}</p>
                <Badge variant="outline" className="mt-1 bg-amber-700/10 border-amber-700/30 text-amber-600 text-xs">
                  {podiumPlayers[2].eloRating} ELO
                </Badge>
              </div>
              
              {/* Podium Base Block */}
              <div className="w-full mt-4 h-20 md:h-24 bg-gradient-to-t from-amber-700/10 to-amber-700/20 border border-amber-700/30 rounded-t-xl flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-amber-700/40">3</span>
                <span className="text-[10px] text-amber-600 uppercase tracking-widest font-semibold mt-1">Bronze</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Rankings Table for ranks 4+ */}
      <Card className="border border-border/40 bg-surface/30 backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/40 text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-2">Rank</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2 text-center">ELO</div>
            <div className="col-span-2 text-right text-success flex items-center justify-end gap-1">
              <Shield className="h-3 w-3" /> WINS
            </div>
            <div className="col-span-2 text-right text-danger flex items-center justify-end gap-1">
              <Swords className="h-3 w-3" /> LOSSES
            </div>
          </div>

          {/* Rows */}
          {remainingPlayers.map((player, idx) => {
            const actualRank = idx + 4
            return (
              <div
                key={player.userId}
                onClick={() => navigate(`/profile/${player.userId}`)}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/20 last:border-0 cursor-pointer hover:bg-surface-hover/60 transition-all duration-200 items-center group"
              >
                <div className="col-span-2 text-sm font-semibold text-muted-foreground group-hover:text-foreground">
                  #{actualRank}
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-surface-hover flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border group-hover:border-primary/40 group-hover:text-primary transition-colors">
                    {getInitials(player.username)}
                  </div>
                  <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {player.username}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <Badge variant="outline" className="border-border/60 bg-surface/20 group-hover:border-primary/40 text-xs px-2 py-0.5">
                    {player.eloRating}
                  </Badge>
                </div>
                <div className="col-span-2 text-right text-sm text-success font-medium">
                  {player.wins || 0}
                </div>
                <div className="col-span-2 text-right text-sm text-danger font-medium">
                  {player.losses || 0}
                </div>
              </div>
            )
          })}

          {sortedPlayers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <User className="h-8 w-8 text-muted-foreground/40" />
              <p>No players ranked yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
