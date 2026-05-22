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
//   ON:   match_over
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Eye, Trophy, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

const MAX_ATTEMPTS = 5;

export default function QuickDrawGame({
  socket,
  matchId,
  player1Id,
  player2Id,
  currentUserId,
  isSpectator,
}) {
  const [gameStatus, setGameStatus] = useState("waiting");
  const [wordToDraw, setWordToDraw] = useState(null);
  const [guess, setGuess] = useState("");
  const [guessMessage, setGuessMessage] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [guesses, setGuesses] = useState([]);
  const [countdown, setCountdown] = useState(5);

  // Starting Countdown
  useEffect(() => {
    if (gameStatus !== 'starting') return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus]);

  const canvasRef = useRef(null);

  const isDrawer = Number(currentUserId) === player1Id;
  const userIdNum = Number(currentUserId);
  const safeUserId = !isNaN(userIdNum) && userIdNum > 0 ? userIdNum : null;

  const joinMatchRef = useRef(null);
  const onGameStatusRef = useRef(null);
  const onReceiveStrokeRef = useRef(null);
  const onDrawHistoryRef = useRef(null);
  const onWrongGuessRef = useRef(null);
  const onMatchOverRef = useRef(null);
  const onErrorRef = useRef(null);
  const onTimerRef = useRef(null);
  const onAttemptRef = useRef(null);
  const onGuessAttemptRef = useRef(null);

  useEffect(() => {
    if (!socket || !safeUserId) return;

    const onGameStatus = (data) => {
      if (data.message && data.message.includes("starting in")) {
        setGameStatus("starting");
        return;
      }
      setGameStatus("playing");
      if (data.wordToDraw) {
        setWordToDraw(data.wordToDraw);
      }
    };

    const onReceiveStroke = (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (data.type === "start") {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else {
        ctx.lineTo(data.x, data.y);
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    };

    const onDrawHistory = (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
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
      setAttemptsLeft(data.attemptsLeft ?? 0);
      setTimeout(() => setGuessMessage(null), 3000);
    };

    const onMatchOver = (data) => {
      setFinalResult(data);
      setGameStatus("finished");
    };

    const onTimer = (data) => {
      setTimeRemaining(data.timeRemaining);
    };

    const onAttemptUpdate = (data) => {
      setAttemptsLeft(data.attemptsLeft);
    };

    const onGuessAttempt = (data) => {
      setGuesses((prev) => [...prev, data]);
      setAttemptsLeft(data.attemptsLeft);
      if (Number(data.playerId) === safeUserId) {
        if (!data.correct) {
          toast.error(`"${data.guess}" is incorrect!`);
        } else {
          toast.success("Correct guess!");
        }
      }
    };

    const onError = (data) => {
      toast.error(data.message || "An error occurred");
    };

    const joinMatch = () => {
      socket.emit("join_match", {
        matchId,
        playerId: safeUserId,
        player1Id,
        player2Id,
      });
    };

    onGameStatusRef.current = onGameStatus;
    onReceiveStrokeRef.current = onReceiveStroke;
    onDrawHistoryRef.current = onDrawHistory;
    onWrongGuessRef.current = onWrongGuess;
    onMatchOverRef.current = onMatchOver;
    onErrorRef.current = onError;
    onTimerRef.current = onTimer;
    onAttemptRef.current = onAttemptUpdate;
    onGuessAttemptRef.current = onGuessAttempt;
    joinMatchRef.current = joinMatch;

    socket.on("game_status", onGameStatus);
    socket.on("receive_stroke", onReceiveStroke);
    socket.on("draw_history", onDrawHistory);
    socket.on("wrong_guess", onWrongGuess);
    socket.on("match_over", onMatchOver);
    socket.on("error", onError);
    socket.on("quickdraw:timer", onTimer);
    socket.on("quickdraw:attempt_update", onAttemptUpdate);
    socket.on("quickdraw:guess_attempt", onGuessAttempt);

    if (socket.connected) {
      joinMatch();
    }

    socket.on("connect", joinMatch);

    return () => {
      const jm = joinMatchRef.current;
      if (jm) socket.off("connect", jm);
      socket.off("game_status", onGameStatusRef.current);
      socket.off("receive_stroke", onReceiveStrokeRef.current);
      socket.off("draw_history", onDrawHistoryRef.current);
      socket.off("wrong_guess", onWrongGuessRef.current);
      socket.off("match_over", onMatchOverRef.current);
      socket.off("error", onErrorRef.current);
      socket.off("quickdraw:timer", onTimerRef.current);
      socket.off("quickdraw:attempt_update", onAttemptRef.current);
      socket.off("quickdraw:guess_attempt", onGuessAttemptRef.current);
    };
  }, [socket, matchId, safeUserId, player1Id, player2Id]);

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
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

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
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

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

  const handleTouchStart = useCallback(
    (e) => {
      if (!isDrawer || isSpectator) return;
      setIsDrawing(true);
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(x, y);

      // Send stroke START to opponent
      socket.emit("draw_stroke", { matchId, playerId: Number(currentUserId), x, y, type: "start" });
    },
    [isDrawer, isSpectator, socket, matchId, currentUserId]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isDrawer || !isDrawing || isSpectator) return;
      if (e.cancelable) e.preventDefault(); // Prevent scrolling while drawing on touch devices
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

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
      if (!guess.trim()) {
        toast.error("Please enter a guess first");
        return;
      }

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

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Role indicator + Timer + Attempts bar */}
      <Card className="border-neutral-800 bg-neutral-900/60">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isSpectator ? (
                <Eye className="h-4 w-4 text-amber-500 animate-pulse" />
              ) : isDrawer ? (
                <Pencil className="h-4 w-4 text-amber-400" />
              ) : (
                <Eye className="h-4 w-4 text-amber-400" />
              )}
              <span className="text-sm font-semibold text-neutral-200">
                {isSpectator ? "SPECTATING" : (isDrawer ? "DRAWING" : "GUESSING")}
              </span>
            </div>
            {isDrawer && wordToDraw && (
              <span className="text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-md">
                Draw: <span className="uppercase">{wordToDraw}</span>
              </span>
            )}
          </div>
          {/* Timer + Attempts bar — only visible during active play */}
          {gameStatus === "playing" && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-800">
                <Clock className={`h-3.5 w-3.5 ${timeRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
                <span className={timeRemaining <= 10 ? 'text-red-500 font-extrabold' : 'font-mono text-neutral-300'}>
                  {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-800">
                <span className={`h-2 w-2 rounded-full ${attemptsLeft <= 2 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-neutral-300">Chances left: {attemptsLeft}/{MAX_ATTEMPTS}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waiting / Starting message */}
      {(gameStatus === "waiting" || gameStatus === "starting") && (
        <Card className="border-neutral-800 bg-neutral-950 shadow-2xl">
          <CardContent className="p-8 text-center space-y-4">
            {isSpectator && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full w-max mx-auto uppercase tracking-wider animate-pulse">
                Spectator Mode
              </div>
            )}
            <Pencil className="h-12 w-12 text-amber-500 mx-auto mb-2 animate-bounce" />
            <h2 className="text-xl font-bold text-neutral-100">
              {isSpectator ? 'Waiting for match to begin...' : (gameStatus === 'starting' ? 'Game Starting!' : 'Waiting for opponent...')}
            </h2>
            {gameStatus === 'starting' && !isSpectator && countdown > 0 ? (
              <p className="text-4xl font-black text-amber-500 animate-pulse">{countdown}...</p>
            ) : (
              <p className="text-neutral-400 text-sm">Quick Draw match starting soon</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Match finished */}
      {gameStatus === "finished" && finalResult && (
        <Card className="border-neutral-800 bg-neutral-950 shadow-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <Trophy
              className={`h-12 w-12 mx-auto mb-2 ${finalResult.winnerId === Number(currentUserId) && !isSpectator ? "text-amber-500 animate-pulse" : "text-neutral-600"}`}
            />
            <h2 className="text-2xl font-black text-neutral-100 tracking-tight">
              {isSpectator ? "Match Finished" : (finalResult.winnerId === Number(currentUserId) ? "You Won!" : "Game Over")}
            </h2>
            {finalResult.message && (
              <p className="text-sm text-neutral-500">{finalResult.message}</p>
            )}
            <p className="text-neutral-400 text-sm bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
              The secret word was: <span className="font-extrabold text-amber-400 uppercase tracking-wide">{finalResult.word}</span>
            </p>
          </CardContent>
        </Card>
      )}

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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            className={`w-full border border-neutral-850 rounded bg-neutral-950 shadow-inner ${isDrawer && !isSpectator ? "cursor-crosshair" : "cursor-not-allowed"}`}
          />
        </CardContent>
      </Card>

      {/* Guess input */}
      {!isDrawer && !isSpectator && (
        <form onSubmit={handleGuess} className="flex gap-2">
          <Input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type your guess..."
            className="flex-1 border-neutral-800 bg-neutral-900/60 focus-visible:ring-amber-500 text-neutral-100"
          />
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">Guess</Button>
        </form>
      )}

      {/* Guess feedback */}
      {guessMessage && (
        <p className="text-center text-sm text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded p-2">
          {guessMessage}
        </p>
      )}

      {/* Live Guesses feed */}
      {guesses.length > 0 && (
        <Card className="border-neutral-800 bg-neutral-900/40">
          <CardContent className="p-3.5 space-y-2">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Live Guesses</h3>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {guesses.map((g, idx) => (
                <span
                  key={idx}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    g.correct
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {g.guess}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
