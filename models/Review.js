const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // يشير إلى نموذج المنتج
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // يشير إلى نموذج المستخدم
        required: true
    },
    userName: { // لحفظ اسم المستخدم مباشرة لتجنب استعلام إضافي
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 500 // حد أقصى لطول التعليق
    },
    isApproved: { // ✅ جديد: حقل لحالة الموافقة
        type: Boolean,
        default: false // افتراضيًا، المراجعات معلقة للموافقة
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;