const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { auth, adminAuth } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createShippingOrder } = require('../services/shippingService'); // ✅ استدعاء الخدمة الجديدة

console.log('orderRoutes.js: Module started loading.');

module.exports = ({ axios, PAYMOB_API_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_ID_CARD, PAYMOB_MERCHANT_ID, PAYMOB_IFRAME_ID }) => {

console.log('orderRoutes.js: Module function executed, router being configured.');

// --- Nodemailer Transporter Configuration ---
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE_HOST,
    port: process.env.EMAIL_SERVICE_PORT,
    secure: process.env.EMAIL_SERVICE_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_SERVICE_USER,
        pass: process.env.EMAIL_SERVICE_PASS,
    },
});

transporter.verify(function (error, success) {
    if (error) {
        console.error("Nodemailer Transporter Verification Error:", error);
    } else {
        console.log("Nodemailer Transporter is ready for sending emails.");
    }
});

// ✅ NEW: Define shipping rates by governorate on the backend for validation
const BACKEND_SHIPPING_RATES_BY_GOVERNORATE = {
    "Cairo": 50.00,
    "Giza": 50.00,
    "Qalyubia": 50.00,
    "Alexandria": 75.00,
    "Dakahlia": 75.00,
    "Gharbia": 75.00,
    "Menoufia": 75.00,
    "Sharqia": 75.00,
    "El-Beheira": 75.00,
    "Damietta": 75.00,
    "Ismailia": 75.00,
    "Suez": 75.00,
    "Port Said": 75.00,
    "Kafr el-Sheikh": 75.00,
    "Beni Suef": 100.00,
    "Faiyum": 100.00,
    "Minya": 100.00,
    "Asyut": 100.00,
    "Sohag": 100.00,
    "Qena": 100.00,
    "Luxor": 100.00,
    "Aswan": 100.00,
    "Red Sea": 150.00,
    "Matrouh": 150.00,
    "New Valley": 150.00,
    "North Sinai": 150.00,
    "South Sinai": 150.00
};

// ✅ NEW: Shipping company webhook secret (MUST be configured in .env)
const SHIPPING_WEBHOOK_SECRET = process.env.SHIPPING_WEBHOOK_SECRET || 'your_shipping_webhook_secret'; // Replace with actual secret


// --- Paymob Helper Functions ---
async function paymobAuth() {
    if (!PAYMOB_API_KEY || PAYMOB_API_KEY.length < 5) {
        console.warn('Paymob Auth: PAYMOB_API_KEY is missing or too short. Returning a dummy token for development.');
        return 'dummy_auth_token_for_development';
    }

    try {
        const response = await axios.post('https://accept.paymobsolutions.com/api/auth/tokens', {
            api_key: PAYMOB_API_KEY
        });
        return response.data.token;
    } catch (error) {
        console.error('Paymob Auth Error:', error.response ? error.response.data : error.message);
        throw new Error('Failed to authenticate with Paymob. Please check API key.');
    }
}

async function paymobRegisterOrder(authToken, merchantOrderId, amountCents, currency, items) {
    try {
        const response = await axios.post('https://accept.paymobsolutions.com/api/ecommerce/orders', {
            auth_token: authToken,
            delivery_needed: 'false',
            merchant_order_id: merchantOrderId,
            amount_cents: amountCents,
            currency: currency,
            items: items.map(item => ({
                name: String(item.name), // Ensure string
                amount_cents: Math.round(parseFloat(item.price) * 100), // Ensure float then round
                description: String(item.name), // Ensure string
                quantity: parseInt(item.quantity) // Ensure integer
            }))
        });
        return response.data.id; // Paymob order ID
    } catch (error) {
        console.error('Paymob Register Order Error:', error.response ? error.response.data : error.message);
        throw new Error('Failed to register order with Paymob. Check order details or Paymob API status.');
    }
}

async function paymobGetPaymentKey(authToken, amountCents, currency, paymobOrderId, integrationId, billingData, userEmail, userName) {
    try {
        const response = await axios.post('https://accept.paymobsolutions.com/api/acceptance/payment_keys', {
            auth_token: authToken,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: paymobOrderId,
            billing_data: {
                apartment: String(billingData.apartment || 'NA'),
                email: String(userEmail),
                floor: String(billingData.floor || 'NA'),
                first_name: String(userName.split(' ')[0] || 'NA'),
                street: String(billingData.addressLine1 || 'NA'),
                building: String(billingData.building || 'NA'),
                phone_number: String(billingData.phone),
                shipping_method: 'NA',
                postal_code: String(billingData.postalCode || 'NA'),
                city: String(billingData.city),
                country: String(billingData.country),
                last_name: String(userName.split(' ').slice(1).join(' ') || 'NA'),
                state: String(billingData.governorate || 'NA') // Using state for governorate for Paymob billing
            },
            currency: currency,
            integration_id: integrationId
        });
        return response.data.token; // Payment Key
    } catch (error) {
        console.error('Paymob Get Payment Key Error:', error.response ? error.response.data : error.message);
        throw new Error('Failed to obtain payment key from Paymob. Check integration ID or billing data.');
    }
}

