// ============================================================
// LEADERBOARD PAGE
// ============================================================
// The simplest smart page in the app.
// ONE useQuery. ZERO UI state. ZERO mutations. Just fetch and display.
//
// This proves a point: not every page needs to be complex.
// Same pattern (Page → Hook → API), just less state.

import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Trophy, Medal } from 'lucide-react'
import { useLeaderboard } from '@/hooks/useUsers'

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { data: players, isLoading, error } = useLeaderboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading leaderboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">Failed to load leaderboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-right">ELO</div>
            <div className="col-span-2 text-right">Wins</div>
            <div className="col-span-2 text-right">Losses</div>
          </div>

          {/* Table rows */}
          {(players || []).map((player, index) => (
            <div
              key={player.userId}
              onClick={() => navigate(`/profile/${player.userId}`)}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-surface-hover transition-colors items-center"
            >
              {/* Rank — top 3 get special icons */}
              <div className="col-span-1">
                {index === 0 ? <Trophy className="h-4 w-4 text-primary" /> :
                 index === 1 ? <Medal className="h-4 w-4 text-muted-foreground" /> :
                 index === 2 ? <Medal className="h-4 w-4 text-muted-foreground" /> :
                 <span className="text-sm text-muted-foreground">{index + 1}</span>}
              </div>

              {/* Username */}
              <div className="col-span-5">
                <span className="text-sm font-medium">{player.username}</span>
              </div>

              {/* ELO Rating */}
              <div className="col-span-2 text-right">
                <Badge variant="secondary" className="text-xs">{player.eloRating}</Badge>
              </div>

              {/* Wins */}
              <div className="col-span-2 text-right text-sm text-success">
                {player.wins || 0}
              </div>

              {/* Losses */}
              <div className="col-span-2 text-right text-sm text-danger">
                {player.losses || 0}
              </div>
            </div>
          ))}

          {(players || []).length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No players ranked yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
