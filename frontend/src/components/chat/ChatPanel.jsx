// ============================================================
// CHAT PANEL — Real-time tournament chat
// ============================================================
//
// This is an EXCEPTION to the "dumb components have no state" rule.
// ChatPanel has local useState for the input text, because the parent
// page doesn't need to know what the user is typing in the chat box.
//
// It also manages its own socket listeners for incoming messages.
// This makes it self-contained — you drop it into any page and it works.
//
// SOCKET EVENTS (matched to backend):
//   EMIT: chat:join  → { tournamentId, userId }
//   EMIT: chat:send  → { tournamentId, userId, text }
//   ON:   chat:message → { id, userId, username, message, createdAt }
//   ON:   chat:user_joined → { username, message }
//   ON:   chat:error  → { message }

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";
import { getChatHistory } from "@/api/tournamentApi";

export default function ChatPanel({ socket, tournamentId, userId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState(null);

  // Ref to auto-scroll to bottom when new messages arrive
  const messagesEndRef = useRef(null);

  // Auto-scroll to newest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ============================================================
  // API: Load existing chat history
  // ============================================================
  useEffect(() => {
    if (!tournamentId) return;

    const loadHistory = async () => {
      try {
        const history = await getChatHistory(tournamentId);
        setMessages(history || []);
      } catch (err) {
        console.error("❌ [ChatPanel] Failed to load chat history:", err);
      }
    };

    loadHistory();
  }, [tournamentId]);

  // ============================================================
  // SOCKET: Join chat room + listen for messages
  // ============================================================
  useEffect(() => {
    if (!socket || !tournamentId || !userId) return;

    // Listen for new messages
    const onMessage = (data) => {
      console.log("💬 [ChatPanel] Message received:", data);
      setMessages((prev) => {
        // Prevent duplicate messages if they have the same ID
        if (data.id && prev.some((m) => m.id === data.id)) {
          return prev;
        }
        return [...prev, data];
      });
    };

    // Listen for user join notifications
    const onUserJoined = (data) => {
      console.log("💬 [ChatPanel] User joined notification:", data);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          username: "System",
          message: data.message,
          isSystem: true,
        },
      ]);
    };

    // Listen for errors (rate limiting, empty message, etc.)
    const onError = (data) => {
      console.error("❌ [ChatPanel] Chat error received:", data.message);
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:user_joined", onUserJoined);
    socket.on("chat:error", onError);

    const joinRoom = () => {
      socket.emit("chat:join", { tournamentId, userId });
    };

    // Join immediately if already connected
    if (socket.connected) {
      joinRoom();
    }

    // Join on every connection/reconnection
    socket.on("connect", joinRoom);

    return () => {
      // Leave the chat room on unmount so we don't receive messages for this room anymore
      socket.emit("chat:leave", { tournamentId, userId });
      socket.off("connect", joinRoom);
      socket.off("chat:message", onMessage);
      socket.off("chat:user_joined", onUserJoined);
      socket.off("chat:error", onError);
    };
  }, [socket, tournamentId, userId]);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ============================================================
  // SEND MESSAGE
  // ============================================================
  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit("chat:send", {
      tournamentId,
      userId,
      text: inputText.trim(),
    });

    setInputText("");
  };

  return (
    <Card className="flex flex-col h-[400px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Chat
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-3 pt-0">
        {/* Messages area — scrollable */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No messages yet. Say hi!
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-sm ${
                msg.isSystem
                  ? "text-center text-xs text-muted-foreground italic"
                  : ""
              }`}
            >
              {!msg.isSystem && (
                <>
                  <span
                    className={`font-medium ${
                      Number(msg.userId) === Number(userId)
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {msg.username}
                  </span>
                  <span className="text-muted-foreground">: </span>
                </>
              )}
              <span className="text-foreground">{msg.message}</span>
            </div>
          ))}
          {/* Invisible div at the bottom for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && <p className="text-xs text-danger mb-2">{error}</p>}

        {/* Input + send button */}
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-8 text-sm"
          />
          <Button type="submit" size="sm" className="h-8 px-3">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
