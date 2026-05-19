// ============================================================
// MATCH PAGE — Smart component for live games
// ============================================================
// Fetches match data to know: which game type? who are the players?
// Connects to WebSocket, passes socket to the game component.
//
// This page DECIDES which game to show:
//   match.gameType === 'TRIVIA'     → <TriviaGame />
//   match.gameType === 'QUICK_DRAW' → <QuickDrawGame /> (future)

import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useSocket from '@/hooks/useSocket'
import useAuthStore from '@/stores/authStore'
import api from '@/api/axiosClient'
import TriviaGame from '@/components/games/TriviaGame'
import QuickDrawGame from '@/components/games/QuickDrawGame'

// Fetch match details — we need to know the game type and player IDs
async function getMatch(tournamentId, matchId) {
  const response = await api.get(`/tournaments/${tournamentId}/bracket`)
  // Find the specific match from the bracket
  const bracket = response.data.data
  if (!bracket?.rounds) return null
  for (const round of Object.values(bracket.rounds)) {
    const match = round.find(m => m.id === Number(matchId))
    if (match) return match
  }
  return null
}

export default function MatchPage() {
  const { id: tournamentId, matchId } = useParams()
  const userId = useAuthStore((state) => state.userId)
  const socketRef = useSocket()

  // Fetch match data to know game type + player IDs
  const { data: match, isLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(tournamentId, matchId),
    enabled: !!matchId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading match...</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">Match not found.</p>
      </div>
    )
  }

  // Decide which game component to render based on game type
  // The match object has a gameType field from the tournament
  const GameComponent = match.gameType === 'QUICK_DRAW' ? QuickDrawGame : TriviaGame

  return (
    <div className="py-4">
      <GameComponent
        socket={socketRef.current}
        matchId={Number(matchId)}
        player1Id={match.player1Id}
        player2Id={match.player2Id}
        currentUserId={userId}
      />
    </div>
  )
}
