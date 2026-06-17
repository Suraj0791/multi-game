import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Brain,
  Brush,
  Check,
  Copy,
  IndianRupee,
  LogOut,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { guestLogin } from '@/api/authApi'
import { createQuickMatch } from '@/api/tournamentApi'
import useAuthStore from '@/stores/authStore'

const DEMOS = [
  {
    type: 'TRIVIA',
    title: 'Try Trivia Demo',
    text: 'Same questions, live scoring, instant round updates.',
    icon: Brain,
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50',
    button: 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400',
  },
  {
    type: 'QUICK_DRAW',
    title: 'Try QuickDraw Demo',
    text: 'Draw in one tab and watch strokes sync in another.',
    icon: Brush,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:border-amber-400/50',
    button: 'bg-amber-500 text-neutral-950 hover:bg-amber-400',
  },
]

const PRODUCT_POINTS = [
  { icon: Zap, label: 'Live Socket.io matches' },
  { icon: Trophy, label: 'Bracket tournaments' },
  { icon: ShieldCheck, label: 'Rate-limited auth' },
  { icon: BarChart3, label: 'Cached leaderboards' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const token = useAuthStore((state) => state.token)
  const userId = useAuthStore((state) => state.userId)
  const [loading, setLoading] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleGuestLogin = async () => {
    if (token) return
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
      if (data.token) {
        login(data.token, data.userId)
      }
      navigate(`/tournaments/${data.tournamentId}/match/waiting`, { replace: true })
    } catch {
      setLoading(null)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-amber-500/25 selection:text-amber-100">
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Trophy className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">TourneyHub</span>
          </button>

          <div className="flex items-center gap-2">
            {token ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/tournaments')}>
                  Tournaments
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/profile/${userId}`)}>
                  Profile
                </Button>
                <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => navigate('/register')}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.04fr_0.96fr] lg:py-16">
          <div className="space-y-8">
            <div className="space-y-5">
              <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                Live multiplayer tournament platform
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-neutral-50 md:text-6xl">
                  Run real-time game tournaments in a few clicks.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Create a lobby, invite another player, and play Trivia or QuickDraw with live sockets,
                  brackets, chat, payments, and player rankings.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {DEMOS.map((demo) => {
                const Icon = demo.icon
                const isLoading = loading === demo.type

                return (
                  <button
                    key={demo.type}
                    onClick={() => handleQuickMatch(demo.type)}
                    disabled={loading !== null}
                    className={`group rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 ${demo.className}`}
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-current/20 bg-neutral-950/40">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <h2 className="text-base font-semibold text-neutral-50">
                      {isLoading ? 'Creating lobby...' : demo.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">{demo.text}</p>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">
                Opens a live lobby you can test with an Incognito window.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="w-fit border-border/80 bg-surface/40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Base URL copied' : 'Copy base URL'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={token ? () => navigate('/tournaments') : handleGuestLogin}
                disabled={loading !== null}
              >
                <Users className="h-4 w-4" />
                {token ? 'Open dashboard' : loading === 'guest' ? 'Entering...' : 'Enter as guest'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/leaderboard')}>
                View leaderboard
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/45 p-4 shadow-2xl shadow-black/30">
            <div className="rounded-xl border border-border/60 bg-neutral-950/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Live lobby</p>
                  <h2 className="mt-1 text-xl font-semibold text-neutral-50">Friday Night Finals</h2>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  Registration
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <Swords className="mb-3 h-4 w-4 text-amber-400" />
                  <p className="text-xs text-muted-foreground">Game</p>
                  <p className="font-medium">QuickDraw</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <Users className="mb-3 h-4 w-4 text-emerald-400" />
                  <p className="text-xs text-muted-foreground">Players</p>
                  <p className="font-medium">2 / 8 joined</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lobby fill</span>
                  <span className="font-medium text-neutral-200">25%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/4 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {['Host ready', 'Player payment complete', 'Invite copied'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-neutral-300">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/70 bg-surface/20">
          <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 md:grid-cols-4">
            {PRODUCT_POINTS.map((point) => {
              const Icon = point.icon
              return (
                <div key={point.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                  <Icon className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-neutral-200">{point.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* ====== FAQ SECTION ====== */}
        <section className="border-t border-border/70 bg-background py-16">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-neutral-50">Frequently Asked Questions</h2>
              <p className="mt-2 text-muted-foreground">Everything you need to know about testing the platform.</p>
            </div>
            
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-surface/35 p-5 transition-colors hover:bg-surface/50">
                <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-400" />
                  What is the difference between Guest and Real accounts?
                </h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  Guests are ephemeral demo accounts — no email or password needed. They are deleted by a CRON job after 24 hours of inactivity. Real accounts are permanent and let you keep your ELO rating, host public tournaments, and manage a wallet. Guests cannot create or join paid tournaments.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/35 p-5 transition-colors hover:bg-surface/50">
                <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  How do I test multiplayer features by myself?
                </h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  Click "Try Demo" to create a lobby. Then copy the invite URL and paste it into a <strong>separate Incognito window</strong>. Incognito does not share `localStorage` tokens with your main window, so the app provisions a second Player session for real-time socket testing.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/35 p-5 transition-colors hover:bg-surface/50">
                <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  What happens if I disconnect during an active match?
                </h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  You have a 30-second grace period to reconnect. If you come back, the game resumes where it left off (current question, scores, timer). If you don't reconnect in time, your opponent wins by default and the tournament advances. If both players disconnect, the first player wins as a tiebreaker.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/35 p-5 transition-colors hover:bg-surface/50">
                <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                  <Swords className="h-4 w-4 text-emerald-400" />
                  How does Quick Draw scoring work?
                </h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  One player draws a secret word while the other guesses. The guesser has 5 attempts and 60 seconds. A correct guess wins immediately. If time runs out or all 5 guesses are wrong, the drawer wins. ELO ratings adjust after every match.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/35 p-5 transition-colors hover:bg-surface/50">
                <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-amber-400" />
                  How does Trivia scoring work?
                </h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  Each round shows a multiple-choice question with a 10-second timer. Points are awarded for correct answers — faster answers score higher. After 10 questions, the player with the most points wins. Ties are broken by whoever answered faster on average.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/35 p-5 transition-colors hover:bg-surface/50">
                <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Will I lose my Guest stats if I register later?
                </h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  Yes. Guest accounts are deleted after 24 hours and cannot be merged with a real account. Any ELO or match history earned as a Guest is lost. If you want permanent ratings, register with an email before playing.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
