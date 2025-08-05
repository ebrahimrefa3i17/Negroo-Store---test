const express = require('express');
const router = express.Router();
const User = require('../models/User'); // سنحتاج لنموذج المستخدم
const Product = require('../models/Product'); // سنحتاج لنموذج المنتج
const { auth } = require('../middleware/authMiddleware'); // لتحقق المصادقة

// 1. GET user's wishlist (http://localhost:3000/api/wishlist) - Requires authentication
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('wishlist'); // جلب قائمة الرغبات وتعبئة المنتجات
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user.wishlist);
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).json({ message: 'Server error fetching wishlist.' });
    }
});

// 2. POST add item to wishlist (http://localhost:3000/api/wishlist) - Requires authentication
router.post('/', auth, async (req, res) => {
    const { productId } = req.body;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Check if product already in wishlist
        if (user.wishlist.includes(productId)) {
            return res.status(400).json({ message: 'Product already in wishlist.' });
        }

        user.wishlist.push(productId);
        await user.save();
        res.status(200).json({ message: 'Product added to wishlist!', wishlist: user.wishlist });
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        res.status(500).json({ message: 'Server error adding to wishlist.' });
    }
});

// 3. DELETE remove item from wishlist (http://localhost:3000/api/wishlist/:productId) - Requires authentication
router.delete('/:productId', auth, async (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Remove product from wishlist array
        user.wishlist = user.wishlist.filter(item => item.toString() !== productId);
        await user.save();
        res.status(200).json({ message: 'Product removed from wishlist!', wishlist: user.wishlist });
    } catch (err) {
        console.error('Error removing from wishlist:', err);
        res.status(500).json({ message: 'Server error removing from wishlist.' });
    }
});

module.exports = router;