async function sendOrderConfirmationEmail(order) {
    console.log(`Email Service: Attempting to send order confirmation email for Order ID: ${order._id} to ${order.shippingAddress.email}`);

    let mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: order.shippingAddress.email,
        subject: `Order Confirmation - #${order._id}`,
        html: `
            <h1>Thank you for your order!</h1>
            <p>Your order #${order._id} has been placed successfully.</p>
            <p>Total amount: EGP${order.totalAmount.toFixed(2)}</p>
            <p>Items:</p>
            <ul>
                ${order.items.map(item => `<li>${String(item.name)} (x${parseInt(item.quantity)}) - EGP${parseFloat(item.price).toFixed(2)} each</li>`).join('')}
            </ul>
            <p>Shipping Address: ${String(order.shippingAddress.addressLine1)}, ${String(order.shippingAddress.city)}, ${String(order.shippingAddress.governorate)}, ${String(order.shippingAddress.country)}</p>
            <p>Shipping Cost: EGP${order.shippingAddress.shippingCost.toFixed(2)}</p>
            <p>Payment Method: ${String(order.paymentMethod)}</p>
            <p>Current Status: ${String(order.status)}</p>
            ${order.couponUsed ? `
                <p>Discount Applied: Coupon "${String(order.couponUsed.code)}"</p>
            ` : ''}
            ${order.shippingTrackingId ? `
                <p>Tracking ID: ${order.shippingTrackingId}</p>
            ` : ''}
            <br>
            <p>We will notify you when your order is shipped.</p>
            <br>
            <p>Best regards,</p>
            <p>The Light & Wire Store Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent: Order confirmation for', order._id);
        return true;
    } catch (error) {
        console.error('Error sending email for order confirmation:', error);
        return false;
    }
}


// NEW: POST Initiate Paymob Payment (http://localhost:3000/api/orders/pay-with-paymob) - Now supports guests
router.post('/pay-with-paymob', auth, async (req, res) => { // Auth middleware added
    console.log('orderRoutes.js: /pay-with-paymob route HIT!');
    const { orderDetails } = req.body;
    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? (req.user.email || orderDetails.shippingAddress.email) : orderDetails.shippingAddress.email;
    const userName = req.user ? (req.user.name || orderDetails.shippingAddress.fullName) : orderDetails.shippingAddress.fullName;

    try {
        let totalAmountItems = 0; // Total from items only, before shipping/coupon
        const itemsForPaymob = [];
        const orderItemsForDB = [];
        let sourceItems = [];

        // ✅ NEW: Validate governorate and shipping cost from frontend
        const frontendGovernorate = orderDetails.shippingAddress.governorate;
        const frontendShippingCost = parseFloat(orderDetails.shippingAddress.shippingCost);
        
        if (!frontendGovernorate || !BACKEND_SHIPPING_RATES_BY_GOVERNORATE[frontendGovernorate]) {
            return res.status(400).json({ message: 'Invalid or missing governorate provided.' });
        }
        const backendCalculatedShippingCost = BACKEND_SHIPPING_RATES_BY_GOVERNORATE[frontendGovernorate];
        if (frontendShippingCost !== backendCalculatedShippingCost) {
            console.warn(`Frontend shipping cost mismatch. Frontend: ${frontendShippingCost}, Backend: ${backendCalculatedShippingCost}`);
            // return res.status(400).json({ message: 'Shipping cost mismatch. Please refresh and try again.' });
            // For now, we'll use the backend calculated one for final total.
        }
        let actualShippingCost = backendCalculatedShippingCost;


        if (userId) {
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ message: 'Your cart is empty. Please add items before initiating payment.' });
            }
            sourceItems = cart.items;
        } else {
            if (!orderDetails.items || orderDetails.items.length === 0) {
                return res.status(400).json({ message: 'No items provided for guest checkout.' });
            }
            // For guest, fetch full product details for stock validation and denormalization
            for (const clientItem of orderDetails.items) {
                const product = await Product.findById(clientItem.productId);
                if (!product) {
                    return res.status(404).json({ message: `Product with ID ${clientItem.productId} not found.` });
                }
                // Prepare item for processing, ensuring denormalized fields are present and correctly typed
                sourceItems.push({
                    productId: product._id, // Actual product ID
                    name: String(clientItem.name || product.name || 'Unknown Product'),
                    price: parseFloat(clientItem.price || product.price || 0),
                    imageUrl: String(clientItem.imageUrl || product.imageUrl || '/images/images/placeholder.jpg'),
                    quantity: parseInt(clientItem.quantity || 0),
                    selectedVariants: clientItem.selectedVariants || [],
                    variantImageUrl: String(clientItem.variantImageUrl || product.imageUrl || '/images/images/placeholder.jpg'),
                    variantPriceAdjustment: parseFloat(clientItem.variantPriceAdjustment || 0)
                });
            }
        }

        for (const item of sourceItems) {
            // ✅ FIX: Ensure product ID is always a string for findById
            const productIdToFetch = item.productId._id ? item.productId._id : item.productId;
            const product = await Product.findById(productIdToFetch);
            if (!product) {
                console.warn(`Product ${String(productIdToFetch)} not found during order processing in Paymob initiation. Skipping item.`);
                continue; // Skip item if product not found
            }

            // Perform stock validation
            let itemStockToValidate = product.stock;
            if (product.variants && product.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentVariantStock = Infinity;
                for(const selVar of item.selectedVariants) {
                    const foundGroup = product.variants.find(vg => vg.name === selVar.name);
                    if(foundGroup) {
                        const foundOption = foundGroup.options.find(opt => opt.value === selVar.value);
                        if(foundOption) {
                            currentVariantStock = Math.min(currentVariantStock, foundOption.stock);
                        }
                    }
                }
                itemStockToValidate = currentVariantStock;
            }

            if (itemStockToValidate < parseInt(item.quantity || 0)) { // Ensure quantity is integer for comparison
                return res.status(400).json({ message: `Not enough stock for ${String(item.name)}. Available: ${itemStockToValidate}, Requested: ${parseInt(item.quantity || 0)}.` });
            }

            // Calculate total amount for Paymob (using parsed numbers)
            totalAmountItems += parseFloat(item.price || 0) * parseInt(item.quantity || 0);
            itemsForPaymob.push({
                name: String(item.name),
                amount_cents: Math.round(parseFloat(item.price || 0) * 100),
                description: String(item.name),
                quantity: parseInt(item.quantity || 0)
            });

            // Prepare item for database, ensuring types
            orderItemsForDB.push({
                productId: item.productId,
                name: String(item.name),
                price: parseFloat(item.price),
                imageUrl: String(item.imageUrl),
                quantity: parseInt(item.quantity),
                selectedVariants: item.selectedVariants || [],
                variantImageUrl: String(item.variantImageUrl || item.imageUrl || '/images/images/placeholder.jpg'),
                variantPriceAdjustment: parseFloat(item.variantPriceAdjustment || 0)
            });
        }

        let finalTotalAmount = totalAmountItems + actualShippingCost; // Start with item total + actual shipping

        let couponDetailsForDB = null;
        if (orderDetails.coupon && userId) {
            const coupon = await Coupon.findOne({ code: String(orderDetails.coupon.code).toUpperCase() });
            if (coupon && coupon.isActive && new Date() <= (coupon.expiresAt || new Date('2100-01-01'))) {
                if (finalTotalAmount >= parseFloat(coupon.minOrderAmount || 0)) {
                    let discountAmount = 0;
                    if (coupon.discountType === 'percentage') {
                        discountAmount = finalTotalAmount * (parseFloat(coupon.discountValue || 0) / 100);
                        if (coupon.maxDiscountAmount && discountAmount > parseFloat(coupon.maxDiscountAmount || 0)) {
                            discountAmount = parseFloat(coupon.maxDiscountAmount || 0);
                        }
                    } else if (coupon.discountType === 'fixed_amount') {
                        discountAmount = parseFloat(coupon.discountValue || 0);
                    }
                    finalTotalAmount = finalTotalAmount - discountAmount;
                    if (finalTotalAmount < 0) finalTotalAmount = 0;

                    couponDetailsForDB = {
                        code: String(coupon.code),
                        discountType: String(coupon.discountType),
                        discountValue: parseFloat(coupon.discountValue)
                    };
                    coupon.timesUsed += 1;
                    await coupon.save();
                }
            }
        }

        const amountInCents = Math.round(finalTotalAmount * 100);
        const currency = 'EGP';

        const authToken = await paymobAuth();

        const merchantOrderId = userId ? `${userId}-${Date.now()}` : `guest-${Date.now()}`;
        const paymobOrderId = await paymobRegisterOrder(authToken, merchantOrderId, amountInCents, currency, itemsForPaymob);

        const paymentKey = await paymobGetPaymentKey(
            authToken,
            amountInCents,
            currency,
            paymobOrderId,
            PAYMOB_INTEGRATION_ID_CARD,
            { // Billing data for Paymob
                apartment: String(orderDetails.shippingAddress.apartment || 'NA'),
                email: String(userEmail),
                floor: String(orderDetails.shippingAddress.floor || 'NA'),
                first_name: String(userName.split(' ')[0] || 'NA'),
                street: String(orderDetails.shippingAddress.addressLine1 || 'NA'),
                building: String(orderDetails.shippingAddress.building || 'NA'),
                phone_number: String(orderDetails.shippingAddress.phone),
                shipping_method: 'NA',
                postal_code: String(orderDetails.shippingAddress.postalCode || 'NA'),
                city: String(orderDetails.shippingAddress.city),
                country: String(orderDetails.shippingAddress.country),
                last_name: String(userName.split(' ').slice(1).join(' ') || 'NA'),
                state: String(orderDetails.shippingAddress.governorate || 'NA') // Pass governorate as state
            },
            String(userEmail),
            String(userName)
        );

        const paymobIframeUrl = `https://accept.paymobsolutions.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;

        const newOrder = new Order({
            userId: userId,
            items: orderItemsForDB,
            totalAmount: finalTotalAmount,
            shippingAddress: {
                fullName: String(orderDetails.shippingAddress.fullName),
                email: String(orderDetails.shippingAddress.email),
                phone: String(orderDetails.shippingAddress.phone),
                addressLine1: String(orderDetails.shippingAddress.addressLine1),
                governorate: String(frontendGovernorate), // ✅ NEW: Add governorate
                city: String(orderDetails.shippingAddress.city),
                country: String(orderDetails.shippingAddress.country),
                shippingCost: actualShippingCost // ✅ NEW: Add shipping cost
            },
            status: 'Pending Payment', // Set initial status for Paymob orders
            paymentMethod: 'Paymob Card',
            paymobOrderId: paymobOrderId,
            couponUsed: couponDetailsForDB
        });
        const savedOrder = await newOrder.save();

        // No direct shipping integration for Paymob here; it will happen on callback
        // This is handled in the `paymob-callback` route once payment is confirmed.

        res.json({
            message: 'Payment initiated successfully! Redirecting to secure payment page.',
            paymentType: 'iframe',
            redirectUrl: paymobIframeUrl,
            orderId: savedOrder._id
        });

    } catch (err) {
        console.error('Error initiating Paymob payment:', err);
        res.status(500).json({ message: err.message || 'Failed to initiate online payment due to a server error.' });
    }
});


