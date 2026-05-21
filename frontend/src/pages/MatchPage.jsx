// ============================================================
// MATCH PAGE — Smart component for live games
// ============================================================
// Fetches match data to know: which game type? who are the players?
// Connects to WebSocket, passes socket to the game component.
//
// This page DECIDES which game to show:
//   match.gameType === 'TRIVIA'     → <TriviaGame />
//   match.gameType === 'QUICK_DRAW' → <QuickDrawGame /> (future)

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import useSocket from "@/hooks/useSocket";
import useAuthStore from "@/stores/authStore";
import api from "@/api/axiosClient";
import TriviaGame from "@/components/games/TriviaGame";
import QuickDrawGame from "@/components/games/QuickDrawGame";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

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
  const { id: tournamentId, matchId } = useParams();
  const userId = useAuthStore((state) => state.userId);
  const socket = useSocket();

  // Fetch match data to know game type + player IDs
  const { data: match, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch(tournamentId, matchId),
    enabled: !!matchId,
  });

  // Guard: wait until we have both match data and a valid userId
  const hasValidUserId = userId && Number(userId) > 0;

  if (isLoading || !hasValidUserId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading match...</p>
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

  // If match is already completed, show result instead of trying to play
  if (match.status === 'COMPLETED') {
    const isWinner = Number(userId) === Number(match.winnerId);
    return (
      <Card className="max-w-lg mx-auto border-neutral-800 bg-neutral-950/40 mt-8">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className={`h-12 w-12 mx-auto ${isWinner ? 'text-amber-500 animate-pulse' : 'text-neutral-600'}`} />
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            {isWinner ? 'You Won!' : 'Match Over'}
          </h2>
          <div className="text-neutral-400 text-sm space-y-1">
            <p>{match.player1Name} vs {match.player2Name}</p>
            <p className="text-xs text-muted-foreground">This match has already been completed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compute if current user is a spectator
  const isSpectator = Number(userId) !== Number(match.player1Id) && Number(userId) !== Number(match.player2Id);

  // Decide which game component to render based on game type
  // The match object has a gameType field from the tournament
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
