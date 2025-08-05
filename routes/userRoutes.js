const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subscriber = require('../models/Subscriber'); // ✅ NEW: استيراد نموذج Subscriber الجديد
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/authMiddleware');
const JWT_SECRET = process.env.JWT_SECRET; // تأكد من أن هذا المتغير محدد في .env


// 1. GET User Profile (Protected Route) - (http://localhost:3000/api/users/profile)
router.get('/profile', auth, async (req, res) => {
    try {
        // req.user.id comes from the auth middleware after token verification
        // ✅ REVERTED: تم إزالة +shippingAddress للعودة إلى السلوك السابق
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ message: 'Failed to retrieve user profile.' });
    }
});


// 2. PUT Update User Profile (Protected Route) - (http://localhost:3000/api/users/profile)
// هذا المسار يظل كما هو في نسختك السابقة التي لم تسبب مشاكل في تسجيل الدخول
router.put('/profile', auth, async (req, res) => {
    const { name, email, password } = req.body; // Can include password for update if desired
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (password) {
            // Hash new password if provided
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await user.save();
        res.json({ message: 'Profile updated successfully!', user: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email } });
    } catch (err) {
        console.error('Error updating user profile:', err);
        if (err.code === 11000) { // Duplicate key error (e.g., email already exists)
            return res.status(400).json({ message: 'Email already registered.' });
        }
        res.status(500).json({ message: 'Failed to update user profile.' });
    }
});

// ✅ NEW: POST endpoint for Newsletter Subscription (http://localhost:3000/api/users/subscribe)
router.post('/subscribe', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required for subscription.' });
    }

    try {
        // 1. Check if email belongs to an existing User
        let user = await User.findOne({ email });
        if (user) {
            if (user.isSubscribedToNewsletter) {
                return res.status(409).json({ message: 'This email is already subscribed.' });
            }
            user.isSubscribedToNewsletter = true; // Assuming User model has this field
            await user.save();
            return res.status(200).json({ message: 'Successfully subscribed to the newsletter!' });
        } else {
            // 2. If not an existing User, try to save as a new Subscriber
            // First, check if this email is already in the Subscribers collection
            let existingSubscriber = await Subscriber.findOne({ email });
            if (existingSubscriber) {
                return res.status(409).json({ message: 'This email is already subscribed.' });
            }

            // Create a new Subscriber entry
            const newSubscriber = new Subscriber({ email });
            await newSubscriber.save();
            return res.status(200).json({ message: 'Thank you for subscribing to our newsletter!' });
        }
    } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        // Handle duplicate key error specifically for Subscriber model if it occurs during save
        if (error.code === 11000) {
            return res.status(409).json({ message: 'This email is already subscribed.' });
        }
        res.status(500).json({ message: 'Failed to subscribe to newsletter due to a server error.' });
    }
});


module.exports = router;