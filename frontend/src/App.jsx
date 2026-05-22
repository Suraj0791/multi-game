import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Layout & Guards
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import PublicRoute from '@/components/layout/PublicRoute'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import { Toaster } from 'sonner'

// Pages
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import TournamentsPage from '@/pages/TournamentsPage'
import CreateTournamentPage from '@/pages/CreateTournamentPage'
import TournamentDetailPage from '@/pages/TournamentDetailPage'
import MatchPage from '@/pages/MatchPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import ProfilePage from '@/pages/ProfilePage'

// React Query client — manages all API data caching
// This is created ONCE and shared across the entire app
const queryClient = new QueryClient()

function App() {
  return (
    // QueryClientProvider — makes React Query available to all components
    // Same idea as wrapping your Express app with the database connection
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>

            {/* ====== PUBLIC ROUTES (no login needed) ====== */}
            {/* Landing page is the root — no auth needed */}
            <Route path="/" element={<LandingPage />} />
            {/* If user is already logged in, PublicRoute redirects to /tournaments */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            } />

            {/* ====== PUBLIC MATCH WAITING ROOM (no login needed) ====== */}
            {/* This route MUST be outside ProtectedRoute so Player 2 in Incognito */}
            {/* can land here directly — MatchPage handles its own guest auto-login */}
            <Route element={<Layout />}>
              <Route path="/tournaments/:id/match/waiting" element={<MatchPage />} />
            </Route>

            {/* ====== PROTECTED ROUTES (login required) ====== */}
            {/* Layout adds the Navbar + page wrapper around ALL these routes */}
            {/* ProtectedRoute checks for JWT token before rendering */}
            <Route element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              {/* These are "child routes" of Layout */}
              {/* They render inside Layout's <Outlet /> component */}
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/new" element={<CreateTournamentPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/tournaments/:id/match/:matchId" element={<MatchPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/profile/:id" element={<ProfilePage />} />
            </Route>

            {/* ====== CATCH-ALL ====== */}
            {/* Any URL that doesn't match above → go to /tournaments */}
            <Route path="*" element={<Navigate to="/tournaments" replace />} />

          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
