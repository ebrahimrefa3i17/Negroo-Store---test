const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const HeroSlide = require('../models/HeroSlide');
const PromoSlide = require('../models/PromoSlide');
const GalleryImage = require('../models/GalleryImage');
const { auth, adminAuth } = require('../middleware/authMiddleware');
const axios = require('axios');
const mongoose = require('mongoose');

console.log('Admin API Routes: Module started loading.');

const PYTHON_ML_SERVICE_URL = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:5000';

async function sendLowStockNotification(product) {
    const notificationMessage = `Product "${product.name}" is low in stock! Current stock: ${product.stock}. Threshold: ${product.minStockThreshold}.`;
    const notificationLink = `/admin/products/edit/${product._id}`;
    const notificationType = 'low_stock_alert';

    const admins = await User.find({ isAdmin: true }).select('_id');

    for (const admin of admins) {
        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        if (!product.lastLowStockNotification || product.lastLowStockNotification < twentyFourHoursAgo) {
            const newNotification = new Notification({
                userId: admin._id,
                message: notificationMessage,
                type: notificationType,
                link: notificationLink
            });
            await newNotification.save();
            console.log(`Low stock notification sent for product ${product.name} to admin ${admin._id}.`);
        } else {
            console.log(`Low stock notification for product ${product.name} skipped (sent recently).`);
        }
    }
    product.lastLowStockNotification = new Date();
    await product.save();
}

async function generateAndSaveImageEmbedding(productId, imageUrlOnNodeServer) {
    if (!imageUrlOnNodeServer) {
        console.warn(`Embedding generation skipped for product ${productId}: No image URL provided.`);
        return;
    }

    try {
        const fullImageUrl = `http://localhost:3000${imageUrlOnNodeServer}`;

        console.log(`Sending image URL to ML service for embedding: ${fullImageUrl}`);

        const mlResponse = await axios.post(`${PYTHON_ML_SERVICE_URL}/generate-embedding`, {
            imageUrl: fullImageUrl
        });

        const { embedding } = mlResponse.data;

        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
            await Product.findByIdAndUpdate(productId, { imageEmbedding: embedding });
            console.log(`Image embedding saved for product ${productId}.`);
        } else {
            console.warn(`ML service returned empty or invalid embedding for product ${productId}.`);
        }
    } catch (error) {
        console.error(`Error generating or saving embedding for product ${productId}:`, error.response ? error.response.data : error.message);
    }
}


// API لجلب إحصائيات لوحة التحكم
router.get('/dashboard-stats', adminAuth, async (req, res) => {
    console.log('GET /dashboard-stats: Request received.');
    try {
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const pendingOrdersCount = await Order.countDocuments({ status: 'Pending' });
        const deliveredOrdersCount = await Order.countDocuments({ status: 'Delivered' });
        const deliveredOrders = await Order.find({ status: 'Delivered' }).select('totalAmount');
        const totalDeliveredAmount = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        const actualLowStockProducts = await Product.aggregate([
            { $match: { $expr: { $lte: ["$stock", "$minStockThreshold"] } } }
        ]);
        const finalLowStockCount = actualLowStockProducts.length;

        res.json({
            productCount,
            orderCount,
            pendingOrdersCount,
            deliveredOrdersCount,
            totalDeliveredAmount,
            lowStockProductCount: finalLowStockCount
        });
        console.log('GET /dashboard-stats: Response sent.');
    } catch (error) {
        console.error('Error fetching admin dashboard stats API:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard statistics due to a server error.' });
    }
});


// --- User Management APIs ---
router.get('/users', adminAuth, async (req, res) => {
    console.log('GET /admin/users: Request received.');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    try {
        console.log('GET /admin/users: Querying DB with:', { page, limit, sortBy, sortOrder });
        const users = await User.find()
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .select('-password -__v');

        const totalUsers = await User.countDocuments();
        console.log('GET /admin/users: Users found:', users.length, 'Total:', totalUsers);

        res.json({
            users,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalItems: totalUsers
        });
        console.log('GET /admin/users: Response sent.');
    } catch (err) {
        console.error('Error fetching admin users API:', err);
        res.status(500).json({ message: 'Failed to retrieve user list due to a server error.' });
    }
});

router.get('/users/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/users/:id: Request received.');
    try {
        console.log('GET /admin/users/:id: Attempting to find user by ID:', req.params.id);
        const user = await User.findById(req.params.id).select('-password -__v');
        if (!user) {
            console.warn('GET /admin/users/:id: User not found for ID:', req.params.id);
            return res.status(404).json({ message: 'User not found.' });
        }
        console.log('GET /admin/users/:id: User found:', user._id);
        res.json(user);
        console.log('GET /admin/users/:id: Response sent.');
    } catch (err) {
        console.error('Error fetching single user for admin API:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid User ID format. Please check the ID.' });
        }
        res.status(500).json({ message: 'Failed to retrieve user details due to a server error.' });
    }
});

router.put('/users/:id', adminAuth, async (req, res) => {
    console.log('PUT /admin/users/:id: Request received.');
    const { name, email, isAdmin } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (isAdmin !== undefined) {
            if (req.user.id.toString() === req.params.id && req.user.isAdmin === true && isAdmin === false) {
                return res.status(403).json({ message: 'Admins cannot remove their own admin status through this panel.' });
            }
            user.isAdmin = isAdmin;
        }

        const updatedUser = await user.save();
        res.json({ message: 'User updated successfully!', user: updatedUser });
        console.log('PUT /admin/users/:id: Response sent.');
    } catch (err) {
        console.error('Error updating user API:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        } else if (err.code === 11000) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }
        res.status(500).json({ message: 'Failed to update user due to a server error.' });
    }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/users/:id: Request received.');
    try {
        const userToDelete = await User.findById(req.params.id);
        if (!userToDelete) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (req.user.id.toString() === req.params.id && req.user.isAdmin === true) {
            return res.status(403).json({ message: 'Admins cannot delete their own account through this panel.' });
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User deleted successfully!' });
        console.log('DELETE /admin/users/:id: Response sent.');
    } catch (err) {
        console.error('Error deleting user:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid User ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete user due to a server error.' });
    }
});


