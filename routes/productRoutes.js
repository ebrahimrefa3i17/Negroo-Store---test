const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category'); // استيراد نموذج Category
const ProductCollection = require('../models/ProductCollection'); // ✅ NEW: Import ProductCollection model
const { auth } = require('../middleware/authMiddleware'); // إذا كنت تستخدم المصادقة العامة
const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');

// Middleware to get the multer upload instances from app settings
router.use((req, res, next) => {
    req.upload = req.app.get('multer_upload'); // Original disk storage upload
    req.upload_memory = req.app.get('multer_upload_memory'); // Get memory storage upload
    next();
});

// Define the URL for your Python ML Microservice
const PYTHON_ML_SERVICE_URL = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:5000';

// Helper function to build query based on filters (تعديل لدعم الفئات الفرعية والعروض)
const buildProductQuery = async (filters) => { // جعل الدالة async
    let query = {};

    if (filters.search) {
        query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } }
        ];
    }

    // معالجة تصفية الفئات بدعم الفئات الفرعية
    if (filters.category) {
        let categoryIds = [];
        // إذا كان filter.category عبارة عن ID
        if (mongoose.Types.ObjectId.isValid(filters.category)) {
            // أضف الـ ID الحالي
            categoryIds.push(new mongoose.Types.ObjectId(filters.category));

            // ابحث عن جميع الفئات الفرعية لهذا الـ ID
            const descendantCategories = await Category.find({ parentCategory: filters.category });
            descendantCategories.forEach(cat => categoryIds.push(cat._id));

            // ملاحظة: هذه الطريقة تجلب فقط المستوى الأول من الفئات الفرعية.
            // إذا كنت تحتاج إلى مستويات متعددة (grand-subcategories)،
            // ستحتاج إلى دالة بحث متكررة (recursive function) أو استخدام aggregation pipeline لـ $graphLookup
            // لجلب جميع المستويات الهرمية للفئات الفرعية.
            // في الوقت الحالي، هذا الكود يتعامل مع مستوى واحد من الفئات الفرعية.

        } else { // إذا كان filter.category عبارة عن اسم الفئة (كما في الروابط الحالية)
            // التعديل السابق: لجعل البحث عن اسم الفئة غير حساس لحالة الأحرف
            const baseCategory = await Category.findOne({ name: { $regex: filters.category, $options: 'i' } }); 
            if (baseCategory) {
                categoryIds.push(baseCategory._id);
                // ابحث عن الفئات الفرعية لهذه الفئة الرئيسية بالاسم (إذا كانت موجودة)
                const descendantCategories = await Category.find({ parentCategory: baseCategory._id });
                descendantCategories.forEach(cat => categoryIds.push(cat._id));
            } else {
                // إذا لم يتم العثور على الفئة بالاسم، فلا توجد منتجات لتصفيتها
                // يمكن أن نُعيد استعلامًا لا يعيد أي نتائج
                query._id = null; // سيؤدي هذا إلى عدم إرجاع أي منتجات
            }
        }

        if (categoryIds.length > 0) {
            query.category = { $in: categoryIds }; // البحث عن المنتجات في أي من هذه الفئات (الرئيسية والفرعية)
        } else if (mongoose.Types.ObjectId.isValid(filters.category)) { // في حالة إذا تم تمرير ID ولم يتم العثور على فئات
             query._id = null; // سيؤدي هذا إلى عدم إرجاع أي منتجات
        }
    }


    if (filters.minPrice || filters.maxPrice) {
        query.price = {};
        if (filters.minPrice) {
            query.price.$gte = parseFloat(filters.minPrice);
        }
        if (filters.maxPrice) {
            query.price.$lte = parseFloat(filters.maxPrice);
        }
    }

    if (filters.variants && Array.isArray(filters.variants) && filters.variants.length > 0) {
        query.$and = query.$and || [];
        filters.variants.forEach(vFilter => {
            query.$and.push({
                'variants': {
                    $elemMatch: {
                        name: String(vFilter.name),
                        'options.value': String(vFilter.value)
                    }
                }
            });
        });
    }

    if (filters.exclude) {
        query._id = { $ne: filters.exclude };
    }

    // ✅ NEW: Filter for flash sales
    if (filters.isOnFlashSale) {
        query.isOnFlashSale = true;
        // Ensure the flash sale is active (end date is in the future)
        query.flashSaleEndDate = { $gte: new Date() };
    }


    return query;
};

