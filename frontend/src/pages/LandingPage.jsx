import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Swords, Brain, Users, ArrowRight, Sparkles, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { guestLogin } from '@/api/authApi'
import { createQuickMatch } from '@/api/tournamentApi'
import useAuthStore from '@/stores/authStore'

const FEATURES = [
  {
    icon: <Swords className="h-6 w-6" />,
    title: 'Quick Draw Canvas',
    desc: 'Race to guess what your opponent is drawing in real-time. Fast-paced fun with a live syncing canvas.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    accent: 'text-amber-400',
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: 'Trivia Showdown',
    desc: 'Test your knowledge across multiple categories. Answer fast, earn points, climb the live leaderboards.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    accent: 'text-emerald-400',
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    title: 'Live Tournaments',
    desc: 'Create or join 2-player quick matches and sync gameplay instantly between windows.',
    gradient: 'from-purple-500/20 to-pink-500/20',
    accent: 'text-purple-400',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const token = useAuthStore((state) => state.token)
  const userId = useAuthStore((state) => state.userId)
  const [loading, setLoading] = useState(null)
  const [copiedStep, setCopiedStep] = useState(false)

  const handleGuestLogin = async () => {
    setLoading('guest')
    try {
      const res = await guestLogin()
      login(res.token, res.userId)
      navigate('/tournaments', { replace: true })
    } catch {
      setLoading(null)
    }
  }

  const handleQuickMatch = async (gameType) => {
    setLoading(gameType)
    try {
      const data = await createQuickMatch(gameType)
      login(data.token, data.userId)
      // For quick match, take them to the tournament lobby so they can easily copy the URL for tab 2
      navigate(`/tournaments/${data.tournamentId}`, { replace: true })
    } catch {
      setLoading(null)
    }
  }

  const handleCopyLink = async () => {
    try {
      const sandboxUrl = window.location.origin
      await navigator.clipboard.writeText(sandboxUrl)
      setCopiedStep(true)
      setTimeout(() => setCopiedStep(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-amber-500/30 selection:text-amber-200">
      {/* Navigation */}
      <nav className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-foreground text-xl tracking-tight">TourneyHub</span>
          </div>
          <div className="flex items-center gap-4">
            {token ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/tournaments')} className="hover:text-amber-400 transition-colors">
                  Dashboard
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/profile/${userId}`)} className="hover:text-amber-400 transition-colors">
                  Profile
                </Button>
                <Button variant="outline" size="sm" className="border-neutral-800 hover:bg-neutral-900" onClick={() => {
                  localStorage.removeItem('token')
                  localStorage.removeItem('userId')
                  window.location.reload()
                }}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hover:text-amber-400 transition-colors">
                  Sign in
                </Button>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold" onClick={() => navigate('/register')}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero / WebSocket Sandbox Section */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-[400px] w-[600px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-10 right-10 -z-10 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6 uppercase tracking-wider animate-pulse">
            <Sparkles className="h-3.5 w-3.5" />
            Recruiter Testing Sandbox
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Test Real-Time{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              WebSockets
            </span>{' '}
            Side-by-Side
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Skip faking matches with bots. Experience genuine real-time synchronization by opening two browser tabs and playing against yourself in a fast lobby match.
          </p>

          {/* Guide / Instructions Block */}
          <div className="max-w-3xl mx-auto mb-12 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 md:p-8 text-left shadow-[0_8px_30px_rgb(0,0,0,0.6)] backdrop-blur-sm relative">
            <div className="absolute -top-3 left-6 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-neutral-950 rounded-full">
              4-Step Testing Guide
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-2">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">1</div>
                  <p className="text-sm text-neutral-300">
                    Click <strong className="text-amber-400">Quick Match</strong> on either Trivia or Quick Draw below.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">2</div>
                  <p className="text-sm text-neutral-300">
                    Copy the lobby invite link displayed inside the tournament header.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">3</div>
                  <p className="text-sm text-neutral-300">
                    Open an <span className="underline decoration-amber-500/50">Incognito tab</span>, paste the link, and hit join.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">4</div>
                  <p className="text-sm text-neutral-300">
                    Play and observe instant, low-latency WebSocket sync on both screens.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-neutral-500">Need to copy URL to paste in Incognito?</span>
              <Button
                variant="outline"
                size="sm"
                className="border-neutral-800 text-neutral-300 hover:bg-neutral-900 flex items-center gap-1.5"
                onClick={handleCopyLink}
              >
                {copiedStep ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied Base URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Base URL</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Match Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Trivia Duel Card */}
            <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-emerald-950/20 p-6 md:p-8 flex flex-col justify-between text-left group hover:border-emerald-500/40 transition-all duration-300 shadow-lg hover:shadow-emerald-500/5">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Brain className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-100 mb-2">Trivia Duel</h3>
                <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                  Join a real-time question arena. Players receive the same question simultaneously. Answers and score updates are instantly synchronized.
                </p>
              </div>
              <Button
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold flex items-center justify-center gap-2 h-11"
                onClick={() => handleQuickMatch('TRIVIA')}
                disabled={loading !== null}
              >
                {loading === 'TRIVIA' ? 'Creating Arena...' : 'Launch Trivia Quick Match'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Draw Canvas Card */}
            <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-amber-950/20 p-6 md:p-8 flex flex-col justify-between text-left group hover:border-amber-500/40 transition-all duration-300 shadow-lg hover:shadow-amber-500/5">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />
              <div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Swords className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-100 mb-2">Quick Draw Canvas</h3>
                <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                  One player draws, the other guesses in real-time. Stroke vectors and guess events sync instantly on the shared canvas screen.
                </p>
              </div>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold flex items-center justify-center gap-2 h-11"
                onClick={() => handleQuickMatch('QUICK_DRAW')}
                disabled={loading !== null}
              >
                {loading === 'QUICK_DRAW' ? 'Creating Lobby...' : 'Launch Quick Draw Match'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            {token ? (
              <span className="text-sm text-neutral-500">
                You are currently signed in. You can also test guest matching in Incognito!
              </span>
            ) : (
              <Button
                variant="link"
                className="text-neutral-400 hover:text-amber-400 text-sm font-semibold transition-colors"
                onClick={handleGuestLogin}
                disabled={loading !== null}
              >
                Or enter normal Dashboard as Guest &rarr;
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight mb-3">Core App Features</h2>
          <p className="text-neutral-400 max-w-md mx-auto">Modern real-time gameplay architecture built from scratch.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <Card key={i} className="bg-neutral-900/40 border-neutral-800/80 overflow-hidden hover:border-neutral-700/80 transition-colors group">
              <CardContent className="p-0">
                <div className={`h-1 w-full bg-gradient-to-r ${feature.gradient}`} />
                <div className="p-6 space-y-4">
                  <div className={`w-10 h-10 rounded-lg bg-neutral-950 flex items-center justify-center border border-neutral-800 ${feature.accent}`}>
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-neutral-200">{feature.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{feature.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-800 bg-neutral-950 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            TourneyHub &copy; {new Date().getFullYear()} · All rights reserved.
          </div>
          <div>
            Built with React, Socket.io, Node.js, and PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  )
}
