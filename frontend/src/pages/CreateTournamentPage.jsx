// ============================================================
// CREATE TOURNAMENT PAGE
// ============================================================
// Pattern: Same as Login (form → submit → API → redirect)
// New concept: useMutation for cache invalidation
//
// THE FLOW:
//   User fills form → clicks submit
//   → handleSubmit validates
//   → onSubmit calls mutateAsync (sends POST /tournaments)
//   → Backend creates tournament, returns { tournamentId }
//   → useMutation's onSuccess invalidates ['tournaments'] cache
//   → navigate to /tournaments/:newId
//   → Tournament list will auto-refetch next time user visits it

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useCreateTournament } from '@/hooks/useTournaments'

export default function CreateTournamentPage() {
  const navigate = useNavigate()

  // useMutation hook — handles POST + cache invalidation
  const createMutation = useCreateTournament()

  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm({
    // Default values — pre-fill the form
    defaultValues: {
      name: '',
      game_type: 'TRIVIA',
      max_players: 8,
      entry_fee: 0,
    }
  })

  const [error, setError] = useState(null)

  const onSubmit = async (data) => {
    setError(null)
    try {
      // mutateAsync returns a promise (unlike mutate which is fire-and-forget)
      // We use mutateAsync so we can AWAIT the result and get the tournament ID
      const response = await createMutation.mutateAsync({
        name: data.name,
        game_type: data.game_type,
        max_players: Number(data.max_players),   // form gives strings, backend wants numbers
        entry_fee: Number(data.entry_fee),
      })

      // Redirect to the newly created tournament's detail page
      navigate(`/tournaments/${response.data.tournamentId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create tournament.')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Tournament</CardTitle>
          <CardDescription>Set up a new tournament for players to join</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-danger/10 text-danger text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Tournament Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Tournament Name</label>
              <Input
                id="name"
                placeholder="e.g. Friday Night Trivia"
                {...register('name', { required: true })}
              />
            </div>

            {/* Game Type — dropdown */}
            <div className="space-y-2">
              <label htmlFor="game_type" className="text-sm font-medium">Game Type</label>
              <select
                id="game_type"
                {...register('game_type')}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="TRIVIA">Trivia</option>
                <option value="QUICK_DRAW">Quick Draw</option>
              </select>
            </div>

            {/* Max Players — dropdown */}
            <div className="space-y-2">
              <label htmlFor="max_players" className="text-sm font-medium">Max Players</label>
              <select
                id="max_players"
                {...register('max_players')}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="4">4 Players</option>
                <option value="8">8 Players</option>
                <option value="16">16 Players</option>
              </select>
            </div>

            {/* Entry Fee */}
            <div className="space-y-2">
              <label htmlFor="entry_fee" className="text-sm font-medium">Entry Fee (₹)</label>
              <Input
                id="entry_fee"
                type="number"
                min="0"
                placeholder="0 for free"
                {...register('entry_fee')}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Tournament'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
