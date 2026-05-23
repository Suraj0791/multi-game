import { createNotification, getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../models/Notification.js';

// We need access to `io` (the socket server) to push live notifications.
// This gets set once when the server starts — see server.js
let io = null;

export function setSocketIO(socketIO) {
  io = socketIO;
}

// ============================================================
// THE KEY FUNCTION: notify()
// Called by OTHER services when something happens.
// Saves to DB (so offline users see it later) + pushes via WebSocket (if online)
// ============================================================
export async function notify(userId, type, title, message, relatedId = null) {
  // PERSIST — always save to DB first
  const notification = await createNotification(userId, type, title, message, relatedId);

  // PUSH — if socket server is available AND user is online, send instantly
  if (io) {
    io.to(`user_${userId}`).emit("notification:new", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: false,
      relatedId: notification.related_id,
      createdAt: notification.created_at
    });
  }

  return notification;
}

// ============================================================
// HTTP helpers — called by the notification controller
// ============================================================

export async function getNotifications(userId) {
  const notifications = await getUserNotifications(userId, 50);

  return notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.is_read,
    relatedId: n.related_id,
    createdAt: n.created_at
  }));
}

export async function getUnread(userId) {
  const count = await getUnreadCount(userId);
  return { unreadCount: count };
}

export async function readOne(notificationId, userId) {
  const updated = await markAsRead(notificationId, userId);
  if (!updated) throw new Error('Notification not found');
  return { success: true };
}

export async function readAll(userId) {
  const count = await markAllAsRead(userId);
  return { markedRead: count };
}

// Helper to expose the socket IO instance globally for other services
export function getSocketIO() {
  return io;
}
