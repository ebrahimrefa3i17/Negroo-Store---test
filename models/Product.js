const mongoose = require('mongoose');

// Define the schema for the Product
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0 // Price cannot be negative
    },
    imageUrl: {
        type: String,
        required: true
    },
    imageUrls: {
        type: [String],
        default: []
    },
    // ✅ MODIFIED: Changed category to reference Category ObjectId
    category: {
        type: mongoose.Schema.Types.ObjectId, // Now stores ObjectId
        ref: 'Category', // References the 'Category' model
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    // ✅ NEW: Minimum stock threshold for alerts
    minStockThreshold: {
        type: Number,
        default: 10, // Default to 10 units for low stock alert
        min: 0
    },
    // ✅ NEW: Timestamp of the last low stock notification sent for this product
    lastLowStockNotification: {
        type: Date,
        default: null
    },
    specifications: {
        type: String,
        trim: true,
        default: 'No specifications available.'
    },
    shippingAndReturns: {
        type: String,
        trim: true,
        default: 'Standard shipping within 3-5 business days. Easy returns within 30 days of purchase.'
    },
    // ✅ NEW: Product Variants Schema
    variants: [
        {
            name: { // e.g., "Color", "Size"
                type: String,
                required: true,
                trim: true
            },
            options: [
                {
                    value: { // e.g., "Red", "Blue", "S", "M"
                        type: String,
                        required: true,
                        trim: true
                    },
                    priceAdjustment: { // Optional: how much to add/subtract from base price
                        type: Number,
                        default: 0
                    },
                    stock: { // Stock for this specific variant option
                        type: Number,
                        required: true,
                        min: 0,
                        default: 0
                    },
                    imageUrl: { // Optional: image for this specific variant option
                        type: String,
                        default: ''
                    }
                }
            ]
        }
    ],
    // ✅ NEW: Fields for Flash Sale / Deals
    isOnFlashSale: {
        type: Boolean,
        default: false // Set to true if product is part of a flash sale
    },
    flashSalePrice: {
        type: Number,
        min: 0,
        default: null // The discounted price for the flash sale, null if no sale
    },
    flashSaleEndDate: {
        type: Date,
        default: null // Date when the flash sale ends, null if no specific end date or not a flash sale
    },
    // ✅ NEW: imageEmbedding field for visual search features
    imageEmbedding: {
        type: [Number], // Array of numbers (the feature vector)
        default: [],    // Default to an empty array
        // يمكنك إضافة index: true هنا إذا كنت تخطط لاستخدام MongoDB Atlas Vector Search،
        // أو لإدارة فهرس مخصص خارجياً (مثال: مع Faiss/Annoy)
        // index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create the Product model from the schema
const Product = mongoose.model('Product', productSchema);

module.exports = Product;