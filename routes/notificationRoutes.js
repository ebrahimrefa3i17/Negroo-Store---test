const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth, adminAuth } = require('../middleware/authMiddleware');

// --- Notification API Endpoints ---

// 1. GET user's notifications (http://localhost:3000/api/notifications) - Protected
router.get('/', auth, async (req, res) => {
    const userId = req.user.id;
    const { read } = req.query;

    let query = { userId };
    if (read !== undefined) {
        query.read = read === 'true';
    }

    // ✅ أضف هذه السجلات هنا
    console.log('GET /api/notifications: Request received.');
    console.log('GET /api/notifications: User ID from token:', userId);
    console.log('GET /api/notifications: Constructed query:', query);

    try {
        const notifications = await Notification.find(query)
                                                .sort({ createdAt: -1 })
                                                .select('-__v');

        // ✅ أضف هذا السجل هنا
        console.log('GET /api/notifications: Notifications found in DB:', notifications.length);
        if (notifications.length > 0) {
            console.log('GET /api/notifications: First notification:', notifications[0]);
        }

        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

// 2. PUT mark notification as read (http://localhost:3000/api/notifications/:id/read) - Protected
router.put('/:id/read', auth, async (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.id;

    console.log('PUT /api/notifications/:id/read: Request received for notification ID:', notificationId); // ✅ سجل
    console.log('PUT /api/notifications/:id/read: User ID from token:', userId); // ✅ سجل

    try {
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            console.warn('PUT /api/notifications/:id/read: Notification not found in DB.'); // ✅ سجل تحذير
            return res.status(404).json({ message: 'Notification not found.' });
        }

        if (notification.userId.toString() !== userId && !req.user.isAdmin) {
            console.warn('PUT /api/notifications/:id/read: Access denied for user ID:', userId, 'to notification owned by:', notification.userId); // ✅ سجل تحذير
            return res.status(403).json({ message: 'Access denied. You can only mark your own notifications as read.' });
        }

        notification.read = true;
        await notification.save();
        console.log('PUT /api/notifications/:id/read: Notification marked as read successfully.'); // ✅ سجل
        res.json({ message: 'Notification marked as read.', notification });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Notification ID format.' });
        }
        res.status(500).json({ message: 'Server error marking notification as read.' });
    }
});

// 3. DELETE a notification (http://localhost:3000/api/notifications/:id) - Protected
router.delete('/:id', auth, async (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.id;

    console.log('DELETE /api/notifications/:id: Request received for notification ID:', notificationId); // ✅ سجل
    console.log('DELETE /api/notifications/:id: User ID from token:', userId); // ✅ سجل

    try {
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            console.warn('DELETE /api/notifications/:id: Notification not found in DB.'); // ✅ سجل تحذير
            return res.status(404).json({ message: 'Notification not found.' });
        }

        if (notification.userId.toString() !== userId && !req.user.isAdmin) {
            console.warn('DELETE /api/notifications/:id: Access denied for user ID:', userId, 'to notification owned by:', notification.userId); // ✅ سجل تحذير
            return res.status(403).json({ message: 'Access denied. You can only delete your own notifications.' });
        }

        await Notification.deleteOne({ _id: notificationId });
        console.log('DELETE /api/notifications/:id: Notification deleted successfully.'); // ✅ سجل
        res.json({ message: 'Notification deleted successfully.' });
    } catch (err) {
        console.error('Error deleting notification:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Notification ID format.' });
        }
        res.status(500).json({ message: 'Server error deleting notification.' });
    }
});

// 4. POST create a new notification (http://localhost:3000/api/notifications) - Admin only (أو من عمليات النظام)
router.post('/', adminAuth, async (req, res) => {
    const { userId, message, type, link } = req.body;

    // ✅ أضف هذا السجل هنا
    console.log('POST /api/notifications: Request received to create notification.');
    console.log('POST /api/notifications: Data:', { userId, message, type, link });

    if (!userId || !message) {
        return res.status(400).json({ message: 'User ID and message are required for notification.' });
    }

    const newNotification = new Notification({
        userId,
        message,
        type,
        link
    });

    try {
        const savedNotification = await newNotification.save();
        console.log('POST /api/notifications: Notification created successfully in DB.'); // ✅ سجل
        res.status(201).json({ message: 'Notification created successfully!', notification: savedNotification });
    } catch (err) {
        console.error('Error creating notification:', err);
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;