// ============================================================
// QUICK DRAW GAME — Real-time drawing + guessing
// ============================================================
//
// HOW IT WORKS:
//   Both players see a canvas.
//   Player 1 (drawer) draws the secret word.
//   Player 2 (guesser) watches strokes appear and types guesses.
//   First correct guess wins the match.
//
// CANVAS BASICS:
//   HTML <canvas> is a bitmap drawing surface.
//   You get a "context" (ctx) and call methods like:
//     ctx.beginPath()     → start a new line
//     ctx.moveTo(x, y)   → move pen to position (without drawing)
//     ctx.lineTo(x, y)   → draw a line to position
//     ctx.stroke()        → render the line
//
//   Mouse events on canvas give us coordinates:
//     onMouseDown → start drawing (pen down)
//     onMouseMove → continue drawing (pen moves)
//     onMouseUp   → stop drawing (pen up)
//
// SOCKET EVENTS (matched to backend):
//   EMIT: join_match     → { matchId }
//   EMIT: draw_stroke    → { matchId, x, y, type: 'start'|'draw' }
//   EMIT: submit_guess   → { matchId, guess, playerId }
//   ON:   game_status    → { message, wordToDraw? }
//   ON:   receive_stroke → { x, y, type }
//   ON:   wrong_guess    → { message: "Try again!" }
//   ON:   match_over     → { winnerId, word }

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Eye, Trophy } from "lucide-react";