// --- Product Management APIs ---
router.get('/products', adminAuth, async (req, res) => {
    console.log('GET /admin/products: Request received.');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    try {
        console.log('GET /admin/products: Querying DB with:', { page, limit, sortBy, sortOrder });
        const products = await Product.find()
            .populate('category', 'name') // ✅ MODIFIED: Populate category name for display
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .select('-__v');

        const totalProducts = await Product.countDocuments();
        console.log('GET /admin/products: Products found:', products.length, 'Total:', totalProducts);

        res.json({
            products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalItems: totalProducts
        });
        console.log('GET /admin/products: Response sent.');
    } catch (err) {
        console.error('Error fetching admin products API:', err);
        res.status(500).json({ message: 'Failed to retrieve product list due to a server error.' });
    }
});
router.get('/products/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/products/:id: Request received.');
    try {
        console.log('GET /admin/products/:id: Attempting to find product by ID:', req.params.id);
        const product = await Product.findById(req.params.id)
            .populate('category', 'name') // ✅ Added populate to get category name
            .select('-__v');

        if (!product) {
            console.warn('GET /admin/products/:id: Product not found for ID:', req.params.id);
            return res.status(404).json({ message: 'Product not found.' });
        }
        console.log('GET /admin/products/:id: Product found:', product._id);
        res.json(product);
        console.log('GET /admin/products/:id: Response sent.');
    } catch (err) {
        console.error('Error fetching single product for admin API:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format. Please check the ID.' });
        }
        res.status(500).json({ message: 'Failed to retrieve product details due to a server error.' });
    }
});

// ✅ MODIFIED: PUT update an existing product (admin only) - Added stock check and notification, and VARIANTS and FLASH SALE
router.put('/products/:id', adminAuth, async (req, res) => {
    console.log('PUT /admin/products/:id: Request received to update product.');
    try {
        const { name, description, price, category, stock, specifications, shippingAndReturns, minStockThreshold, variantsData, isOnFlashSale, flashSalePrice, flashSaleEndDate } = req.body;
        const productId = req.params.id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Store old stock and threshold for comparison
        const oldStock = product.stock;
        const oldMinStockThreshold = product.minStockThreshold;

        // تحديث الحقول النصية
        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (price !== undefined) {
            if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
                return res.status(400).json({ message: 'Price must be a non-negative number.' });
            }
            product.price = parseFloat(price);
        }
        // ✅ MODIFIED: Use category ID directly as it's sent from frontend now
        if (category !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(category)) { // Validate if it's a valid ObjectId
                return res.status(400).json({ message: 'Invalid Category ID format.' });
            }
            product.category = category; // Save category ObjectId directly
        }
        if (stock !== undefined) {
            if (isNaN(parseInt(stock)) || parseInt(stock) < 0) {
                return res.status(400).json({ message: 'Stock must be a non-negative integer.' });
            }
            product.stock = parseInt(stock);
        }
        // ✅ Update minStockThreshold if provided
        if (minStockThreshold !== undefined) {
            if (isNaN(parseInt(minStockThreshold)) || parseInt(minStockThreshold) < 0) {
                return res.status(400).json({ message: 'Minimum stock threshold must be a non-negative integer.' });
            }
            product.minStockThreshold = parseInt(minStockThreshold);
        }

        if (specifications !== undefined) product.specifications = specifications;
        if (shippingAndReturns !== undefined) product.shippingAndReturns = shippingAndReturns;

        let mainImageUpdated = false;
        // معالجة mainImage الجديدة (إذا تم رفع ملف جديد)
        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['mainImage'] && req.files['mainImage'].length > 0) {
            product.imageUrl = `/uploads/products/${req.files['mainImage'][0].filename}`;
            console.log('Product update: New main image URL set to:', product.imageUrl);
            mainImageUpdated = true;
        }

        // معالجة additionalImages الجديدة (إذا تم رفع ملفات جديدة، فاستبدلها بالكامل)
        if (req.files && req.files['additionalImages'] && req.files['additionalImages'].length > 0) {
            const newAdditionalImageUrls = [];
            req.files['additionalImages'].forEach(file => {
                newAdditionalImageUrls.push(`/uploads/products/${file.filename}`);
            });
            product.imageUrls = newAdditionalImageUrls;
            console.log('Product update: New additional image URLs set to:', product.imageUrls);
        }

        // ✅ NEW: Handle Product Variants
        if (variantsData) {
            try {
                const parsedVariants = JSON.parse(variantsData);
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ message: 'Variants data must be a JSON array.' });
                }

                const processedVariants = parsedVariants.map((group, groupIndex) => {
                    if (!group.name || !Array.isArray(group.options)) {
                        throw new Error('Invalid variant group structure.');
                    }
                    const options = group.options.map((option, optionIndex) => {
                        if (!option.value || option.stock === undefined || isNaN(parseInt(option.stock)) || parseInt(option.stock) < 0) {
                             throw new Error('Invalid variant option structure or missing stock.');
                        }
                        const variantOption = {
                            value: option.value,
                            priceAdjustment: isNaN(parseFloat(option.priceAdjustment)) ? 0 : parseFloat(option.priceAdjustment),
                            stock: parseInt(option.stock),
                            imageUrl: option.imageUrl || '' // Use existing URL or default
                        };

                        // Check for new variant image uploads for this option
                        const variantImageFieldName = `variantImage_${groupIndex}_${optionIndex}`;
                        if (req.files && req.files[variantImageFieldName] && req.files[variantImageFieldName].length > 0) {
                            // Corrected syntax for template literal
                            variantOption.imageUrl = `/uploads/products/variants/${req.files[variantImageFieldName][0].filename}`;
                            console.log(`Product update: New variant image URL set for variant ${group.name}:${option.value} to:`, variantOption.imageUrl);
                        }
                        return variantOption;
                    });
                    return { name: group.name, options };
                });
                product.variants = processedVariants;
                console.log('Product update: Variants data processed successfully.');
            } catch (jsonError) {
                console.error('Error parsing or processing variantsData:', jsonError);
                return res.status(400).json({ message: 'Invalid variants data format.' });
            }
        } else {
            product.variants = []; // Clear variants if no data is sent
        }

        // ✅ NEW: Handle Flash Sale fields
        product.isOnFlashSale = (isOnFlashSale === 'true'); // Convert string to boolean
        if (product.isOnFlashSale) {
            if (flashSalePrice !== undefined) {
                const parsedFlashSalePrice = parseFloat(flashSalePrice);
                if (isNaN(parsedFlashSalePrice) || parsedFlashSalePrice < 0) {
                    return res.status(400).json({ message: 'Flash sale price must be a non-negative number.' });
                }
                if (parsedFlashSalePrice >= product.price) {
                     return res.status(400).json({ message: 'Flash sale price must be less than the original price.' });
                }
                product.flashSalePrice = parsedFlashSalePrice;
            } else {
                return res.status(400).json({ message: 'Flash sale price is required when isOnFlashSale is true.' });
            }

            if (flashSaleEndDate) {
                const parsedDate = new Date(flashSaleEndDate);
                if (isNaN(parsedDate.getTime())) { // Check for invalid date
                    return res.status(400).json({ message: 'Invalid flash sale end date format.' });
                }
                if (parsedDate < new Date()) {
                    return res.status(400).json({ message: 'Flash sale end date must be in the future.' });
                }
                product.flashSaleEndDate = parsedDate;
            } else {
                return res.status(400).json({ message: 'Flash sale end date is required when isOnFlashSale is true.' });
            }
        } else {
            // If not on flash sale, reset flash sale fields
            product.flashSalePrice = null;
            product.flashSaleEndDate = null;
        }


        const updatedProduct = await product.save();
        console.log('PUT /admin/products/:id: Product updated successfully!', updatedProduct._id);

        // ✅ NEW INTEGRATION: Generate and save image embedding if main image was updated
        if (mainImageUpdated && updatedProduct.imageUrl) {
            await generateAndSaveImageEmbedding(updatedProduct._id, updatedProduct.imageUrl);
        }

        // ✅ NEW: Check for low stock and send notification AFTER saving
        // Trigger notification only if stock changed and is now below threshold
        // Or if threshold itself changed and product is now below new threshold
        // Note: Global stock check might become less relevant with variant stocks.
        // For now, this still checks the main product stock field.
        if (
            (updatedProduct.stock <= updatedProduct.minStockThreshold && oldStock > updatedProduct.stock) || // Stock decreased and is now low
            (updatedProduct.stock <= updatedProduct.minStockThreshold && oldMinStockThreshold !== updatedProduct.minStockThreshold) // Threshold changed and product is now low
        ) {
            await sendLowStockNotification(updatedProduct);
        }
        // If stock goes from low to above threshold, clear last notification timestamp
        if (updatedProduct.stock > updatedProduct.minStockThreshold && updatedProduct.lastLowStockNotification) {
            updatedProduct.lastLowStockNotification = null;
            await updatedProduct.save(); // Save again to clear timestamp
        }

        res.json({ message: 'Product updated successfully!', product: updatedProduct });
    } catch (err) {
        console.error('Error updating product API (Caught):', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update product due to a server error.' });
    }
});

