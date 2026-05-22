// Bracket View — shows tournament rounds and matches in a connected tree layout
// Receives bracket data, renders rounds and match cards.

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Crown, Eye, Swords, Lock } from 'lucide-react'

export default function BracketView({ bracket, tournamentId, currentUserId, maxPlayers }) {
  const navigate = useNavigate()

  if (!bracket || !bracket.rounds) {
    return null
  }

  // Determine rounds and structure
  // If maxPlayers is not provided, default to 8
  const limitPlayers = maxPlayers || 8
  const totalRounds = Math.log2(limitPlayers) || 3

  // We want to ensure we have column headers and columns for all rounds
  const roundIndices = Array.from({ length: totalRounds }, (_, i) => i + 1)

  return (
    <Card className="border border-border/40 bg-surface/30 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-surface/20">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary animate-pulse" />
          Tournament Bracket
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 overflow-x-auto">
        <div className="flex gap-12 pt-6 pb-4 select-none justify-between items-center h-[520px] md:h-[600px] min-w-[700px] relative">
          {roundIndices.map((roundNumber) => {
            const roundKey = `round${roundNumber}`
            const numMatches = limitPlayers / Math.pow(2, roundNumber)
            const matchesInRound = bracket.rounds[roundKey] || []

            return (
              <div key={roundNumber} className="flex flex-col justify-around h-full w-[220px] md:w-[260px] relative">
                
                {/* Round Header (absolutely positioned at the top of the column) */}
                <div className="absolute top-[-30px] left-0 w-full text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-surface-hover/60 border border-border/20 rounded px-2 py-0.5 inline-block">
                    {roundNumber === totalRounds ? 'Finals' : roundNumber === totalRounds - 1 ? 'Semifinals' : `Round ${roundNumber}`}
                  </p>
                </div>

                {/* Match Slots in this round */}
                {Array.from({ length: numMatches }).map((_, matchIndex) => {
                  const matchNumber = matchIndex + 1
                  
                  // Find the match in the API data
                  const match = matchesInRound.find(m => m.matchNumber === matchNumber)

                  // If match exists in database
                  if (match) {
                    const isMyMatch =
                      match.player1Id === Number(currentUserId) ||
                      match.player2Id === Number(currentUserId)

                    const isCompleted = match.status === 'COMPLETED'
                    const p1Won = isCompleted && match.winnerId === match.player1Id
                    const p2Won = isCompleted && match.winnerId === match.player2Id
                    
                    const canPlay = isMyMatch && !isCompleted
                    const canSpectate = !isMyMatch && (match.status === 'PLAYING' || match.status === 'READY')

                    // Draw connecting lines if not the last round
                    const hasWinner = isCompleted && match.winnerId
                    const connectorColor = hasWinner ? 'border-primary/75' : 'border-border/30'
                    const distance = 50 / numMatches

                    return (
                      <div key={match.id} className="relative w-full py-2">
                        {/* Inlet Line (left side) for Round > 1 */}
                        {roundNumber > 1 && (
                          <div className="absolute left-[-24px] top-1/2 w-[24px] border-t border-border/30 -translate-y-1/2" />
                        )}

                        {/* Outlet Elbow (right side) for Round < totalRounds */}
                        {roundNumber < totalRounds && (
                          matchIndex % 2 === 0 ? (
                            <div 
                              className={`absolute border-r border-t ${connectorColor} rounded-tr-lg`} 
                              style={{ 
                                left: '100%', 
                                top: '50%', 
                                height: `${distance}%`, 
                                width: '24px',
                                boxShadow: hasWinner ? '2px -2px 8px -3px rgba(245,158,11,0.2)' : 'none'
                              }} 
                            />
                          ) : (
                            <div 
                              className={`absolute border-r border-b ${connectorColor} rounded-br-lg`} 
                              style={{ 
                                left: '100%', 
                                bottom: '50%', 
                                height: `${distance}%`, 
                                width: '24px',
                                boxShadow: hasWinner ? '2px 2px 8px -3px rgba(245,158,11,0.2)' : 'none'
                              }} 
                            />
                          )
                        )}

                        {/* Match Card Container */}
                        <div
                          onClick={() => {
                            if (canPlay || canSpectate) {
                              navigate(`/tournaments/${tournamentId}/match/${match.id}`)
                            }
                          }}
                          className={`border rounded-xl p-3 text-sm transition-all duration-200 bg-surface/60 backdrop-blur-sm
                            ${canPlay ? 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20 cursor-pointer hover:scale-[1.02] hover:bg-surface-hover/80 hover:border-amber-500' : ''}
                            ${canSpectate ? 'border-info/40 cursor-pointer hover:scale-[1.02] hover:bg-surface-hover/80 hover:border-info' : ''}
                            ${isCompleted ? 'border-border/40 opacity-90' : ''}
                            ${!canPlay && !canSpectate && !isCompleted ? 'border-border/40' : ''}
                          `}
                        >
                          {/* Match Header info */}
                          <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-muted-foreground mb-2">
                            <span>Match #{match.matchNumber}</span>
                            {match.status === 'PLAYING' && (
                              <span className="flex items-center gap-1 text-danger font-bold animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Live
                              </span>
                            )}
                            {match.status === 'READY' && (
                              <span className="flex items-center gap-1 text-primary font-bold">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Ready
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-success font-semibold">Ended</span>
                            )}
                          </div>

                          {/* Player Rows */}
                          <div className="space-y-2">
                            {/* Player 1 */}
                            <div className={`flex justify-between items-center p-1 rounded ${p1Won ? 'bg-success/5 border border-success/15' : ''}`}>
                              <span className={`truncate flex items-center gap-1 text-xs max-w-[150px]
                                ${p1Won ? 'text-amber-400 font-bold' : ''}
                                ${isCompleted && !p1Won ? 'text-muted-foreground/60 line-through' : 'text-foreground'}
                              `}>
                                {match.player1Name || 'Player 1'}
                                {p1Won && <Crown className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                              </span>
                              {isCompleted && (
                                <span className={`text-[10px] font-bold ${p1Won ? 'text-success' : 'text-muted-foreground/40'}`}>
                                  {p1Won ? 'W' : 'L'}
                                </span>
                              )}
                            </div>

                            {/* Player 2 */}
                            <div className={`flex justify-between items-center p-1 rounded ${p2Won ? 'bg-success/5 border border-success/15' : ''}`}>
                              <span className={`truncate flex items-center gap-1 text-xs max-w-[150px]
                                ${p2Won ? 'text-amber-400 font-bold' : ''}
                                ${isCompleted && !p2Won ? 'text-muted-foreground/60 line-through' : 'text-foreground'}
                              `}>
                                {match.player2Name || 'Player 2'}
                                {p2Won && <Crown className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                              </span>
                              {isCompleted && (
                                <span className={`text-[10px] font-bold ${p2Won ? 'text-success' : 'text-muted-foreground/40'}`}>
                                  {p2Won ? 'W' : 'L'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Interactive Badges / Buttons */}
                          {canPlay && (
                            <div className="mt-3 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-extrabold uppercase py-1.5 px-2 rounded-lg text-center flex items-center justify-center gap-1 shadow-md animate-pulse">
                              <Swords className="h-3 w-3 fill-slate-950" /> Play Now
                            </div>
                          )}

                          {canSpectate && (
                            <div className="mt-3 w-full bg-info/10 text-info border border-info/30 hover:bg-info/20 text-[10px] font-bold uppercase py-1.5 px-2 rounded-lg text-center flex items-center justify-center gap-1 transition-colors">
                              <Eye className="h-3 w-3" /> Spectate
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  } else {
                    // Match has not been created yet (Placeholder TBD)
                    // Determine which preceding matches this slot depends on
                    const prevMatch1Index = 2 * matchIndex
                    const prevMatch2Index = 2 * matchIndex + 1
                    const distance = 50 / numMatches

                    return (
                      <div key={`tbd-${roundNumber}-${matchIndex}`} className="relative w-full py-2">
                        {/* Inlet Line (left side) for Round > 1 */}
                        {roundNumber > 1 && (
                          <div className="absolute left-[-24px] top-1/2 w-[24px] border-t border-border/20 -translate-y-1/2" />
                        )}

                        {/* Outlet Elbow (right side) for Round < totalRounds */}
                        {roundNumber < totalRounds && (
                          matchIndex % 2 === 0 ? (
                            <div 
                              className="absolute border-r border-t border-border/10 rounded-tr-lg" 
                              style={{ 
                                left: '100%', 
                                top: '50%', 
                                height: `${distance}%`, 
                                width: '24px' 
                              }} 
                            />
                          ) : (
                            <div 
                              className="absolute border-r border-b border-border/10 rounded-br-lg" 
                              style={{ 
                                left: '100%', 
                                bottom: '50%', 
                                height: `${distance}%`, 
                                width: '24px' 
                              }} 
                            />
                          )
                        )}

                        {/* Locked Placeholder Card */}
                        <div className="border border-dashed border-border/20 bg-surface/10 opacity-50 rounded-xl p-3 text-xs w-full">
                          <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2">
                            <span>Match #{matchNumber}</span>
                            <span className="flex items-center gap-0.5 text-muted-foreground/40 font-semibold">
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </span>
                          </div>
                          
                          <div className="space-y-1.5 text-muted-foreground/40 font-medium italic">
                            <div>Winner of Match {prevMatch1Index + 1}</div>
                            <div className="border-t border-border/10 pt-1">Winner of Match {prevMatch2Index + 1}</div>
                          </div>
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
