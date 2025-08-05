const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: { // Store product name at time of order
        type: String,
        required: true
    },
    price: { // Store product price at time of order
        type: Number,
        required: true
    },
    imageUrl: { // Store image URL at time of order
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    // ✅ NEW: Fields to store variant information directly in the order item
    selectedVariants: [ // Array of selected variants for this item
        {
            name: { type: String, trim: true, required: true },
            value: { type: String, trim: true, required: true }
        }
    ],
    variantImageUrl: { // The specific image URL for the selected variant combination
        type: String,
        default: ''
    },
    variantPriceAdjustment: { // The price adjustment for the selected variant combination
        type: Number,
        default: 0
    }
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    governorate: { type: String, required: true }, // ✅ NEW: Added governorate field
    city: { type: String, required: true },
    country: { type: String, required: true },
    shippingCost: { type: Number, required: true, default: 0 } // ✅ NEW: Added shippingCost field
}, { _id: false });

const couponAppliedSchema = new mongoose.Schema({
    code: { type: String, trim: true },
    discountType: { type: String, enum: ['percentage', 'fixed_amount'] },
    discountValue: { type: Number, min: 0 }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    userId: { // This field links the order to a user (now optional for guests)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Changed from true to false for guest orders
    },
    items: [OrderItemSchema], // Array of items in this order
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    shippingAddress: shippingAddressSchema, // Using the new shippingAddressSchema
    status: {
        type: String,
        enum: ['Pending', 'Pending Payment', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Pending (Shipping Failed)'], // ✅ UPDATED: Added new statuses
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash on Delivery', 'Paymob Card'],
        required: true
    },
    paymobOrderId: {
        type: String,
        unique: true,
        sparse: true
    },
    paymentDetails: {
        transactionId: { type: String },
        status: { type: String }, // 'succeeded', 'failed', 'pending'
        message: { type: String }
    },
    couponUsed: couponAppliedSchema, // Using the new couponAppliedSchema
    isEmailSent: { // ✅ NEW: To track if order confirmation email was sent
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // ✅ NEW: Added shipping tracking fields (from previous shipping integration)
    shippingTrackingId: { // رقم التتبع من شركة الشحن
        type: String,
        default: null
    },
    shippingCompanyOrderId: { // رقم تعريف الطلب لدى شركة الشحن (إن وجد)
        type: String,
        default: null
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;