const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { adminAuth } = require('../middleware/authMiddleware'); // Only admins can manage coupons

// 1. POST /api/coupons - Create a new coupon (Admin only)
router.post('/', adminAuth, async (req, res) => {
    try {
        const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, expiresAt, isActive } = req.body;

        // Basic validation
        if (!code || !discountType || discountValue === undefined) {
            return res.status(400).json({ message: 'Code, discount type, and discount value are required.' });
        }

        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            minOrderAmount: minOrderAmount || 0,
            maxDiscountAmount: maxDiscountAmount || null,
            usageLimit: usageLimit || 1, // Default to 1 use if not specified
            expiresAt: expiresAt || null,
            isActive: isActive !== undefined ? isActive : true
        });

        const savedCoupon = await newCoupon.save();
        res.status(201).json({ message: 'Coupon created successfully!', coupon: savedCoupon });

    } catch (err) {
        console.error('Error creating coupon:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Coupon code already exists.' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Failed to create coupon due to a server error.' });
    }
});

// 2. GET /api/coupons - Get all coupons (Admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        res.json(coupons);
    } catch (err) {
        console.error('Error fetching coupons:', err);
        res.status(500).json({ message: 'Failed to retrieve coupons due to a server error.' });
    }
});

// 3. GET /api/coupons/:code - Get a single coupon by code (Public or Authenticated)
// This endpoint will be used by frontend to check coupon validity
router.get('/:code', async (req, res) => { // No adminAuth here, anyone can check a coupon code
    try {
        const coupon = await Coupon.findOne({ code: req.params.code.toUpperCase() }); // Ensure case-insensitive check by converting to uppercase

        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found.' });
        }
        if (!coupon.isActive) {
            return res.status(400).json({ message: 'Coupon is inactive.' });
        }
        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            return res.status(400).json({ message: 'Coupon has expired.' });
        }
        if (coupon.usageLimit !== 0 && coupon.timesUsed >= coupon.usageLimit) { // usageLimit 0 means unlimited
            return res.status(400).json({ message: 'Coupon has reached its usage limit.' });
        }

        // Return sensitive info (usageLimit, timesUsed, etc.) only if admin or specifically for validation purposes
        // For public check, return only relevant discount info
        res.json({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minOrderAmount: coupon.minOrderAmount,
            maxDiscountAmount: coupon.maxDiscountAmount,
            message: 'Coupon is valid.'
        });

    } catch (err) {
        console.error('Error fetching coupon by code:', err);
        res.status(500).json({ message: 'Failed to validate coupon due to a server error.' });
    }
});


// 4. PUT /api/coupons/:id - Update a coupon (Admin only)
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, timesUsed, expiresAt, isActive } = req.body;
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, timesUsed, expiresAt, isActive },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Coupon not found.' });
        }
        res.json({ message: 'Coupon updated successfully!', coupon: updatedCoupon });

    } catch (err) {
        console.error('Error updating coupon:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Coupon code already exists.' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Failed to update coupon due to a server error.' });
    }
});

// 5. DELETE /api/coupons/:id - Delete a coupon (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!deletedCoupon) {
            return res.status(404).json({ message: 'Coupon not found.' });
        }
        res.json({ message: 'Coupon deleted successfully!' });
    } catch (err) {
        console.error('Error deleting coupon:', err);
        res.status(500).json({ message: 'Failed to delete coupon due to a server error.' });
    }
});


module.exports = router;