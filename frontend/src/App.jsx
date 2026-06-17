import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import PublicRoute from '@/components/layout/PublicRoute'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import { Toaster } from 'sonner'

import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import TournamentsPage from '@/pages/TournamentsPage'
import CreateTournamentPage from '@/pages/CreateTournamentPage'
import TournamentDetailPage from '@/pages/TournamentDetailPage'
import MatchPage from '@/pages/MatchPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import ProfilePage from '@/pages/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status === 429 || status === 404 || status === 401 || status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
  },
})

function AuthExpiryListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate])

  return null
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthExpiryListener />
          <Routes>

            {/* ====== PUBLIC ROUTES ====== */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={
              <PublicRoute allowGuests>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute allowGuests>
                <RegisterPage />
              </PublicRoute>
            } />

            <Route path="/leaderboard" element={
              <Layout>
                <LeaderboardPage />
              </Layout>
            } />

            {/* ====== MATCH ROUTES (public — MatchPage handles its own auth) ====== */}
            <Route element={<Layout />}>
              <Route path="/tournaments/:id/match/waiting" element={<MatchPage />} />
              <Route path="/tournaments/:id/match/:matchId" element={<MatchPage />} />
            </Route>

            {/* ====== PROTECTED ROUTES ====== */}
            <Route element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/new" element={<CreateTournamentPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/profile/:id" element={<ProfilePage />} />
            </Route>

            {/* ====== CATCH-ALL ====== */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
