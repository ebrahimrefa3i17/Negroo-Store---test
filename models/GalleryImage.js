// Negroo up/models/GalleryImage.js
const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
    // رابط الصورة
    imageUrl: {
        type: String,
        required: true,
    },
    // وصف اختياري للصورة
    description: {
        type: String,
        trim: true,
        maxlength: 250,
        default: ''
    },
    // ترتيب عرض الصورة (اختياري)
    order: {
        type: Number,
        default: 0
    },
    // هل الصورة نشطة للعرض أم لا
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
galleryImageSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
