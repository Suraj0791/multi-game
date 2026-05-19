import { Navigate } from 'react-router-dom'
import useAuthStore from '@/stores/authStore'

export default function PublicRoute({ children }) {
  // Grab the token from our auth store
  const token = useAuthStore((state) => state.token)

  // Already logged in? Skip login page, go to the app
  if (token) {
    return <Navigate to="/tournaments" replace />
  }

  // Not logged in? Show whatever page is inside (login or register)
  return children
}