// ✅ MODIFIED: POST create a new product (admin only) - Added minStockThreshold and VARIANTS and FLASH SALE
router.post('/products', adminAuth, async (req, res) => {
    console.log('POST /admin/products: Request received to create product.');
    try {
        const { name, description, price, category, stock, specifications, shippingAndReturns, minStockThreshold, variantsData, isOnFlashSale, flashSalePrice, flashSaleEndDate } = req.body;

        // التحقق من الحقول المطلوبة
        if (!name || !description || !price || !category || stock === undefined || stock === null) {
            return res.status(400).json({ message: 'Missing required product fields: name, description, price, category, stock.' });
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            return res.status(400).json({ message: 'Price must be a non-negative number.' });
        }
        if (isNaN(parseInt(stock)) || parseInt(stock) < 0) {
            return res.status(400).json({ message: 'Stock must be a non-negative integer.' });
        }
        // ✅ Validate minStockThreshold if provided
        if (minStockThreshold !== undefined && (isNaN(parseInt(minStockThreshold)) || parseInt(minStockThreshold) < 0)) {
            return res.status(400).json({ message: 'Minimum stock threshold must be a non-negative integer.' });
        }

        // ✅ MODIFIED: Use category ID directly as it's sent from frontend now
        if (!mongoose.Types.ObjectId.isValid(category)) { // Validate if it's a valid ObjectId
            return res.status(400).json({ message: 'Invalid Category ID format.' });
        }
        const categoryId = category; // Use category ObjectId directly

        let imageUrl = '';
        const imageUrls = [];
        const productVariants = []; // To store processed variants

        // معالجة mainImage (يجب أن يكون ملفًا واحدًا)
        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['mainImage'] && req.files['mainImage'].length > 0) {
            imageUrl = `/uploads/products/${req.files['mainImage'][0].filename}`;
            console.log('Product creation: Main image URL set to:', imageUrl);
        } else {
            return res.status(400).json({ message: 'Main product image is required.' });
        }

        // معالجة additionalImages (قد تكون ملفات متعددة)
        if (req.files && req.files['additionalImages'] && req.files['additionalImages'].length > 0) {
            req.files['additionalImages'].forEach(file => {
                imageUrls.push(`/uploads/products/${file.filename}`);
            });
            console.log('Product creation: Additional image URLs added:', imageUrls);
        }

        // ✅ NEW: Handle Product Variants
        if (variantsData) {
            try {
                const parsedVariants = JSON.parse(variantsData);
                if (!Array.isArray(parsedVariants)) {
                    return res.status(400).json({ message: 'Variants data must be a JSON array.' });
                }

                parsedVariants.forEach((group, groupIndex) => {
                    if (!group.name || !Array.isArray(group.options)) {
                        throw new Error('Invalid variant group structure.');
                    }
                    const options = group.options.map((option, optionIndex) => {
                        if (!option.value || option.stock === undefined || isNaN(parseInt(option.stock)) || parseInt(option.stock) < 0) {
                            throw new Error('Invalid variant option structure or missing stock.');
                        }
                        const variantOption = {
                            value: option.value,
                            priceAdjustment: isNaN(parseFloat(option.priceAdjustment)) ? 0 : parseFloat(option.priceAdjustment),
                            stock: parseInt(option.stock),
                            imageUrl: option.imageUrl || '' // Use existing URL or default
                        };

                        // Check for new variant image uploads for this option
                        const variantImageFieldName = `variantImage_${groupIndex}_${optionIndex}`;
                        if (req.files && req.files[variantImageFieldName] && req.files[variantImageFieldName].length > 0) {
                            // Corrected syntax for accessing file from req.files
                            variantOption.imageUrl = `/uploads/products/variants/${req.files[variantImageFieldName][0].filename}`;
                            console.log(`Product creation: New variant image URL set for variant ${group.name}:${option.value} to:`, variantOption.imageUrl);
                        }
                        return variantOption;
                    });
                    productVariants.push({ name: group.name, options });
                });
                console.log('Product creation: Variants data processed successfully.');
            } catch (jsonError) {
                console.error('Error parsing or processing variantsData:', jsonError);
                return res.status(400).json({ message: 'Invalid variants data format.' });
            }
        }

        // ✅ NEW: Handle Flash Sale fields for new product
        let isProductOnFlashSale = (isOnFlashSale === 'true');
        let productFlashSalePrice = null;
        let productFlashSaleEndDate = null;

        if (isProductOnFlashSale) {
            if (flashSalePrice !== undefined) {
                const parsedFlashSalePrice = parseFloat(flashSalePrice);
                if (isNaN(parsedFlashSalePrice) || parsedFlashSalePrice < 0) {
                    return res.status(400).json({ message: 'Flash sale price must be a non-negative number.' });
                }
                if (parsedFlashSalePrice >= parseFloat(price)) { // Compare with original price
                     return res.status(400).json({ message: 'Flash sale price must be less than the original price.' });
                }
                productFlashSalePrice = parsedFlashSalePrice;
            } else {
                return res.status(400).json({ message: 'Flash sale price is required when isOnFlashSale is true.' });
            }

            if (flashSaleEndDate) {
                const parsedDate = new Date(flashSaleEndDate);
                if (isNaN(parsedDate.getTime())) {
                    return res.status(400).json({ message: 'Invalid flash sale end date format.' });
                }
                if (parsedDate < new Date()) {
                    return res.status(400).json({ message: 'Flash sale end date must be in the future.' });
                }
                productFlashSaleEndDate = parsedDate;
            } else {
                return res.status(400).json({ message: 'Flash sale end date is required when isOnFlashSale is true.' });
            }
        }


        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            imageUrl,
            imageUrls, // Save additional images/videos URLs
            category: categoryId, // ✅ Use category ObjectId
            stock: parseInt(stock),
            minStockThreshold: minStockThreshold !== undefined ? parseInt(minStockThreshold) : 10, // ✅ Set minStockThreshold
            specifications: specifications || 'No specifications available.',
            shippingAndReturns: shippingAndReturns || 'Standard shipping within 3-5 business days. Easy returns within 30 days of purchase.',
            variants: productVariants, // ✅ Assign processed variants
            isOnFlashSale: isProductOnFlashSale, // ✅ NEW: Assign flash sale status
            flashSalePrice: productFlashSalePrice, // ✅ NEW: Assign flash sale price
            flashSaleEndDate: productFlashSaleEndDate // ✅ NEW: Assign flash sale end date
        });

        const savedProduct = await newProduct.save();
        console.log('POST /admin/products: Product created successfully!', savedProduct._id);

        // ✅ NEW INTEGRATION: Generate and save image embedding after product creation
        if (savedProduct.imageUrl) {
            await generateAndSaveImageEmbedding(savedProduct._id, savedProduct.imageUrl);
        }

        // ✅ NEW: Check for low stock and send notification after creating
        if (savedProduct.stock <= savedProduct.minStockThreshold) {
            await sendLowStockNotification(savedProduct);
        }

        res.status(201).json({ message: 'Product added successfully!', product: savedProduct });
    } catch (err) {
        console.error('Error creating product API (Caught):', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to add product due to a server error.' });
    }
});


