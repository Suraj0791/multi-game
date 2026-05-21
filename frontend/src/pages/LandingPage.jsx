import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Swords, Brain, Users, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { guestLogin } from '@/api/authApi'
import { createDemoTournament } from '@/api/tournamentApi'
import useAuthStore from '@/stores/authStore'

const FEATURES = [
  {
    icon: <Swords className="h-6 w-6" />,
    title: 'Quick Draw',
    desc: 'Race to guess what your opponent is drawing in real-time. Fast-paced fun with a live canvas.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    accent: 'text-amber-400',
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: 'Trivia Battle',
    desc: 'Test your knowledge across multiple categories. Answer fast, earn points, climb the ranks.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    accent: 'text-emerald-400',
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    title: 'Tournaments',
    desc: 'Create or join 4-8 player brackets. Win matches, earn ELO, unlock achievement badges.',
    gradient: 'from-purple-500/20 to-pink-500/20',
    accent: 'text-purple-400',
  },
]

const BRACKET_PREVIEW = [
  { name: 'You', winner: true, round: 1 },
  { name: 'Bot_Alice', winner: false, round: 1 },
  { name: 'Bot_Bob', winner: true, round: 1 },
  { name: 'Bot_Charlie', winner: false, round: 1 },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const token = useAuthStore((state) => state.token)
  const [loading, setLoading] = useState(null)

  if (token) {
    navigate('/tournaments', { replace: true })
    return null
  }

  const handleGuestLogin = async () => {
    setLoading('guest')
    try {
      const res = await guestLogin()
      login(res.token, res.userId)
      navigate('/tournaments')
    } catch {
      setLoading(null)
    }
  }

  const handleDemo = async () => {
    setLoading('demo')
    try {
      const res = await guestLogin()
      login(res.token, res.userId)
      const demo = await createDemoTournament()
      navigate(`/tournaments/${demo.tournamentId}`)
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-lg">TourneyHub</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Real-time multiplayer platform
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Compete in{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Real-Time
            </span>{' '}
            Tournaments
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Play Quick Draw and Trivia against real opponents in live brackets.
            Create tournaments, climb the leaderboard, and earn badges.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              className="gap-2 text-base h-12 px-6"
              onClick={handleGuestLogin}
              disabled={loading !== null}
            >
              {loading === 'guest' ? 'Joining...' : 'Try as Guest'}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 text-base h-12 px-6"
              onClick={handleDemo}
              disabled={loading !== null}
            >
              {loading === 'demo' ? 'Loading...' : 'Load Demo Tournament'}
              <Users className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            No sign-up required. Demo creates a live 4-player bracket instantly.
          </p>

          <div className="mt-12 max-w-md mx-auto">
            <div className="bg-surface rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-3 text-center">Bracket Preview</p>
              <div className="grid grid-cols-2 gap-2">
                {BRACKET_PREVIEW.map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      p.winner
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    <Trophy className={`h-3 w-3 ${p.winner ? '' : 'opacity-0'}`} />
                    <span className={p.winner ? 'font-medium' : ''}>{p.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> 4 Players · Round 1
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2">How It Works</h2>
          <p className="text-muted-foreground">Three game modes. Infinite competition.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <Card key={i} className="bg-surface border-border overflow-hidden group">
              <CardContent className="p-0">
                <div className={`h-1 w-full bg-gradient-to-r ${feature.gradient}`} />
                <div className="p-5 space-y-3">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${feature.accent}`}>
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          TourneyHub — Built with React, Node.js, Socket.io, PostgreSQL
        </div>
      </footer>
    </div>
  )
}
