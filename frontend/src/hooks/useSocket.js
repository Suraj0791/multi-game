// ============================================================
// useSocket — Custom hook for WebSocket connection
// ============================================================
// Creates socket via lazy useState initializer (runs once).
// Disconnects on unmount via useEffect cleanup.

import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Module-level global socket singleton
let globalSocket = null;

export default function useSocket() {
  const [socket] = useState(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
    return globalSocket;
  });

  // Ensure socket is connected (handles React StrictMode's unmount→remount cycle).
  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }
  }, [socket])

  return socket
}
