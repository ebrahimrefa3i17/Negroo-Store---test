const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { auth } = require('../middleware/authMiddleware');

// Helper function to compare two arrays of selected variants
function areVariantsEqual(variants1, variants2) {
    // Normalize null/undefined to empty array for consistent comparison
    // إذا كان أحد المتغيرات null/undefined اجعله مصفوفة فارغة
    const normalizedVariants1 = variants1 || [];
    const normalizedVariants2 = variants2 || [];

    // إذا كانت الأطوال مختلفة بعد التسوية، فهما ليسا متساويين
    if (normalizedVariants1.length !== normalizedVariants2.length) {
        return false;
    }

    // إذا كانت الأطوال متساوية وكلاهما فارغ (بعد التسوية)، فهما متساويان
    if (normalizedVariants1.length === 0 && normalizedVariants2.length === 0) {
        return true;
    }

    // إذا لم يكن كلاهما فارغًا، قم بفرزهما ومقارنة العناصر
    const sorter = (a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        return 0;
    };
    const sortedV1 = [...normalizedVariants1].sort(sorter);
    const sortedV2 = [...normalizedVariants2].sort(sorter);

    for (let i = 0; i < sortedV1.length; i++) {
        if (sortedV1[i].name !== sortedV2[i].name || sortedV1[i].value !== sortedV2[i].value) {
            return false;
        }
    }
    return true;
}


// 1. GET user/guest cart (http://localhost:3000/api/cart)
router.get('/', async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const guestId = req.headers['x-guest-id'];

    console.log('[CartRoutes] GET /api/cart: Request received. userId:', userId, 'guestId:', guestId);

    if (!userId && !guestId) {
        console.log('[CartRoutes] No user or guest ID provided. Returning empty cart.');
        return res.json({ items: [] });
    }

    try {
        let cart;
        if (userId) {
            cart = await Cart.findOne({ userId }).populate({
                path: 'items.productId',
                // قم بجلب كل حقول المنتج اللازمة لتطبيق منطق سعر الفلاش سيل
                select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate'
            });
        } else if (guestId) { // Use guestId if userId is not present
            cart = await Cart.findOne({ guestId }).populate({
                path: 'items.productId',
                // قم بجلب كل حقول المنتج اللازمة لتطبيق منطق سعر الفلاش سيل
                select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate'
            });
        }

        if (!cart) {
            console.log('[CartRoutes] No cart found for provided ID. Returning empty cart.');
            return res.json({ items: [] });
        }

        console.log('[CartRoutes] Raw cart items after populate:', JSON.stringify(cart.items, null, 2));

        const responseItems = [];
        for (const item of cart.items) {
            const product = item.productId;

            if (!product) {
                console.warn(`[CartRoutes] Product ID ${item.productId} not found in database for cart item ${item._id}. Skipping this item.`);
                continue;
            }

            let finalPrice = product.price || 0;
            let finalImageUrl = product.imageUrl || '/images/placeholder-product.jpg';
            let currentProductStock = product.stock || 0;

            // **✅ جديد: تطبيق منطق سعر الفلاش سيل أولاً**
            let originalProductPrice = product.price || 0; // تخزين السعر الأساسي قبل أي تعديلات
            if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
                finalPrice = product.flashSalePrice; // استخدم سعر الفلاش سيل إذا كان نشطًا
            }

            if (product.variants && product.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentCombinationPriceAdjustment = 0;
                let currentCombinationImageUrl = product.imageUrl;
                let currentCombinationStock = Infinity;

                for (const clientVar of item.selectedVariants) {
                    let foundGroup = product.variants.find(vg => vg.name === clientVar.name);
                    if (foundGroup) {
                        let foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                        if (foundOption) {
                            currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                            if (foundOption.imageUrl) {
                                currentCombinationImageUrl = foundOption.imageUrl;
                            }
                            currentCombinationStock = Math.min(currentCombinationStock, foundOption.stock);
                        }
                    } else {
                        console.warn(`[CartRoutes] Variant group '${clientVar.name}' not found for product ${product._id} during cart item processing.`);
                    }
                }
                // طبق تعديل السعر للمتغيرات على السعر النهائي (الذي قد يكون سعر الفلاش سيل أو السعر الأساسي)
                finalPrice = finalPrice + currentCombinationPriceAdjustment;
                finalImageUrl = currentCombinationImageUrl;
                currentProductStock = currentCombinationStock;
            }

            responseItems.push({
                _id: item._id,
                productId: product._id,
                quantity: item.quantity,
                selectedVariants: item.selectedVariants || [],
                product: {
                    _id: product._id,
                    name: product.name || 'Unknown Product',
                    price: finalPrice, // السعر النهائي بعد تطبيق الفلاش سيل والمتغيرات
                    originalPrice: originalProductPrice, // السعر الأساسي للمنتج
                    imageUrl: finalImageUrl,
                    stock: currentProductStock,
                    // أضف هذه الحقول للسماح للواجهة الأمامية بمعرفة حالة الفلاش سيل
                    isOnFlashSale: product.isOnFlashSale,
                    flashSalePrice: product.flashSalePrice,
                    flashSaleEndDate: product.flashSaleEndDate
                }
            });
        }

        const responseCart = {
            userId: cart.userId,
            guestId: cart.guestId,
            _id: cart._id,
            items: responseItems,
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
        };

        console.log('[CartRoutes] Sending formatted cart response:', JSON.stringify(responseCart, null, 2));
        res.json(responseCart);
    } catch (err) {
        console.error('[CartRoutes] Error fetching cart:', err);
        res.status(500).json({ message: 'Failed to retrieve cart due to a server error.' });
    }
});