// NEW: POST Paymob Webhook Callback (http://localhost:3000/api/orders/paymob-callback)
router.post('/paymob-callback', async (req, res) => {
    console.log('orderRoutes.js: /paymob-callback route HIT!');
    console.log('Paymob Callback received query:', req.query);
    console.log('Paymob Callback received body:', req.body);

    const hmac = req.query.hmac || req.body.hmac;
    const obj = req.query.obj || req.body.obj;

    if (!obj || !hmac) {
        console.error('Paymob Callback: Missing obj or hmac in request.');
        return res.status(400).send('Missing data for HMAC verification.');
    }

    const paymobOrderId = obj.order ? obj.order.id : null;
    const transactionId = obj.id;
    const paymobOrderStatus = obj.success;
    const merchantOrderId = obj.order ? obj.order.merchant_order_id : null;

    if (!paymobOrderId || !merchantOrderId) {
        console.error('Paymob Callback: Missing order_id or merchant_order_id in obj.');
        return res.status(400).send('Missing order IDs in Paymob object.');
    }

    const hmacSourceString = [
        obj.amount_cents,
        obj.created_at,
        obj.currency,
        obj.error_occured,
        obj.has_parent_transaction,
        obj.id,
        obj.integration_id,
        obj.is_3d_secure,
        obj.is_auth,
        obj.is_capture,
        obj.is_card_test,
        obj.is_flagged,
        obj.is_gateway,
        obj.is_null,
        obj.is_paid,
        obj.is_refunded,
        obj.is_standalone,
        obj.is_voided,
        obj.order.id,
        obj.owner,
        obj.pending,
        obj.source_data.pan,
        obj.source_data.sub_type,
        obj.source_data.type,
        obj.success
    ].map(value => String(value)).join('');


    const hashed = crypto.createHmac('sha512', PAYMOB_HMAC_SECRET)
                         .update(hmacSourceString)
                         .digest('hex');

    if (hashed !== hmac) {
        console.warn('Paymob Callback: HMAC verification failed! Received HMAC:', hmac, 'Calculated HMAC:', hashed);
        return res.status(401).send('HMAC verification failed.');
    }

    try {
        let order = await Order.findOne({ paymobOrderId: paymobOrderId });

        if (!order) {
            console.warn('Paymob Callback: Order not found by paymobOrderId, attempting fallback with merchantOrderId:', merchantOrderId);
            const possibleUserId = merchantOrderId.startsWith('guest-') ? null : merchantOrderId.split('-')[0];

            if (possibleUserId) {
                order = await Order.findOne({ userId: possibleUserId, paymobOrderId: { $exists: false }, status: 'Pending Payment' });
            }

            if (order) {
                order.paymobOrderId = paymobOrderId;
                console.log('Paymob Callback: Found and updated fallback order with PaymobOrderId.');
            } else {
                console.error('Paymob Callback: Could not find any matching order (original or fallback) for merchantOrderId:', merchantOrderId);
                return res.status(404).send('Order not found in our system for processing callback.');
            }
        }


        if (paymobOrderStatus) {
            order.status = 'Processing'; // Payment successful, now set to processing
            order.paymentDetails = {
                transactionId: String(transactionId),
                status: 'succeeded',
                message: String(obj.data ? obj.data.message : 'Payment successful via Paymob.')
            };
            console.log(`Paymob Callback: Payment succeeded for order ${order._id}`);

            // ✅ دمج شركة الشحن هنا بعد تأكيد الدفع لطلبات Paymob
            const shippingResult = await createShippingOrder(order);
            if (shippingResult.success) {
                order.shippingTrackingId = shippingResult.trackingId;
                order.shippingCompanyOrderId = shippingResult.shippingCompanyOrderId;
                order.status = 'Processing'; // Confirm processing if shipping initiated
                console.log(`Order ${order._id} sent to shipping company via Paymob callback. Tracking ID: ${shippingResult.trackingId}`);
            } else {
                console.error(`Failed to send Paymob order ${order._id} to shipping company: ${shippingResult.message}`);
                order.status = 'Pending (Shipping Failed)'; // Mark for manual review
            }


            if (order.userId) {
                const userCart = await Cart.findOne({ userId: order.userId });
                if (userCart) {
                    userCart.items = [];
                    await userCart.save();
                    console.log(`User cart cleared for order ${order._id}.`);
                }
            } else {
                console.log(`Guest order ${order._id} - no cart to clear.`);
            }

            // Stock deduction already happened when order was initially created for Paymob.
            // If you want to restore stock on payment failure, it happens below.

            if (!order.isEmailSent) {
                const emailSent = await sendOrderConfirmationEmail(order);
                if (emailSent) {
                    order.isEmailSent = true;
                    console.log('Order confirmation email marked as sent for Paymob order.');
                }
            }

        } else {
            order.status = 'Cancelled'; // Payment failed
            order.paymentDetails = {
                transactionId: String(transactionId),
                status: 'failed',
                message: String(obj.data ? obj.data.message : 'Payment failed via Paymob.')
            };
            console.warn(`Paymob Callback: Payment failed for order ${order._id}. Message: ${order.paymentDetails.message}`);
            // Restore stock if payment failed
            for (const item of order.items) {
                // ✅ FIX: Ensure product ID is always a string for findById
                const productIdToFetch = item.productId._id ? item.productId._id : item.productId;
                const product = await Product.findById(productIdToFetch); // Use the actual ID here
                if (product) {
                    let stockUpdated = false;
                    if (item.selectedVariants && item.selectedVariants.length > 0) {
                        for (const variantGroup of product.variants) {
                            const foundOption = variantGroup.options.find(opt =>
                                item.selectedVariants.some(selVar => String(selVar.name) === String(variantGroup.name) && String(selVar.value) === String(opt.value))
                            );
                            if (foundOption) {
                                foundOption.stock += parseInt(item.quantity);
                                stockUpdated = true;
                                break;
                            }
                        }
                    }
                    if (!stockUpdated) {
                        product.stock += parseInt(item.quantity);
                    }
                    await product.save();
                    console.log(`Stock restored for product ${String(item.name)} after failed Paymob payment.`);
                }
            }
        }
        await order.save(); // Save the order with updated status and potentially tracking info
        res.status(200).send('Callback received and processed.');

    } catch (err) {
        console.error('Paymob Callback Processing Error:', err);
        res.status(500).send('Server error processing callback.');
    }
});


