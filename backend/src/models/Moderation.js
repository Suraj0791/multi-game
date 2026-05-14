import { query } from '../config/database.js';

// Create a report against a user
export async function createReport(reporterId, reportedUserId, reason) {
  const result = await query(
    `INSERT INTO reports (reporter_id, reported_user_id, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [reporterId, reportedUserId, reason]
  );
  return result.rows[0];
}

// Check if user already reported this person (prevent spam reports)
export async function findExistingReport(reporterId, reportedUserId) {
  const result = await query(
    `SELECT * FROM reports
     WHERE reporter_id = $1 AND reported_user_id = $2 AND status = 'PENDING'`,
    [reporterId, reportedUserId]
  );
  return result.rows[0];
}

// Block a user
export async function blockUser(blockerId, blockedUserId) {
  const result = await query(
    `INSERT INTO blocked_users (blocker_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING
     RETURNING *`,
    [blockerId, blockedUserId]
  );
  return result.rows[0];
}

// Unblock a user
export async function unblockUser(blockerId, blockedUserId) {
  const result = await query(
    `DELETE FROM blocked_users
     WHERE blocker_id = $1 AND blocked_user_id = $2
     RETURNING *`,
    [blockerId, blockedUserId]
  );
  return result.rows[0];
}

// Get list of users I've blocked
export async function getBlockedUsers(blockerId) {
  const result = await query(
    `SELECT bu.blocked_user_id, u.username, bu.created_at
     FROM blocked_users bu
     JOIN users u ON bu.blocked_user_id = u.id
     WHERE bu.blocker_id = $1
     ORDER BY bu.created_at DESC`,
    [blockerId]
  );
  return result.rows;
}

// Check if user A has blocked user B (used as guard in other features)
export async function isBlocked(blockerId, blockedUserId) {
  const result = await query(
    `SELECT 1 FROM blocked_users
     WHERE blocker_id = $1 AND blocked_user_id = $2`,
    [blockerId, blockedUserId]
  );
  return result.rows.length > 0;
}
