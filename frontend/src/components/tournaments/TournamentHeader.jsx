import { Badge } from '@/components/ui/badge'
import { Brain, Brush, IndianRupee, User, Users } from 'lucide-react'

const STATUS = {
  REGISTRATION: {
    label: 'Registration open',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  IN_PROGRESS: {
    label: 'Live',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'border-neutral-600 bg-neutral-800/70 text-neutral-300',
  },
}

const GAME = {
  TRIVIA: { label: 'Trivia', icon: Brain, className: 'text-emerald-300' },
  QUICK_DRAW: { label: 'QuickDraw', icon: Brush, className: 'text-amber-300' },
}

export default function TournamentHeader({ tournament, playerCount = 0 }) {
  const status = STATUS[tournament.status] || {
    label: tournament.status,
    className: 'border-border bg-muted text-muted-foreground',
  }
  const game = GAME[tournament.gameType] || GAME.TRIVIA
  const GameIcon = game.icon
  const entryFee = Number(tournament.entryFee) > 0 ? `₹${tournament.entryFee}` : 'Free'

  return (
    <section className="rounded-xl border border-border/70 bg-surface/40 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
            <Badge variant="outline" className="border-border/80 bg-background/60 text-neutral-300">
              <GameIcon className={`h-3 w-3 ${game.className}`} />
              {game.label}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-50 md:text-3xl">
            {tournament.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Created {tournament.createdAt ? new Date(tournament.createdAt).toLocaleDateString() : 'recently'}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Host
            </div>
            <p className="truncate text-sm font-medium text-neutral-100">{tournament.hostName}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Players
            </div>
            <p className="text-sm font-medium text-neutral-100">
              {playerCount}/{tournament.maxPlayers}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              Entry
            </div>
            <p className={Number(tournament.entryFee) > 0 ? 'text-sm font-medium text-amber-300' : 'text-sm font-medium text-emerald-300'}>
              {entryFee}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