// 1. POST Create a new order (for Cash on Delivery only) (http://localhost:3000/api/orders) - Now supports guests
router.post('/', auth, async (req, res) => { // Auth middleware added
    const { shippingAddress, paymentMethod, items: clientItems, coupon } = req.body;
    const userId = req.user ? req.user.id : null;

    if (String(paymentMethod) !== 'Cash on Delivery') { // Ensure paymentMethod is string for comparison
        return res.status(400).json({ message: 'Invalid payment method for this endpoint. Only Cash on Delivery is allowed here.' });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.email || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.country || !shippingAddress.governorate || !shippingAddress.phone) {
        return res.status(400).json({ message: 'All shipping address fields are required, including Governorate.' });
    }

    // ✅ NEW: Validate governorate and shipping cost from frontend for COD
    const frontendGovernorate = shippingAddress.governorate;
    const frontendShippingCost = parseFloat(shippingAddress.shippingCost);
    
    if (!frontendGovernorate || !BACKEND_SHIPPING_RATES_BY_GOVERNORATE[frontendGovernorate]) {
        return res.status(400).json({ message: 'Invalid or missing governorate provided for shipping.' });
    }
    const backendCalculatedShippingCost = BACKEND_SHIPPING_RATES_BY_GOVERNORATE[frontendGovernorate];
    if (frontendShippingCost !== backendCalculatedShippingCost) {
        console.warn(`Frontend shipping cost mismatch for COD. Frontend: ${frontendShippingCost}, Backend: ${backendCalculatedShippingCost}`);
        // return res.status(400).json({ message: 'Shipping cost mismatch. Please refresh and try again.' });
        // For now, we'll use the backend calculated one for final total.
    }
    let actualShippingCost = backendCalculatedShippingCost;


    try {
        let totalAmountItems = 0; // Total from items only, before shipping/coupon
        const orderItems = [];
        let sourceItems = [];

        if (userId) {
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ message: 'Your cart is empty. Cannot create an order.' });
            }
            sourceItems = cart.items;
        } else {
            if (!clientItems || clientItems.length === 0) {
                return res.status(400).json({ message: 'No items provided for guest checkout.' });
            }
            // For guest, we need to fetch full product details for stock validation and denormalization
            for (const clientItem of clientItems) {
                const product = await Product.findById(clientItem.productId);
                if (!product) {
                    return res.status(404).json({ message: `Product with ID ${String(clientItem.productId)} not found.` });
                }
                // Prepare item for processing, ensuring denormalized fields are present and correctly typed
                sourceItems.push({
                    productId: product._id, // Actual product ID
                    name: String(clientItem.name || product.name || 'Unknown Product'),
                    price: parseFloat(clientItem.price || product.price || 0),
                    imageUrl: String(clientItem.imageUrl || product.imageUrl || '/images/images/placeholder.jpg'),
                    quantity: parseInt(clientItem.quantity || 0),
                    selectedVariants: clientItem.selectedVariants || [],
                    variantImageUrl: String(clientItem.variantImageUrl || product.imageUrl || '/images/images/placeholder.jpg'),
                    variantPriceAdjustment: parseFloat(clientItem.variantPriceAdjustment || 0)
                });
            }
        }

        for (const item of sourceItems) {
            // ✅ FIX: Ensure product ID is always a string for findById
            const productIdToFetch = item.productId._id ? item.productId._id : item.productId;
            const product = await Product.findById(productIdToFetch);
            if (!product) {
                console.warn(`Product ${String(productIdToFetch)} not found during COD order processing. Skipping item.`);
                continue; // Skip if product not found
            }

            // Perform stock validation
            let itemStockToValidate = product.stock;
            if (product.variants && product.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentVariantStock = Infinity;
                for(const selVar of item.selectedVariants) {
                    const foundGroup = product.variants.find(vg => vg.name === selVar.name);
                    if(foundGroup) {
                        const foundOption = foundGroup.options.find(opt => opt.value === selVar.value);
                        if(foundOption) {
                            currentVariantStock = Math.min(currentVariantStock, foundOption.stock);
                        }
                    }
                }
                itemStockToValidate = currentVariantStock;
            }

            if (itemStockToValidate < parseInt(item.quantity || 0)) { // Ensure quantity is integer for comparison
                return res.status(400).json({ message: `Not enough stock for ${String(item.name)}. Available: ${itemStockToValidate}, Requested: ${parseInt(item.quantity || 0)}.` });
            }

            // Prepare item for database, ensuring types
            orderItems.push({
                productId: item.productId,
                name: String(item.name),
                price: parseFloat(item.price),
                imageUrl: String(item.imageUrl),
                quantity: parseInt(item.quantity),
                selectedVariants: item.selectedVariants || [],
                variantImageUrl: String(item.variantImageUrl || item.imageUrl || '/images/images/placeholder.jpg'),
                variantPriceAdjustment: parseFloat(item.variantPriceAdjustment || 0)
            });

            totalAmountItems += parseFloat(item.price || 0) * parseInt(item.quantity || 0);

            // Reduce stock
            if (item.selectedVariants && item.selectedVariants.length > 0) {
                let foundVariantOption = null;
                for (const variantGroup of product.variants) {
                    foundVariantOption = variantGroup.options.find(opt =>
                        item.selectedVariants.some(selVar => String(selVar.name) === String(variantGroup.name) && String(selVar.value) === String(opt.value)) // Ensure string comparison
                    );
                    if (foundVariantOption) {
                        break;
                    }
                }
                if (foundVariantOption) {
                    foundVariantOption.stock -= parseInt(item.quantity);
                } else {
                    product.stock -= parseInt(item.quantity);
                }
            } else {
                product.stock -= parseInt(item.quantity);
            }
            await product.save();
        }

        let finalTotalAmount = totalAmountItems + actualShippingCost; // Start with item total + actual shipping

        let couponDetailsForDB = null;
        if (coupon && userId) {
            const foundCoupon = await Coupon.findOne({ code: String(coupon.code).toUpperCase() });
            if (foundCoupon && foundCoupon.isActive && new Date() <= (foundCoupon.expiresAt || new Date('2100-01-01'))) {
                if (finalTotalAmount >= parseFloat(foundCoupon.minOrderAmount || 0)) {
                    let discountAmount = 0;
                    if (String(foundCoupon.discountType) === 'percentage') {
                        discountAmount = finalTotalAmount * (parseFloat(foundCoupon.discountValue || 0) / 100);
                        if (foundCoupon.maxDiscountAmount && discountAmount > parseFloat(foundCoupon.maxDiscountAmount || 0)) {
                            discountAmount = parseFloat(foundCoupon.maxDiscountAmount || 0);
                        }
                    } else if (String(foundCoupon.discountType) === 'fixed_amount') {
                        discountAmount = parseFloat(foundCoupon.discountValue || 0);
                    }
                    finalTotalAmount = finalTotalAmount - discountAmount;
                    if (finalTotalAmount < 0) finalTotalAmount = 0;

                    couponDetailsForDB = {
                        code: String(foundCoupon.code),
                        discountType: String(foundCoupon.discountType),
                        discountValue: parseFloat(foundCoupon.discountValue)
                    };
                    foundCoupon.timesUsed += 1;
                    await foundCoupon.save();
                }
            }
        }


        const newOrder = new Order({
            userId: userId,
            items: orderItems,
            totalAmount: finalTotalAmount,
            shippingAddress: {
                fullName: String(shippingAddress.fullName),
                email: String(shippingAddress.email),
                phone: String(shippingAddress.phone),
                addressLine1: String(shippingAddress.addressLine1),
                governorate: String(frontendGovernorate), // ✅ NEW: Add governorate
                city: String(shippingAddress.city),
                country: String(shippingAddress.country),
                shippingCost: actualShippingCost // ✅ NEW: Add shipping cost
            },
            paymentMethod: String(paymentMethod),
            status: 'Pending',
            couponUsed: couponDetailsForDB
        });

        const savedOrder = await newOrder.save();

        // ✅ دمج شركة الشحن هنا لطلبات الدفع عند الاستلام (COD)
        const shippingResult = await createShippingOrder(savedOrder);
        if (shippingResult.success) {
            savedOrder.shippingTrackingId = shippingResult.trackingId;
            savedOrder.shippingCompanyOrderId = shippingResult.shippingCompanyOrderId;
            savedOrder.status = 'Processing'; // Update status if shipment initiated successfully
            await savedOrder.save(); // Save updated order with shipping info
            console.log(`Order ${savedOrder._id} sent to shipping company. Tracking ID: ${shippingResult.trackingId}`);
        } else {
            console.error(`Failed to send order ${savedOrder._id} to shipping company: ${shippingResult.message}`);
            savedOrder.status = 'Pending (Shipping Failed)'; // Mark for manual review
            await savedOrder.save();
        }


        if (userId) {
            const userCart = await Cart.findOne({ userId });
            if (userCart) {
                userCart.items = [];
                await userCart.save();
                console.log(`User cart cleared for order ${savedOrder._id}.`);
            }
        } else {
            console.log(`Guest order ${savedOrder._id} placed - no cart to clear.`);
        }

        if (!savedOrder.isEmailSent) {
            const emailSent = await sendOrderConfirmationEmail(savedOrder);
            if (emailSent) {
                savedOrder.isEmailSent = true;
                await savedOrder.save();
                console.log('Order confirmation email marked as sent.');
            }
        }

        res.status(201).json({ message: 'Order placed successfully!', order: savedOrder });
    } catch (err) {
        console.error('Error creating COD order:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID or User ID format when creating order.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error creating order: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to create order due to a server error.' });
    }
});


