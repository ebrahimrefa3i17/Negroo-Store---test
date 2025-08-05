require('dotenv').config(); // Load environment variables from .env file

// --- Debugging Logs (يمكن حذفها لاحقاً) ---
console.log('--- Dotenv loaded ---');
// console.log('Process ENV JWT_SECRET:', process.env.JWT_SECRET);
console.log('Process ENV PORT:', process.env.PORT);
// --- نهاية أسطر التتبع ---

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const compression = require('compression'); // For Gzip compression
const helmet = require('helmet'); // For security headers
const cookieParser = require('cookie-parser'); // ✅ NEW: Import cookie-parser
const cron = require('node-cron'); // ✅ NEW: Import node-cron for scheduled tasks
const PORT = process.env.PORT || 3000; // Use PORT from .env, or default to 3000
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const User = require('./models/User');
const Subscriber = require('./models/Subscriber'); // ✅ NEW: استيراد نموذج Subscriber الجديد
const Cart = require('./models/Cart'); // ✅ NEW: Import Cart model for cron job
const Review = require('./models/Review');
const Category = require('./models/Category');
const Notification = require('./models/Notification');
const HeroSlide = require('./models/HeroSlide');
const PromoSlide = require('./models/PromoSlide');
const GalleryImage = require('./models/GalleryImage'); // ✅ NEW: Import GalleryImage model
const multer = require('multer');
const path = require('path');
const axios = require('axios'); // تأكد من استيراده إذا كنت تستخدم Paymob
const nodemailer = require('nodemailer'); // ✅ NEW: Import nodemailer here for cron job

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;
const PAYMOB_INTEGRATION_ID_CARD = process.env.PAYMOB_INTEGRATION_ID_CARD;
const PAYMOB_MERCHANT_ID = process.env.PAYMOB_MERCHANT_ID;
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // ✅ NEW: استيراد بريد المسؤول من .env

// --- Nodemailer Transporter Configuration (Global for cron job and shared email sending) ---
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE_HOST, // From .env
    port: process.env.EMAIL_SERVICE_PORT, // From .env
    secure: process.env.EMAIL_SERVICE_SECURE === 'true', // Use 'true' for 465, 'false' for 587/2525
    auth: {
        user: process.env.EMAIL_SERVICE_USER, // From .env
        pass: process.env.EMAIL_SERVICE_PASS, // From .env
    },
});

// Verify transporter connection (optional, but good for debugging)
transporter.verify(function (error, success) {
    if (error) {
        console.error("Nodemailer Transporter Verification Error (server.js):", error);
    } else {
        console.log("Nodemailer Transporter is ready for sending emails (server.js).");
    }
});


// Configure EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Import ALL Routes (APIs and Admin)
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const adminApiRoutes = require('./routes/adminApiRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const couponRoutes = require('./routes/couponRoutes');
const productCollectionRoutes = require('./routes/productCollectionRoutes');
const contactRoutes = require('./routes/contactRoutes'); // ✅ NEW: استيراد مسار الاتصال الجديد

const publicHeroSlideRoutes = require('./routes/publicHeroSlideRoutes');
const publicPromoSlideRoutes = require('./routes/publicPromoSlideRoutes');
const publicGalleryImageRoutes = require('./routes/publicGalleryImageRoutes');

const { auth, adminAuth } = require('./middleware/authMiddleware');

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas!');
        // ✅ NEW: Start cron jobs after successful DB connection
        startAbandonedCartJob(); // Call function to start cron job
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// --- Multer Configuration for file uploads (Product Images/Videos) ---
// Storage for general file uploads (e.g., admin panel) - saves to disk

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let destFolder = 'public/uploads/';
        if (file.fieldname === 'mainImage' || file.fieldname === 'additionalImages') {
            destFolder += 'products/';
        } else if (file.fieldname === 'categoryImage') {
            destFolder += 'categories/';
        } else if (file.fieldname.startsWith('variantImage_')) {
            destFolder += 'products/variants/';
        } else if (file.fieldname === 'heroSlideImage') {
            destFolder += 'hero-slides/';
        } else if (file.fieldname === 'promoSlideImage') {
            destFolder += 'promo-slides/';
        } else if (file.fieldname === 'galleryImage') {
            destFolder += 'gallery/';
        } else if (file.fieldname === 'imageUrl') { // ✅ NEW: إضافة هذا الشرط لصور Collections
            destFolder += 'collections/';
        }
        const fullDestPath = path.join(__dirname, destFolder);
        console.log(`Multer: Destination set to ${fullDestPath} for field ${file.fieldname}.`);
        if (!require('fs').existsSync(fullDestPath)) {
            console.log(`Multer: Creating destination directory: ${fullDestPath}`);
            require('fs').mkdirSync(fullDestPath, { recursive: true });
        }
        cb(null, destFolder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        let newFilename;
        if (file.fieldname.startsWith('variantImage_')) {
            newFilename = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
        } else if (file.fieldname === 'heroSlideImage') {
            newFilename = `hero-slide-${uniqueSuffix}${fileExtension}`;
        } else if (file.fieldname === 'promoSlideImage') {
            newFilename = `promo-slide-${uniqueSuffix}${fileExtension}`;
        } else if (file.fieldname === 'galleryImage') {
            newFilename = `gallery-${uniqueSuffix}${fileExtension}`;
        } else {
            newFilename = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
        }
        console.log(`Multer: Saving file as ${newFilename} for field ${file.fieldname}.`);
        cb(null, newFilename);
    }
});

