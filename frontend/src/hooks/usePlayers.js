// ============================================================
// usePlayers — Hooks for player list + join/leave mutations
// ============================================================
// Separate file from useTournaments because it's a different entity.
// Players belong TO a tournament, but they're their own data.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlayers, joinTournament, leaveTournament, startTournament, getBracket } from '@/api/tournamentApi'

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
      queryClient.invalidateQueries({ queryKey: ['players', tournamentId] })
    },
  })
}

// Leave a tournament — same invalidation pattern
export function useLeaveTournament(tournamentId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => leaveTournament(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', tournamentId] })
    },
  })
}

// Start tournament — invalidates tournament (status changes) + bracket (now exists)
export function useStartTournament(tournamentId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => startTournament(tournamentId),
    onSuccess: () => {
      // Status changed from REGISTRATION → IN_PROGRESS
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      // Bracket was just generated
      queryClient.invalidateQueries({ queryKey: ['bracket', tournamentId] })
      // Player list might need refresh too
      queryClient.invalidateQueries({ queryKey: ['players', tournamentId] })
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
