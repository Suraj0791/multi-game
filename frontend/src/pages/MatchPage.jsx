// ============================================================
// MATCH PAGE — Smart component for live games
// ============================================================
// Fetches match data to know: which game type? who are the players?
// Connects to WebSocket, passes socket to the game component.
//
// This page DECIDES which game to show:
//   match.gameType === 'TRIVIA'     → <TriviaGame />
//   match.gameType === 'QUICK_DRAW' → <QuickDrawGame /> (future)

import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import useSocket from "@/hooks/useSocket";
import useAuthStore from "@/stores/authStore";
import api from "@/api/axiosClient";
import TriviaGame from "@/components/games/TriviaGame";
import QuickDrawGame from "@/components/games/QuickDrawGame";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Copy, Check, Loader2 } from "lucide-react";
import ChatPanel from "@/components/chat/ChatPanel";
import { guestLogin } from "@/api/authApi";
import { joinTournament, getTournamentById, getBracket, getPlayers } from "@/api/tournamentApi";
import { toast } from "sonner";

// Fetch match details — we need to know the game type and player IDs
async function getMatch(tournamentId, matchId) {
  const response = await api.get(`/tournaments/${tournamentId}/bracket`);
  // Find the specific match from the bracket
  const bracket = response.data;
  if (!bracket?.rounds) return null;
  for (const round of Object.values(bracket.rounds)) {
    const match = round.find((m) => m.id === Number(matchId));
    if (match) return match;
  }
  return null;
}

