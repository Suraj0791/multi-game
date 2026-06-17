import { Navigate } from 'react-router-dom'
import useAuthStore from '@/stores/authStore'

export default function PublicRoute({ children, allowGuests = false }) {
  const token = useAuthStore((state) => state.token)
  const isGuest = useAuthStore((state) => state.isGuest)

  if (!token) return children

  // allowGuests=true: guests still see the page (register), real users get redirected
  if (allowGuests && isGuest) return children

  return <Navigate to="/tournaments" replace />
}
