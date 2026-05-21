import { Link, useLocation } from 'react-router-dom'
import { Trophy, Swords, BarChart3, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAuthStore from '@/stores/authStore'

export default function Navbar() {
  const logout = useAuthStore((state) => state.logout)
  const userId = useAuthStore((state) => state.userId)
  const location = useLocation()  // tells us the current URL

  // Helper: is this link the current page? (for highlighting)
  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <nav className="border-b border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* LEFT side — Logo + Navigation links */}
        <div className="flex items-center gap-6">
          <Link to="/tournaments" className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">TourneyHub</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/tournaments">
              <Button variant={isActive('/tournaments') ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 text-sm">
                <Swords className="h-4 w-4" />
                Tournaments
              </Button>
            </Link>
            <Link to="/leaderboard">
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
            <Link to={`/profile/${userId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <User className="h-4 w-4" />
                Profile
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}
