const express = require('express');
const router = express.Router();
const ProductCollection = require('../models/ProductCollection');
const Product = require('../models/Product'); // Needed to validate product IDs and populate
const Category = require('../models/Category'); // Needed for suggestedOnCategories if populated
const { auth } = require('../middleware/authMiddleware'); // For admin protection
const mongoose = require('mongoose');

// Middleware to get the multer upload instances from app settings
router.use((req, res, next) => {
    // Access the multer upload instance set in server.js
    req.upload = req.app.get('multer_upload'); 
    next();
});

// Helper to check if array of product IDs are valid and exist
async function validateProductIds(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return { valid: true, message: 'No products provided or array is empty.' };
    }
    const existingProducts = await Product.find({ _id: { $in: productIds } }).select('_id');
    if (existingProducts.length !== productIds.length) {
        const foundIds = existingProducts.map(p => p._id.toString());
        const invalidIds = productIds.filter(id => !foundIds.includes(id));
        return { valid: false, message: `Invalid or non-existent product IDs: ${invalidIds.join(', ')}`};
    }
    return { valid: true };
}

// 1. POST Create a new Product Collection (Admin Only)
// ✅ NEW: Apply multer middleware here to parse multipart/form-data
router.post('/', auth, async (req, res) => {
    // Wrap multer processing in a Promise or use a callback to ensure it completes before main logic
    req.upload.single('imageUrl')(req, res, async (err) => { // 'imageUrl' هو اسم الحقل للملف
        if (err) {
            console.error('Multer error during collection creation:', err);
            return res.status(400).json({ message: err.message || 'File upload error.' });
        }

        if (!req.user.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        // البيانات الآن موجودة في req.body و req.file (إذا تم تحميل صورة)
        // التأكد من تحليل مصفوفة المنتجات بشكل صحيح من FormData
        const products = req.body.products ? (Array.isArray(req.body.products) ? req.body.products : [req.body.products]) : [];
        const suggestedOnProducts = req.body.suggestedOnProducts ? (Array.isArray(req.body.suggestedOnProducts) ? req.body.suggestedOnProducts : [req.body.suggestedOnProducts]) : [];
        const suggestedOnCategories = req.body.suggestedOnCategories ? (Array.isArray(req.body.suggestedOnCategories) ? req.body.suggestedOnCategories : [req.body.suggestedOnCategories]) : [];
        const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];


        const { name, description } = req.body; // الآن يتم فك الهيكلة من req.body

        // تحديد عنوان URL للصورة: ملف تم تحميله حديثًا، أو افتراضي
        const collectionImageUrl = req.file ? `/uploads/collections/${req.file.filename}` : '/images/placeholder-collection.jpg';

        if (!name || products.length === 0) {
            return res.status(400).json({ message: 'Collection name and at least one product are required.' });
        }

        const productValidation = await validateProductIds(products);
        if (!productValidation.valid) {
            return res.status(400).json({ message: `Invalid products in collection: ${productValidation.message}` });
        }

        const suggestedProductsValidation = await validateProductIds(suggestedOnProducts);
        if (!suggestedProductsValidation.valid) {
            return res.status(400).json({ message: `Invalid product IDs for suggestions: ${suggestedProductsValidation.message}` });
        }
        // لا توجد حاجة للتحقق من suggestedOnCategories أو tags بخلاف التأكد من أنها مصفوفات / سلاسل نصية


        try {
            const newCollection = new ProductCollection({
                name,
                description,
                imageUrl: collectionImageUrl, // استخدم عنوان URL للصورة التي تم إنشاؤها
                products,
                suggestedOnProducts,
                suggestedOnCategories,
                tags
            });

            const savedCollection = await newCollection.save();
            res.status(201).json({ message: 'تم إنشاء مجموعة المنتجات بنجاح!', collection: savedCollection });

        } catch (err) {
            console.error('خطأ أثناء إنشاء مجموعة المنتجات:', err);
            if (err.code === 11000) { // خطأ المفتاح المكرر للاسم الفريد
                return res.status(409).json({ message: 'توجد مجموعة بهذا الاسم بالفعل.' });
            }
            res.status(500).json({ message: 'فشل إنشاء مجموعة المنتجات بسبب خطأ في الخادم.' });
        }
    });
});

