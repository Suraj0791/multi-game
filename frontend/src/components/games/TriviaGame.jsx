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

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function TriviaGame({ socket, matchId, player1Id, player2Id, currentUserId }) {
  // ============================================================
  // ALL STATE for the trivia game
  // ============================================================
  const [gameStatus, setGameStatus] = useState('waiting')
  const [question, setQuestion] = useState(null)        // current question object
  const [timeLeft, setTimeLeft] = useState(0)            // countdown seconds
  const [selectedAnswer, setSelectedAnswer] = useState(null)  // which option clicked
  const [feedback, setFeedback] = useState(null)         // correct/wrong result
  const [scores, setScores] = useState({})               // { playerId: score }
  const [finalResult, setFinalResult] = useState(null)   // end-of-game data
  const [questionStart, setQuestionStart] = useState(0)  // timestamp for timeTakenMs

  // ============================================================
  // SOCKET EVENT LISTENERS — set up on mount, clean up on unmount
  // ============================================================
  useEffect(() => {
    if (!socket) return

    const joinMatch = () => {
      socket.emit('trivia:join', { matchId, player1Id, player2Id })
    }

    // Join immediately if already connected
    if (socket.connected) {
      joinMatch()
    }

    // Re-join on connection/reconnection
    socket.on('connect', joinMatch)

    // LISTENER: Game is starting
    const onStarted = () => {
      setGameStatus('starting')
    }

    // LISTENER: New question arrived
    const onNewQuestion = (data) => {
      setQuestion(data.question)
      setTimeLeft(data.timerSeconds)
      setSelectedAnswer(null)
      setFeedback(null)
      setGameStatus('playing')
      setQuestionStart(Date.now())
    }

    // LISTENER: My answer result
    const onFeedback = (data) => {
      setFeedback(data)
      setGameStatus('result')
    }

    // LISTENER: Scores updated
    const onScoreUpdate = (data) => {
      setScores(data.scores)
    }

    // LISTENER: Round is over (timeout — no one answered in time)
    const onRoundOver = (data) => {
      setFeedback({ correct: false, correctAnswer: data.correctAnswer })
      setGameStatus('result')
    }

    // LISTENER: Game finished
    const onMatchOver = (data) => {
      setFinalResult(data)
      setScores(data.scores)
      setGameStatus('finished')
    }

    // REGISTER all listeners
    socket.on('trivia:started', onStarted)
    socket.on('trivia:new_question', onNewQuestion)
    socket.on('trivia:answer_feedback', onFeedback)
    socket.on('trivia:score_update', onScoreUpdate)
    socket.on('trivia:round_over', onRoundOver)
    socket.on('trivia:match_over', onMatchOver)

    // CLEANUP — remove all listeners when component unmounts
    // Without this: memory leak + ghost listeners
    return () => {
      socket.off('connect', joinMatch)
      socket.off('trivia:started', onStarted)
      socket.off('trivia:new_question', onNewQuestion)
      socket.off('trivia:answer_feedback', onFeedback)
      socket.off('trivia:score_update', onScoreUpdate)
      socket.off('trivia:round_over', onRoundOver)
      socket.off('trivia:match_over', onMatchOver)
    }
  }, [socket, matchId, player1Id, player2Id])

  // ============================================================
  // TIMER — counts down every second
  // ============================================================
  useEffect(() => {
    if (gameStatus !== 'playing' || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Cleanup the timer when question changes or component unmounts
    return () => clearInterval(timer)
  }, [gameStatus, timeLeft])

  // ============================================================
  // HANDLER: User clicks an answer
  // ============================================================
  const handleAnswer = useCallback((answer) => {
    if (gameStatus !== 'playing' || selectedAnswer) return  // prevent double-click

    setSelectedAnswer(answer)
    setGameStatus('answered')

    // Calculate how long the user took (for scoring)
    const timeTakenMs = Date.now() - questionStart

    // EMIT to backend
    socket.emit('trivia:answer', {
      matchId,
      playerId: Number(currentUserId),
      answer,
      timeTakenMs,
    })
  }, [gameStatus, selectedAnswer, socket, matchId, currentUserId, questionStart])

  // ============================================================
  // RENDER — different UI for each game state
  // ============================================================

  // WAITING state
  if (gameStatus === 'waiting' || gameStatus === 'starting') {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {gameStatus === 'starting' ? 'Game starting...' : 'Waiting for opponent...'}
          </h2>
          <p className="text-muted-foreground">Get ready!</p>
        </CardContent>
      </Card>
    )
  }

  // FINISHED state
  if (gameStatus === 'finished' && finalResult) {
    const isWinner = finalResult.winnerId === Number(currentUserId)
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <Trophy className={`h-12 w-12 mx-auto mb-4 ${isWinner ? 'text-primary' : 'text-muted-foreground'}`} />
          <h2 className="text-2xl font-bold mb-2">
            {isWinner ? 'You Won!' : 'Game Over'}
          </h2>
          <div className="text-muted-foreground">
            {Object.entries(scores).map(([playerId, score]) => (
              <p key={playerId} className={`text-lg ${Number(playerId) === Number(currentUserId) ? 'text-foreground font-semibold' : ''}`}>
                Player {playerId}: {score} pts
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // PLAYING / ANSWERED / RESULT states
  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="p-6 space-y-6">
        {/* Score bar */}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Your score: {scores[currentUserId] || 0}</span>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className={timeLeft <= 3 ? 'text-danger font-bold' : ''}>{timeLeft}s</span>
          </div>
        </div>

        {/* Question text */}
        {question && (
          <>
            <h2 className="text-lg font-semibold">{question.text}</h2>

            {/* Answer options */}
            <div className="grid grid-cols-1 gap-2">
              {question.options.map((option, i) => {
                // Determine button styling based on game state
                let variant = 'outline'
                let icon = null

                if (gameStatus === 'result' && feedback) {
                  if (option === feedback.correctAnswer) {
                    variant = 'default'  // highlight correct answer
                    icon = <CheckCircle className="h-4 w-4 text-success" />
                  } else if (option === selectedAnswer && !feedback.correct) {
                    icon = <XCircle className="h-4 w-4 text-danger" />
                  }
                } else if (option === selectedAnswer) {
                  variant = 'secondary'  // highlight selected
                }

                return (
                  <Button
                    key={i}
                    variant={variant}
                    className="justify-start gap-2 h-auto py-3 px-4 text-left"
                    onClick={() => handleAnswer(option)}
                    disabled={gameStatus !== 'playing'}
                  >
                    {icon}
                    {option}
                  </Button>
                )
              })}
            </div>

            {/* Feedback message */}
            {gameStatus === 'result' && feedback && (
              <div className={`text-center text-sm font-medium ${feedback.correct ? 'text-success' : 'text-danger'}`}>
                {feedback.correct ? `Correct! +${feedback.points} pts` : `Wrong! Answer: ${feedback.correctAnswer}`}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
