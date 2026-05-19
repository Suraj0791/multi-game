// ============================================================
// PROFILE PAGE
// ============================================================
// Shows a user's stats. Similar simplicity to Leaderboard.
// One useQuery for user data. No mutations. No forms.

import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Trophy, Target, TrendingUp } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUsers'
import useAuthStore from '@/stores/authStore'

export default function ProfilePage() {
  const { id } = useParams()
  const currentUserId = useAuthStore((state) => state.userId)
  const isOwnProfile = id === currentUserId

  const { data: user, isLoading, error } = useUserProfile(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">User not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-surface flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {user.username}
                {isOwnProfile && <span className="text-sm text-muted-foreground ml-2">(You)</span>}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  ELO {user.eloRating || 1000}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold">{user.gamesPlayed || 0}</p>
            <p className="text-xs text-muted-foreground">Games Played</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{user.wins || 0}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-danger mx-auto mb-1" />
            <p className="text-2xl font-bold text-danger">{user.losses || 0}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