// 2. POST add item to cart (http://localhost:3000/api/cart/add)
router.post('/add', async (req, res) => {
    const { productId, quantity, selectedVariants: clientSelectedVariants } = req.body;
    const userId = req.user ? req.user.id : null;
    const guestId = req.headers['x-guest-id'];

    if (!productId || quantity === undefined || quantity <= 0) {
        console.error("[CartRoutes] Validation failed for cart ADD. Received:", { productId, quantity, userId, guestId });
        return res.status(400).json({ message: 'Product ID and a positive quantity are required.' });
    }

    let cart;
    if (userId) {
        cart = await Cart.findOne({ userId });
    } else if (guestId) {
        cart = await Cart.findOne({ guestId });
    } else {
        return res.status(401).json({ message: 'Authorization required or guest ID missing for cart operations.' });
    }

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be a positive number.' });
        }

        let totalAvailableStock = product.stock;
        let finalImageUrl = product.imageUrl;
        let finalPrice = product.price;
        let variantPriceAdjustment = 0;
        let originalProductPrice = product.price || 0; // تخزين السعر الأساسي

        // **✅ جديد: تطبيق منطق سعر الفلاش سيل أولاً**
        if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
            finalPrice = product.flashSalePrice; // استخدم سعر الفلاش سيل إذا كان نشطًا
        }

        if (product.variants && product.variants.length > 0) {
            if (!Array.isArray(clientSelectedVariants) || clientSelectedVariants.length === 0) {
                return res.status(400).json({ message: 'Product has variants. Please select all required variants.' });
            }

            totalAvailableStock = Infinity;
            let currentCombinationPriceAdjustment = 0;
            let currentCombinationImageUrl = product.imageUrl;

            for (const clientVar of clientSelectedVariants) {
                let foundGroup = product.variants.find(vg => vg.name === clientVar.name);
                if (!foundGroup) {
                    return res.status(400).json({ message: `Variant group '${clientVar.name}' not found for product.` });
                }
                let foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                if (!foundOption) {
                    return res.status(400).json({ message: `Variant option '${clientVar.value}' not found for group '${clientVar.name}'.` });
                }

                totalAvailableStock = Math.min(totalAvailableStock, foundOption.stock);
                currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                if (foundOption.imageUrl) {
                    currentCombinationImageUrl = foundOption.imageUrl;
                }
            }

            variantPriceAdjustment = currentCombinationPriceAdjustment;
            finalImageUrl = currentCombinationImageUrl;
            // طبق تعديل السعر للمتغيرات على السعر النهائي (الذي قد يكون سعر الفلاش سيل أو السعر الأساسي)
            finalPrice = finalPrice + variantPriceAdjustment;

        } else if (clientSelectedVariants && clientSelectedVariants.length > 0) {
            return res.status(400).json({ message: 'Product does not support variants. Please remove variant selections.' });
        }

        if (totalAvailableStock < parsedQuantity) {
            const variantStr = clientSelectedVariants && clientSelectedVariants.length > 0
                ? clientSelectedVariants.map(v => `${v.name}: ${v.value}`).join(', ')
                : 'main product';
            return res.status(400).json({ message: `Not enough stock for ${product.name} (${variantStr}). Available: ${totalAvailableStock}, Requested: ${parsedQuantity}.` });
        }

        // If cart doesn't exist, create it using the correct ID (userId or guestId)
        if (!cart) {
            if (userId) {
                cart = new Cart({ userId, items: [] });
            } else if (guestId) { // Must be guestId
                cart = new Cart({ guestId: guestId, items: [] });
            }
        }

        let itemIndex = -1;
        itemIndex = cart.items.findIndex(item =>
            item.productId.toString() === productId &&
            areVariantsEqual(item.selectedVariants, clientSelectedVariants)
        );

        if (itemIndex > -1) {
            const newTotalQuantity = cart.items[itemIndex].quantity + parsedQuantity;
            if (totalAvailableStock < newTotalQuantity) {
                const variantStr = clientSelectedVariants && clientSelectedVariants.length > 0
                    ? clientSelectedVariants.map(v => `${v.name}: ${v.value}`).join(', ')
                    : 'main product';
                return res.status(400).json({ message: `Adding ${parsedQuantity} units of ${product.name} (${variantStr}) would exceed available stock. Max allowed: ${totalAvailableStock - cart.items[itemIndex].quantity}.` });
            }
            cart.items[itemIndex].quantity = newTotalQuantity;
            cart.items[itemIndex].name = product.name;
            cart.items[itemIndex].price = finalPrice;
            cart.items[itemIndex].imageUrl = finalImageUrl;
            cart.items[itemIndex].selectedVariants = clientSelectedVariants;
            cart.items[itemIndex].variantImageUrl = finalImageUrl;
            cart.items[itemIndex].variantPriceAdjustment = variantPriceAdjustment;

        } else {
            cart.items.push({
                productId,
                name: product.name,
                price: finalPrice, // السعر النهائي
                imageUrl: finalImageUrl,
                quantity: parsedQuantity,
                selectedVariants: clientSelectedVariants,
                variantImageUrl: finalImageUrl,
                variantPriceAdjustment: variantPriceAdjustment,
            });
        }

        await cart.save();
        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items.productId',
            select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate' // تأكد من جلب حقول الفلاش سيل هنا أيضاً
        });

        const responseItems = updatedCart.items.map(item => {
            const productData = item.productId;
            if (!productData) { // If productData is null/undefined (product was deleted)
                // Return a placeholder or remove the item later in a cleanup task
                console.warn(`[CartRoutes] Product data missing for item ID: ${item.productId}. It might have been deleted.`);
                 return {
                    _id: item._id,
                    productId: item.productId, // Still provide ID for potential debugging/cleanup
                    quantity: item.quantity,
                    selectedVariants: item.selectedVariants,
                    product: {
                        _id: item.productId,
                        name: item.name || 'Deleted Product',
                        price: item.price || 0,
                        imageUrl: item.imageUrl || '/images/placeholder-product.jpg', // Use existing image or placeholder
                        stock: 0, // Assume 0 stock if product data is missing
                        isOnFlashSale: false,
                        flashSalePrice: null,
                        flashSaleEndDate: null
                    }
                };
            }

            let itemFinalPrice = productData.price || 0;
            let itemFinalImageUrl = productData.imageUrl || '/images/placeholder-product.jpg';
            let itemCurrentStock = productData.stock || 0;
            let itemOriginalPrice = productData.price || 0; // السعر الأساسي

            // **✅ جديد: تطبيق منطق سعر الفلاش سيل عند إعداد استجابة السلة**
            if (productData.isOnFlashSale && productData.flashSalePrice !== null && productData.flashSaleEndDate && new Date(productData.flashSaleEndDate) > new Date()) {
                itemFinalPrice = productData.flashSalePrice;
            }

            if (productData.variants && productData.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentCombinationPriceAdjustment = 0;
                let currentCombinationImageUrl = productData.imageUrl;
                let currentCombinationStock = Infinity;
                for (const clientVar of item.selectedVariants) {
                    let foundGroup = productData.variants.find(vg => vg.name === clientVar.name);
                    if (foundGroup) {
                        let foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                        if (foundOption) {
                            currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                            if (foundOption.imageUrl) currentCombinationImageUrl = foundOption.imageUrl;
                            currentCombinationStock = Math.min(currentCombinationStock, foundOption.stock);
                        }
                    }
                }
                itemFinalPrice = itemFinalPrice + currentCombinationPriceAdjustment; // طبق تعديل المتغيرات على السعر النهائي
                itemFinalImageUrl = currentCombinationImageUrl;
                itemCurrentStock = currentCombinationStock;
            }

            return {
                _id: item._id,
                productId: productData._id,
                quantity: item.quantity,
                selectedVariants: item.selectedVariants,
                product: {
                    _id: productData._id,
                    name: productData.name || 'Unknown Product',
                    price: itemFinalPrice,
                    originalPrice: itemOriginalPrice, // أضف السعر الأساسي
                    imageUrl: itemFinalImageUrl,
                    stock: itemCurrentStock,
                    isOnFlashSale: productData.isOnFlashSale, // أضف حقول الفلاش سيل
                    flashSalePrice: productData.flashSalePrice,
                    flashSaleEndDate: productData.flashSaleEndDate
                }
            };
        });

        const updatedCartResponse = { ...updatedCart.toObject(), items: responseItems };
        res.status(200).json({ message: 'Item added to cart successfully!', cart: updatedCartResponse });

    } catch (err) {
        console.error('Error adding to cart (backend):', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid product ID format.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: err.message || 'Failed to add item to cart due to a server error.' });
    }
});

