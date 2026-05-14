import { reportUser, block, unblock, getBlocked } from '../services/moderationService.js';

// POST /users/:id/report
export async function report(req, res, next) {
  try {
    const reporterId = req.user.userId;
    const reportedUserId = req.params.id;
    const { reason } = req.body;

    const result = await reportUser(reporterId, reportedUserId, reason);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);  // goes to centralized error handler
  }
}

// POST /users/:id/block
export async function blockUserHandler(req, res, next) {
  try {
    const blockerId = req.user.userId;
    const blockedUserId = req.params.id;

    const result = await block(blockerId, blockedUserId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// DELETE /users/:id/block
export async function unblockUserHandler(req, res, next) {
  try {
    const blockerId = req.user.userId;
    const blockedUserId = req.params.id;

    const result = await unblock(blockerId, blockedUserId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// GET /users/blocked
export async function getBlockedList(req, res, next) {
  try {
    const userId = req.user.userId;
    const blocked = await getBlocked(userId);
    res.status(200).json({ success: true, data: blocked });
  } catch (error) {
    next(error);
  }
}