const fileFilter = (req, file, cb) => {
    console.log(`Multer: Filtering file ${file.originalname} with mimetype ${file.mimetype}.`);
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        console.warn(`Multer: Rejected file ${file.originalname} due to unsupported mimetype.`);
        cb(new Error('Only image and video files are allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// ✅ NEW: Multer Configuration for image search (stores in memory for buffer access)
const upload_memory = multer({
    storage: multer.memoryStorage(), // Store file in memory as a buffer
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for search images
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for image search!'), false);
        }
    }
});

// ✅ NEW: Make both 'upload' (disk) and 'upload_memory' (memory) instances available to routes
app.set('multer_upload', upload);
app.set('multer_upload_memory', upload_memory);


// --- Body Parsing Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // ✅ NEW: Use cookie-parser middleware

// --- Security Middlewares ---
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            'script-src': ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com","https://cdn.tailwindcss.com","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"],
            // ✅ التعديل هنا: إضافة التجزئة (hash) للسماح بتنفيذ الكود المضمن المؤقت
            'script-src-elem': ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", ,"https://cdn.tailwindcss.com","'sha256-D0tY4q6sTBgx6KfBz49OxdG6/d9hSbGg2Rjcug+XMZk='",],
            'img-src': [
                "'self'",
                "data:",
                "https://images.unsplash.com",
                "https://via.placeholder.com",
                "https://cdn.jsdelivr.net",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.tailwindcss.com",
                "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css",
                "https://fonts.gstatic.com",
                "https://placehold.co",
                "http://googleusercontent.com", // ✅ NEW: إضافة هذا لتضمين خرائط جوجل
                APP_URL ,
                "blob:"
            ],
            'media-src': [
                "'self'",
                APP_URL,
                "blob:"
            ],
           'style-src': ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "'unsafe-inline'","https://cdn.tailwindcss.com","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"],
            'style-src-elem': ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "'unsafe-inline'","https://cdn.tailwindcss.com","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.00-beta3/css/all.min.css"],
            'connect-src': ["'self'", APP_URL, "https://accept.paymobsolutions.com", "https://api.paymob.com", process.env.PYTHON_ML_SERVICE_URL], // ✅ ADDED Python ML Service URL
            'font-src': ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            'default-src': ["'self'"], // Default to self for all other resources
            'object-src': ["'none'"],
            'worker-src': ["'self'"],
            'frame-src': ["'self'", "https://accept.paymobsolutions.com", "http://googleusercontent.com"], // ✅ NEW: إضافة هذا لتضمين خرائط جوجل
        },
    })
);
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(compression());

