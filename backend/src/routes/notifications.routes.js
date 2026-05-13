import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getMyNotifications, getUnreadCount, markRead, markAllRead } from '../controllers/notificationController.js';

const router = Router();

// All notification routes require auth — you can only see YOUR notifications
router.get('/', authenticate, getMyNotifications);        // List my notifications
router.get('/unread', authenticate, getUnreadCount);       // Unread count (badge number)
router.put('/read-all', authenticate, markAllRead);        // Mark all as read
router.put('/:id/read', authenticate, markRead);           // Mark one as read

// NOTE: /read-all MUST come before /:id/read
// Otherwise Express thinks "read-all" is an :id parameter

export default router;
