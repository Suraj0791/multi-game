// ============================================================
// TRIVIA GAME — Real-time trivia match
// ============================================================
//
// GAME STATES:
//   waiting   → joined room, waiting for opponent / game to start
//   playing   → question is on screen, timer is running
//   answered  → user submitted answer, waiting for feedback
//   result    → showing correct/wrong for this round
//   finished  → all questions done, showing final scores
//
// EVENTS (matched to backend socketEvents.js):
//   EMIT:  trivia:join    → { matchId, player1Id, player2Id }
//   EMIT:  trivia:answer  → { matchId, playerId, answer, timeTakenMs }
//   ON:    trivia:started → game is about to begin
//   ON:    trivia:new_question → { question: { text, options }, timerSeconds }
//   ON:    trivia:answer_feedback → { correct, correctAnswer, points }
//   ON:    trivia:score_update → { scores: { [playerId]: score } }
//   ON:    trivia:round_over → { correctAnswer }
//   ON:    trivia:match_over → { winnerId, scores }

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TriviaGame({ socket, matchId, currentUserId, isSpectator }) {
  // ============================================================
  // ALL STATE for the trivia game
  // ============================================================
  const [gameStatus, setGameStatus] = useState('waiting')
  const [question, setQuestion] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [scores, setScores] = useState({})
  const [finalResult, setFinalResult] = useState(null)
  const [questionStartTime, setQuestionStartTime] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false)

  const userIdNum = Number(currentUserId);
  const safeUserId = !isNaN(userIdNum) && userIdNum > 0 ? userIdNum : null;

  // Refs for stable listener cleanup
  const joinMatchRef = useRef(null);
  const onStartedRef = useRef(null);
  const onNewQuestionRef = useRef(null);
  const onFeedbackRef = useRef(null);
  const onScoreUpdateRef = useRef(null);
  const onRoundOverRef = useRef(null);
  const onMatchOverRef = useRef(null);
  const onTriviaErrorRef = useRef(null);
  const onHasAnsweredRef = useRef(null);

  // Countdown timer for starting state
  useEffect(() => {
    if (gameStatus !== 'starting') return
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [gameStatus])

  // ============================================================
  // SOCKET EVENT LISTENERS — set up on mount, clean up on unmount
  // ============================================================
  useEffect(() => {
    if (!socket || !safeUserId) return

    const onStarted = () => {
      setGameStatus('starting')
    }

    const onNewQuestion = (data) => {
      socket.emit('trivia:request_scores', { matchId })
      setQuestion(data.question)
      setQuestionStartTime(data.questionStartTime || Date.now())
      setTimeLeft(data.timerSeconds)
      setSelectedAnswer(null)
      setFeedback(null)
      setHasAnsweredCurrent(false)
      setGameStatus('playing')
    }

    const onFeedback = (data) => {
      setFeedback(data)
      setGameStatus('result')
    }

    const onScoreUpdate = (data) => {
      setScores(data.scores)
    }

    const onRoundOver = (data) => {
      setFeedback(prev => {
        if (prev !== null) return prev;
        return { correct: false, correctAnswer: data.correctAnswer };
      });
      setGameStatus('result')
    }

    const onMatchOver = (data) => {
      setFinalResult(data)
      setScores(data.scores)
      setGameStatus('finished')
    }

    const onTriviaError = (data) => {
      toast.error(data.message || 'An error occurred');
    }

    const onHasAnswered = (data) => {
      setHasAnsweredCurrent(data.hasAnswered);
    }

    const joinMatch = () => {
      socket.emit('trivia:join', { matchId, playerId: safeUserId })
    }

    // Store refs for cleanup
    onStartedRef.current = onStarted;
    onNewQuestionRef.current = onNewQuestion;
    onFeedbackRef.current = onFeedback;
    onScoreUpdateRef.current = onScoreUpdate;
    onRoundOverRef.current = onRoundOver;
    onMatchOverRef.current = onMatchOver;
    onTriviaErrorRef.current = onTriviaError;
    onHasAnsweredRef.current = onHasAnswered;
    joinMatchRef.current = joinMatch;

    socket.on('trivia:started', onStarted)
    socket.on('trivia:new_question', onNewQuestion)
    socket.on('trivia:answer_feedback', onFeedback)
    socket.on('trivia:score_update', onScoreUpdate)
    socket.on('trivia:round_over', onRoundOver)
    socket.on('trivia:match_over', onMatchOver)
    socket.on('trivia:error', onTriviaError)
    socket.on('trivia:has_answered', onHasAnswered)

    if (socket.connected) {
      joinMatch()
    }

    socket.on('connect', joinMatch)

    return () => {
      const jm = joinMatchRef.current;
      if (jm) socket.off('connect', jm);
      socket.off('trivia:started', onStartedRef.current)
      socket.off('trivia:new_question', onNewQuestionRef.current)
      socket.off('trivia:answer_feedback', onFeedbackRef.current)
      socket.off('trivia:score_update', onScoreUpdateRef.current)
      socket.off('trivia:round_over', onRoundOverRef.current)
      socket.off('trivia:match_over', onMatchOverRef.current)
      socket.off('trivia:error', onTriviaErrorRef.current)
      socket.off('trivia:has_answered', onHasAnsweredRef.current)
    }
  }, [socket, matchId, safeUserId])

  // ============================================================
  // TIMER — server-authoritative, uses questionStartTime
  // ============================================================
  useEffect(() => {
    if (gameStatus !== 'playing') return

    const tick = () => {
      if (!questionStartTime) return
      const elapsed = Date.now() - questionStartTime
      const remaining = Math.max(0, Math.ceil((10000 - elapsed) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }

    tick()
    const interval = setInterval(tick, 500)

    return () => clearInterval(interval)
  }, [gameStatus, questionStartTime])

  // ============================================================
  // HANDLER: User clicks an answer
  // ============================================================
  const handleAnswer = useCallback((answer) => {
    if (gameStatus !== 'playing' || selectedAnswer) return  // prevent double-click

    setSelectedAnswer(answer)
    setGameStatus('answered')

    // Calculate how long the user took (for scoring)
    const timeTakenMs = Date.now() - questionStartTime

    // EMIT to backend
    socket.emit('trivia:answer', {
      matchId,
      playerId: Number(currentUserId),
      answer,
      timeTakenMs,
    })
  }, [gameStatus, selectedAnswer, socket, matchId, currentUserId, questionStartTime])

  // ============================================================
  // RENDER — different UI for each game state
  // ============================================================

  // WAITING state
  if (gameStatus === 'waiting' || gameStatus === 'starting') {
    return (
      <Card className="max-w-lg mx-auto border-neutral-800 bg-neutral-950/40">
        <CardContent className="p-8 text-center space-y-4">
          {isSpectator && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full w-max mx-auto uppercase tracking-wider animate-pulse">
              Spectator Mode
            </div>
          )}
          <Trophy className="h-12 w-12 text-amber-500 mx-auto mb-2 animate-bounce" />
          <h2 className="text-xl font-bold text-neutral-100">
            {isSpectator ? 'Waiting for match to begin...' : (gameStatus === 'starting' ? 'Game Starting!' : 'Waiting for opponent...')}
          </h2>
          {gameStatus === 'starting' && !isSpectator && countdown > 0 && (
            <p className="text-4xl font-black text-amber-500 animate-pulse">{countdown}...</p>
          )}
          <p className="text-neutral-400 text-sm">Get ready for the Trivia Showdown!</p>
        </CardContent>
      </Card>
    )
  }

  // FINISHED state
  if (gameStatus === 'finished' && finalResult) {
    const isWinner = finalResult.winnerId === Number(currentUserId)
    return (
      <Card className="max-w-lg mx-auto border-neutral-800 bg-neutral-950/40">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className={`h-12 w-12 mx-auto mb-2 ${isWinner && !isSpectator ? 'text-amber-500 animate-pulse' : 'text-neutral-600'}`} />
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            {isSpectator ? 'Match Finished' : (isWinner ? 'You Won!' : 'Game Over')}
          </h2>
          <div className="text-neutral-400 space-y-2 bg-neutral-900/60 p-4 rounded-lg border border-neutral-800/80">
            {Object.entries(scores).map(([playerId, score]) => (
              <div key={playerId} className={`flex justify-between items-center py-1 border-b border-neutral-800 last:border-0 ${Number(playerId) === Number(currentUserId) ? 'text-amber-400 font-bold' : 'text-neutral-300'}`}>
                <span>{Number(playerId) === Number(currentUserId) ? 'You' : `Player ${playerId}`}</span>
                <span>{score} pts</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // PLAYING / ANSWERED / RESULT states
  return (
    <Card className="max-w-lg mx-auto border-neutral-850 bg-gradient-to-b from-neutral-900 to-neutral-950 shadow-xl">
      <CardContent className="p-6 space-y-6">
        {isSpectator && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold py-1.5 rounded-md text-center uppercase tracking-wider animate-pulse">
            Spectating Match
          </div>
        )}

        {/* Score bar */}
        <div className="flex justify-between items-center text-sm text-neutral-400 border-b border-neutral-800/60 pb-3">
          <span>{isSpectator ? 'Spectating' : `Your Score: ${scores[currentUserId] || 0}`}</span>
          <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1 rounded-full border border-neutral-800">
            <Clock className={`h-3.5 w-3.5 ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
            <span className={timeLeft <= 3 ? 'text-red-500 font-extrabold' : 'font-mono'}>{timeLeft}s</span>
          </div>
        </div>

        {/* Question text */}
        {question && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-100 leading-snug">{question.text}</h2>

            {/* Answer options */}
            <div className="grid grid-cols-1 gap-2.5">
              {question.options.map((option, i) => {
                // Determine button styling based on game state
                let variant = 'outline'
                let icon = null
                let customStyle = ''

                if (gameStatus === 'result' && feedback) {
                  if (option === feedback.correctAnswer) {
                    variant = 'default'  // highlight correct answer
                    customStyle = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                    icon = <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  } else if (option === selectedAnswer && !feedback.correct) {
                    customStyle = 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/20 hover:text-red-400'
                    icon = <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  }
                } else if (option === selectedAnswer) {
                  variant = 'secondary'  // highlight selected
                  customStyle = 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }

                return (
                  <Button
                    key={i}
                    variant={variant}
                    className={`justify-start gap-2.5 h-auto py-3.5 px-4 text-left border border-neutral-800/80 hover:border-neutral-700/80 transition-all ${customStyle}`}
                    onClick={() => handleAnswer(option)}
                    disabled={gameStatus !== 'playing' || isSpectator}
                  >
                    {icon}
                    {option}
                  </Button>
                )
              })}
            </div>

            {/* Feedback message */}
            {gameStatus === 'result' && feedback && (
              <div className={`text-center text-sm font-semibold rounded-lg p-3 ${feedback.correct ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {feedback.correct ? `Correct! +${feedback.points} pts` : `Round Over! Correct Answer: ${feedback.correctAnswer}`}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
