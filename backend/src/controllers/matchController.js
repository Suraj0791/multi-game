import { completeMatch as completeMatchService } from '../services/matchService.js';

// Handle PUT /matches/:id/complete
export async function completeMatch(req, res) {
  try {
    const matchId = req.params.id;
    
    // For Phase 2 (before we add the actual drawing game), 
    // the frontend will just tell us who won in the request body.
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({ error: "winnerId is required" });
    }

    const result = await completeMatchService(matchId, winnerId);

    // 200 OK
    res.status(200).json(result);
  } catch (error) {
    // 404 for not found, 400 for bad logic (like already completed)
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}
