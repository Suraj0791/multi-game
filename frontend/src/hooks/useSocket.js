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
        auth: {
          token: localStorage.getItem('token'),
        },
      });

      // Re-attach token on reconnect (in case user logged in after first connect)
      globalSocket.on('connect', () => {
        const currentToken = localStorage.getItem('token');
        if (currentToken && globalSocket.auth) {
          globalSocket.auth.token = currentToken;
        }
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
