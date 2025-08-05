const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed_amount'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minOrderAmount: { // Minimum amount required for the coupon to be applicable
        type: Number,
        default: 0,
        min: 0
    },
    maxDiscountAmount: { // Optional: maximum discount amount for percentage coupons
        type: Number,
        min: 0,
        default: null // Can be null if no max limit
    },
    usageLimit: { // Total number of times this coupon can be used
        type: Number,
        default: 1, // Default to single-use if not specified
        min: 0
    },
    timesUsed: { // Counter for how many times the coupon has been used
        type: Number,
        default: 0,
        min: 0
    },
    expiresAt: {
        type: Date,
        default: null // Coupon does not expire if null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to ensure discountValue is valid for percentage
couponSchema.pre('save', function(next) {
    if (this.discountType === 'percentage' && (this.discountValue < 0 || this.discountValue > 100)) {
        return next(new Error('Percentage discount value must be between 0 and 100.'));
    }
    next();
});


const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;