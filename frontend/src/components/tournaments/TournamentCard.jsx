// ============================================================
// TOURNAMENT CARD — Dumb component
// ============================================================
// This component has:
//   - NO useQuery (doesn't fetch data)
//   - NO useState (no local state)
//   - NO API calls
//
// It just receives a tournament object as a PROP and displays it.
// This is what "dumb component" means — it only knows about rendering.
//
// PROPS CONTRACT:
//   tournament: { id, name, gameType, hostName, maxPlayers, entryFee, status }
//   onClick: function called when card is clicked

import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Swords, Users, IndianRupee } from 'lucide-react'

// Map game types to display labels
const GAME_LABELS = {
  TRIVIA: 'Trivia',
  QUICK_DRAW: 'Quick Draw',
}

// Map status to badge color variants
const STATUS_COLORS = {
  REGISTRATION: 'default',    // neutral
  IN_PROGRESS: 'secondary',   // highlighted
  COMPLETED: 'outline',       // muted
}

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate()

  return (
    <Card
      // Clicking the card navigates to the tournament detail page
      onClick={() => navigate(`/tournaments/${tournament.id}`)}
      className="cursor-pointer transition-colors hover:bg-surface-hover"
    >
      <CardContent className="p-4">
        {/* Top row: Name + Status badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-foreground leading-tight">
            {tournament.name}
          </h3>
          <Badge variant={STATUS_COLORS[tournament.status] || 'default'}>
            {tournament.status}
          </Badge>
        </div>

        {/* Info row: Game type, host, players, fee */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5" />
            <span>{GAME_LABELS[tournament.gameType] || tournament.gameType}</span>
            <span className="text-border">•</span>
            <span>by {tournament.hostName}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{tournament.maxPlayers} players</span>
            </div>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5" />
              <span>{tournament.entryFee > 0 ? `₹${tournament.entryFee}` : 'Free'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