// 2. GET All Product Collections (Public access, can be filtered by admin status)
router.get('/', async (req, res) => {
    console.log('[ProductCollectionRoutes] GET /: Request received.');
    try {
        const { search, sort, page = 1, limit = 12 } = req.query; // إضافة search, sort, page, limit
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};

        if (search) {
            query.name = { $regex: search, $options: 'i' }; // بحث غير حساس لحالة الأحرف
        }

        let sortOptions = {};
        if (sort === 'name-asc') {
            sortOptions.name = 1;
        } else if (sort === 'name-desc') {
            sortOptions.name = -1;
        } else if (sort === 'createdAt-desc') {
            sortOptions.createdAt = -1;
        }

        const totalCollections = await ProductCollection.countDocuments(query);
        const collections = await ProductCollection.find(query)
                                                .sort(sortOptions)
                                                .skip(skip)
                                                .limit(parseInt(limit));
        
        const totalPages = Math.ceil(totalCollections / parseInt(limit));

        console.log('[ProductCollectionRoutes] GET /: Collections fetched from DB.', collections.length);

        // Adjust product prices for flash sale within collections for public view
        const collectionsForResponse = collections.map(collection => {
            const collectionObject = collection.toObject();
            if (collectionObject.products && collectionObject.products.length > 0) {
                 collectionObject.products = collectionObject.products.map(product => {
                    const productObj = product.toObject ? product.toObject() : product;
                    if (productObj.isOnFlashSale && productObj.flashSalePrice !== null && productObj.flashSaleEndDate && new Date(productObj.flashSaleEndDate) > new Date()) {
                        return {
                            ...productObj,
                            originalPrice: productObj.price,
                            price: productObj.flashSalePrice
                        };
                    }
                    return productObj;
                });
            }
            return collectionObject;
        });

        console.log('[ProductCollectionRoutes] GET /: Sending response with pagination.');
        res.status(200).json({
            collections: collectionsForResponse, // ✅ إرسال المجموعات ضمن الخاصية 'collections'
            totalPages: totalPages,
            currentPage: parseInt(page)
        });
    } catch (err) {
        console.error('خطأ أثناء جلب مجموعات المنتجات:', err);
        res.status(500).json({ message: 'فشل استرداد مجموعات المنتجات بسبب خطأ في الخادم.' });
    }
});

// 3. GET Single Product Collection by ID (Public Access)
router.get('/:id', async (req, res) => {
    try {
        const collection = await ProductCollection.findById(req.params.id)
                                                  // ✅ تبسيط Populate للتصحيح
                                                  .populate('products')
                                                  .populate('suggestedOnCategories')
                                                  .populate('suggestedOnProducts');

        if (!collection) {
            return res.status(404).json({ message: 'لم يتم العثور على مجموعة المنتجات.' });
        }

        const collectionObject = collection.toObject();

        // ضبط أسعار المنتجات لـ "Flash Sale" داخل هذه المجموعة الفردية
        if (collectionObject.products) {
            collectionObject.products = collectionObject.products.map(product => {
                const productObj = product.toObject ? product.toObject() : product; // التأكد من أنها كائن عادي
                if (productObj.isOnFlashSale && productObj.flashSalePrice !== null && productObj.flashSaleEndDate && new Date(productObj.flashSaleEndDate) > new Date()) {
                    return {
                        ...productObj,
                        originalPrice: productObj.price,
                        price: productObj.flashSalePrice
                    };
                }
                return productObj;
            });
        }


        res.status(200).json(collectionObject);

    } catch (err) {
        console.error('خطأ أثناء جلب مجموعة منتجات واحدة:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'تنسيق معرف المجموعة غير صالح.' });
        }
        res.status(500).json({ message: 'فشل استرداد مجموعة المنتجات بسبب خطأ في الخادم.' });
    }
});

