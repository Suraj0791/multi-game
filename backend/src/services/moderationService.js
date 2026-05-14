import { createReport, findExistingReport, blockUser, unblockUser, getBlockedUsers } from '../models/Moderation.js';
import { findById } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// ============================================================
// REPORTS
// ============================================================

export async function reportUser(reporterId, reportedUserId, reason) {
  // GUARD — can't report yourself
  if (reporterId === parseInt(reportedUserId)) {
    throw new AppError("You can't report yourself", 400);
  }

  // GUARD — does the reported user exist?
  const reported = await findById(reportedUserId);
  if (!reported) throw new AppError('User not found', 404);

  // GUARD — already reported this person?
  const existing = await findExistingReport(reporterId, reportedUserId);
  if (existing) throw new AppError('You already have a pending report against this user', 409);

  // PERSIST
  const report = await createReport(reporterId, reportedUserId, reason);

  return {
    id: report.id,
    reportedUser: reported.username,
    reason: report.reason,
    status: report.status
  };
}

// ============================================================
// BLOCKING
// ============================================================

export async function block(blockerId, blockedUserId) {
  // GUARD — can't block yourself
  if (blockerId === parseInt(blockedUserId)) {
    throw new AppError("You can't block yourself", 400);
  }

  // GUARD — does the user exist?
  const blocked = await findById(blockedUserId);
  if (!blocked) throw new AppError('User not found', 404);

  // PERSIST — ON CONFLICT DO NOTHING handles duplicate blocks silently
  await blockUser(blockerId, blockedUserId);

  return { message: `Blocked ${blocked.username}` };
}

export async function unblock(blockerId, blockedUserId) {
  const result = await unblockUser(blockerId, blockedUserId);
  if (!result) throw new AppError('User was not blocked', 404);

  return { message: 'User unblocked' };
}

export async function getBlocked(userId) {
  const blocked = await getBlockedUsers(userId);

  return blocked.map(b => ({
    userId: b.blocked_user_id,
    username: b.username,
    blockedAt: b.created_at
  }));
}