// --- Custom logging middleware (يمكن حذفها لاحقاً) ---
app.use((req, res, next) => {
    // console.log('*** Request received:', req.method, req.originalUrl); // يمكن تفعيل هذا للتتبع
    // if (req.body && Object.keys(req.body).length > 0) {
    //     console.log('*** Parsed Request Body:', req.body);
    // } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    //     console.log('*** Empty Request Body for:', req.originalUrl);
    // }
    next();
});

// --- IMPORTANT: Define ALL API Routes FIRST ---
// ✅ تم تمرير axios ومتغيرات Paymob إلى orderRoutes
const orderRoutes = require('./routes/orderRoutes')({ axios, PAYMOB_API_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_ID_CARD, PAYMOB_MERCHANT_ID, PAYMOB_IFRAME_ID, nodemailerTransporter: transporter }); // Pass transporter to orderRoutes

// Apply auth middleware to routes that may need user info (even if optional for some routes)
app.use('/api/products', auth, productRoutes);
app.use('/api/cart', auth, cartRoutes);
app.use('/api/orders', auth, orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reviews', auth, reviewRoutes);
app.use('/api/wishlist', auth, wishlistRoutes);
app.use('/api/categories', auth, categoryRoutes);
app.use('/api/users', auth, userRoutes);
app.use('/api/notifications', auth, notificationRoutes);
app.use('/api/coupons', auth, couponRoutes);
// ✅ NEW: Use productCollectionRoutes
app.use('/api/product-collections', auth, productCollectionRoutes);

// ✅ NEW: مسار نموذج الاتصال (Contact Form Route)
app.use('/api/contact', contactRoutes({ nodemailerTransporter: transporter, ADMIN_EMAIL })); // Pass transporter and ADMIN_EMAIL

// Public API routes (no auth required for display)
app.use('/api/hero-slides', publicHeroSlideRoutes);
app.use('/api/promo-slides', publicPromoSlideRoutes);
app.use('/api/gallery-images', publicGalleryImageRoutes);
// مسارات Admin API التي تستقبل رفع الملفات
// ✅ هذا هو المكان الذي يتم فيه تطبيق Multer middleware
app.use('/api/admin', adminAuth, (req, res, next) => {
    console.log('Multer Middleware: Applying upload.fields for /api/admin route.');
    const fieldsToUpload = [
        { name: 'mainImage', maxCount: 1 },
        { name: 'additionalImages', maxCount: 10 },
        { name: 'categoryImage', maxCount: 1 },
        { name: 'heroSlideImage', maxCount: 1 },
        { name: 'promoSlideImage', maxCount: 1 },
        { name: 'galleryImage', maxCount: 1 },
    ];

    // ✅ NEW: Dynamically add fields for variant images (assuming a max number for robustness)
    for (let g = 0; g < 5; g++) { // Max 5 variant groups
        for (let o = 0; o < 10; o++) { // Max 10 options per group
            fieldsToUpload.push({ name: `variantImage_${g}_${o}`, maxCount: 1 });
        }
    }

    upload.fields(fieldsToUpload)(req, res, (err) => {
        if (err) {
            console.error('Multer Middleware: Error during upload processing:', err);
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: 'File upload error: ' + err.message });
            } else {
                return res.status(500).json({ message: 'An unknown file upload error occurred: ' + err.message });
            }
        }
        console.log('Multer Middleware: File upload processed. Proceeding to adminApiRoutes.');
        next();
    });
}, adminApiRoutes);


// --- Admin Panel HTML Page Routes ---
app.use('/admin', adminRoutes);

// --- Serve static files from the 'public' directory ---
app.use(express.static('public'));

// Example API endpoint for testing
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