router.delete('/products/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/products/:id: Request received.');
    try {
        const productToDelete = await Product.findById(req.params.id);
        if (!productToDelete) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        await Product.deleteOne({ _id: req.params.id });
        res.json({ message: 'Product deleted successfully!' });
        console.log('DELETE /admin/products/:id: Response sent.');
    } catch (err) {
        console.error('Error deleting product:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete product due to a server error.' });
    }
});


// ✅ NEW: GET endpoint for low stock products (admin only)
router.get('/stock-alerts', adminAuth, async (req, res) => {
    console.log('GET /admin/stock-alerts: Request received.');
    try {
        // Find products where stock is less than or equal to minStockThreshold
        const lowStockProducts = await Product.aggregate([
            {
                $match: {
                    $expr: { $lte: ["$stock", "$minStockThreshold"] }
                }
            },
            {
                $project: {
                    name: 1,
                    stock: 1,
                    minStockThreshold: 1,
                    imageUrl: 1,
                    lastLowStockNotification: 1
                }
            },
            {
                $sort: { stock: 1 } // Sort by lowest stock first
            }
        ]);

        console.log('GET /admin/stock-alerts: Found low stock products:', lowStockProducts.length);
        res.json(lowStockProducts);
    } catch (err) {
        console.error('Error fetching low stock alerts:', err);
        res.status(500).json({ message: 'Failed to retrieve low stock alerts due to a server error.' });
    }
});


// --- Order Management APIs ---
router.get('/orders', adminAuth, async (req, res) => {
    console.log('GET /admin/orders: Request received.');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    try {
        console.log('GET /admin/orders: Querying DB with:', { page, limit, sortBy, sortOrder });
        const orders = await Order.find()
            .populate('userId', 'name email')
            // ✅ MODIFIED: Populate product details and variant info if available
            .populate({
                path: 'items.productId',
                select: 'name imageUrl variants' // Include variants
            })
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments();
        console.log('GET /admin/orders: Orders found:', orders.length, 'Total:', totalOrders);

        res.json({
            orders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            totalItems: totalOrders
        });
        console.log('GET /admin/orders: Response sent.');
    } catch (err) {
        console.error('Error fetching admin orders API:', err);
        res.status(500).json({ message: 'Failed to retrieve orders due to a server error.' });
    }
});

router.get('/orders/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/orders/:id: Request received.');
    try {
        console.log('GET /admin/orders/:id: Attempting to find order by ID:', req.params.id);
        const order = await Order.findById(req.params.id)
            .populate('userId', 'name email')
            // ✅ MODIFIED: Populate product details and variant info if available
            .populate({
                path: 'items.productId',
                select: 'name imageUrl variants' // Include variants
            });

        if (!order) {
            console.warn('GET /admin/orders/:id: Order not found for ID:', req.params.id);
            return res.status(404).json({ message: 'Order not found.' });
        }
        console.log('GET /admin/orders/:id: Order found:', order._id);
        res.json(order);
        console.log('GET /admin/orders/:id: Response sent.');
    } catch (err) {
        console.error('Error fetching single order for admin API:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Order ID format for status update.' });
        }
        res.status(500).json({ message: 'Failed to retrieve order details due to a server error.' });
    }
});


