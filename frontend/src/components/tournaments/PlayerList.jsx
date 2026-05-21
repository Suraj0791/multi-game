// Player List — shows who joined the tournament
// DUMB: receives array of players, renders them. No API calls.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

export default function PlayerList({ players, maxPlayers }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Players ({players.length}/{maxPlayers})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players yet.</p>
        ) : (
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-surface-hover"
              >
                <div>
                  <span className="text-sm font-medium">{player.username}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ELO {player.eloRating}
                  </span>
                </div>
                {player.paymentStatus === 'COMPLETED' ? (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">Paid</Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
