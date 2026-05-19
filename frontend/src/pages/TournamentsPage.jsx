// ============================================================
// TOURNAMENTS PAGE — Smart Component
// ============================================================
// This is the SMART component. It:
//   1. FETCHES tournament data (via useTournaments hook → React Query)
//   2. OWNS UI state (search term, status filter)
//   3. COMPUTES derived state (filtered list)
//   4. PASSES data down to dumb children (TournamentCard)
//
// MENTAL MODEL:
//   This page is the CONTROLLER.
//   useTournaments hook is the SERVICE.
//   tournamentApi.js is the MODEL.
//   TournamentCard is the VIEW (just renders what it's given).
//
// STATE MAP:
//   tournaments    → SERVER STATE (useQuery via useTournaments)
//   searchTerm     → UI STATE (useState — tracks what user types)
//   statusFilter   → UI STATE (useState — tracks which filter is active)
//   filtered       → DERIVED (computed every render, NOT stored)

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTournaments } from '@/hooks/useTournaments'
import TournamentCard from '@/components/tournaments/TournamentCard'

// The filter options — a simple array of strings
const STATUSES = ['ALL', 'REGISTRATION', 'IN_PROGRESS', 'COMPLETED']

export default function TournamentsPage() {
  // ============================================================
  // STATE
  // ============================================================

  // SERVER STATE — the tournament list from the API
  // React Query handles: fetching, caching, loading, errors
  const { data: tournaments, isLoading, error } = useTournaments()
  // ^^^ destructuring with rename: data → tournaments
  // So instead of writing data.map(...), we write tournaments.map(...)

  // UI STATE — what the user typed in the search bar
  const [searchTerm, setSearchTerm] = useState('')

  // UI STATE — which filter button is active
  const [statusFilter, setStatusFilter] = useState('ALL')

  // ============================================================
  // DERIVED STATE — computed, NOT stored
  // ============================================================
  // WHY NOT useState for this?
  // Because filteredTournaments can ALWAYS be recalculated from
  // tournaments + searchTerm + statusFilter.
  // Storing it separately would create two sources of truth.
  //
  // This runs on every render. Is that slow?
  // NO. Filtering 100 items is microseconds. You'd need 100,000+
  // items before this becomes a performance concern.

  const filteredTournaments = (tournaments || [])
    // Step 1: Filter by status (if not "ALL")
    .filter(t => statusFilter === 'ALL' || t.status === statusFilter)
    // Step 2: Filter by search term (case-insensitive name match)
    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))

  // ============================================================
  // RENDER
  // ============================================================

  // Loading state — show while React Query is fetching
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading tournaments...</p>
      </div>
    )
  }

  // Error state — show if the API call failed
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">Failed to load tournaments.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* HEADER — Title + Create button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Link to="/tournaments/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Tournament
          </Button>
        </Link>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tournaments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {/* ^^^ This is one of the FEW places where useState + onChange
              is the right choice instead of React Hook Form.
              Why? Because this is NOT a form submission — it's a live filter.
              The value changes on every keystroke and immediately affects
              the filtered list. No submit button involved. */}
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {STATUSES.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="text-xs"
            >
              {status === 'ALL' ? 'All' : status.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* TOURNAMENT GRID */}
      {filteredTournaments.length === 0 ? (
        // Empty state — no tournaments match the search/filter
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tournaments found.</p>
        </div>
      ) : (
        // Grid of tournament cards
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTournaments.map((tournament) => (
            // Each card receives ONE tournament as a prop
            // The card doesn't know about the API, the filter, or the search
            // It just renders what it's given
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  )
}
