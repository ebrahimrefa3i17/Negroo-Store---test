const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { adminAuth } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables! Auth middleware will not function.");
    process.exit(1);
}

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        user = new User({ name, email, password });
        await user.save();

        // ✅ تأكد من وجود خاصية 'name' هنا في حمولة التوكن (payload)
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin, name: user.name }, JWT_SECRET, { expiresIn: '8h' });

        res.status(201).json({
            message: 'User registered successfully!',
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });

    } catch (error) {
        console.error('Error during user registration:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        } else if (error.code === 11000) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }
        res.status(500).json({ message: 'Registration failed due to a server error. Please try again later.' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials. Please check your email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials. Please check your email or password.' });
        }

        console.log('User found for login:', user.email);
        console.log('isAdmin status from DB (before token creation):', user.isAdmin);

        // ✅ تأكد من وجود خاصية 'name' هنا في حمولة التوكن (payload)
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin, name: user.name }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'Logged in successfully!',
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });

    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ message: 'Login failed due to a server error. Please try again later.' });
    }
});

router.get('/check-admin-status', adminAuth, (req, res) => {
    res.status(200).json({ message: 'Admin access granted.', isAdmin: true });
});

module.exports = router;