// ✅ تعديل: PUT Update order status (for admin) - لإرسال إشعار عند الشحن
router.put('/orders/:id/status', adminAuth, async (req, res) => {
    console.log('adminApiRoutes.js: PUT /orders/:id/status route HIT!');
    const { status } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            console.warn('adminApiRoutes.js: Order not found for status update:', req.params.id);
            return res.status(404).json({ message: 'Order not found.' });
        }
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            console.warn('adminApiRoutes.js: Invalid status provided:', status);
            return res.status(400).json({ message: 'Invalid status provided. Valid statuses are: ' + validStatuses.join(', ') + '.' });
        }

        const oldStatus = order.status;

        if (oldStatus !== 'Cancelled' && status === 'Cancelled') {
            for (const item of order.items) {
                // ✅ MODIFIED: Restore stock for correct variant if applicable, else for main product
                const product = await Product.findById(item.productId);
                if (product) {
                    let stockUpdated = false;
                    if (item.selectedVariant && product.variants && product.variants.length > 0) {
                        for (const variantGroup of product.variants) {
                            const variantOption = variantGroup.options.find(opt =>
                                opt.value === item.selectedVariant.optionValue && variantGroup.name === item.selectedVariant.groupName
                            );
                            if (variantOption) {
                                variantOption.stock += item.quantity;
                                stockUpdated = true;
                                break;
                            }
                        }
                    }
                    if (!stockUpdated) { // If no variant or variant not found, restore to main product stock
                        product.stock += item.quantity;
                    }
                    await product.save();
                    console.log(`adminApiRoutes.js: Stock restored for product ${product.name} (variant: ${item.selectedVariant ? item.selectedVariant.optionValue : 'N/A'}) due to status change to Cancelled.`);
                }
            }
        }
        if (oldStatus === 'Cancelled' && status !== 'Cancelled') {
             for (const item of order.items) {
                // ✅ MODIFIED: Deduct stock for correct variant if applicable, else for main product
                const product = await Product.findById(item.productId);
                if (product) {
                    let stockUpdated = false;
                    if (item.selectedVariant && product.variants && product.variants.length > 0) {
                        for (const variantGroup of product.variants) {
                            const variantOption = variantGroup.options.find(opt =>
                                opt.value === item.selectedVariant.optionValue && variantGroup.name === item.selectedVariant.groupName
                            );
                            if (variantOption) {
                                if (variantOption.stock < item.quantity) {
                                    return res.status(400).json({ message: `Cannot change status from Cancelled to ${status}. Not enough stock for product "${product.name}" (Variant: ${item.selectedVariant.optionValue}). Available: ${variantOption.stock}, Requested: ${item.quantity}.` });
                                }
                                variantOption.stock -= item.quantity;
                                stockUpdated = true;
                                break;
                            }
                        }
                    }
                    if (!stockUpdated) { // If no variant or variant not found, deduct from main product stock
                        if (product.stock < item.quantity) {
                            return res.status(400).json({ message: `Cannot change status from Cancelled to ${status}. Not enough stock for product "${product.name}". Available: ${product.stock}, Ordered: ${item.quantity}.` });
                        }
                        product.stock -= item.quantity;
                    }
                    await product.save();
                    console.log(`adminApiRoutes.js: Stock reduced for product ${product.name} (variant: ${item.selectedVariant ? item.selectedVariant.optionValue : 'N/A'}) due to status change from Cancelled.`);
                }
            }
        }

        order.status = status;
        await order.save();
        console.log(`adminApiRoutes.js: Order ${order._id} status updated from ${oldStatus} to ${status}.`);

        if (status === 'Shipped' && oldStatus !== 'Shipped') {
            console.log('adminApiRoutes.js: Status changed to Shipped, attempting to create notification.');
            try {
                if (!order.userId) {
                    console.error('adminApiRoutes.js: Order has no associated userId for notification:', order._id);
                } else {
                    const notification = new Notification({
                        userId: order.userId,
                        message: `Your order #${order._id.toString().substring(0, 8)} has been shipped!`,
                        type: 'order_update',
                        link: `/my-orders.html?orderId=${order._id}`
                    });
                    await notification.save();
                    console.log(`adminApiRoutes.js: Notification created for user ${order.userId} for order ${order._id} being shipped.`);
                }
            } catch (notificationError) {
                console.error('adminApiRoutes.js: Error creating notification for shipped order:', notificationError);
            }
        }

        res.json({ message: 'Order status updated successfully!', order });
    } catch (err) {
        console.error('adminApiRoutes.js: Error updating order status API (Caught):', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Order ID format for status update.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error updating status: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update order status due to a server error.' });
    }
});


// --- Category Management APIs (Admin Only) ---
router.get('/categories', adminAuth, async (req, res) => {
    console.log('GET /admin/categories: Request received.');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    try {
        console.log('GET /admin/categories: Querying DB with:', { page, limit, sortBy, sortOrder });
        const categories = await Category.find()
            .populate('parentCategory', 'name')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .select('-__v');

        const totalCategories = await Category.countDocuments();
        console.log('GET /admin/categories: Categories found:', categories.length, 'Total:', totalCategories);

        res.json({
            categories,
            currentPage: page,
            totalPages: Math.ceil(totalCategories / limit),
            totalItems: totalCategories
        });
        console.log('GET /admin/categories: Response sent.');
    } catch (err) {
        console.error('Error fetching admin categories API:', err);
        res.status(500).json({ message: 'Failed to retrieve category list due to a server error.' });
    }
});

router.get('/categories/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/categories/:id: Request received.');
    try {
        console.log('GET /admin/categories/:id: Attempting to find category by ID:', req.params.id);
        const category = await Category.findById(req.params.id)
            .populate('parentCategory', 'name')
            .select('-__v');

        if (!category) {
            console.warn('GET /admin/categories/:id: Category not found for ID:', req.params.id);
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.json(category);
        console.log('GET /admin/categories/:id: Response sent.');
    } catch (err) {
        console.error('Error fetching single category for admin API:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Category ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve category details due to a server error.' });
    }
});

