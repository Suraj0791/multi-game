// ============================================================
// TOURNAMENT DETAIL PAGE — The Smart Component
// ============================================================
// This is the most complex page in the app.
// It fetches 3 data sources, computes derived state,
// and passes everything to dumb children.
//
// DATA SOURCES:
//   1. tournament   → useQuery via useTournament(id)
//   2. players      → useQuery via usePlayers(id)
//   3. bracket      → useQuery via useBracket(id)
//
// DERIVED STATE (computed from the above):
//   isHost, hasJoined, canJoin, canLeave, canStart, showBracket
//
// MUTATIONS:
//   joinMutation, leaveMutation, startMutation

import { useParams } from 'react-router-dom'
import { useTournament } from '@/hooks/useTournaments'
import { usePlayers, useJoinTournament, useLeaveTournament, useStartTournament, useBracket } from '@/hooks/usePlayers'
import useAuthStore from '@/stores/authStore'
import useSocket from '@/hooks/useSocket'

import TournamentHeader from '@/components/tournaments/TournamentHeader'
import PlayerList from '@/components/tournaments/PlayerList'
import ActionButtons from '@/components/tournaments/ActionButtons'
import BracketView from '@/components/bracket/BracketView'
import ChatPanel from '@/components/chat/ChatPanel'

export default function TournamentDetailPage() {
  // Get the tournament ID from the URL (/tournaments/:id)
  // useParams is React Router's version of req.params in Express
  const { id } = useParams()

  // Get current user's ID from Zustand
  const userId = useAuthStore((state) => state.userId)
  const socket = useSocket()

  // ============================================================
  // SERVER STATE — 3 parallel data fetches
  // ============================================================
  const { data: tournament, isLoading: loadingTournament } = useTournament(id)
  const { data: players, isLoading: loadingPlayers } = usePlayers(id)
  const { data: bracket } = useBracket(id)

  // ============================================================
  // MUTATIONS — the action functions
  // ============================================================
  const joinMutation = useJoinTournament(id)
  const leaveMutation = useLeaveTournament(id)
  const startMutation = useStartTournament(id)

  // ============================================================
  // DERIVED STATE — computed from server state + userId
  // ============================================================
  // These are NOT stored. They're recalculated every render.
  // If tournament or players change, these update automatically.

  const isHost = tournament?.hostId === Number(userId)
  const hasJoined = (players || []).some(p => p.playerId === Number(userId))
  const canJoin = !hasJoined && tournament?.status === 'REGISTRATION'
  const canLeave = hasJoined && tournament?.status === 'REGISTRATION'
  const canStart = isHost && tournament?.status === 'REGISTRATION' && (players || []).length >= 2
  const showBracket = tournament?.status !== 'REGISTRATION'

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loadingTournament || loadingPlayers) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading tournament...</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">Tournament not found.</p>
      </div>
    )
  }

  // ============================================================
  // RENDER — pass everything down to dumb children
  // ============================================================
  return (
    <div className="space-y-6">

      {/* Section A: Tournament info */}
      <TournamentHeader tournament={tournament} />

      {/* Section B: Action buttons — page passes computed booleans */}
      <ActionButtons
        canJoin={canJoin}
        canLeave={canLeave}
        canStart={canStart}
        onJoin={() => joinMutation.mutate()}
        onLeave={() => leaveMutation.mutate()}
        onStart={() => startMutation.mutate()}
        isJoining={joinMutation.isPending}
        isLeaving={leaveMutation.isPending}
        isStarting={startMutation.isPending}
      />

      {/* Three-section layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Player list */}
        <div className="lg:col-span-1 space-y-6">
          <PlayerList players={players || []} maxPlayers={tournament.maxPlayers} />
          {/* Chat below player list */}
          <ChatPanel
            socket={socket}
            tournamentId={id}
            userId={userId}
          />
        </div>

        {/* Right: Bracket (only after tournament starts) */}
        <div className="lg:col-span-2">
          {showBracket && bracket && (
            <BracketView
              bracket={bracket}
              tournamentId={id}
              currentUserId={userId}
            />
          )}
        </div>
      </div>
    </div>
  )
}
