// Negroo up/models/PromoSlide.js
const mongoose = require('mongoose');

const promoSlideSchema = new mongoose.Schema({
    // عنوان الشريحة (مثلاً: "عروض حصرية لك")
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    // وصف موجز للشريحة
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 250
    },
    // رابط الصورة الخلفية للشريحة
    imageUrl: {
        type: String,
        required: true,
    },
    // نص الزر (مثلاً: "اكتشف العروض")
    buttonText: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    // الرابط الذي يؤدي إليه الزر
    buttonLink: {
        type: String,
        required: true,
        trim: true,
    },
    // ترتيب عرض الشريحة (اختياري، يمكن استخدامه لفرز الشرائح)
    order: {
        type: Number,
        default: 0
    },
    // هل الشريحة نشطة للعرض أم لا
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// إضافة فهرس لتحسين الفرز حسب الترتيب أو تاريخ الإنشاء
promoSlideSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('PromoSlide', promoSlideSchema);
