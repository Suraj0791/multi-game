import { getNotifications, getUnread, readOne, readAll } from '../services/notificationService.js';

// GET /notifications — list my notifications
export async function getMyNotifications(req, res) {
  try {
    const userId = req.user.userId;
    const notifications = await getNotifications(userId);
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Notifications Error:', error.message);
    res.status(400).json({ error: error.message });
  }
}

// GET /notifications/unread — get unread count (for badge)
export async function getUnreadCount(req, res) {
  try {
    const userId = req.user.userId;
    const result = await getUnread(userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// PUT /notifications/:id/read — mark one as read
export async function markRead(req, res) {
  try {
    const notificationId = req.params.id;
    const userId = req.user.userId;
    const result = await readOne(notificationId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// PUT /notifications/read-all — mark all as read
export async function markAllRead(req, res) {
  try {
    const userId = req.user.userId;
    const result = await readAll(userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
