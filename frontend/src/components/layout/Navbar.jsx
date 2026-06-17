import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Trophy, Swords, BarChart3, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAuthStore from '@/stores/authStore'
import useGameStore from '@/stores/gameStore'

export default function Navbar() {
  const logout = useAuthStore((state) => state.logout)
  const userId = useAuthStore((state) => state.userId)
  const activeMatchId = useGameStore((state) => state.activeMatchId)
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => location.pathname.startsWith(path)

  const handleNavClick = (e, path) => {
    if (activeMatchId) {
      e.preventDefault()
      if (window.confirm('You are in an active match! Leaving will forfeit the game. Continue?')) {
        useGameStore.getState().clearActiveGame()
        navigate(path)
      }
    }
  }

  return (
    <nav className={`border-b border-border bg-surface ${activeMatchId ? 'border-yellow-500/40' : ''}`}>
      {activeMatchId && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-1.5 text-center">
          <p className="text-xs font-bold text-yellow-400 animate-pulse">
            ⚠️ Active match in progress — leaving will forfeit the game
          </p>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* LEFT side — Logo + Navigation links */}
        <div className="flex items-center gap-6">
          <Link to="/tournaments" onClick={(e) => handleNavClick(e, '/tournaments')} className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">TourneyHub</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/tournaments" onClick={(e) => handleNavClick(e, '/tournaments')}>
              <Button variant={isActive('/tournaments') ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 text-sm">
                <Swords className="h-4 w-4" />
                Tournaments
              </Button>
            </Link>
            <Link to="/leaderboard" onClick={(e) => handleNavClick(e, '/leaderboard')}>
              <Button variant={isActive('/leaderboard') ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 text-sm">
                <BarChart3 className="h-4 w-4" />
                Leaderboard
              </Button>
            </Link>
          </div>
        </div>

        {/* RIGHT side — Profile & Logout */}
        <div className="flex items-center gap-2">
          {userId && (
            <Link to={`/profile/${userId}`} onClick={(e) => handleNavClick(e, `/profile/${userId}`)}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <User className="h-4 w-4" />
                Profile
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={() => {
            if (activeMatchId && !window.confirm('You are in an active match! Logging out will forfeit the game. Continue?')) return;
            useGameStore.getState().clearActiveGame();
            logout();
          }} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}
