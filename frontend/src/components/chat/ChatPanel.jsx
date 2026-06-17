import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";
import { getChatHistory } from "@/api/tournamentApi";

export default function ChatPanel({ socket, tournamentId, userId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    if (!tournamentId) return;

    const loadHistory = async () => {
      try {
        const history = await getChatHistory(tournamentId);
        setMessages(history || []);
      } catch (err) {
        console.error("[ChatPanel] Failed to load chat history:", err);
      }
    };

    loadHistory();
  }, [tournamentId]);

  useEffect(() => {
    if (!socket || !tournamentId || !userId) return;

    const onMessage = (data) => {
      setMessages((prev) => {
        if (data.id && prev.some((message) => message.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const onUserJoined = (data) => {
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

    const onError = (data) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:user_joined", onUserJoined);
    socket.on("chat:error", onError);

    const joinRoom = () => {
      socket.emit("chat:join", { tournamentId, userId });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    return () => {
      socket.emit("chat:leave", { tournamentId, userId });
      socket.off("connect", joinRoom);
      socket.off("chat:message", onMessage);
      socket.off("chat:user_joined", onUserJoined);
      socket.off("chat:error", onError);
    };
  }, [socket, tournamentId, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (event) => {
    event.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit("chat:send", {
      tournamentId,
      userId,
      text: inputText.trim(),
    });

    setInputText("");
  };

  return (
    <section className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-border/70 bg-surface/35">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Lobby Chat</h2>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400" title="Connected" />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">
                    {msg.message}
                  </span>
                </div>
              );
            }

            const isMe = Number(msg.userId) === Number(userId);
            const formattedTime = msg.createdAt
              ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                    {!isMe && (
                      <span className="font-medium text-neutral-300 flex items-center gap-1">
                        {msg.username || "Player"}
                        {msg.isGuest && (
                          <span className="rounded-sm bg-neutral-800 px-1 text-[9px] uppercase tracking-wide text-neutral-400">Guest</span>
                        )}
                      </span>
                    )}
                    {isMe && <span className="font-medium text-neutral-300">You</span>}
                    {formattedTime && <span>{formattedTime}</span>}
                  </div>
                  <div
                    className={
                      isMe
                        ? "rounded-2xl rounded-tr-md border border-amber-500/25 bg-amber-500/15 px-3 py-2 text-sm leading-5 text-amber-50"
                        : "rounded-2xl rounded-tl-md border border-border/70 bg-background/75 px-3 py-2 text-sm leading-5 text-neutral-200"
                    }
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border/60 bg-background/55 p-3">
        <Input
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Message the lobby"
          className="h-9 flex-1 border-border/80 bg-surface/60 text-sm"
        />
        <Button type="submit" size="icon" className="h-9 w-9" disabled={!inputText.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
