const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    imageUrl: { // صورة رمزية للفئة
        type: String,
        default: 'https://via.placeholder.com/300x180?text=Category+Image' // صورة افتراضية
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // ✅ جديد: حقل لربط الفئة بفئتها الأم (Subcategory)
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId, // يشير إلى معرف فئة أخرى
        ref: 'Category', // يحدد أن هذا الحقل يشير إلى نموذج 'Category' نفسه
        default: null // إذا كانت null، فهذه فئة رئيسية (Top-level category)
    },
    // ✅ NEW: Field to mark if a category is featured on the homepage
    isFeatured: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
