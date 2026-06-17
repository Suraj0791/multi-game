import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock3, Crown, UserPlus, Users } from 'lucide-react'

function getInitials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

export default function PlayerList({ players, maxPlayers, hostId, currentUserId }) {
  const slots = Array.from({ length: maxPlayers || players.length || 0 }, (_, index) => players[index] || null)

  return (
    <section className="rounded-xl border border-border/70 bg-surface/35">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Players</h2>
        </div>
        <Badge variant="outline" className="border-border/80 bg-background/60 text-neutral-300">
          {players.length}/{maxPlayers}
        </Badge>
      </div>

      <div className="space-y-2 p-3">
        {slots.map((player, index) => {
          if (!player) {
            return (
              <div
                key={`empty-${index}`}
                className="flex items-center gap-3 rounded-lg border border-dashed border-border/70 bg-background/35 px-3 py-2.5 text-sm text-muted-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-muted/40">
                  <UserPlus className="h-4 w-4" />
                </span>
                <span>Waiting for player</span>
              </div>
            )
          }

          const isHost = Number(player.playerId) === Number(hostId)
          const isCurrentUser = Number(player.playerId) === Number(currentUserId)
          const isPaid = player.paymentStatus === 'COMPLETED'

          return (
            <div
              key={player.playerId}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/55 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-surface-hover text-xs font-bold text-neutral-200">
                  {getInitials(player.username)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-neutral-100">{player.username}</p>
                    {isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ELO {player.eloRating || 1000}
                    {isCurrentUser ? ' - You' : ''}
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={
                  isPaid
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }
              >
                {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                {isPaid ? 'Ready' : 'Pending'}
              </Badge>
            </div>
          )
        })}
      </div>
    </section>
  )
}
