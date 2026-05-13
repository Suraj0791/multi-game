import { saveMessage, getMessageHistory } from '../models/ChatMessage.js';

// ============================================================
// FUNCTION 1: sendMessage
// Called by: Socket event handler (chat:send)
// Flow: Guard → Persist → Return saved message
// ============================================================
export async function sendMessage(tournamentId, userId, text) {

  // GUARD — empty or whitespace-only message?
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Message can't be empty");

  // GUARD — too long? (prevents abuse)
  if (trimmed.length > 500) throw new Error("Message too long (max 500 characters)");

  // PERSIST — save to database
  const message = await saveMessage(tournamentId, userId, trimmed);

  // RETURN — the saved message row
  return message;
}

// ============================================================
// FUNCTION 2: getChatHistory
// Called by: HTTP controller (GET /tournaments/:id/chat)
// Flow: Query → Format → Return
// ============================================================
export async function getChatHistory(tournamentId) {

  // QUERY — get last 50 messages with usernames (model handles the JOIN)
  const messages = await getMessageHistory(tournamentId, 50);

  // FORMAT — snake_case from DB → camelCase for API response
  return messages.map(m => ({
    id: m.id,
    userId: m.user_id,
    username: m.username,
    message: m.message,
    createdAt: m.created_at
  }));
}
