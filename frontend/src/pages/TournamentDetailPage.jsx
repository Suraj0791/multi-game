// ============================================================
// TOURNAMENT DETAIL PAGE
// ============================================================

import { useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock3, Copy, Swords, Users } from 'lucide-react'

export default function TournamentDetailPage() {
  // Get the tournament ID from the URL (/tournaments/:id)
  // useParams is React Router's version of req.params in Express
  const { id } = useParams()

  // Get current user's ID from Zustand
  const userId = useAuthStore((state) => state.userId)
  const socket = useSocket()
  const queryClient = useQueryClient()

  // Subscribe to real-time tournament updates (players join/leave/pay, match starts, completions)
  useEffect(() => {
    if (!socket || !id) return;

    // Join the tournament room
    socket.emit("tournament:join", { tournamentId: id });

    const handleTournamentUpdate = () => {
      console.log("🔄 [TournamentDetailPage] Real-time tournament:updated event received. Refreshing data...");
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['players', id] });
      queryClient.invalidateQueries({ queryKey: ['bracket', id] });
    };

    const handleTournamentStarted = (data) => {
      console.log("📢 [TournamentDetailPage] Real-time tournament:started event received:", data);
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['players', id] });
      queryClient.invalidateQueries({ queryKey: ['bracket', id] });
    };

    socket.on("tournament:updated", handleTournamentUpdate);
    socket.on("tournament:started", handleTournamentStarted);

    return () => {
      socket.off("tournament:updated", handleTournamentUpdate);
      socket.off("tournament:started", handleTournamentStarted);
    };
  }, [socket, id, queryClient]);

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
        handler: async function () {
          toast.success('Payment captured');
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
            toast.message('Payment cancelled');
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error('Payment flow failed:', err);
      toast.error(err.response?.data?.error || err.message || 'Could not start payment');
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Invite link copied');
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
    <div className="space-y-5">
      <TournamentHeader tournament={tournament} playerCount={playersList.length} />

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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0">
          {showBracket && bracket ? (
            <section className="rounded-xl border border-border/70 bg-surface/35 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-100">Bracket</h2>
                  <p className="text-sm text-muted-foreground">Matches update as players complete each round.</p>
                </div>
                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">
                  Live
                </Badge>
              </div>
              <BracketView
                bracket={bracket}
                tournamentId={id}
                currentUserId={userId}
                maxPlayers={tournament.maxPlayers}
              />
            </section>
          ) : (
            <section className="rounded-xl border border-border/70 bg-surface/35 p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100">Lobby</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invite players, complete payments, then start the bracket.
                  </p>
                </div>
                <Button variant="outline" onClick={copyInvite} className="w-fit">
                  <Copy className="h-4 w-4" />
                  Copy Invite
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-background/55 p-4">
                  <Users className="mb-3 h-5 w-5 text-emerald-400" />
                  <p className="text-sm text-muted-foreground">Players joined</p>
                  <p className="mt-1 text-xl font-bold text-neutral-50">
                    {playersList.length}/{tournament.maxPlayers}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/55 p-4">
                  {hasUnpaidPlayers ? (
                    <Clock3 className="mb-3 h-5 w-5 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-400" />
                  )}
                  <p className="text-sm text-muted-foreground">Payments</p>
                  <p className="mt-1 text-xl font-bold text-neutral-50">
                    {tournament.entryFee > 0 ? (hasUnpaidPlayers ? 'Pending' : 'Ready') : 'Free'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/55 p-4">
                  <Swords className="mb-3 h-5 w-5 text-amber-400" />
                  <p className="text-sm text-muted-foreground">Start status</p>
                  <p className="mt-1 text-xl font-bold text-neutral-50">
                    {startDisabledReason || !isHost ? 'Waiting' : 'Ready'}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min((playersList.length / tournament.maxPlayers) * 100, 100)}%` }}
                />
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-5">
          <PlayerList
            players={players || []}
            maxPlayers={tournament.maxPlayers}
            hostId={tournament.hostId}
            currentUserId={userId}
          />
          <ChatPanel
            socket={socket}
            tournamentId={id}
            userId={userId}
          />
        </aside>
      </div>
    </div>
  )
}
