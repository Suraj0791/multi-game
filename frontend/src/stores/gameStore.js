import { create } from 'zustand'

const useGameStore = create((set) => ({
  activeMatchId: null,
  activeTournamentId: null,
  setActiveGame: (matchId, tournamentId) => set({ activeMatchId: matchId, activeTournamentId: tournamentId }),
  clearActiveGame: () => set({ activeMatchId: null, activeTournamentId: null }),
}))

export default useGameStore