// 2. GET orders for the authenticated user (http://localhost:3000/api/orders/my-orders) - Requires authentication
router.get('/my-orders', auth, async (req, res) => {
    console.log('--- GET /api/orders/my-orders initiated ---');
    try {
        console.log('User ID from token:', req.user.id);

        const orders = await Order.find({ userId: req.user.id })
                                 .populate('items.productId', 'name imageUrl')
                                 .sort({ createdAt: -1 });

        console.log('Orders fetched from DB:', orders.length);

        if (orders.length === 0) {
            console.log('No orders found for this user.');
        }

        res.json(orders);
        console.log('--- GET /api/orders/my-orders response sent ---');
    } catch (err) {
        console.error('Error fetching user orders (Caught in Catch Block):', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve your orders due to a server error.' });
    }
});

// 3. GET a single order by ID (for admin or user if it's their order) (http://localhost:3000/api/orders/:id)
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
                                 .populate('userId', 'name email')
                                 .populate('items.productId', 'name imageUrl variants');
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        if (req.user.isAdmin || (order.userId && String(order.userId) === String(req.user.id))) { // Ensure string comparison
            res.json(order);
        } else {
            res.status(403).json({ message: 'Access denied. You can only view your own orders or if you are an admin.' });
        }
    } catch (err) {
        console.error('Error fetching single order:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Order ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve order details due to a server error.' });
    }
});