// ✅ NEW: Cron job for Abandoned Carts
async function processAbandonedCarts() {
    console.log('Cron Job: Running abandoned cart check...');
    const ABANDONED_CART_THRESHOLD_HOURS = parseInt(process.env.ABANDONED_CART_THRESHOLD_HOURS || 24);
    const ABANDONED_CART_REMINDER_SENT_THRESHOLD_HOURS = parseInt(process.env.ABANDONED_CART_REMINDER_SENT_THRESHOLD_HOURS || 48);

    try {
        const thresholdDate = new Date(Date.now() - ABANDONED_CART_THRESHOLD_HOURS * 60 * 60 * 1000);
        const resendThresholdDate = new Date(Date.now() - ABANDONED_CART_REMINDER_SENT_THRESHOLD_HOURS * 60 * 60 * 1000);

        const abandonedCarts = await Cart.find({
            userId: { $exists: true },
            items: { $ne: [] },
            lastActivityAt: { $lt: thresholdDate },
            $or: [
                { isAbandonedReminderSent: { $exists: false } },
                { isAbandonedReminderSent: false },
                { 'reminderSentAt': { $lt: resendThresholdDate } }
            ]
        }).populate('userId', 'email name');

        if (abandonedCarts.length > 0) {
            console.log(`Cron Job: Found ${abandonedCarts.length} abandoned carts.`);
            for (const cart of abandonedCarts) {
                if (cart.items.length > 0 && cart.userId && cart.userId.email) {
                    console.log(`Cron Job: Processing abandoned cart for user ${cart.userId.email}`);
                    
                    let totalCartAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    let mailOptions = {
                        from: process.env.SENDER_EMAIL,
                        to: cart.userId.email,
                        subject: `Don't Miss Out! Your Cart Awaits You at The Light & Wire Store`,
                        html: `
                            <h1>Hi ${cart.userId.name || cart.userId.email.split('@')[0]},</h1>
                            <p>It looks like you left some items in your cart at The Light & Wire Store. Don't miss out on these great products!</p>
                            <p>Here's what's waiting for you:</p>
                            <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
                                <thead>
                                    <tr style="background-color: #f2f2f2;">
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Quantity</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${cart.items.map(item => `
                                        <tr>
                                            <td style="padding: 8px; border: 1px solid #ddd;">
                                                ${item.name}
                                                ${item.selectedVariants && item.selectedVariants.length > 0 ? `(${item.selectedVariants.map(v => `${v.name}: ${v.value}`).join(', ')})` : ''}
                                            </td>
                                            <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
                                            <td style="padding: 8px; border: 1px solid #ddd;">${item.price.toFixed(2)} EGP</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            <p style="margin-top: 20px;">Total: <strong>${totalCartAmount.toFixed(2)} EGP</strong></p>
                            <p style="margin-top: 20px;">Click here to complete your purchase:</p>
                            <a href="${APP_URL}/cart.html" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Go to My Cart</a>
                            <p style="margin-top: 20px;">Best regards,<br>The Light & Wire Store Team</p>
                        `
                    };

                    try {
                        await transporter.sendMail(mailOptions);
                        console.log(`Cron Job: Sent abandoned cart email to ${cart.userId.email}`);
                        cart.isAbandonedReminderSent = true;
                        cart.reminderSentAt = Date.now();
                        await cart.save();
                        console.log(`Cron Job: Abandoned cart reminder marked as sent for user ${cart.userId.email}.`);
                    } catch (emailErr) {
                        console.error('Cron Job: Error sending abandoned cart email:', emailErr);
                    }
                }
            }
        } else {
            console.log("Cron Job: No abandoned carts found within threshold.");
        }
    } catch (error) {
        console.error('Cron Job: Error processing abandoned carts:', error);
    }
}

function startAbandonedCartJob() {
    cron.schedule('0 */6 * * *', async () => {
        console.log('Cron Job: Scheduled abandoned cart check initiated.');
        await processAbandonedCarts();
    });
    console.log('Cron Job: Abandoned cart reminder job scheduled.');
}


// --- Handle 404 Not Found for any other requests (Fallback) ---
app.use((err, req, res, next) => {
    console.error('Global Error Handler: Detected an error!', err);
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof multer.MulterError) {
        console.error('Global Error Handler: Multer Error caught:', err.message);
        return res.status(400).json({ message: 'File upload error: ' + err.message });
    } else if (err.message === 'File too large') {
        console.error('Global Error Handler: File too large error caught.');
        return res.status(413).json({ message: 'File too large.' });
    } else if (err) {
        console.error('Global Error Handler: General Error caught:', err.message);
        return res.status(500).json({ message: 'Internal server error: ' + err.message });
    }
    next();
});

app.use((req, res, next) => {
    res.status(404).send('Sorry, can\'t find that!');
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
// --- End of server.js ---