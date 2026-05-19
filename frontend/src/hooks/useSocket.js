// ============================================================
// useSocket — Custom hook for WebSocket connection
// ============================================================
// Creates socket via lazy useState initializer (runs once).
// Disconnects on unmount via useEffect cleanup.

import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function useSocket() {
  // Lazy initializer — the function runs ONCE on first render
  // No useEffect needed for creation. React calls this function
  // only during the initial render, never again.
  const [socket] = useState(() =>
    io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  )

  // Cleanup only — disconnect when component unmounts
  useEffect(() => {
    return () => {
      socket.disconnect()
    }
  }, [socket])

  return socket
}
