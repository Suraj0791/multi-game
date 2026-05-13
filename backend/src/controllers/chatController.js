import { getChatHistory } from '../services/chatService.js';

// GET /tournaments/:id/chat
// Load message history — frontend calls this when user opens chat
// Returns last 50 messages with usernames
export async function getHistory(req, res) {
  try {
    const tournamentId = req.params.id;
    const messages = await getChatHistory(tournamentId);
    res.status(200).json(messages);
  } catch (error) {
    console.error('Chat History Error:', error.message);
    res.status(400).json({ error: error.message });
  }
}
