const mongoose = require('mongoose');

const productCollectionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true // Ensure collection names are unique
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    imageUrl: {
        type: String,
        default: '/images/placeholder-collection.jpg' // Default image for collections
    },
    products: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product', // Reference to the Product model
            required: true
        }
    ],
    // Optional: Fields to suggest this collection on specific product pages
    // You can use product IDs or category IDs or custom tags
    suggestedOnProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    suggestedOnCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    // Or a more flexible tag-based system:
    tags: [String], // e.g., ['kitchen', 'bedroom', 'living-room']

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the 'updatedAt' field on save
productCollectionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const ProductCollection = mongoose.model('ProductCollection', productCollectionSchema);

module.exports = ProductCollection;