// 1. GET all products (http://localhost:3000/api/products) - Public
router.get('/', async (req, res) => {
    // استدعاء buildProductQuery كـ async
    const { search, category, minPrice, maxPrice, sortBy, sortOrder, limit, page = 1, exclude, bestsellers, variants, isOnFlashSale } = req.query; // ✅ Added isOnFlashSale

    const filters = { search, category, minPrice, maxPrice, exclude, bestsellers, isOnFlashSale }; // ✅ Added isOnFlashSale
    if (variants) {
        try {
            filters.variants = JSON.parse(variants);
        } catch (e) {
            console.error('Error parsing variants filter:', e);
            return res.status(400).json({ message: 'Invalid variants filter format.' });
        }
    }

    const query = await buildProductQuery(filters); // انتظار نتيجة buildProductQuery
    let sortOptions = {};

    if (sortBy) {
        let order = sortOrder === 'desc' ? -1 : 1;
        if (sortBy === 'price') {
            sortOptions.price = order;
        } else if (sortBy === 'name') {
            sortOptions.name = order;
        } else if (sortBy === 'createdAt') {
            sortOptions.createdAt = order;
        }
        else if (sortBy === 'totalSold') {
             sortOptions.totalSold = order;
        }
    } else {
        sortOptions.createdAt = -1;
    }

    const itemsPerPage = parseInt(limit) || 12;
    const skip = (page - 1) * itemsPerPage;

    try {
        const totalProducts = await Product.countDocuments(query);
        let products = await Product.find(query) // Used let because we might modify the 'price' field
                                     .populate('category', 'name')
                                     .sort(sortOptions)
                                     .skip(skip)
                                     .limit(itemsPerPage);

        // ✅ NEW: Adjust price for flash sale products
        products = products.map(product => {
            if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
                // Return a new object or modify the existing one if Mongoose allows it
                return {
                    ...product.toObject(), // Convert Mongoose document to plain JS object
                    originalPrice: product.price, // Store original price for display if needed
                    price: product.flashSalePrice // Use flash sale price
                };
            }
            return product.toObject(); // Always return a plain object
        });


        res.json({
            products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / itemsPerPage),
            totalProducts
        });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Failed to retrieve products due to a server error.' });
    }
});

