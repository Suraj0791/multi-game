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
import { useQueryClient } from '@tanstack/react-query'
import { useTournament } from '@/hooks/useTournaments'
import { usePlayers, useJoinTournament, useLeaveTournament, useStartTournament, useBracket } from '@/hooks/usePlayers'
import useAuthStore from '@/stores/authStore'
import useSocket from '@/hooks/useSocket'
import { createPaymentOrder } from '@/api/tournamentApi'
import { toast } from 'sonner'

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

  const queryClient = useQueryClient()

  // ============================================================
  // DERIVED STATE — computed from server state + userId
  // ============================================================
  // These are NOT stored. They're recalculated every render.
  // If tournament or players change, these update automatically.

  const isHost = tournament?.hostId === Number(userId)
  const playersList = players || []
  const hasJoined = playersList.some(p => p.playerId === Number(userId))
  const canJoin = !hasJoined && tournament?.status === 'REGISTRATION' && playersList.length < (tournament?.maxPlayers || 8)
  const canLeave = hasJoined && tournament?.status === 'REGISTRATION' && !isHost
  const showBracket = tournament?.status !== 'REGISTRATION'

  // Payment derived states
  const currentPlayer = playersList.find(p => p.playerId === Number(userId))
  const needsPayment = hasJoined && tournament?.entryFee > 0 && currentPlayer?.paymentStatus === 'PENDING'

  // Host start validations
  const allSlotsFilledAndPowerOfTwo = 
    playersList.length === tournament?.maxPlayers && 
    (tournament?.maxPlayers & (tournament?.maxPlayers - 1)) === 0
  const hasUnpaidPlayers = tournament?.entryFee > 0 && playersList.some(p => p.paymentStatus !== 'COMPLETED')
  const canStart = isHost && tournament?.status === 'REGISTRATION'

  let startDisabledReason = ''
  if (playersList.length < (tournament?.maxPlayers || 0)) {
    const needed = (tournament?.maxPlayers || 0) - playersList.length
    startDisabledReason = `Need ${needed} more`
  } else if (!allSlotsFilledAndPowerOfTwo) {
    startDisabledReason = 'Tournament size must be a power of 2 (2, 4, 8, 16)'
  } else if (hasUnpaidPlayers) {
    startDisabledReason = 'All players must complete their payment before starting'
  }

  // ============================================================
  // PAYMENT HANDLERS
  // ============================================================
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Failed to load Razorpay payment gateway. Please check your connection.');
        return;
      }

      // Call backend to create payment order
      const orderData = await createPaymentOrder(id);

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'TourneyHub',
        description: `Entry Fee for ${tournament.name}`,
        order_id: orderData.orderId,
        handler: async function (response) {
          toast.success('Payment captured successfully!');
          // Invalidate queries so that players' status updates to COMPLETED in the UI
          queryClient.invalidateQueries({ queryKey: ['players', id] });
        },
        prefill: {
          name: '',
          email: '',
        },
        theme: {
          color: '#F59E0B',
        },
        modal: {
          ondismiss: function () {
            toast.error('Payment checkout cancelled');
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error('Payment flow failed:', err);
      toast.error(err.response?.data?.error || err.message || 'Payment failed to initiate');
    }
  };

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
        needsPayment={needsPayment}
        startDisabledReason={startDisabledReason}
        onJoin={() => joinMutation.mutate()}
        onLeave={() => leaveMutation.mutate()}
        onStart={() => startMutation.mutate()}
        onPay={handlePayment}
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
              maxPlayers={tournament.maxPlayers}
            />
          )}
        </div>
      </div>
    </div>
  )
}