router.post('/categories', adminAuth, async (req, res) => {
    console.log('POST /admin/categories: Request received to create category.');
    try {
        const { name, description, parentCategory, isFeatured } = req.body; // ✅ Added isFeatured

        if (!name) {
            return res.status(400).json({ message: 'Category name is required.' });
        }

        let imageUrl = 'https://via.placeholder.com/300x180?text=Category+Image';

        const upload = req.app.get('multer_upload');
        if (req.files && req.files['categoryImage'] && req.files['categoryImage'].length > 0) {
            imageUrl = `/uploads/categories/${req.files['categoryImage'][0].filename}`;
            console.log('Category creation: Image URL set to:', imageUrl);
        }

        const newCategory = new Category({
            name,
            description: description || '',
            imageUrl,
            parentCategory: parentCategory || null,
            isFeatured: isFeatured === 'true' // Convert string boolean to actual boolean
        });

        const savedCategory = await newCategory.save();
        console.log('POST /admin/categories: Category created successfully!', savedCategory._id);
        res.status(201).json({ message: 'Category added successfully!', category: savedCategory });
    } catch (err) {
        console.error('Error creating category API (Caught):', err);
        if (err.name === 'MongoServerError' && err.code === 11000) {
            return res.status(400).json({ message: 'Category with this name already exists.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to add category due to a server error.' });
    }
});

router.put('/categories/:id', adminAuth, async (req, res) => {
    console.log('PUT /admin/categories/:id: Request received to update category.');
    try {
        const { name, description, parentCategory, isFeatured } = req.body; // ✅ Added isFeatured
        const categoryId = req.params.id;

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ message: 'Category not found.' });
        }

        if (name !== undefined) category.name = name;
        if (description !== undefined) category.description = description;
        category.parentCategory = parentCategory || null;
        if (isFeatured !== undefined) category.isFeatured = (isFeatured === 'true'); // ✅ Update isFeatured

        const upload = req.app.get('multer_upload');
        if (req.files && req.files['categoryImage'] && req.files['categoryImage'].length > 0) {
            category.imageUrl = `/uploads/categories/${req.files['categoryImage'][0].filename}`;
            console.log('Category update: New image URL set to:', category.imageUrl);
        }

        const updatedCategory = await category.save();
        console.log('PUT /admin/categories/:id: Category updated successfully!', updatedCategory._id);
        res.json({ message: 'Category updated successfully!', category: updatedCategory });
    } catch (err) {
        console.error('Error updating category API (Caught):', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Category ID format.' });
        } else if (err.name === 'MongoServerError' && err.code === 11000) {
            return res.status(400).json({ message: 'Category with this name already exists.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update category due to a server error.' });
    }
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/categories/:id: Request received.');
    try {
        const categoryToDelete = await Category.findById(req.params.id);
        if (!categoryToDelete) {
            return res.status(404).json({ message: 'Category not found.' });
        }

        await Category.deleteOne({ _id: req.params.id });
        res.json({ message: 'Category deleted successfully!' });
        console.log('DELETE /admin/categories/:id: Response sent.');
    } catch (err) {
        console.error('Error deleting category:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Category ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete category due to a server error.' });
    }
});


// --- Hero Slide Management APIs (Admin Only) ---
// ✅ NEW: GET all hero slides
router.get('/hero-slides', adminAuth, async (req, res) => {
    console.log('GET /admin/hero-slides: Request received.');
    try {
        const slides = await HeroSlide.find().sort({ order: 1, createdAt: 1 });
        res.json(slides);
        console.log('GET /admin/hero-slides: Response sent with', slides.length, 'slides.');
    } catch (err) {
        console.error('Error fetching hero slides:', err);
        res.status(500).json({ message: 'Failed to retrieve hero slides due to a server error.' });
    }
});

// ✅ NEW: GET a single hero slide by ID
router.get('/hero-slides/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/hero-slides/:id: Request received.');
    try {
        const slide = await HeroSlide.findById(req.params.id);
        if (!slide) {
            return res.status(404).json({ message: 'Hero slide not found.' });
        }
        res.json(slide);
        console.log('GET /admin/hero-slides/:id: Response sent for slide', slide._id);
    }
    catch (err) {
        console.error('Error fetching single hero slide:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Hero Slide ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve hero slide due to a server error.' });
    }
});

// ✅ NEW: POST create a new hero slide
router.post('/hero-slides', adminAuth, async (req, res) => {
    console.log('POST /admin/hero-slides: Request received to create hero slide.');
    try {
        const { title, description, buttonText, buttonLink, order, isActive } = req.body;

        if (!title || !description || !buttonText || !buttonLink) {
            return res.status(400).json({ message: 'Missing required hero slide fields: title, description, buttonText, buttonLink.' });
        }

        let imageUrl = '';
        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['heroSlideImage'] && req.files['heroSlideImage'].length > 0) {
            imageUrl = `/uploads/hero-slides/${req.files['heroSlideImage'][0].filename}`;
            console.log('Hero slide creation: Image URL set to:', imageUrl);
        } else {
            return res.status(400).json({ message: 'Hero slide image is required.' });
        }

        const newSlide = new HeroSlide({
            title,
            description,
            imageUrl,
            buttonText,
            buttonLink,
            order: order !== undefined ? parseInt(order) : 0,
            isActive: isActive !== undefined ? (isActive === 'true') : true, // Convert string boolean to actual boolean
        });

        const savedSlide = await newSlide.save();
        console.log('POST /admin/hero-slides: Hero slide created successfully!', savedSlide._id);
        res.status(201).json({ message: 'Hero slide added successfully!', slide: savedSlide });
    } catch (err) {
        console.error('Error creating hero slide:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to add hero slide due to a server error.' });
    }
});

// ✅ NEW: PUT update an existing hero slide
router.put('/hero-slides/:id', adminAuth, async (req, res) => {
    console.log('PUT /admin/hero-slides/:id: Request received to update hero slide.');
    try {
        const { title, description, buttonText, buttonLink, order, isActive } = req.body;
        const slideId = req.params.id;

        const slide = await HeroSlide.findById(slideId);
        if (!slide) {
            return res.status(404).json({ message: 'Hero slide not found.' });
        }

        if (title !== undefined) slide.title = title;
        if (description !== undefined) slide.description = description;
        if (buttonText !== undefined) slide.buttonText = buttonText;
        if (buttonLink !== undefined) slide.buttonLink = buttonLink;
        if (order !== undefined) slide.order = parseInt(order);
        if (isActive !== undefined) slide.isActive = (isActive === 'true'); // Convert string boolean

        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['heroSlideImage'] && req.files['heroSlideImage'].length > 0) {
            slide.imageUrl = `/uploads/hero-slides/${req.files['heroSlideImage'][0].filename}`;
            console.log('Hero slide update: New image URL set to:', slide.imageUrl);
        }

        const updatedSlide = await slide.save();
        console.log('PUT /admin/hero-slides/:id: Hero slide updated successfully!', updatedSlide._id);
        res.json({ message: 'Hero slide updated successfully!', slide: updatedSlide });
    } catch (err) {
        console.error('Error updating hero slide:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Hero Slide ID format.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update hero slide due to a server error.' });
    }
});