// POST Search by Image (http://localhost:3000/api/products/search-by-image)
router.post('/search-by-image', async (req, res) => {
    console.log('Backend: /api/products/search-by-image HIT!');
    req.upload_memory.single('image')(req, res, async (err) => {
        console.log('Backend: Multer processing for search-by-image started.');
        if (err) {
            console.error('Backend: Multer error occurred:', err);
            return res.status(400).json({ message: err.message || 'File upload error.' });
        }

        if (!req.file) {
            console.log('Backend: No file received in search-by-image.');
            return res.status(400).json({ message: 'No image file uploaded.' });
        }

        console.log('Backend: Image file received:', req.file.originalname, 'Size:', req.file.size, 'Mimetype:', req.file.mimetype);

        try {
            // Send image buffer to Python ML microservice
            const formData = new FormData();
            formData.append('image', req.file.buffer, {
                filename: req.file.originalname,
                contentType: req.file.mimetype
            });

            console.log(`Backend: Sending image to Python ML Microservice at ${PYTHON_ML_SERVICE_URL}/search-image`);

            const mlResponse = await axios.post(`${PYTHON_ML_SERVICE_URL}/search-image`, formData, {
                headers: formData.getHeaders(),
                timeout: 60000 // Add a timeout of 60 seconds for the request
            });

            console.log('Backend: Raw ML Response:', mlResponse);
            console.log('Backend: Raw ML Response Data:', mlResponse.data);

            const { product_ids } = mlResponse.data;

            if (!product_ids || product_ids.length === 0) {
                console.log('Backend: ML service returned empty product_ids or no product_ids key.');
                return res.json({ message: 'No similar products found by image search.', products: [] });
            }

            // Fetch product details from MongoDB using the IDs returned by the ML service
            const similarProducts = await Product.find({ '_id': { $in: product_ids } });

            console.log(`Backend: Found ${similarProducts.length} similar products from ML service.`);
            res.json({
                message: 'Image search completed successfully!',
                products: similarProducts.map(p => ({
                    _id: p._id,
                    name: p.name,
                    imageUrl: p.imageUrl,
                    price: p.price
                }))
            });

        } catch (error) {
            console.error('Backend: Detailed Axios Error:', error);
            console.error('Backend: Axios Error Response Data:', error.response ? error.response.data : 'No response data from ML service.');
            console.error('Backend: Axios Error Message:', error.message);
            
            let errorMessage = 'Failed to perform image search due to backend processing error.';
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'ML service is not running or unreachable. Please check Python server status.';
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ERR_SOCKET_TIMEOUT' || error.message.includes('timeout')) {
                errorMessage = 'ML service request timed out. The Python service might be slow to respond.';
            } else if (error.response && error.response.data && typeof error.response.data.detail === 'string') {
                errorMessage = `ML service error: ${error.response.data.detail}`;
            } else if (error.response && error.response.status) {
                errorMessage = `ML service responded with status ${error.response.status}.`;
            }

            res.status(500).json({ message: errorMessage });
        }
    });
});

// Endpoint to fetch products by a list of IDs (for image search results from frontend)
// هذا المسار تم نقله ليأتي قبل المسار /single/:id لتجنب التعارض.
router.get('/by-ids', async (req, res) => {
    const { ids } = req.query; // ids ستكون سلسلة نصية مفصولة بفواصل مثل "id1,id2,id3"
    console.log('DEBUG Node.js: Received IDs string:', ids);
    if (!ids) {
        console.log('Backend: GET /by-ids received empty IDs. Returning empty array.');
        return res.json({ products: [] });
    }
    try {
        let productIds = ids.split(',').filter(id => id.trim() !== '');
        console.log('DEBUG Node.js: IDs after split and trim:', productIds);
        
        const invalidIds = productIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            console.warn('DEBUG Node.js: Found invalid IDs:', invalidIds);
        }

        productIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        console.log('DEBUG Node.js: IDs after isValid check:', productIds);

        if (productIds.length === 0) {
            console.log('Backend: GET /by-ids received IDs that resulted in an empty array after filtering for validity. Returning empty array.');
            return res.json({ products: [] });
        }

        let products = await Product.find({ '_id': { $in: productIds } }); // Used let
        // ✅ NEW: Adjust price for flash sale products
        products = products.map(product => {
            if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
                // Return a new object or modify the existing one if Mongoose allows it
                return {
                    ...product.toObject(), // Convert Mongoose document to plain JS object
                    originalPrice: product.price, // Store original price for display if needed
                    price: product.flashSalePrice // Use flash sale price
                };
            }
            return product.toObject(); // Always return a plain object
        });
        
        res.json({ products });
    } catch (error) {
        console.error('Error fetching products by IDs:', error);
        if (error.name === 'CastError') {
            console.error('Backend: CastError in GET /by-ids - Invalid Product ID format:', error.message);
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve products by IDs.' });
    }
});

