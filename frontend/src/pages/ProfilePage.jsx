// ============================================================
// PROFILE PAGE
// ============================================================
// Redesigned with a high-fidelity glassmorphic dashboard card,
// ELO-themed avatar rings, circular win rate dial, and stat counters.

import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Trophy, Target, TrendingUp, Medal, Sparkles, Swords } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUsers'
import useAuthStore from '@/stores/authStore'

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUserId = useAuthStore((state) => state.userId)
  const isOwnProfile = Number(id) === Number(currentUserId)

  const { data: user, isLoading, error } = useUserProfile(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground animate-pulse">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger font-semibold">User profile not found.</p>
      </div>
    )
  }

  // Derive Stats
  const elo = user.eloRating || 1000
  const wins = user.wins || 0
  const losses = user.losses || 0
  const totalGames = user.gamesPlayed || (wins + losses)
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

  // Define ELO tier style
  let tierName = 'Bronze'
  let tierGradient = 'from-amber-800 via-amber-700 to-amber-900'
  let borderGlow = 'border-amber-800 shadow-[0_0_20px_rgba(146,64,14,0.35)] text-amber-500'
  let badgeColor = 'bg-amber-800/20 text-amber-600 border-amber-800/40'

  if (elo >= 1800) {
    tierName = 'Grandmaster'
    tierGradient = 'from-amber-500 via-yellow-400 to-amber-600'
    borderGlow = 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] text-amber-400'
    badgeColor = 'bg-amber-500/20 text-amber-500 border-amber-500/40'
  } else if (elo >= 1400) {
    tierName = 'Platinum'
    tierGradient = 'from-slate-400 via-slate-300 to-slate-500'
    borderGlow = 'border-slate-300 shadow-[0_0_20px_rgba(148,163,184,0.4)] text-slate-300'
    badgeColor = 'bg-slate-400/20 text-slate-300 border-slate-400/40'
  }

  // Helper to render initials
  const getInitials = (name) => {
    if (!name) return '?'
    return name.substring(0, 2).toUpperCase()
  }

  // SVG parameters for circular win rate meter
  const radius = 36
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (winRate / 100) * circumference

  if (user?.isGuest) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 px-2">
        <Card className="border border-dashed border-border/40 bg-surface/20 backdrop-blur-md overflow-hidden relative shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700" />
          <CardContent className="p-8 text-center flex flex-col items-center gap-6">
            
            {/* Avatar Ring */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center font-extrabold text-2xl md:text-3xl text-neutral-400 border-4 border-dashed border-neutral-700 transition-all duration-300 hover:scale-105">
                {getInitials(user.username)}
              </div>
              <div className="absolute -top-1 -right-1 bg-neutral-800 text-neutral-400 font-bold text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-neutral-700 shadow-md">
                Guest
              </div>
            </div>

            {/* User Info */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
                {user.username}
                <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Guest Account</span>
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                This is a temporary guest session. Sign up to save your ELO, join tournaments, compete on the leaderboard, and customize your profile!
              </p>
            </div>

            <Button 
              className="mt-2 px-8 py-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg hover:shadow-amber-500/10 transition-all duration-200 cursor-pointer animate-pulse hover:animate-none hover:scale-[1.03]"
              onClick={() => navigate('/register')}
            >
              <Sparkles className="h-4 w-4 mr-2 fill-slate-950" /> Register Now
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      {/* Profile Header Card */}
      <Card className="border border-border/40 bg-surface/30 backdrop-blur-md overflow-hidden relative shadow-xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-amber-500 to-orange-500" />
        <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6">
          
          {/* Avatar Ring */}
          <div className="relative">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${tierGradient} flex items-center justify-center font-extrabold text-2xl md:text-3xl text-white border-4 border-double ${borderGlow} transition-transform duration-300 hover:rotate-3`}>
              {getInitials(user.username)}
            </div>
            {isOwnProfile && (
              <div className="absolute -top-1 -right-1 bg-primary text-slate-950 font-semibold text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-background shadow-md flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5" /> Self
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="text-center sm:text-left flex-1 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center sm:justify-start gap-2">
              {user.username}
              {isOwnProfile && <span className="text-xs font-medium text-muted-foreground">(You)</span>}
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Badge variant="outline" className={`gap-1 font-semibold text-xs ${badgeColor}`}>
                <Medal className="h-3.5 w-3.5" />
                {tierName} Division
              </Badge>
              <Badge variant="secondary" className="gap-1 font-semibold text-xs bg-surface-hover/80 text-foreground border border-border/40">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                {elo} ELO
              </Badge>
            </div>
          </div>

          {/* Radial Win Rate Dial */}
          <div className="flex items-center gap-3 bg-surface/40 px-4 py-3 rounded-xl border border-border/20">
            <div className="relative w-20 h-20">
              {/* SVG Background Circle */}
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  className="stroke-neutral-800 fill-none"
                  strokeWidth={strokeWidth}
                />
                {/* SVG Progress Circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  className="stroke-primary fill-none transition-all duration-500 ease-out"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              {/* Percentage Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold tracking-tighter text-foreground">{winRate}%</span>
                <span className="text-[8px] text-muted-foreground font-medium uppercase">Win Rate</span>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-3 gap-4">
        
        {/* Games Played Card */}
        <Card className="border border-border/40 bg-surface/30 backdrop-blur-md hover:border-border/80 transition-colors duration-200">
          <CardContent className="p-5 text-center flex flex-col items-center gap-1">
            <div className="p-2 rounded-lg bg-info/10 text-info border border-info/20 mb-1">
              <Target className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{totalGames}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Games Played</p>
          </CardContent>
        </Card>

        {/* Wins Card */}
        <Card className="border border-border/40 bg-surface/30 backdrop-blur-md hover:border-success/30 transition-colors duration-200">
          <CardContent className="p-5 text-center flex flex-col items-center gap-1">
            <div className="p-2 rounded-lg bg-success/10 text-success border border-success/20 mb-1">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-success">{wins}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Wins</p>
          </CardContent>
        </Card>

        {/* Losses Card */}
        <Card className="border border-border/40 bg-surface/30 backdrop-blur-md hover:border-danger/30 transition-colors duration-200">
          <CardContent className="p-5 text-center flex flex-col items-center gap-1">
            <div className="p-2 rounded-lg bg-danger/10 text-danger border border-danger/20 mb-1">
              <Swords className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-danger">{losses}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Losses</p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
