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

    socket.emit("join_match", {
      matchId,
      playerId: Number(currentUserId),
      player1Id,
      player2Id,
    });

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
    socket.on("wrong_guess", onWrongGuess);
    socket.on("match_over", onMatchOver);

    return () => {
      socket.off("game_status", onGameStatus);
      socket.off("receive_stroke", onReceiveStroke);
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
      if (!isDrawer) return;
      setIsDrawing(true);
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(x, y);

      // Send stroke START to opponent
      socket.emit("draw_stroke", { matchId, x, y, type: "start" });
    },
    [isDrawer, socket, matchId]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDrawer || !isDrawing) return;
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
      socket.emit("draw_stroke", { matchId, x, y, type: "draw" });
    },
    [isDrawer, isDrawing, socket, matchId]
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

  if (gameStatus === "waiting") {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <Pencil className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground">
            Quick Draw match starting soon
          </p>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === "finished" && finalResult) {
    const isWinner = finalResult.winnerId === Number(currentUserId);
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <Trophy
            className={`h-12 w-12 mx-auto mb-4 ${
              isWinner ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <h2 className="text-2xl font-bold mb-2">
            {isWinner ? "You Won!" : "Game Over"}
          </h2>
          <p className="text-muted-foreground">
            The word was:{" "}
            <span className="font-bold text-foreground">
              {finalResult.word}
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Role indicator */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDrawer ? (
              <Pencil className="h-4 w-4 text-primary" />
            ) : (
              <Eye className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium">
              {isDrawer ? "You are DRAWING" : "You are GUESSING"}
            </span>
          </div>
          {/* Drawer sees the word they need to draw */}
          {isDrawer && wordToDraw && (
            <span className="text-sm font-bold text-primary">
              Draw: {wordToDraw}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Canvas */}
      <Card>
        <CardContent className="p-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`w-full border border-border rounded bg-white ${
              isDrawer ? "cursor-crosshair" : "cursor-default"
            }`}
          />
        </CardContent>
      </Card>

      {/* Guess input (only for guesser) */}
      {!isDrawer && (
        <form onSubmit={handleGuess} className="flex gap-2">
          <Input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type your guess..."
            className="flex-1"
          />
          <Button type="submit">Guess</Button>
        </form>
      )}

      {/* Guess feedback */}
      {guessMessage && (
        <p className="text-center text-sm text-danger font-medium">
          {guessMessage}
        </p>
      )}
    </div>
  );
}
