// ============================================================
// useTournaments — Custom hook for tournament data
// ============================================================
//
// A "custom hook" is just a function that starts with "use".
// It wraps useQuery so any component can fetch tournaments
// with ONE line: const { data, isLoading } = useTournaments()
//
// WHY wrap useQuery in a custom hook instead of using it directly?
//   1. REUSABILITY — multiple pages might need tournament data
//   2. SINGLE SOURCE OF TRUTH — queryKey is defined in ONE place
//      If you change the key, you change it here, not in 5 files
//   3. CLEAN PAGES — the page just calls useTournaments(),
//      doesn't need to know about queryKey or queryFn details
//
// BACKEND PARALLEL:
//   This is like a Service layer.
//   API file = Model (raw database/HTTP call)
//   Hook = Service (business logic + caching rules)
//   Page = Controller (handles the request/UI)

import { useQuery } from '@tanstack/react-query'
import { getTournaments, getTournamentById } from '@/api/tournamentApi'

// Fetch ALL tournaments (for the list page)
export function useTournaments() {
  return useQuery({
    // queryKey — a unique ID for this data in the cache
    // React Query uses this to know: "have I already fetched this?"
    // If you navigate away and come back, it checks the cache first
    queryKey: ['tournaments'],

    // queryFn — the function that actually fetches the data
    // React Query calls this when the cache is empty or stale
    queryFn: getTournaments,
  })
  // WHAT THIS RETURNS:
  // {
  //   data: [...tournaments] or undefined (while loading)
  //   isLoading: true/false
  //   error: Error object or null
  //   refetch: function to manually refresh the data
  // }
}

// Fetch ONE tournament by ID (for the detail page — we'll use this later)
export function useTournament(id) {
  return useQuery({
    // queryKey includes the ID — so each tournament is cached separately
    // ['tournament', '5'] is different from ['tournament', '3']
    queryKey: ['tournament', id],

    queryFn: () => getTournamentById(id),

    // Don't fetch if there's no ID (prevents errors during initial render)
    enabled: !!id,
  })
}
