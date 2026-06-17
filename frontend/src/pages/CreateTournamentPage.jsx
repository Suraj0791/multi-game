import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Brain, Brush, IndianRupee, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useCreateTournament } from '@/hooks/useTournaments'
import useAuthStore from '@/stores/authStore'

const GAMES = [
  {
    value: 'TRIVIA',
    label: 'Trivia',
    text: 'Fast questions, timed answers, live scoring.',
    icon: Brain,
    className: 'border-emerald-500/25 text-emerald-300',
  },
  {
    value: 'QUICK_DRAW',
    label: 'QuickDraw',
    text: 'One player draws, the other guesses live.',
    icon: Brush,
    className: 'border-amber-500/25 text-amber-300',
  },
]

const PLAYER_COUNTS = [2, 4, 8, 16]

export default function CreateTournamentPage() {
  const navigate = useNavigate()
  const createMutation = useCreateTournament()
  const isGuest = useAuthStore((state) => state.isGuest)
  const [feeMode, setFeeMode] = useState('free')
  const [error, setError] = useState(null)

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      game_type: 'TRIVIA',
      max_players: 8,
      entry_fee: 0,
    },
  })

  const values = useWatch({ control })
  const selectedGame = GAMES.find((game) => game.value === values.game_type) || GAMES[0]
  const PreviewGameIcon = selectedGame.icon
  const isCreating = isSubmitting || createMutation.isPending

  const onSubmit = async (data) => {
    setError(null)

    try {
      const response = await createMutation.mutateAsync({
        name: data.name,
        game_type: data.game_type,
        max_players: Number(data.max_players),
        entry_fee: feeMode === 'free' ? 0 : Number(data.entry_fee || 0),
      })

      toast.success('Tournament ready')
      navigate(`/tournaments/${response.tournamentId}`, { replace: true })
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Could not create tournament'
      setError(message)
      toast.error(message)
    }
  }

  const switchFeeMode = (mode) => {
    setFeeMode(mode)
    if (mode === 'free') setValue('entry_fee', 0)
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-xl border border-border/70 bg-surface/35 p-5">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Create Tournament</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up the lobby, invite players, and start when everyone is ready.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-neutral-200">
              Tournament name
            </label>
            <Input
              id="name"
              placeholder="Friday Night Finals"
              className="h-10 border-border/80 bg-background/60"
              {...register('name', { required: true })}
            />
          </div>

          <Controller
            control={control}
            name="game_type"
            render={({ field }) => (
              <div className="space-y-3">
                <p className="text-sm font-medium text-neutral-200">Game type</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GAMES.map((game) => {
                    const Icon = game.icon
                    const active = field.value === game.value

                    return (
                      <button
                        key={game.value}
                        type="button"
                        onClick={() => field.onChange(game.value)}
                        className={`rounded-xl border p-4 text-left transition-all hover:bg-surface-hover ${
                          active ? `${game.className} bg-background/70` : 'border-border/70 bg-background/35 text-neutral-300'
                        }`}
                      >
                        <Icon className="mb-4 h-5 w-5" />
                        <h2 className="font-semibold text-neutral-50">{game.label}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{game.text}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          />

          <Controller
            control={control}
            name="max_players"
            render={({ field }) => (
              <div className="space-y-3">
                <p className="text-sm font-medium text-neutral-200">Players</p>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => field.onChange(count)}
                      className={`rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
                        Number(field.value) === count
                          ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                          : 'border-border/70 bg-background/35 text-neutral-300 hover:bg-surface-hover'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />

          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-200">Entry fee</p>
            {isGuest && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Guest accounts cannot create paid tournaments. Please register a real account.</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => switchFeeMode('free')}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
                  feeMode === 'free'
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                    : 'border-border/70 bg-background/35 text-neutral-300 hover:bg-surface-hover'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => !isGuest && switchFeeMode('paid')}
                disabled={isGuest}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
                  isGuest
                    ? 'border-border/30 bg-background/20 text-neutral-500 cursor-not-allowed'
                    : feeMode === 'paid'
                      ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                      : 'border-border/70 bg-background/35 text-neutral-300 hover:bg-surface-hover'
                }`}
              >
                Paid
              </button>
            </div>
            {feeMode === 'paid' && (
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  placeholder="Entry amount"
                  className="h-10 border-border/80 bg-background/60 pl-9"
                  {...register('entry_fee')}
                />
              </div>
            )}
          </div>

          <Button type="submit" className="h-10 w-full" disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCreating ? 'Creating tournament' : 'Create Tournament'}
          </Button>
        </form>
      </section>

      <aside className="rounded-xl border border-border/70 bg-surface/35 p-5 lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-4 text-sm font-medium text-muted-foreground">Preview</p>
        <div className="rounded-xl border border-border/70 bg-background/55 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Badge variant="outline" className={selectedGame.className}>
              <PreviewGameIcon className="h-3 w-3" />
              {selectedGame.label}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Open
            </Badge>
          </div>
          <h2 className="line-clamp-2 text-lg font-semibold text-neutral-50">
            {values.name || 'Untitled tournament'}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border/60 bg-surface/50 p-3">
              <Users className="mb-2 h-4 w-4 text-emerald-400" />
              <p className="text-muted-foreground">Players</p>
              <p className="font-medium text-neutral-100">1 / {values.max_players}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface/50 p-3">
              <IndianRupee className="mb-2 h-4 w-4 text-amber-400" />
              <p className="text-muted-foreground">Entry</p>
              <p className={feeMode === 'free' ? 'font-medium text-emerald-300' : 'font-medium text-amber-300'}>
                {feeMode === 'free' ? 'Free' : `₹${values.entry_fee || 0}`}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