// 4. PUT Update a Product Collection (Admin Only)
// ✅ NEW: Apply multer middleware here to parse multipart/form-data
router.put('/:id', auth, async (req, res) => {
    req.upload.single('imageUrl')(req, res, async (err) => { // 'imageUrl' هو اسم الحقل للملف
        if (err) {
            console.error('Multer error during collection update:', err);
            return res.status(400).json({ message: err.message || 'File upload error.' });
        }

        if (!req.user.isAdmin) {
            return res.status(403).json({ message: 'تم رفض الوصول. مطلوب امتيازات المسؤول.' });
        }

        // البيانات الآن موجودة في req.body و req.file (إذا تم تحميل صورة)
        const products = req.body.products ? (Array.isArray(req.body.products) ? req.body.products : [req.body.products]) : [];
        const suggestedOnProducts = req.body.suggestedOnProducts ? (Array.isArray(req.body.suggestedOnProducts) ? req.body.suggestedOnProducts : [req.body.suggestedOnProducts]) : [];
        const suggestedOnCategories = req.body.suggestedOnCategories ? (Array.isArray(req.body.suggestedOnCategories) ? req.body.suggestedOnCategories : [req.body.suggestedOnCategories]) : [];
        const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
        const { name, description } = req.body;


        // Fetch the existing collection first to get its current imageUrl
        const existingCollection = await ProductCollection.findById(req.params.id);
        if (!existingCollection) {
            return res.status(404).json({ message: 'لم يتم العثور على مجموعة المنتجات.' });
        }

        let updateFields = {
            name,
            description,
            products,
            suggestedOnProducts,
            suggestedOnCategories,
            tags,
            updatedAt: Date.now()
        };

        // ✅ MODIFIED LOGIC: Handle imageUrl conditionally
        if (req.file) { // If a new file was uploaded (Multer processed it)
            updateFields.imageUrl = `/uploads/collections/${req.file.filename}`;
        } else { // If no new file was uploaded, retain the existing image URL from the database
            updateFields.imageUrl = existingCollection.imageUrl;
        }

        // التحقق الأساسي من مصفوفة المنتجات (حتى لو كانت اختيارية للتحديث، فهي ممارسة جيدة)
        if (products.length === 0) {
            return res.status(400).json({ message: 'مطلوب منتج واحد على الأقل للمجموعة.' });
        }

        const productValidation = await validateProductIds(products);
        if (!productValidation.valid) {
            return res.status(400).json({ message: `منتجات غير صالحة في المجموعة: ${productValidation.message}` });
        }
        
        const suggestedProductsValidation = await validateProductIds(suggestedOnProducts);
        if (!suggestedProductsValidation.valid) {
            return res.status(400).json({ message: `معرفات المنتجات غير صالحة للاقتراحات: ${suggestedProductsValidation.message}` });
        }

        try {
            const updatedCollection = await ProductCollection.findByIdAndUpdate(
                req.params.id,
                updateFields,
                { new: true, runValidators: true }
            );

            if (!updatedCollection) {
                return res.status(404).json({ message: 'لم يتم العثور على مجموعة المنتجات.' });
            }

            res.status(200).json({ message: 'تم تحديث مجموعة المنتجات بنجاح!', collection: updatedCollection });

        } catch (err) {
            console.error('خطأ أثناء تحديث مجموعة المنتجات:', err);
            if (err.name === 'CastError') {
                return res.status(400).json({ message: 'تنسيق معرف المجموعة غير صالح.' });
            }
            if (err.code === 11000) {
                return res.status(409).json({ message: 'توجد مجموعة بهذا الاسم بالفعل.' });
            }
            res.status(500).json({ message: 'فشل تحديث مجموعة المنتجات بسبب خطأ في الخادم.' });
        }
    });
});

// 5. DELETE a Product Collection (Admin Only)
router.delete('/:id', auth, async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'تم رفض الوصول. مطلوب امتيازات المسؤول.' });
    }

    try {
        const deletedCollection = await ProductCollection.findByIdAndDelete(req.params.id);

        if (!deletedCollection) {
            return res.status(404).json({ message: 'لم يتم العثور على مجموعة المنتجات.' });
        }

        res.status(200).json({ message: 'تم حذف مجموعة المنتجات بنجاح!' });

    } catch (err) {
        console.error('خطأ أثناء حذف مجموعة المنتجات:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'تنسيق معرف المجموعة غير صالح.' });
        }
        res.status(500).json({ message: 'فشل حذف مجموعة المنتجات بسبب خطأ في الخادم.' });
    }
});

module.exports = router;