// ✅ NEW: DELETE a hero slide
router.delete('/hero-slides/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/hero-slides/:id: Request received.');
    try {
        const slideToDelete = await HeroSlide.findById(req.params.id);
        if (!slideToDelete) {
            return res.status(404).json({ message: 'Hero slide not found.' });
        }

        await HeroSlide.deleteOne({ _id: req.params.id });
        res.json({ message: 'Hero slide deleted successfully!' });
        console.log('DELETE /admin/hero-slides/:id: Response sent.');
    } catch (err) {
        console.error('Error deleting hero slide:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Hero Slide ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete hero slide due to a server error.' });
    }
});

// --- Promo Slide Management APIs (Admin Only) ---
// ✅ NEW: GET all promo slides
router.get('/promo-slides', adminAuth, async (req, res) => {
    console.log('GET /admin/promo-slides: Request received.');
    try {
        const slides = await PromoSlide.find().sort({ order: 1, createdAt: 1 });
        res.json(slides);
        console.log('GET /admin/promo-slides: Response sent with', slides.length, 'slides.');
    } catch (err) {
        console.error('Error fetching promo slides:', err);
        res.status(500).json({ message: 'Failed to retrieve promo slides due to a server error.' });
    }
});

// ✅ NEW: GET a single promo slide by ID
router.get('/promo-slides/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/promo-slides/:id: Request received.');
    try {
        const slide = await PromoSlide.findById(req.params.id);
        if (!slide) {
            return res.status(404).json({ message: 'Promo slide not found.' });
        }
        res.json(slide);
        console.log('GET /admin/promo-slides/:id: Response sent for slide', slide._id);
    } catch (err) {
        console.error('Error fetching single promo slide:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Promo Slide ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve promo slide due to a server error.' });
    }
});

// ✅ NEW: POST create a new promo slide
router.post('/promo-slides', adminAuth, async (req, res) => {
    console.log('POST /admin/promo-slides: Request received to create promo slide.');
    try {
        const { title, description, buttonText, buttonLink, order, isActive } = req.body;

        if (!title || !description || !buttonText || !buttonLink) {
            return res.status(400).json({ message: 'Missing required promo slide fields: title, description, buttonText, buttonLink.' });
        }

        let imageUrl = '';
        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['promoSlideImage'] && req.files['promoSlideImage'].length > 0) {
            imageUrl = `/uploads/promo-slides/${req.files['promoSlideImage'][0].filename}`;
            console.log('Promo slide creation: Image URL set to:', imageUrl);
        } else {
            return res.status(400).json({ message: 'Promo slide image is required.' });
        }

        const newSlide = new PromoSlide({
            title,
            description,
            imageUrl,
            buttonText,
            buttonLink,
            order: order !== undefined ? parseInt(order) : 0,
            isActive: isActive !== undefined ? (isActive === 'true') : true, // Convert string boolean to actual boolean
        });

        const savedSlide = await newSlide.save();
        console.log('POST /admin/promo-slides: Promo slide created successfully!', savedSlide._id);
        res.status(201).json({ message: 'Promo slide added successfully!', slide: savedSlide });
    } catch (err) {
        console.error('Error creating promo slide:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to add promo slide due to a server error.' });
    }
});

// ✅ NEW: PUT update an existing promo slide
router.put('/promo-slides/:id', adminAuth, async (req, res) => {
    console.log('PUT /admin/promo-slides/:id: Request received to update promo slide.');
    try {
        const { title, description, buttonText, buttonLink, order, isActive } = req.body;
        const slideId = req.params.id;

        const slide = await PromoSlide.findById(slideId);
        if (!slide) {
            return res.status(404).json({ message: 'Promo slide not found.' });
        }

        if (title !== undefined) slide.title = title;
        if (description !== undefined) slide.description = description;
        if (buttonText !== undefined) slide.buttonText = buttonText;
        if (buttonLink !== undefined) slide.buttonLink = buttonLink;
        if (order !== undefined) slide.order = parseInt(order);
        if (isActive !== undefined) slide.isActive = (isActive === 'true'); // Convert string boolean

        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['promoSlideImage'] && req.files['promoSlideImage'].length > 0) {
            slide.imageUrl = `/uploads/promo-slides/${req.files['promoSlideImage'][0].filename}`;
            console.log('Promo slide update: New image URL set to:', slide.imageUrl);
        }

        const updatedSlide = await slide.save();
        console.log('PUT /admin/promo-slides/:id: Promo slide updated successfully!', updatedSlide._id);
        res.json({ message: 'Promo slide updated successfully!', slide: updatedSlide });
    } catch (err) {
        console.error('Error updating promo slide:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Promo Slide ID format.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update promo slide due to a server error.' });
    }
});

// ✅ NEW: DELETE a promo slide
router.delete('/promo-slides/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/promo-slides/:id: Request received.');
    try {
        const slideToDelete = await PromoSlide.findById(req.params.id);
        if (!slideToDelete) {
            return res.status(404).json({ message: 'Promo slide not found.' });
        }

        await PromoSlide.deleteOne({ _id: req.params.id });
        res.json({ message: 'Promo slide deleted successfully!' });
        console.log('DELETE /admin/promo-slides/:id: Response sent.');
    } catch (err) {
        console.error('Error deleting promo slide:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Promo Slide ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete promo slide due to a server error.' });
    }
});

// --- Gallery Image Management APIs (Admin Only) ---
// ✅ NEW: GET all gallery images
router.get('/gallery-images', adminAuth, async (req, res) => {
    console.log('GET /admin/gallery-images: Request received.');
    try {
        const images = await GalleryImage.find().sort({ order: 1, createdAt: 1 });
        res.json(images);
        console.log('GET /admin/gallery-images: Response sent with', images.length, 'images.');
    } catch (err) {
        console.error('Error fetching gallery images:', err);
        res.status(500).json({ message: 'Failed to retrieve gallery images due to a server error.' });
    }
});

