// ============================================================
// useSocket — Custom hook for WebSocket connection
// ============================================================
//
// This hook does THREE things:
//   1. CONNECTS to the socket server when component mounts
//   2. DISCONNECTS when component unmounts (cleanup)
//   3. Returns the socket instance so the component can emit/listen
//
// WHY a custom hook?
//   Same as useTournaments wraps useQuery — we wrap socket.io setup
//   so every component that needs WebSocket just calls useSocket()
//   instead of managing io() connection, cleanup, etc. manually.
//
// WHY useEffect is correct here (but wrong for data fetching):
//   useEffect is for SIDE EFFECTS that need cleanup.
//   WebSocket is a side effect — it opens a persistent connection
//   that MUST be closed when the component unmounts.
//   useQuery handles its own lifecycle. WebSocket doesn't.

import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function useSocket() {
  // useRef stores a value that PERSISTS across re-renders
  // without triggering a re-render when it changes.
  //
  // WHY useRef and not useState?
  //   useState: when value changes → component re-renders
  //   useRef: when value changes → NOTHING happens
  //
  //   We don't want a re-render every time the socket object updates.
  //   The socket is infrastructure, not display data.
  const socketRef = useRef(null)

  useEffect(() => {
    // CREATE the connection (runs once on mount)
    socketRef.current = io(SOCKET_URL, {
      // Don't auto-connect — we control when to connect
      autoConnect: true,
      // Reconnect if connection drops
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    // CLEANUP — runs when component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])  // Empty array = run once on mount, cleanup on unmount

  // Return the socket so components can use it
  return socketRef
}
