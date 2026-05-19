// Hooks for leaderboard + user profile
import { useQuery } from '@tanstack/react-query'
import { getLeaderboard, getUserProfile } from '@/api/userApi'

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
  })
}

export function useUserProfile(userId) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserProfile(userId),
    enabled: !!userId,
  })
}
