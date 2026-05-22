import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TriviaGame({ socket, matchId, currentUserId, isSpectator }) {
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

  const userIdNum = Number(currentUserId)
  const safeUserId = !isNaN(userIdNum) && userIdNum > 0 ? userIdNum : null

  // Starting Countdown
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

  // Smooth Local Timer (No Server Clock Skew)
  useEffect(() => {
    if (gameStatus !== 'playing') return

    const tick = () => {
      if (!questionStartTime) return
      // Use purely local Date.now() to prevent stuttering
      const elapsed = Date.now() - questionStartTime
      const remaining = Math.max(0, Math.ceil((10000 - elapsed) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) clearInterval(interval)
    }

    tick()
    const interval = setInterval(tick, 100) // Fast 100ms tick for buttery smooth updates
    return () => clearInterval(interval)
  }, [gameStatus, questionStartTime])

  // Socket Listeners
  useEffect(() => {
    if (!socket || !safeUserId) return

    const onStarted = () => setGameStatus('starting')

    const onNewQuestion = (data) => {
      socket.emit('trivia:request_scores', { matchId })
      setQuestion(data.question)
      // FIX: Lock the start time exactly to when the browser receives the event
      setQuestionStartTime(Date.now()) 
      setTimeLeft(data.timerSeconds || 10)
      setSelectedAnswer(null)
      setFeedback(null)
      setHasAnsweredCurrent(false)
      setGameStatus('playing')
    }

    const onFeedback = (data) => {
      setFeedback(data)
      setGameStatus('result')
    }

    const onScoreUpdate = (data) => setScores(data.scores)

    const onRoundOver = (data) => {
      setFeedback(prev => prev !== null ? prev : { correct: false, correctAnswer: data.correctAnswer })
      setGameStatus('result')
    }

    const onMatchOver = (data) => {
      setFinalResult(data)
      setScores(data.scores)
      setGameStatus('finished')
    }

    const onTriviaError = (data) => toast.error(data.message || 'An error occurred')
    
    const onHasAnswered = (data) => setHasAnsweredCurrent(data.hasAnswered)

    socket.on('trivia:started', onStarted)
    socket.on('trivia:new_question', onNewQuestion)
    socket.on('trivia:answer_feedback', onFeedback)
    socket.on('trivia:score_update', onScoreUpdate)
    socket.on('trivia:round_over', onRoundOver)
    socket.on('trivia:match_over', onMatchOver)
    socket.on('trivia:error', onTriviaError)
    socket.on('trivia:has_answered', onHasAnswered)

    const joinMatch = () => socket.emit('trivia:join', { matchId, playerId: safeUserId })
    if (socket.connected) joinMatch()
    socket.on('connect', joinMatch)

    return () => {
      socket.off('connect', joinMatch)
      socket.off('trivia:started', onStarted)
      socket.off('trivia:new_question', onNewQuestion)
      socket.off('trivia:answer_feedback', onFeedback)
      socket.off('trivia:score_update', onScoreUpdate)
      socket.off('trivia:round_over', onRoundOver)
      socket.off('trivia:match_over', onMatchOver)
      socket.off('trivia:error', onTriviaError)
      socket.off('trivia:has_answered', onHasAnswered)
    }
  }, [socket, matchId, safeUserId])

  const handleAnswer = useCallback((answer) => {
    if (gameStatus !== 'playing' || selectedAnswer || isSpectator) return

    setSelectedAnswer(answer)
    setGameStatus('answered')
    
    // Time taken calculates exactly how fast they clicked for point scaling
    const timeTakenMs = Date.now() - questionStartTime

    socket.emit('trivia:answer', {
      matchId,
      playerId: safeUserId,
      answer,
      timeTakenMs,
    })
  }, [gameStatus, selectedAnswer, socket, matchId, safeUserId, questionStartTime, isSpectator])

  // WAITING UI
  if (gameStatus === 'waiting' || gameStatus === 'starting') {
    return (
      <Card className="max-w-lg mx-auto border-neutral-800 bg-neutral-950/40 mt-8">
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
        </CardContent>
      </Card>
    )
  }

  // FINISHED UI
  if (gameStatus === 'finished' && finalResult) {
    const isWinner = finalResult.winnerId === safeUserId
    return (
      <Card className="max-w-lg mx-auto border-neutral-800 bg-neutral-950/40 mt-8">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className={`h-12 w-12 mx-auto mb-2 ${isWinner && !isSpectator ? 'text-amber-500 animate-pulse' : 'text-neutral-600'}`} />
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            {isSpectator ? 'Match Finished' : (isWinner ? 'You Won!' : 'Game Over')}
          </h2>
          <div className="text-neutral-400 space-y-2 bg-neutral-900/60 p-4 rounded-lg border border-neutral-800/80 mb-6">
            {Object.entries(scores).map(([playerId, score]) => (
              <div key={playerId} className={`flex justify-between items-center py-2 border-b border-neutral-800 last:border-0 ${Number(playerId) === safeUserId ? 'text-amber-400 font-bold' : 'text-neutral-300'}`}>
                <span>{Number(playerId) === safeUserId ? 'You' : `Player ${playerId}`}</span>
                <span className="bg-neutral-950 px-3 py-1 rounded-md">{score} pts</span>
              </div>
            ))}
          </div>
          
          {/* Add this button so the user is not stuck! */}
          <Button 
            className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold mt-4"
            onClick={() => window.location.href = '/tournaments'}
          >
            Return to Dashboard
          </Button>

        </CardContent>
      </Card>
    )
  }

  // ACTIVE PLAYING UI
  return (
    <Card className="max-w-lg mx-auto border-neutral-850 bg-gradient-to-b from-neutral-900 to-neutral-950 shadow-xl mt-8">
      <CardContent className="p-6 space-y-6">
        {isSpectator && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold py-1.5 rounded-md text-center uppercase tracking-wider animate-pulse">
            Spectating Match
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-neutral-400 border-b border-neutral-800/60 pb-3">
          <span className="font-semibold text-neutral-200">
            {isSpectator ? 'Spectating' : `Score: ${scores[safeUserId] || 0}`}
          </span>
          <div className="flex items-center gap-1.5 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
            <Clock className={`h-4 w-4 ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
            <span className={`font-mono text-base ${timeLeft <= 3 ? 'text-red-500 font-black' : 'text-neutral-200'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {question && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-100 leading-snug">{question.text}</h2>

            <div className="grid grid-cols-1 gap-3">
              {question.options.map((option, i) => {
                let variant = 'outline'
                let customStyle = 'bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-100'
                let icon = null

                if (gameStatus === 'result' && feedback) {
                  if (option === feedback.correctAnswer) {
                    variant = 'default'
                    customStyle = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                    icon = <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  } else if (option === selectedAnswer && !feedback.correct) {
                    customStyle = 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/20 hover:text-red-400'
                    icon = <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  }
                } else if (option === selectedAnswer) {
                  variant = 'secondary'
                  customStyle = 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 hover:text-amber-400'
                }

                return (
                  <Button
                    key={i}
                    variant={variant}
                    className={`justify-start gap-3 h-auto py-4 px-5 text-left border transition-all ${customStyle}`}
                    onClick={() => handleAnswer(option)}
                    disabled={gameStatus !== 'playing' || isSpectator || selectedAnswer !== null}
                  >
                    {icon}
                    <span className="text-sm font-medium">{option}</span>
                  </Button>
                )
              })}
            </div>

            {gameStatus === 'result' && feedback && (
              <div className={`text-center text-sm font-bold rounded-lg p-3 animate-in fade-in zoom-in duration-200 ${feedback.correct ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {feedback.correct ? `Correct! +${feedback.points} pts` : `Correct Answer: ${feedback.correctAnswer}`}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