// ✅ NEW: GET a single gallery image by ID
router.get('/gallery-images/:id', adminAuth, async (req, res) => {
    console.log('GET /admin/gallery-images/:id: Request received.');
    try {
        const image = await GalleryImage.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ message: 'Gallery image not found.' });
        }
        res.json(image);
        console.log('GET /admin/gallery-images/:id: Response sent for image', image._id);
    } catch (err) {
        console.error('Error fetching single gallery image:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Gallery Image ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve gallery image due to a server error.' });
    }
});

// ✅ NEW: POST create a new gallery image
router.post('/gallery-images', adminAuth, async (req, res) => {
    console.log('POST /admin/gallery-images: Request received to create gallery image.');
    try {
        const { description, order, isActive } = req.body;

        let imageUrl = '';
        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['galleryImage'] && req.files['galleryImage'].length > 0) {
            imageUrl = `/uploads/gallery/${req.files['galleryImage'][0].filename}`;
            console.log('Gallery image creation: Image URL set to:', imageUrl);
        } else {
            return res.status(400).json({ message: 'Gallery image file is required.' });
        }

        const newImage = new GalleryImage({
            imageUrl,
            description: description || '',
            order: order !== undefined ? parseInt(order) : 0,
            isActive: isActive !== undefined ? (isActive === 'true') : true, // Convert string boolean to actual boolean
        });

        const savedImage = await newImage.save();
        console.log('POST /admin/gallery-images: Gallery image created successfully!', savedImage._id);
        res.status(201).json({ message: 'Gallery image added successfully!', image: savedImage });
    } catch (err) {
        console.error('Error creating gallery image:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to add gallery image due to a server error.' });
    }
});

// ✅ NEW: PUT update an existing gallery image
router.put('/gallery-images/:id', adminAuth, async (req, res) => {
    console.log('PUT /admin/gallery-images/:id: Request received to update gallery image.');
    try {
        const { description, order, isActive } = req.body;
        const imageId = req.params.id;

        const image = await GalleryImage.findById(imageId);
        if (!image) {
            return res.status(404).json({ message: 'Gallery image not found.' });
        }

        if (description !== undefined) image.description = description;
        if (order !== undefined) image.order = parseInt(order);
        if (isActive !== undefined) image.isActive = (isActive === 'true'); // Convert string boolean

        const upload = req.app.get('multer_upload'); // Get multer instance
        if (req.files && req.files['galleryImage'] && req.files['galleryImage'].length > 0) {
            image.imageUrl = `/uploads/gallery/${req.files['galleryImage'][0].filename}`;
            console.log('Gallery image update: New image URL set to:', image.imageUrl);
        }

        const updatedImage = await image.save();
        console.log('PUT /admin/gallery-images/:id: Gallery image updated successfully!', updatedImage._id);
        res.json({ message: 'Gallery image updated successfully!', image: updatedImage });
    } catch (err) {
        console.error('Error updating gallery image:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Gallery Image ID format.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update gallery image due to a server error.' });
    }
});

// ✅ NEW: DELETE a gallery image
router.delete('/gallery-images/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/gallery-images/:id: Request received.');
    try {
        const imageToDelete = await GalleryImage.findById(req.params.id);
        if (!imageToDelete) {
            return res.status(404).json({ message: 'Gallery image not found.' });
        }

        await GalleryImage.deleteOne({ _id: req.params.id });
        res.json({ message: 'Gallery image deleted successfully!' });
        console.log('DELETE /admin/gallery-images/:id: Response sent.');
    } catch (err) {
        console.error('Error deleting gallery image:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Gallery Image ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete gallery image due to a server error.' });
    }
});


// --- Review Management APIs (Admin Only) ---
// NEW: GET all reviews for admin panel with pagination, sorting, and filtering
router.get('/reviews', adminAuth, async (req, res) => {
    console.log('GET /admin/reviews: Request received.');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const approvedFilter = req.query.approved; // 'true', 'false', or undefined/null for 'All'
    const skip = (page - 1) * limit;

    let query = {};
    if (approvedFilter !== undefined && approvedFilter !== 'All') {
        query.isApproved = approvedFilter === 'true';
    }

    try {
        console.log('GET /admin/reviews: Querying DB with:', { page, limit, sortBy, sortOrder, query });
        const reviews = await Review.find(query)
            .populate('userId', 'name email') // Populate user name and email
            .populate('productId', 'name imageUrl') // Populate product name and image
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);

        const totalReviews = await Review.countDocuments(query);
        console.log('GET /admin/reviews: Reviews found:', reviews.length, 'Total:', totalReviews);

        res.json({
            reviews,
            currentPage: page,
            totalPages: Math.ceil(totalReviews / limit),
            totalItems: totalReviews
        });
        console.log('GET /admin/reviews: Response sent.');
    } catch (err) {
        console.error('Error fetching admin reviews API:', err);
        res.status(500).json({ message: 'Failed to retrieve review list due to a server error.' });
    }
});

// NEW: PUT update review approval status (admin only)
router.put('/reviews/:id/approve', adminAuth, async (req, res) => {
    console.log('PUT /admin/reviews/:id/approve: Request received to update approval status.');
    const { isApproved } = req.body;
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        if (typeof isApproved !== 'boolean') {
            return res.status(400).json({ message: 'isApproved must be a boolean value.' });
        }
        review.isApproved = isApproved;
        await review.save();
        res.json({ message: 'Review approval status updated successfully!', review });
        console.log(`Review ${review._id} approval status set to ${isApproved}.`);
    } catch (err) {
        console.error('Error updating review approval status:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Review ID format.' });
        }
        res.status(500).json({ message: 'Failed to update review approval status.' });
    }
});

// NEW: DELETE a review (admin only)
router.delete('/reviews/:id', adminAuth, async (req, res) => {
    console.log('DELETE /admin/reviews/:id: Request received to delete review.');
    try {
        const reviewToDelete = await Review.findById(req.params.id);
        if (!reviewToDelete) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        await Review.deleteOne({ _id: req.params.id });
        res.json({ message: 'Review deleted successfully!' });
        console.log(`Review ${req.params.id} deleted.`);
    } catch (err) {
        console.error('Error deleting review:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Review ID format for deletion.' });
        }
        res.status(500).json({ message: 'Failed to delete review.' });
    }
});


module.exports = router;