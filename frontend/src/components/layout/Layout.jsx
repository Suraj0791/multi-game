import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar is always visible on every protected page */}
      <Navbar />

      {/* Outlet = "put the current page's content here" */}
      {/* If URL is /tournaments → TournamentsPage appears here */}
      {/* If URL is /leaderboard → LeaderboardPage appears here */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children || <Outlet />}
      </main>
    </div>
  )
}