export default function QuickDrawGame({
  socket,
  matchId,
  player1Id,
  player2Id,
  currentUserId,
  isSpectator,
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [gameStatus, setGameStatus] = useState("waiting");
  const [wordToDraw, setWordToDraw] = useState(null); // only drawer sees this
  const [guess, setGuess] = useState(""); // guesser's text input
  const [guessMessage, setGuessMessage] = useState(null); // "Try again!" feedback
  const [finalResult, setFinalResult] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false); // is mouse held down?

  // Canvas ref — gives us direct access to the <canvas> DOM element
  // We need this because canvas drawing uses imperative DOM APIs,
  // not React's declarative JSX.
  const canvasRef = useRef(null);

  // Determine role: player1 draws, player2 guesses
  // (based on how your backend assigns roles)
  const isDrawer = Number(currentUserId) === player1Id;

  // ============================================================
  // SOCKET LISTENERS
  // ============================================================
  useEffect(() => {
    if (!socket) return;

    const joinMatch = () => {
      socket.emit("join_match", {
        matchId,
        playerId: Number(currentUserId),
        player1Id,
        player2Id,
      });
    };

    // Join immediately if already connected
    if (socket.connected) {
      joinMatch();
    }

    // Re-join on connection/reconnection
    socket.on("connect", joinMatch);

    const onGameStatus = (data) => {
      setGameStatus("playing");
      // Backend sends the word only to the drawer
      if (data.wordToDraw) {
        setWordToDraw(data.wordToDraw);
      }
    };

    // Receive strokes from the other player (drawn on their canvas)
    const onReceiveStroke = (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      if (data.type === "start") {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else {
        ctx.lineTo(data.x, data.y);
        ctx.strokeStyle = "#F59E0B"; // gold color matching our theme
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    };

    // Redraw history on reconnection
    const onDrawHistory = (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data.strokes) {
        data.strokes.forEach((stroke) => {
          if (stroke.type === "start") {
            ctx.beginPath();
            ctx.moveTo(stroke.x, stroke.y);
          } else {
            ctx.lineTo(stroke.x, stroke.y);
            ctx.strokeStyle = "#F59E0B";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        });
      }
    };

    const onWrongGuess = (data) => {
      setGuessMessage(data.message);
      setTimeout(() => setGuessMessage(null), 2000);
    };

    const onMatchOver = (data) => {
      setFinalResult(data);
      setGameStatus("finished");
    };

    socket.on("game_status", onGameStatus);
    socket.on("receive_stroke", onReceiveStroke);
    socket.on("draw_history", onDrawHistory);
    socket.on("wrong_guess", onWrongGuess);
    socket.on("match_over", onMatchOver);

    return () => {
      socket.off("connect", joinMatch);
      socket.off("game_status", onGameStatus);
      socket.off("receive_stroke", onReceiveStroke);
      socket.off("draw_history", onDrawHistory);
      socket.off("wrong_guess", onWrongGuess);
      socket.off("match_over", onMatchOver);
    };
  }, [socket, matchId, currentUserId, player1Id, player2Id]);

  // ============================================================
  // CANVAS DRAWING HANDLERS (only for the drawer)
  // ============================================================
  // These use the Canvas 2D API — an imperative browser API,
  // not React. We interact with it via refs.

  const handleMouseDown = useCallback(
    (e) => {
      if (!isDrawer || isSpectator) return;
      setIsDrawing(true);
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(x, y);

      // Send stroke START to opponent
      socket.emit("draw_stroke", { matchId, playerId: Number(currentUserId), x, y, type: "start" });
    },
    [isDrawer, isSpectator, socket, matchId, currentUserId]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDrawer || !isDrawing || isSpectator) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();

      // Send stroke DRAW to opponent
      socket.emit("draw_stroke", { matchId, playerId: Number(currentUserId), x, y, type: "draw" });
    },
    [isDrawer, isDrawing, isSpectator, socket, matchId, currentUserId]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // ============================================================
  // GUESS HANDLER (only for the guesser)
  // ============================================================
  const handleGuess = useCallback(
    (e) => {
      e.preventDefault();
      if (!guess.trim()) return;

      socket.emit("submit_guess", {
        matchId,
        guess: guess.trim(),
        playerId: Number(currentUserId),
      });
      setGuess("");
    },
    [guess, socket, matchId, currentUserId]
  );

  // ============================================================
  // RENDER
  // ============================================================

  // Render overlay for waiting / finished status, and render the base canvas layout.
  // ALWAYS render the base canvas layout so canvasRef is mounted when draw history events arrive.
  return (
    <div className="max-w-2xl mx-auto space-y-4 relative">
      {/* Waiting screen overlay */}
      {gameStatus === "waiting" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/80 rounded-xl backdrop-blur-sm p-4">
          <Card className="max-w-lg w-full border-neutral-800 bg-neutral-900 shadow-2xl">
            <CardContent className="p-8 text-center space-y-4">
              {isSpectator && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full w-max mx-auto uppercase tracking-wider animate-pulse">
                  Spectator Mode
                </div>
              )}
              <Pencil className="h-12 w-12 text-amber-500 mx-auto mb-2 animate-bounce" />
              <h2 className="text-xl font-bold text-neutral-100">
                {isSpectator ? 'Waiting for match to begin...' : 'Waiting for opponent...'}
              </h2>
              <p className="text-neutral-400 text-sm">Quick Draw match starting soon</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Match finished overlay */}
      {gameStatus === "finished" && finalResult && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/90 rounded-xl backdrop-blur-sm p-4">
          <Card className="max-w-lg w-full border-neutral-800 bg-neutral-900 shadow-2xl">
            <CardContent className="p-8 text-center space-y-4">
              <Trophy
                className={`h-12 w-12 mx-auto mb-2 ${finalResult.winnerId === Number(currentUserId) && !isSpectator ? "text-amber-500 animate-pulse" : "text-neutral-600"
                  }`}
              />
              <h2 className="text-2xl font-black text-neutral-100 tracking-tight">
                {isSpectator ? "Match Finished" : (finalResult.winnerId === Number(currentUserId) ? "Victory!" : "Defeat")}
              </h2>
              <p className="text-neutral-400 text-sm bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
                The secret word was: <span className="font-extrabold text-amber-400 uppercase tracking-wide">{finalResult.word}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role indicator */}
      <Card className="border-neutral-800 bg-neutral-900/60">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSpectator ? (
              <Eye className="h-4 w-4 text-amber-500 animate-pulse" />
            ) : isDrawer ? (
              <Pencil className="h-4 w-4 text-amber-450" />
            ) : (
              <Eye className="h-4 w-4 text-amber-450" />
            )}
            <span className="text-sm font-semibold text-neutral-200">
              {isSpectator ? "You are SPECTATING" : (isDrawer ? "You are DRAWING" : "You are GUESSING")}
            </span>
          </div>
          {/* Drawer sees the word they need to draw */}
          {isDrawer && wordToDraw && (
            <span className="text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-md">
              Secret Word: <span className="uppercase">{wordToDraw}</span>
            </span>
          )}
        </CardContent>
      </Card>

      {/* Canvas */}
      <Card className="border-neutral-800 overflow-hidden bg-neutral-950">
        <CardContent className="p-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`w-full border border-neutral-850 rounded bg-neutral-950 shadow-inner ${isDrawer && !isSpectator ? "cursor-crosshair" : "cursor-not-allowed"
              }`}
          />
        </CardContent>
      </Card>

      {/* Guess input (only for guesser, hidden for spectators) */}
      {!isDrawer && !isSpectator && (
        <form onSubmit={handleGuess} className="flex gap-2">
          <Input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type your guess here..."
            className="flex-1 border-neutral-800 bg-neutral-900/60 focus-visible:ring-amber-500 text-neutral-100"
          />
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">Guess</Button>
        </form>
      )}

      {/* Guess feedback */}
      {guessMessage && (
        <p className="text-center text-sm text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded p-2 animate-shake">
          {guessMessage}
        </p>
      )}
    </div>
  );
}