// 3. PUT update item quantity in cart (http://localhost:3000/api/cart/update)
router.put('/update', async (req, res) => {
    console.log('[CartRoutes] Received PUT /api/cart/update request.');
    const { productId, quantity, selectedVariants: clientSelectedVariants } = req.body;
    const userId = req.user ? req.user.id : null;
    const guestId = req.headers['x-guest-id'];

    if (!productId || quantity === undefined || quantity < 0) {
        console.error("[CartRoutes] Validation failed for cart UPDATE. Received:", { productId, quantity, userId, guestId });
        return res.status(400).json({ message: 'Product ID and a non-negative quantity are required.' });
    }

    let query = {};
    if (userId) {
        query = { userId };
    } else if (guestId) {
        query = { guestId };
    } else {
        return res.status(401).json({ message: 'Authorization required or guest ID missing for cart operations.' });
    }

    try {
        let cart = await Cart.findOne(query);

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user/guest.' });
        }

        let itemIndex = -1;
        itemIndex = cart.items.findIndex(item =>
            item.productId.toString() === productId &&
            areVariantsEqual(item.selectedVariants, clientSelectedVariants)
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Product (or specific variant) not found in cart.' });
        }

        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity < 0) {
            return res.status(400).json({ message: 'Quantity must be a non-negative number.' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            // Product not found in DB, remove it from cart and notify
            cart.items.splice(itemIndex, 1);
            await cart.save();
            const updatedCart = await Cart.findById(cart._id).populate({
                path: 'items.productId',
                select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate' // تأكد من جلب حقول الفلاش سيل هنا أيضاً
            });
            const responseItems = updatedCart.items.map(item => {
                const productData = item.productId;
                if (!productData) { /* ... handle missing product ... */ }

                let itemFinalPrice = productData.price || 0;
                let itemFinalImageUrl = productData.imageUrl || '/images/placeholder-product.jpg';
                let itemCurrentStock = productData.stock || 0;
                let itemOriginalPrice = productData.price || 0;

                if (productData.isOnFlashSale && productData.flashSalePrice !== null && productData.flashSaleEndDate && new Date(productData.flashSaleEndDate) > new Date()) {
                    itemFinalPrice = productData.flashSalePrice;
                }
                if (productData.variants && productData.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                    let currentCombinationPriceAdjustment = 0;
                    let currentCombinationImageUrl = productData.imageUrl;
                    let currentCombinationStock = Infinity;
                    for (const clientVar of item.selectedVariants) {
                        let foundGroup = productData.variants.find(vg => vg.name === clientVar.name);
                        if (foundGroup) {
                            let foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                            if (foundOption) {
                                currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                                if (foundOption.imageUrl) currentCombinationImageUrl = foundOption.imageUrl;
                                currentCombinationStock = Math.min(currentCombinationStock, foundOption.stock);
                            }
                        }
                    }
                    itemFinalPrice = itemFinalPrice + currentCombinationPriceAdjustment;
                    itemFinalImageUrl = currentCombinationImageUrl;
                    itemCurrentStock = currentCombinationStock;
                }

                return {
                    _id: item._id,
                    productId: productData._id,
                    quantity: item.quantity,
                    selectedVariants: item.selectedVariants,
                    product: {
                        _id: productData._id,
                        name: productData.name || 'Unknown Product',
                        price: itemFinalPrice,
                        originalPrice: itemOriginalPrice,
                        imageUrl: itemFinalImageUrl,
                        stock: itemCurrentStock,
                        isOnFlashSale: productData.isOnFlashSale,
                        flashSalePrice: productData.flashSalePrice,
                        flashSaleEndDate: productData.flashSaleEndDate
                    }
                };
            });
            const updatedCartResponse = { ...updatedCart.toObject(), items: responseItems };
            return res.status(404).json({ message: 'Product not found in database and removed from your cart.', cart: updatedCartResponse });
        }

        let totalAvailableStock = product.stock;
        let variantImageUrl = product.imageUrl;
        let variantPriceAdjustment = 0;
        let finalPrice = product.price;
        let originalProductPrice = product.price || 0; // السعر الأساسي

        // **✅ جديد: تطبيق منطق سعر الفلاش سيل أولاً**
        if (product.isOnFlashSale && product.flashSalePrice !== null && product.flashSaleEndDate && new Date(product.flashSaleEndDate) > new Date()) {
            finalPrice = product.flashSalePrice; // استخدم سعر الفلاش سيل إذا كان نشطًا
        }

        if (product.variants && product.variants.length > 0) {
            if (!Array.isArray(clientSelectedVariants) || clientSelectedVariants.length === 0) {
                return res.status(400).json({ message: 'Product has variants. Selected variants are missing for update.' });
            }

            totalAvailableStock = Infinity;
            let currentCombinationPriceAdjustment = 0;
            let currentCombinationImageUrl = product.imageUrl;

            for (const clientVar of clientSelectedVariants) {
                let foundGroup = product.variants.find(vg => vg.name === clientVar.name);
                if (!foundGroup) {
                    return res.status(400).json({ message: `Variant group '${clientVar.name}' not found for product.` });
                }
                let foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                if (!foundOption) {
                    return res.status(400).json({ message: `Variant option '${clientVar.value}' not found for group '${clientVar.name}'.` });
                }
                totalAvailableStock = Math.min(totalAvailableStock, foundOption.stock);
                currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                if (foundOption.imageUrl) {
                    currentCombinationImageUrl = foundOption.imageUrl;
                }
            }
            variantImageUrl = currentCombinationImageUrl;
            variantPriceAdjustment = currentCombinationPriceAdjustment;
            finalPrice = finalPrice + variantPriceAdjustment; // طبق تعديل المتغيرات على السعر النهائي

        }

        if (parsedQuantity > totalAvailableStock) {
            const variantStr = clientSelectedVariants && clientSelectedVariants.length > 0
                ? clientSelectedVariants.map(v => `${v.name}: ${v.value}`).join(', ')
                : 'main product';
            return res.status(400).json({ message: `Not enough stock for ${product.name} (${variantStr}). Available: ${totalAvailableStock}, Requested: ${parsedQuantity}.` });
        }

        if (parsedQuantity === 0) {
            cart.items.splice(itemIndex, 1);
        } else {
            cart.items[itemIndex].quantity = parsedQuantity;
        }
        cart.items[itemIndex].name = product.name;
        cart.items[itemIndex].price = finalPrice;
        cart.items[itemIndex].imageUrl = variantImageUrl;
        cart.items[itemIndex].selectedVariants = clientSelectedVariants;
        cart.items[itemIndex].variantImageUrl = variantImageUrl;
        cart.items[itemIndex].variantPriceAdjustment = variantPriceAdjustment;


        await cart.save();
        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items.productId',
            select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate' // تأكد من جلب حقول الفلاش سيل هنا أيضاً
        });
        const responseItems = updatedCart.items.map(item => {
            const productData = item.productId;
            if (!productData) { /* ... handle missing product ... */ }

            let itemFinalPrice = productData.price || 0;
            let itemFinalImageUrl = productData.imageUrl || '/images/placeholder-product.jpg';
            let itemCurrentStock = productData.stock || 0;
            let itemOriginalPrice = productData.price || 0; // السعر الأساسي

            // **✅ جديد: تطبيق منطق سعر الفلاش سيل عند إعداد استجابة السلة**
            if (productData.isOnFlashSale && productData.flashSalePrice !== null && productData.flashSaleEndDate && new Date(productData.flashSaleEndDate) > new Date()) {
                itemFinalPrice = productData.flashSalePrice;
            }

            if (productData.variants && productData.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentCombinationPriceAdjustment = 0;
                let currentCombinationImageUrl = productData.imageUrl;
                let currentCombinationStock = Infinity;
                for (const clientVar of item.selectedVariants) {
                    let foundGroup = productData.variants.find(vg => vg.name === clientVar.name);
                    if (foundGroup) {
                        const foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                        if (foundOption) {
                            currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                            if (foundOption.imageUrl) currentCombinationImageUrl = foundOption.imageUrl;
                            currentCombinationStock = Math.min(currentCombinationStock, foundOption.stock);
                        }
                    }
                }
                itemFinalPrice = itemFinalPrice + currentCombinationPriceAdjustment; // طبق تعديل المتغيرات على السعر النهائي
                itemFinalImageUrl = currentCombinationImageUrl;
                itemCurrentStock = currentCombinationStock;
            }
            return {
                _id: item._id,
                productId: productData._id,
                quantity: item.quantity,
                selectedVariants: item.selectedVariants,
                product: {
                    _id: productData._id,
                    name: productData.name || 'Unknown Product',
                    price: itemFinalPrice,
                    originalPrice: itemOriginalPrice, // أضف السعر الأساسي
                    imageUrl: itemFinalImageUrl,
                    stock: itemCurrentStock,
                    isOnFlashSale: productData.isOnFlashSale, // أضف حقول الفلاش سيل
                    flashSalePrice: productData.flashSalePrice,
                    flashSaleEndDate: productData.flashSaleEndDate
                }
            };
        });
        const updatedCartResponse = { ...updatedCart.toObject(), items: responseItems };
        res.json({ message: 'Cart updated successfully!', cart: updatedCartResponse });

    } catch (err) {
        console.error('[CartRoutes] Error updating cart item:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid product ID format or cart ID.' });
        } else if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation error: ${err.message}` });
        }
        res.status(500).json({ message: err.message || 'Failed to update cart due to a server error.' });
    }
});

// 4. DELETE remove item from cart (http://localhost:3000/api/cart/remove)
router.delete('/remove', async (req, res) => {
    console.log('[CartRoutes] DELETE /api/cart/remove request received.');
    const { productId, selectedVariants: clientSelectedVariants } = req.body;
    const userId = req.user ? req.user.id : null;
    const guestId = req.headers['x-guest-id'];

    if (!productId) {
        return res.status(400).json({ message: 'Product ID is required for removal.' });
    }

    let query = {};
    if (userId) {
        query = { userId };
    } else if (guestId) {
        query = { guestId };
    } else {
        return res.status(401).json({ message: 'Authorization required or guest ID missing for cart operations.' });
    }

    try {
        let cart = await Cart.findOne(query);

        if (!cart) {
            return res.status(404).json({ message: 'Product not found in your cart.' });
        }

        let initialLength = cart.items.length;
        cart.items = cart.items.filter(item =>
            !(item.productId.toString() === productId &&
              areVariantsEqual(item.selectedVariants, clientSelectedVariants))
        );

        if (cart.items.length === initialLength) {
            return res.status(404).json({ message: 'Product (or specific variant combination) not found in cart to remove.' });
        }

        await cart.save();
        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items.productId',
            select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate' // تأكد من جلب حقول الفلاش سيل هنا أيضاً
        });
        const responseItems = updatedCart.items.map(item => {
            const productData = item.productId;
            if (!productData) {
                return {
                    _id: item._id, productId: item.productId, quantity: item.quantity, selectedVariants: item.selectedVariants,
                    product: { _id: item.productId, name: item.name || 'Unknown Product', price: item.price || 0, imageUrl: item.imageUrl || '/images/placeholder.jpg', stock: 0 }
                };
            }
            let itemFinalPrice = productData.price || 0;
            let itemFinalImageUrl = productData.imageUrl || '/images/placeholder-product.jpg';
            let itemCurrentStock = productData.stock || 0;
            let itemOriginalPrice = productData.price || 0; // السعر الأساسي

            // **✅ جديد: تطبيق منطق سعر الفلاش سيل عند إعداد استجابة السلة**
            if (productData.isOnFlashSale && productData.flashSalePrice !== null && productData.flashSaleEndDate && new Date(productData.flashSaleEndDate) > new Date()) {
                itemFinalPrice = productData.flashSalePrice;
            }

            if (productData.variants && productData.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentCombinationPriceAdjustment = 0;
                let currentCombinationImageUrl = productData.imageUrl;
                let currentCombinationStock = Infinity;
                for (const clientVar of item.selectedVariants) {
                    const foundGroup = productData.variants.find(vg => vg.name === clientVar.name);
                    if (foundGroup) {
                        const foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                        if (foundOption) {
                            currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                            if (foundOption.imageUrl) currentCombinationImageUrl = foundOption.imageUrl;
                            currentCombinationStock = Math.min(currentCombinationStock, foundOption.stock);
                        }
                    }
                }
                itemFinalPrice = itemFinalPrice + currentCombinationPriceAdjustment; // طبق تعديل المتغيرات على السعر النهائي
                itemFinalImageUrl = currentCombinationImageUrl;
                itemCurrentStock = currentCombinationStock;
            }
            return {
                _id: item._id,
                productId: productData._id,
                quantity: item.quantity,
                selectedVariants: item.selectedVariants,
                product: {
                    _id: productData._id,
                    name: productData.name || 'Unknown Product',
                    price: itemFinalPrice,
                    originalPrice: itemOriginalPrice, // أضف السعر الأساسي
                    imageUrl: itemFinalImageUrl,
                    stock: itemCurrentStock,
                    isOnFlashSale: productData.isOnFlashSale, // أضف حقول الفلاش سيل
                    flashSalePrice: productData.flashSalePrice,
                    flashSaleEndDate: productData.flashSaleEndDate
                }
            };
        });
        const updatedCartResponse = { ...updatedCart.toObject(), items: responseItems };
        res.json({ message: 'Item removed from cart successfully!', cart: updatedCartResponse });

    } catch (err) {
        console.error('[CartRoutes] Error removing item from cart:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid product ID format for removal.' });
        }
        res.status(500).json({ message: err.message || 'Failed to remove item from cart due to a server error.' });
    }
});

// 5. DELETE clear user's cart (http://localhost:3000/api/cart/clear) - تتطلب المصادقة
router.delete('/clear', auth, async (req, res) => {
    console.log('[CartRoutes] DELETE /api/cart/clear request received.');
    const userId = req.user.id; // يجب أن يكون المستخدم مسجلاً للدخول هنا

    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(200).json({ message: 'Cart is already empty or not found for this user.', cart: { userId, items: [] } });
        }

        cart.items = [];
        await cart.save();
        res.json({ message: 'Cart cleared successfully!', cart });

    } catch (err) {
        console.error('[CartRoutes] Error clearing cart:', err);
        res.status(500).json({ message: 'Failed to clear cart due to a server error.' });
    }
});

// 6. PUT merge guest cart into user cart (http://localhost:3000/api/cart/merge) - تتطلب المصادقة
router.put('/merge', auth, async (req, res) => {
    console.log('[CartRoutes] PUT /api/cart/merge request received.');
    const userId = req.user.id;
    const guestId = req.headers['x-guest-id'];

    if (!guestId) {
        return res.status(400).json({ message: 'Guest ID is required for merging cart.' });
    }

    try {
        const guestCart = await Cart.findOne({ guestId });
        if (!guestCart) {
            return res.status(200).json({ message: 'No guest cart to merge or already merged.' });
        }

        let userCart = await Cart.findOne({ userId });
        if (!userCart) {
            userCart = new Cart({ userId, items: [] });
        }

        for (const guestItem of guestCart.items) {
            const itemIndex = userCart.items.findIndex(userItem =>
                userItem.productId.toString() === guestItem.productId.toString() &&
                areVariantsEqual(userItem.selectedVariants, guestItem.selectedVariants)
            );

            // Fetch product data for the guest item to apply flash sale logic
            const guestProduct = await Product.findById(guestItem.productId);
            if (!guestProduct) {
                console.warn(`[CartRoutes] Product ID ${guestItem.productId} from guest cart not found in DB. Skipping.`);
                continue; // Skip if product doesn't exist
            }

            let guestItemFinalPrice = guestProduct.price || 0;
            let guestItemOriginalPrice = guestProduct.price || 0;

            // Apply flash sale logic for guest item
            if (guestProduct.isOnFlashSale && guestProduct.flashSalePrice !== null && guestProduct.flashSaleEndDate && new Date(guestProduct.flashSaleEndDate) > new Date()) {
                guestItemFinalPrice = guestProduct.flashSalePrice;
            }

            // Apply variant price adjustment for guest item
            if (guestProduct.variants && guestProduct.variants.length > 0 && guestItem.selectedVariants && guestItem.selectedVariants.length > 0) {
                let currentCombinationPriceAdjustment = 0;
                for (const clientVar of guestItem.selectedVariants) {
                    let foundGroup = guestProduct.variants.find(vg => vg.name === clientVar.name);
                    if (foundGroup) {
                        let foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                        if (foundOption) {
                            currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                        }
                    }
                }
                guestItemFinalPrice += currentCombinationPriceAdjustment;
            }

            // Update userCart item with correct price from guestItem logic
            if (itemIndex > -1) {
                userCart.items[itemIndex].quantity += guestItem.quantity;
                // Update price and image in merged item based on guest item's calculated price
                userCart.items[itemIndex].price = guestItemFinalPrice;
                userCart.items[itemIndex].imageUrl = guestItem.imageUrl || guestProduct.imageUrl; // Use original item's image or product's
                userCart.items[itemIndex].originalPrice = guestItemOriginalPrice;
                userCart.items[itemIndex].isOnFlashSale = guestProduct.isOnFlashSale;
                userCart.items[itemIndex].flashSalePrice = guestProduct.flashSalePrice;
                userCart.items[itemIndex].flashSaleEndDate = guestProduct.flashSaleEndDate;

            } else {
                // Push new item with correct price and flash sale info
                userCart.items.push({
                    productId: guestItem.productId,
                    name: guestItem.name,
                    price: guestItemFinalPrice, // Use calculated final price
                    imageUrl: guestItem.imageUrl,
                    quantity: guestItem.quantity,
                    selectedVariants: guestItem.selectedVariants,
                    variantImageUrl: guestItem.variantImageUrl,
                    variantPriceAdjustment: guestItem.variantPriceAdjustment,
                    originalPrice: guestItemOriginalPrice, // Save original price
                    isOnFlashSale: guestProduct.isOnFlashSale,
                    flashSalePrice: guestProduct.flashSalePrice,
                    flashSaleEndDate: guestProduct.flashSaleEndDate
                });
            }
        }

        await userCart.save();
        await Cart.deleteOne({ guestId }); // حذف سلة الضيف بعد الدمج

        const updatedUserCart = await Cart.findById(userCart._id).populate({
            path: 'items.productId',
            select: 'name price imageUrl stock variants isOnFlashSale flashSalePrice flashSaleEndDate' // تأكد من جلب حقول الفلاش سيل هنا أيضاً
        });

        const responseItems = updatedUserCart.items.map(item => {
            const productData = item.productId;
            if (!productData) { /* ... handle missing product ... */ }

            let itemFinalPrice = productData.price || 0;
            let itemFinalImageUrl = productData.imageUrl || '/images/placeholder-product.jpg';
            let itemCurrentStock = productData.stock || 0;
            let itemOriginalPrice = productData.price || 0; // السعر الأساسي

            // **✅ جديد: تطبيق منطق سعر الفلاش سيل عند إعداد استجابة السلة**
            if (productData.isOnFlashSale && productData.flashSalePrice !== null && productData.flashSaleEndDate && new Date(productData.flashSaleEndDate) > new Date()) {
                itemFinalPrice = productData.flashSalePrice;
            }

            if (productData.variants && productData.variants.length > 0 && item.selectedVariants && item.selectedVariants.length > 0) {
                let currentCombinationPriceAdjustment = 0;
                let currentCombinationImageUrl = productData.imageUrl;
                let currentCombinationStock = Infinity;
                for (const clientVar of item.selectedVariants) {
                    let foundGroup = productData.variants.find(vg => vg.name === clientVar.name);
                    if (foundGroup) {
                        const foundOption = foundGroup.options.find(opt => opt.value === clientVar.value);
                        if (foundOption) {
                            currentCombinationPriceAdjustment += foundOption.priceAdjustment || 0;
                            if (foundOption.imageUrl) currentCombinationImageUrl = foundOption.imageUrl;
                            currentCombinationStock = Math.min(currentCombinationStock, foundOption.stock);
                        }
                    }
                }
                itemFinalPrice = itemFinalPrice + currentCombinationPriceAdjustment; // طبق تعديل المتغيرات على السعر النهائي
                itemFinalImageUrl = currentCombinationImageUrl;
                itemCurrentStock = currentCombinationStock;
            }

            return {
                _id: item._id,
                productId: productData._id,
                quantity: item.quantity,
                selectedVariants: item.selectedVariants,
                product: {
                    _id: productData._id,
                    name: productData.name || 'Unknown Product',
                    price: itemFinalPrice,
                    originalPrice: itemOriginalPrice, // أضف السعر الأساسي
                    imageUrl: itemFinalImageUrl,
                    stock: itemCurrentStock,
                    isOnFlashSale: productData.isOnFlashSale, // أضف حقول الفلاش سيل
                    flashSalePrice: productData.flashSalePrice,
                    flashSaleEndDate: productData.flashSaleEndDate
                }
            };
        });
        const updatedCartResponse = { ...updatedUserCart.toObject(), items: responseItems };

        res.json({ message: 'Guest cart merged successfully!', cart: updatedCartResponse });

    } catch (err) {
        console.error('[CartRoutes] Error merging guest cart:', err);
        res.status(500).json({ message: 'Failed to merge guest cart due to a server error.' });
    }
});


module.exports = router;