// ✅ MODIFIED: GET a single product by ID (http://localhost:3000/api/products/single/:id) - Public
// تم تغيير المسار لتجنب التعارض مع /by-ids.
router.get('/single/:id', async (req, res) => { // ✅ تم تغيير المسار
    try {
        let product = await Product.findById(req.params.id); // Used let
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        
        // ✅ NEW: Adjust price for flash sale product if active
        if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
            product = {
                ...product.toObject(),
                originalPrice: product.price,
                price: product.flashSalePrice
            };
        } else {
            product = product.toObject(); // Ensure it's a plain object even if no sale
        }

        res.json(product);
    } catch (err) {
        console.error('Error fetching single product:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve product due to a server error.' });
    }
});

// ✅ NEW: GET endpoint for product suggestions (related products + collections)
router.get('/suggestions/:productId', async (req, res) => {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 4; // Default limit for suggestions

    try {
        const currentProduct = await Product.findById(productId).populate('category');
        if (!currentProduct) {
            return res.status(404).json({ message: 'Product not found for suggestions.' });
        }

        let suggestions = [];
        let fetchedProductIds = new Set(); // To keep track of fetched product IDs to avoid duplicates

        // 1. Fetch related individual products by category
        if (currentProduct.category) {
            const categoryRelatedProducts = await Product.find({
                category: currentProduct.category._id,
                _id: { $ne: productId } // Exclude current product
            })
            .limit(limit)
            .select('name price imageUrl description variants isOnFlashSale flashSalePrice flashSaleEndDate');

            categoryRelatedProducts.forEach(product => {
                const productObj = product.toObject();
                // Apply flash sale price
                if (productObj.isOnFlashSale && productObj.flashSalePrice !== null && productObj.flashSaleEndDate && new Date(productObj.flashSaleEndDate) > new Date()) {
                    productObj.originalPrice = productObj.price;
                    productObj.price = productObj.flashSalePrice;
                }
                suggestions.push({ type: 'product', data: productObj });
                fetchedProductIds.add(product._id.toString());
            });
        }

        // 2. Fetch relevant ProductCollection bundles
        const relatedCollections = await ProductCollection.find({
            $or: [
                { suggestedOnProducts: productId }, // Explicitly suggested on this product
                { suggestedOnCategories: currentProduct.category ? currentProduct.category._id : null } // Suggested on this product's category
                // Add more conditions here if you implement tags on Product model
            ],
            products: { $ne: [] } // Ensure collection has products
        })
        .limit(limit - suggestions.length > 0 ? limit - suggestions.length : 0) // Limit based on remaining slots
        .populate({
            path: 'products', // Populate products within the collection
            select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate'
        });
        
        relatedCollections.forEach(collection => {
            const collectionObj = collection.toObject();
            // Filter out products already in suggestions and apply flash sale prices
            collectionObj.products = collectionObj.products.filter(p => !fetchedProductIds.has(p._id.toString())).map(product => {
                const productInCollectionObj = product.toObject ? product.toObject() : product;
                if (productInCollectionObj.isOnFlashSale && productInCollectionObj.flashSalePrice !== null && productInCollectionObj.flashSaleEndDate && new Date(productInCollectionObj.flashSaleEndDate) > new Date()) {
                    productInCollectionObj.originalPrice = productInCollectionObj.price;
                    productInCollectionObj.price = productInCollectionObj.flashSalePrice;
                }
                return productInCollectionObj;
            });

            // Only add collection if it still contains products after filtering, and we have space
            if (collectionObj.products.length > 0 && suggestions.length < limit) {
                suggestions.push({ type: 'collection', data: collectionObj });
                // Note: We don't add individual product IDs from collection to fetchedProductIds here
                // as the collection itself is the suggested item, not its individual products in this context.
            }
        });

        res.json({
            suggestions: suggestions.slice(0, limit) // Ensure final limit
        });

    } catch (err) {
        console.error('Error fetching product suggestions:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve product suggestions due to a server error.' });
    }
});


module.exports = router;