// 4. PUT Cancel a user's own order (http://localhost:3000/api/orders/cancel/:id) - Requires authentication (or admin)
router.put('/cancel/:id', auth, async (req, res) => {
    const orderId = req.params.id;
    const userId = req.user.id;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.userId && String(order.userId) !== String(userId) && !req.user.isAdmin) { // Ensure string comparison
            return res.status(403).json({ message: 'Access denied. You can only cancel your own orders.' });
        }
        if (!order.userId && !req.user.isAdmin) {
             return res.status(403).json({ message: 'Access denied. Only admins can cancel guest orders.' });
        }


        const cancellableStatuses = ['Pending', 'Processing', 'Pending (Shipping Failed)'];
        if (!cancellableStatuses.includes(String(order.status))) { // Ensure string comparison
            return res.status(400).json({ message: `Order cannot be cancelled. Current status: ${String(order.status)}.` });
        }

        order.status = 'Cancelled';
        await order.save();

        for (const item of order.items) {
            // ✅ FIX: Ensure product ID is always a string for findById
            const productIdToFetch = item.productId._id ? item.productId._id : item.productId;
            const product = await Product.findById(productIdToFetch); // Use the actual ID here
            if (product) {
                if (item.selectedVariants && item.selectedVariants.length > 0) {
                    let foundVariantOption = null;
                    for (const variantGroup of product.variants) {
                        foundVariantOption = variantGroup.options.find(opt =>
                            item.selectedVariants.some(selVar => String(selVar.name) === String(variantGroup.name) && String(selVar.value) === String(opt.value)) // Ensure string comparison
                        );
                        if (foundVariantOption) {
                            break;
                        }
                    }
                    if (foundVariantOption) {
                        foundVariantOption.stock += parseInt(item.quantity);
                        console.log(`Stock restored for variant ${String(item.name)} (${item.selectedVariants.map(v => String(v.value)).join(', ')}). New stock: ${foundVariantOption.stock}`);
                    } else {
                        product.stock += parseInt(item.quantity);
                        console.warn(`Variant option not found for ${String(item.name)}. Restoring main product stock.`);
                    }
                } else {
                    product.stock += parseInt(item.quantity);
                    console.log(`Stock restored for product ${String(item.name)} after cancellation.`);
                }
                await product.save();
            }
        }

        res.json({ message: 'Order cancelled successfully!', order });
    } catch (err) {
        console.error('Error cancelling order:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Order ID format for cancellation.' });
        }
        res.status(500).json({ message: 'Failed to cancel order due to a server error.' });
    }
});

