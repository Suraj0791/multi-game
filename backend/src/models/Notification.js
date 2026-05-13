import { query } from '../config/database.js';

// Create a new notification for a specific user
export async function createNotification(userId, type, title, message, relatedId = null) {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, message, related_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, message, relatedId]
  );
  return result.rows[0];
}

// Get a user's notifications (newest first, last 50)
export async function getUserNotifications(userId, limit = 50) {
  const result = await query(
    `SELECT id, type, title, message, is_read, related_id, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// Count unread notifications — used for the badge number ("3 new")
export async function getUnreadCount(userId) {
  const result = await query(
    `SELECT COUNT(*) AS count FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(result.rows[0].count);
}

// Mark ONE notification as read
// WHERE includes user_id so users can only mark THEIR OWN notifications
export async function markAsRead(notificationId, userId) {
  const result = await query(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0];
}

// Mark ALL unread notifications as read for a user
export async function markAllAsRead(userId) {
  const result = await query(
    `UPDATE notifications SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return result.rowCount; // how many were marked
}
