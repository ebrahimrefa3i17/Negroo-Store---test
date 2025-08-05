// models/Cart.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true }, // Denormalized product name
    price: { type: Number, required: true }, // Denormalized product price
    imageUrl: { type: String }, // Denormalized product image
    quantity: { type: Number, required: true, min: 1 },
    selectedVariants: [
        {
            name: { type: String, required: true },
            value: { type: String, required: true }
        }
    ],
    variantImageUrl: { type: String }, // Store the variant-specific image
    variantPriceAdjustment: { type: Number, default: 0 }, // Store the price adjustment for variant
});

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Optional to allow guests
        // Removed unique: false from here, as uniqueness will be handled by the index below
    },
    guestId: {
        type: String,
        required: false,
        unique: true,    // guestId must be unique
        sparse: true     // Allows multiple documents where guestId is null/undefined
    },
    items: [cartItemSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Add a unique and sparse index for userId
// This allows multiple documents where userId is null, but enforces uniqueness when userId is present.
cartSchema.index({ userId: 1 }, { unique: true, sparse: true });

// Ensure guestId index is also defined correctly (it was already there, just confirming)
// cartSchema.index({ guestId: 1 }, { unique: true, sparse: true }); // This line was already present in your file, no change needed.

// تأكد من أن السلة لا يمكن أن تحتوي على userId و guestId في نفس الوقت
cartSchema.pre('save', function(next) {
    if (this.userId && this.guestId) {
        const error = new Error('A cart cannot have both a userId and a guestId.');
        next(error);
    }
    // إذا لم يكن هناك userId أو guestId، هذا يعني أن هناك مشكلة في البيانات
    if (!this.userId && !this.guestId) {
        const error = new Error('Cart must be associated with either a user or a guest.');
        next(error);
    }
    next();
});

module.exports = mongoose.model('Cart', cartSchema);
