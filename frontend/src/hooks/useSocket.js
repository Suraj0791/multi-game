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

  // Ensure socket is connected (handles React StrictMode's unmount→remount cycle).
  // StrictMode calls cleanup (socket.disconnect()) on first mount, but
  // Socket.IO treats manual disconnects as permanent (no auto-reconnect).
  // Calling socket.connect() here re-establishes the connection after remount.
  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.disconnect()
    }
  }, [socket])

  return socket
}
