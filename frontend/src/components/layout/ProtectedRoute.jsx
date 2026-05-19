import { Navigate } from 'react-router-dom'
import useAuthStore from '@/stores/authStore'

export default function ProtectedRoute({ children }) {
  // Grab the token from our auth store
  const token = useAuthStore((state) => state.token)

  // No token = not logged in = go to login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Has token = logged in = show the page
  return children
}
