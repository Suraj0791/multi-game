import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Brain, Brush, Eye, IndianRupee, User, Users } from 'lucide-react'

const GAME_CONFIG = {
  TRIVIA: {
    label: 'Trivia',
    icon: Brain,
    accent: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  },
  QUICK_DRAW: {
    label: 'QuickDraw',
    icon: Brush,
    accent: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  },
}

const STATUS_CONFIG = {
  REGISTRATION: {
    label: 'Open',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  IN_PROGRESS: {
    label: 'Live',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  COMPLETED: {
    label: 'Done',
    className: 'border-neutral-600 bg-neutral-800/70 text-neutral-300',
  },
}

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate()
  const game = GAME_CONFIG[tournament.gameType] || GAME_CONFIG.TRIVIA
  const status = STATUS_CONFIG[tournament.status] || {
    label: tournament.status,
    className: 'border-border bg-muted text-muted-foreground',
  }
  const GameIcon = game.icon
  const joinedCount = tournament.playerCount ?? null
  const maxPlayers = Number(tournament.maxPlayers) || 0
  const shownPlayers = joinedCount ?? (tournament.status === 'REGISTRATION' ? 1 : null)
  const progress = maxPlayers && shownPlayers !== null ? Math.min((shownPlayers / maxPlayers) * 100, 100) : 0
  const isPaid = Number(tournament.entryFee) > 0

  return (
    <article
      onClick={() => navigate(`/tournaments/${tournament.id}`)}
      className="group cursor-pointer rounded-xl border border-border/70 bg-surface/45 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/35 hover:bg-surface/75"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Badge variant="outline" className={game.accent}>
            <GameIcon className="h-3 w-3" />
            {game.label}
          </Badge>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50">
            {tournament.name}
          </h3>
        </div>
        <Badge variant="outline" className={status.className}>
          {status.label}
        </Badge>
      </div>

      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-neutral-500" />
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate">Hosted by {tournament.hostName || 'Unknown'}</span>
            {tournament.hostIsGuest && (
              <span className="rounded-sm bg-neutral-800 px-1 py-[1px] text-[9px] uppercase tracking-wide text-neutral-400">Guest</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Players
            </div>
            <p className="font-medium text-neutral-200">
              {shownPlayers !== null ? `${shownPlayers} / ${maxPlayers}` : `${maxPlayers} slots`}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              Entry
            </div>
            <p className={isPaid ? 'font-medium text-amber-300' : 'font-medium text-emerald-300'}>
              {isPaid ? `₹${tournament.entryFee}` : 'Free'}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span>Lobby fill</span>
            <span>{shownPlayers !== null ? `${Math.round(progress)}%` : 'Waiting'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs text-muted-foreground">
          {tournament.createdAt ? new Date(tournament.createdAt).toLocaleDateString() : 'Recently created'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-neutral-300 group-hover:text-amber-300"
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/tournaments/${tournament.id}`)
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      </div>
    </article>
  )
}
