// ============================================================
// usePlayers — Hooks for player list + join/leave mutations
// ============================================================
// Separate file from useTournaments because it's a different entity.
// Players belong TO a tournament, but they're their own data.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlayers, joinTournament, leaveTournament, startTournament, getBracket } from '@/api/tournamentApi'
import { toast } from 'sonner'

// Fetch players in a specific tournament
export function usePlayers(tournamentId) {
  return useQuery({
    queryKey: ['players', tournamentId],
    queryFn: () => getPlayers(tournamentId),
    enabled: !!tournamentId,
  })
}

// Join a tournament — invalidates player list so it updates
export function useJoinTournament(tournamentId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => joinTournament(tournamentId),
    onSuccess: () => {
      toast.success('Joined tournament!')
      queryClient.invalidateQueries({ queryKey: ['players', tournamentId] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to join')
    },
  })
}

// Leave a tournament — same invalidation pattern
export function useLeaveTournament(tournamentId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => leaveTournament(tournamentId),
    onSuccess: () => {
      toast.success('Left tournament')
      queryClient.invalidateQueries({ queryKey: ['players', tournamentId] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to leave')
    },
  })
}

// Start tournament — invalidates tournament (status changes) + bracket (now exists)
export function useStartTournament(tournamentId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => startTournament(tournamentId),
    onSuccess: () => {
      toast.success('Tournament started!')
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['bracket', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['players', tournamentId] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to start')
    },
  })
}

// Fetch bracket data
export function useBracket(tournamentId) {
  return useQuery({
    queryKey: ['bracket', tournamentId],
    queryFn: () => getBracket(tournamentId),
    enabled: !!tournamentId,
  })
}
