// Bracket View — shows tournament rounds and matches
// DUMB: receives bracket data, renders rounds and match cards.

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy } from 'lucide-react'

export default function BracketView({ bracket, tournamentId, currentUserId }) {
  const navigate = useNavigate()

  if (!bracket || !bracket.rounds) {
    return null
  }

  // bracket.rounds = { round1: [match, match], round2: [match], ... }
  const roundKeys = Object.keys(bracket.rounds).sort()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Bracket
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 overflow-x-auto pb-2">
          {roundKeys.map((roundKey) => (
            <div key={roundKey} className="min-w-[200px]">
              {/* Round header */}
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                {roundKey.replace('round', 'Round ')}
              </p>

              {/* Matches in this round */}
              <div className="space-y-2">
                {bracket.rounds[roundKey].map((match) => {
                  // Can this user click into this match? Only if they're in it
                  const isMyMatch =
                    match.player1Id === Number(currentUserId) ||
                    match.player2Id === Number(currentUserId)

                  return (
                    <div
                      key={match.id}
                      onClick={() => isMyMatch && match.status !== 'COMPLETED' &&
                        navigate(`/tournaments/${tournamentId}/match/${match.id}`)}
                      className={`border border-border rounded-md p-2 text-sm space-y-1
                        ${isMyMatch && match.status !== 'COMPLETED' ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
                    >
                      {/* Player 1 */}
                      <div className={`flex justify-between ${match.winnerId === match.player1Id ? 'text-success font-medium' : 'text-foreground'}`}>
                        <span>{match.player1Name || 'TBD'}</span>
                      </div>
                      {/* Player 2 */}
                      <div className={`flex justify-between ${match.winnerId === match.player2Id ? 'text-success font-medium' : 'text-foreground'}`}>
                        <span>{match.player2Name || 'TBD'}</span>
                      </div>
                      {/* Match status */}
                      <Badge variant="outline" className="text-xs mt-1">
                        {match.status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
