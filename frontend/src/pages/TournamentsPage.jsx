import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RotateCcw, Search, Swords, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTournaments } from '@/hooks/useTournaments'
import TournamentCard from '@/components/tournaments/TournamentCard'

const STATUSES = [
  { value: 'ALL', label: 'All' },
  { value: 'REGISTRATION', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'Live' },
  { value: 'COMPLETED', label: 'Done' },
]

function TournamentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-2 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mt-4 h-8 animate-pulse rounded border-t border-border/60 bg-muted/60" />
    </div>
  )
}

export default function TournamentsPage() {
  const { data: tournaments, isLoading, error } = useTournaments()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filteredTournaments = useMemo(() => {
    return (tournaments || [])
      .filter((tournament) => statusFilter === 'ALL' || tournament.status === statusFilter)
      .filter((tournament) => tournament.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [tournaments, searchTerm, statusFilter])

  const counts = useMemo(() => {
    const source = tournaments || []
    return {
      total: source.length,
      open: source.filter((item) => item.status === 'REGISTRATION').length,
      live: source.filter((item) => item.status === 'IN_PROGRESS').length,
    }
  }, [tournaments])

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('ALL')
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
        <h1 className="text-lg font-semibold">Could not load tournaments</h1>
        <p className="mt-1 text-sm text-red-200/80">Refresh the page or try again after a moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-surface/35 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Trophy className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse active lobbies, join a bracket, or host the next match.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-border/80 bg-background/50 text-neutral-300">
            {counts.total} total
          </Badge>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            {counts.open} open
          </Badge>
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">
            {counts.live} live
          </Badge>
          <Link to="/tournaments/new">
            <Button>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-surface/30 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tournaments"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-10 border-border/80 bg-background/60 pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {STATUSES.map((status) => (
              <Button
                key={status.value}
                variant={statusFilter === status.value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(status.value)}
                className="shrink-0"
              >
                {status.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <TournamentCardSkeleton key={index} />
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/25 px-6 py-14 text-center">
          <Swords className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-neutral-100">No tournaments found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Create a new tournament or reset the filters to see every lobby.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to="/tournaments/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create Tournament
              </Button>
            </Link>
            {(searchTerm || statusFilter !== 'ALL') && (
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4" />
                Reset filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  )
}
