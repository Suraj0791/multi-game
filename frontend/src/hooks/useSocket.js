// ============================================================
// useSocket — Custom hook for WebSocket connection
// ============================================================
//
// Returns the socket INSTANCE directly (not a ref).
// Uses useState so React knows when the socket is ready.
//
// WHY useState instead of useRef?
//   React 19 forbids accessing ref.current during render.
//   Passing socketRef.current as a prop = accessing during render = error.
//   useState returns a value that's safe to pass as a prop.

import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function useSocket() {
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  // Returns the socket instance directly — safe to pass as a prop
  return socket
}
