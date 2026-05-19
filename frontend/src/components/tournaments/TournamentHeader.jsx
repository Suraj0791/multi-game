// Tournament Header — shows tournament info at the top
// DUMB: receives tournament object, displays it. No API, no state.

import { Badge } from '@/components/ui/badge'
import { Swords, User, IndianRupee } from 'lucide-react'

const STATUS_LABELS = {
  REGISTRATION: 'Registration Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
}

export default function TournamentHeader({ tournament }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <Badge variant={tournament.status === 'IN_PROGRESS' ? 'default' : 'secondary'}>
          {STATUS_LABELS[tournament.status] || tournament.status}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Swords className="h-4 w-4" />
          {tournament.gameType === 'TRIVIA' ? 'Trivia' : 'Quick Draw'}
        </span>
        <span className="flex items-center gap-1">
          <User className="h-4 w-4" />
          Hosted by {tournament.hostName}
        </span>
        <span className="flex items-center gap-1">
          <IndianRupee className="h-4 w-4" />
          {tournament.entryFee > 0 ? `₹${tournament.entryFee}` : 'Free'}
        </span>
      </div>
    </div>
  )
}