// 5. PUT Update order status (for admin) (http://localhost:3000/api/orders/:id/status) - Requires admin authentication
router.put('/:id/status', adminAuth, async (req, res) => {
    const { status } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Pending Payment', 'Pending (Shipping Failed)'];
        if (!validStatuses.includes(String(status))) { // Ensure string comparison
            return res.status(400).json({ message: 'Invalid status provided. Valid statuses are: ' + validStatuses.join(', ') + '.' });
        }

        if (String(status) === 'Cancelled' && String(order.status) !== 'Cancelled') { // Ensure string comparison
            for (const item of order.items) {
                // ✅ FIX: Ensure product ID is always a string for findById
                const productIdToFetch = item.productId._id ? item.productId._id : item.productId;
                const product = await Product.findById(productIdToFetch); // Use the actual ID here
                if (product) {
                    if (item.selectedVariants && item.selectedVariants.length > 0) {
                        let foundVariantOption = null;
                        for (const variantGroup of product.variants) {
                            const foundOption = variantGroup.options.find(opt =>
                                item.selectedVariants.some(selVar => String(selVar.name) === String(variantGroup.name) && String(selVar.value) === String(opt.value)) // Ensure string comparison
                            );
                            if (foundOption) {
                                foundVariantOption = foundOption;
                                break;
                            }
                        }
                        if (foundVariantOption) {
                            foundVariantOption.stock += parseInt(item.quantity);
                        } else {
                            product.stock += parseInt(item.quantity);
                        }
                    } else {
                        product.stock += parseInt(item.quantity);
                    }
                    await product.save();
                    console.log(`Stock reduced for product ${String(item.name)} due to status change to Cancelled.`);
                }
            }
        }
        if (String(order.status) === 'Cancelled' && String(status) !== 'Cancelled') { // If status changes from Cancelled to something else
             for (const item of order.items) {
                // ✅ FIX: Ensure product ID is always a string for findById
                const productIdToFetch = item.productId._id ? item.productId._id : item.productId;
                const product = await Product.findById(productIdToFetch); // Use the actual ID here
                if (product) {
                    let itemStockToValidate = product.stock;
                    if (item.selectedVariants && item.selectedVariants.length > 0) {
                        let currentVariantStock = Infinity;
                        for(const selVar of item.selectedVariants) {
                            const foundGroup = product.variants.find(vg => vg.name === selVar.name);
                            if(foundGroup) {
                                const foundOption = foundGroup.options.find(opt => opt.value === selVar.value);
                                if(foundOption) {
                                    currentVariantStock = Math.min(currentVariantStock, foundOption.stock);
                                }
                            }
                        }
                        itemStockToValidate = currentVariantStock;
                    }

                    if (itemStockToValidate < parseInt(item.quantity)) { // Ensure quantity is integer for comparison
                        return res.status(400).json({ message: `Cannot change status from Cancelled to ${String(status)}. Not enough stock for product \"${String(item.name)}\". Available: ${itemStockToValidate}, Ordered: ${parseInt(item.quantity)}.` });
                    }

                    if (item.selectedVariants && item.selectedVariants.length > 0) {
                        let foundVariantOption = null;
                        for (const variantGroup of product.variants) {
                            const foundOption = variantGroup.options.find(opt =>
                                item.selectedVariants.some(selVar => String(selVar.name) === String(variantGroup.name) && String(selVar.value) === String(opt.value)) // Ensure string comparison
                            );
                            if (foundOption) {
                                foundVariantOption = foundOption;
                                break;
                            }
                        }
                        if (foundVariantOption) {
                            foundVariantOption.stock -= parseInt(item.quantity);
                        } else {
                            product.stock -= parseInt(item.quantity);
                        }
                    } else {
                        product.stock -= parseInt(item.quantity);
                    }
                    await product.save();
                    console.log(`Stock reduced for product ${String(item.name)} due to status change from Cancelled.`);
                }
            }
        }

        order.status = String(status);
        await order.save();
        res.json({ message: 'Order status updated successfully!', order });
    } catch (err) {
        console.error('Error updating order status:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Order ID format for status update.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error updating status: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update order status due to a server error.' });
    }
});

