// ============================================================
// useSocket — Custom hook for WebSocket connection
// ============================================================
// Creates socket via lazy useState initializer (runs once).
// Disconnects on unmount via useEffect cleanup.

import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import useAuthStore from '@/stores/authStore'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Module-level global socket singleton
let globalSocket = null;

export default function useSocket() {
  const token = useAuthStore((state) => state.token);

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

      // Socket event tracing for E2E tests — logs to window.__socketEvents
      try {
        function safeCloneTrace(obj) {
          try { return JSON.parse(JSON.stringify(obj)); }
          catch { return String(obj); }
        }
        if (typeof window !== 'undefined' && window.__socketTracerInstalled) {
          globalSocket.onAny((event, ...args) => {
            if (!window.__socketEvents) window.__socketEvents = [];
            window.__socketEvents.push({
              timestamp: Date.now(),
              direction: 'RECEIVE',
              event: event,
              payload: safeCloneTrace(args)
            });
            if (window.__socketEvents.length > (window.__socketEventLimit || 200)) window.__socketEvents.shift();
          });
          var origEmit = globalSocket.emit;
          globalSocket.emit = function(ev) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (!window.__socketEvents) window.__socketEvents = [];
            window.__socketEvents.push({
              timestamp: Date.now(),
              direction: 'EMIT',
              event: ev,
              payload: safeCloneTrace(args)
            });
            if (window.__socketEvents.length > (window.__socketEventLimit || 200)) window.__socketEvents.shift();
            return origEmit.apply(this, arguments);
          };
        }
      } catch(e) {
        // tracer logging is best-effort
      }
    }
    return globalSocket;
  });

  // Re-authenticate when token changes
  useEffect(() => {
    if (globalSocket && token && globalSocket.auth.token !== token) {
      globalSocket.auth.token = token;
      globalSocket.disconnect();
      globalSocket.connect();
    }
  }, [token]);

  // Ensure socket is connected (handles React StrictMode's unmount→remount cycle).
  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }
  }, [socket])

  return socket
}
