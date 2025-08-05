const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const { auth } = require('../middleware/authMiddleware');

// 1. GET reviews for a specific product (http://localhost:3000/api/reviews/:productId)
// This route now fetches ALL reviews for a product (approved or not), used by admin.
router.get('/:productId', async (req, res) => {
    try {
        const reviews = await Review.find({ productId: req.params.productId })
                                    .sort({ createdAt: -1 }); // الأحدث أولاً
        res.json(reviews);
    } catch (err) {
        console.error('Error fetching reviews for product:', err); // تسجيل الخطأ كاملا للمطورين
        // ✅ رسائل خطأ أكثر تحديدا
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format for fetching reviews.' });
        }
        res.status(500).json({ message: 'Failed to retrieve reviews due to a server error.' });
    }
});

// ✅ NEW: GET product reviews for public display (only approved reviews)
router.get('/product/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        // Fetch only approved reviews for public display
        const reviews = await Review.find({ productId: productId, isApproved: true })
                                    .populate('userId', 'name') // Populate user name for display
                                    .sort({ createdAt: -1 }); // Newest first

        let totalRating = 0;
        reviews.forEach(review => {
            totalRating += review.rating;
        });
        const averageRating = reviews.length > 0 ? (totalRating / reviews.length) : 0;

        res.json({
            reviews: reviews,
            averageRating: averageRating,
            totalReviews: reviews.length
        });
    } catch (err) {
        console.error('Error fetching public reviews for product:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve product reviews.' });
    }
});

// ✅ NEW: GET approved reviews for testimonials (http://localhost:3000/api/reviews/approved)
router.get('/approved', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 3; // Default to 3 testimonials
        const reviews = await Review.find({ isApproved: true })
                                    .populate('userId', 'name') // Populate user name
                                    .populate('productId', 'name') // Populate product name (optional)
                                    .sort({ createdAt: -1 }) // Newest first
                                    .limit(limit);
        res.json(reviews);
    } catch (err) {
        console.error('Error fetching approved reviews for testimonials:', err);
        res.status(500).json({ message: 'Failed to retrieve testimonials due to a server error.' });
    }
});


// 2. POST a new review for a product (http://localhost:3000/api/reviews) - Requires authentication
router.post('/', auth, async (req, res) => {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;
    // ✅ تأكد أنك تستخدم req.user.name القادم من التوكن
    const userName = req.user.name;

    // ✅ أضف هذا السجل هنا
    console.log('Review POST API: received userName from token:', userName);
    console.log('Review POST API: received userId from token:', userId);


    const productExists = await Product.findById(productId);
    if (!productExists) {
        return res.status(404).json({ message: 'Product not found.' });
    }

    if (!productId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Product ID and a valid rating (1-5) are required.' });
    }
    if (comment && comment.length > 500) {
        return res.status(400).json({ message: 'Comment cannot exceed 500 characters.' });
    }

    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
        return res.status(400).json({ message: 'You have already reviewed this product.' });
    }

    const newReview = new Review({
        productId,
        userId,
        userName, // هذا الحقل يتسبب في المشكلة
        rating,
        comment
    });

    try {
        const savedReview = await newReview.save();
        res.status(201).json({ message: 'Review added successfully!', review: savedReview });
    } catch (err) {
        console.error('Error adding review:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        } else if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID or User ID format.' });
        }
        res.status(500).json({ message: 'Failed to submit review due to a server error.' });
    }
});

module.exports = router;