// ✅ NEW: Shipping Company Webhook Endpoint
// This endpoint will receive status updates from the shipping company
// The exact path, method (POST), and payload structure depend on the shipping company's API documentation.
router.post('/shipping-webhook', async (req, res) => {
    console.log('--- Shipping Webhook Endpoint HIT ---');
    console.log('Request Body:', req.body);
    console.log('Request Headers:', req.headers);

    // --- 1. Validate Webhook Authenticity (CRITICAL) ---
    // This is a conceptual example. You MUST implement actual HMAC/signature verification
    // based on your shipping company's documentation.
    const receivedSignature = req.headers['x-shipping-signature'] || req.headers['X-Hub-Signature'] || ''; // Example header
    const payload = JSON.stringify(req.body); // Use raw body for HMAC if possible, or stringified
    
    // Example HMAC verification (replace with actual logic from shipping company's docs)
    // const expectedSignature = crypto.createHmac('sha256', SHIPPING_WEBHOOK_SECRET)
    //                                 .update(payload)
    //                                 .digest('hex');
    // if (receivedSignature !== `sha256=${expectedSignature}`) { // Or whatever format they use
    //     console.warn('Shipping Webhook: Signature mismatch! Rejecting request.');
    //     return res.status(401).send('Unauthorized: Invalid signature.');
    // }
    console.log('Shipping Webhook: (Skipping actual signature validation for demo. Implement it!)');

    try {
        // --- 2. Parse Webhook Data ---
        // Adjust these to match the actual payload from your shipping company
        const trackingId = req.body.tracking_id || req.body.shipmentId; // Example: 'tracking_id' or 'shipmentId'
        const newStatusFromCompany = req.body.status || req.body.event; // Example: 'status' or 'event' like 'SHIPPED', 'DELIVERED'

        if (!trackingId || !newStatusFromCompany) {
            console.error('Shipping Webhook: Missing tracking_id or status in payload.');
            return res.status(400).send('Missing required data.');
        }

        // --- 3. Map Shipping Company Status to Your Internal Status ---
        let internalStatus;
        switch (String(newStatusFromCompany).toUpperCase()) { // Ensure string and uppercase for comparison
            case 'SHIPPED':
            case 'IN_TRANSIT':
            case 'OUT_FOR_DELIVERY':
                internalStatus = 'Shipped';
                break;
            case 'DELIVERED':
                internalStatus = 'Delivered';
                break;
            case 'CANCELLED':
            case 'FAILED_DELIVERY':
                internalStatus = 'Cancelled'; // Or 'Failed Delivery' if you add that status
                break;
            // Add more status mappings as needed
            default:
                console.warn(`Shipping Webhook: Unhandled status from company: ${newStatusFromCompany}. Not updating order status.`);
                return res.status(200).send('Status received but not mapped.');
        }

        // --- 4. Find and Update Order Status ---
        const order = await Order.findOneAndUpdate(
            { shippingTrackingId: trackingId },
            { $set: { status: internalStatus } },
            { new: true } // Return the updated document
        );

        if (!order) {
            console.warn(`Shipping Webhook: Order not found for tracking ID: ${trackingId}.`);
            return res.status(404).send('Order not found.');
        }

        console.log(`Shipping Webhook: Order ${order._id} status updated to: ${order.status}`);

        // --- 5. Notify User/Admin (Optional) ---
        // You might want to send an email or an in-app notification to the user
        // that their order status has changed.
        // if (order.userId) {
        //     await Notification.create({
        //         user: order.userId,
        //         message: `Your order #${order._id.toString().slice(-6)} status updated to: ${order.status}.`,
        //         type: 'order',
        //         link: `/my-orders.html?orderId=${order._id}`
        //     });
        // }


        res.status(200).send('Webhook received and processed successfully.');

    } catch (error) {
        console.error('Shipping Webhook: Error processing webhook:', error);
        res.status(500).send('Error processing webhook.');
    }
});


console.log('orderRoutes.js: Router configuration complete, returning router.');
return router;
};