export default function MatchPage() {
  const { id: tournamentId, matchId: matchIdParam } = useParams();
  const matchId = matchIdParam || "waiting";
  const userId = useAuthStore((state) => state.userId);
  const token = useAuthStore((state) => state.token);
  const login = useAuthStore((state) => state.login);
  const socket = useSocket();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch tournament details if we are in waiting room
  const { data: tournament, isLoading: isLoadingTournament } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournamentById(tournamentId),
    enabled: matchId === "waiting",
    refetchInterval: (query) => {
      // Poll every 2 seconds if in REGISTRATION as a fallback for the socket event
      const data = query.state.data;
      return data?.status === "IN_PROGRESS" ? false : 2000;
    },
  });

  // Fetch match data to know game type + player IDs (only if we have a real match ID)
  const { data: match, isLoading: isLoadingMatch } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch(tournamentId, matchId),
    enabled: !!matchId && matchId !== "waiting",
  });

  // Fetch bracket if we are waiting but tournament has started
  const { data: bracket } = useQuery({
    queryKey: ["bracket", tournamentId],
    queryFn: () => getBracket(tournamentId),
    enabled: matchId === "waiting" && tournament?.status === "IN_PROGRESS",
  });

  // Track the initial status of the match when first loaded
  const initialStatusRef = useRef(null);
  if (match && initialStatusRef.current === null) {
    initialStatusRef.current = match.status;
  }

  // --- AUTO LOGIN & JOIN QUICK MATCH FOR PLAYER 2 ---
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    if (matchId !== "waiting") return;
    if (hasAutoJoinedRef.current) return;
    hasAutoJoinedRef.current = true;

    const autoJoin = async () => {
      setJoining(true);
      try {
        let currentUserId = userId;
        let currentToken = token;

        // 1. Auto-login if no auth token is present
        if (!currentToken || !currentUserId) {
          console.log("👤 [MatchPage] No auth found for Quick Match, logging in as guest...");
          const res = await guestLogin();
          login(res.token, res.userId);
          currentUserId = res.userId;
          currentToken = res.token;
        }

        // 2. Fetch players list to check if we are already in the tournament
        const players = await getPlayers(tournamentId);
        const hasJoined = players.some((p) => Number(p.playerId) === Number(currentUserId));

        if (!hasJoined) {
          console.log(`📝 [MatchPage] Joining quick match tournament ${tournamentId}...`);
          await joinTournament(tournamentId);
          queryClient.invalidateQueries({ queryKey: ["players", tournamentId] });
          queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
        }
      } catch (err) {
        console.error("❌ [MatchPage] Auto-join failed:", err);
        toast.error("Failed to automatically join the quick match lobby");
        hasAutoJoinedRef.current = false; // Allow retry on failure
      } finally {
        setJoining(false);
      }
    };

    autoJoin();
  }, [matchId, tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- SOCKET EVENT FOR QUICK TRANSITION ---
  useEffect(() => {
    if (matchId !== "waiting" || !socket) return;

    const onTournamentStarted = (data) => {
      console.log("📢 [MatchPage] tournament:started socket event received:", data);
      if (Number(data.tournamentId) === Number(tournamentId) && data.matchId) {
        navigate(`/tournaments/${tournamentId}/match/${data.matchId}`, { replace: true });
      }
    };

    socket.emit("tournament:join", { tournamentId });
    socket.on("tournament:started", onTournamentStarted);

    return () => {
      socket.off("tournament:started", onTournamentStarted);
    };
  }, [matchId, tournamentId, socket, navigate]);

  // --- REDIRECT FALLBACK (If tournament started on refresh/poll) ---
  useEffect(() => {
    if (matchId === "waiting" && tournament?.status === "IN_PROGRESS" && bracket?.rounds?.round1) {
      const activeMatch = bracket.rounds.round1[0];
      if (activeMatch) {
        console.log(`🚀 [MatchPage] Polled start detected. Redirecting to active match ${activeMatch.id}`);
        navigate(`/tournaments/${tournamentId}/match/${activeMatch.id}`, { replace: true });
      }
    }
  }, [matchId, tournamentId, tournament, bracket, navigate]);

  // Copy Link Handler
  const inviteLink = `${window.location.origin}/tournaments/${tournamentId}/match/waiting`;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied! Paste this in your Incognito window.");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Loading indicator for match details or waiting initialization
  const isLoading = matchId === "waiting" ? (isLoadingTournament && !tournament) : isLoadingMatch;
  const hasValidUserId = userId && Number(userId) > 0;

  if (isLoading || !hasValidUserId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin mr-3" />
        <p className="text-muted-foreground">Loading lobby details...</p>
      </div>
    );
  }

  // --- WAITING ROOM UI ---
  if (matchId === "waiting") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Invitation / Lobby info Card */}
          <Card className="lg:col-span-2 border border-neutral-800 bg-neutral-950/60 backdrop-blur-md shadow-2xl rounded-2xl flex flex-col justify-between overflow-hidden relative min-h-[480px]">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 -z-10 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -z-10 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

            <CardContent className="p-8 flex-1 flex flex-col justify-center items-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" />
                <div className="relative p-4 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <Trophy className="h-10 w-10 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight text-neutral-100 uppercase">
                  Waiting for Opponent
                </h2>
                <p className="text-neutral-400 text-sm max-w-md">
                  Copy this private invite link and open it in an <strong className="text-amber-400 font-bold">Incognito window</strong> to play against yourself!
                </p>
              </div>

              {/* Copy Invite Link Input */}
              <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800/80">
                  <code className="text-xs text-amber-400 font-mono select-all truncate flex-1 text-left">
                    {inviteLink}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    className="h-8 w-8 p-0 shrink-0 hover:bg-neutral-850 text-amber-400"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>The game starts automatically when the opponent joins</span>
                </div>
              </div>

              {/* Loader Status */}
              <div className="flex items-center gap-2.5 px-4 py-2 bg-neutral-900/40 border border-neutral-800/50 rounded-full">
                <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                <span className="text-xs font-semibold text-neutral-400 tracking-wide uppercase">
                  {joining ? "Registering you in lobby..." : "Waiting for player 2..."}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Chat Panel */}
          <div className="lg:col-span-1 flex flex-col">
            <ChatPanel
              socket={socket}
              tournamentId={tournamentId}
              userId={userId}
            />
          </div>

        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">Match not found.</p>
      </div>
    );
  }

  // If match was already completed when loading the page, show result instead of trying to play
  if (initialStatusRef.current === "COMPLETED") {
    const isWinner = Number(userId) === Number(match.winnerId);
    return (
      <Card className="max-w-lg mx-auto border-neutral-800 bg-neutral-950/40 mt-8">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className={`h-12 w-12 mx-auto ${isWinner ? "text-amber-500 animate-pulse" : "text-neutral-600"}`} />
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            {isWinner ? "You Won!" : "Match Over"}
          </h2>
          <div className="text-neutral-400 text-sm space-y-1">
            <p>{match.player1Name} vs {match.player2Name}</p>
            <p className="text-xs text-muted-foreground">This match has already been completed.</p>
          </div>
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold mt-4"
            onClick={() => (window.location.href = "/tournaments")}
          >
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Compute if current user is a spectator
  const isSpectator = Number(userId) !== Number(match.player1Id) && Number(userId) !== Number(match.player2Id);

  // Decide which game component to render based on game type
  const GameComponent =
    match.gameType === "QUICK_DRAW" ? QuickDrawGame : TriviaGame;

  return (
    <div className="py-4">
      <GameComponent
        socket={socket}
        matchId={Number(matchId)}
        player1Id={match.player1Id}
        player2Id={match.player2Id}
        currentUserId={userId}
        isSpectator={isSpectator}
      />
    </div>
  );
}
