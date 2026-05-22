import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/stores/authStore'

export default function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()

  if (!token) {
    // Preserve the intended URL so login can redirect back
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return children
}
