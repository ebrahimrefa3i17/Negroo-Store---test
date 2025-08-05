const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// Helper function to build product query based on filters
async function buildProductQuery(filters) {
    const { search, category, minPrice, maxPrice, sort, page, limit, bestsellers, imageSearchIds, variants } = filters;
    const query = {};
    const sortOptions = {};

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { specifications: { $regex: search, $options: 'i' } }
        ];
    }

    if (category && category !== 'All') {
        // Find category ID if category name is provided
        const cat = await Category.findOne({ name: category });
        if (cat) {
            // Include products from this category and all its descendants
            const descendantIds = await getDescendantCategoryIds(cat._id); // Assuming getDescendantCategoryIds is available or copied here
            query.category = { $in: descendantIds };
        } else {
            // If category name doesn't match any existing category, return no products
            query.category = null; // No matching category
        }
    }

    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Handle variant filtering
    if (variants && Array.isArray(variants) && variants.length > 0) {
        query.$and = query.$and || []; // Ensure $and exists
        variants.forEach(v => {
            query.$and.push({
                'variants.name': v.name,
                'variants.options.value': v.value
            });
        });
    }


    switch (sort) {
        case 'priceAsc':
            sortOptions.price = 1;
            break;
        case 'priceDesc':
            sortOptions.price = -1;
            break;
        case 'nameAsc':
            sortOptions.name = 1;
            break;
        case 'nameDesc':
            sortOptions.name = -1;
            break;
        case 'createdAtDesc':
            sortOptions.createdAt = -1;
            break;
        case 'totalSoldDesc': // For bestsellers
            sortOptions.totalSold = -1;
            break;
        default:
            sortOptions.createdAt = -1; // Default sort
    }

    if (bestsellers === true) {
        sortOptions.totalSold = -1; // Prioritize bestsellers sort if specified
    }

    if (imageSearchIds) {
        const idsArray = imageSearchIds.split(',');
        query._id = { $in: idsArray };
    }

    return { query, sortOptions };
}

// Helper function to recursively get all descendant category IDs (copied for self-containment)
async function getDescendantCategoryIds(categoryId) {
    let descendantIds = [categoryId];
    let directChildren = await Category.find({ parentCategory: categoryId }).select('_id');

    for (const child of directChildren) {
        const grandChildren = await getDescendantCategoryIds(child._id);
        descendantIds = descendantIds.concat(grandChildren);
    }
    return descendantIds;
}


// Render Products List Page (HTML Page Route) - Render products.ejs
// هذا المسار سيتم تحميله على /products/view/
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9; // Limit for EJS initial load
        const skip = (page - 1) * limit;

        // Extract initial filters from query parameters for direct EJS rendering
        const initialFilters = {
            search: req.query.search || '',
            category: req.query.category || 'All',
            minPrice: req.query.minPrice || '',
            maxPrice: req.query.maxPrice || '',
            sort: req.query.sort || '',
            page: page,
            imageSearchIds: req.query.imageSearchIds || '', // Pass image search IDs if present
            variants: req.query.variants ? JSON.parse(req.query.variants) : undefined // Parse variants if present
        };

        const { query, sortOptions } = await buildProductQuery(initialFilters);

        const products = await Product.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(query);
        const allCategories = await Category.find({}).sort({ name: 1 });


        res.render('products', {
            title: 'Our Products',
            products: products,
            allCategories: allCategories, // Pass all categories for the filter dropdown
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalItems: totalProducts,
            initialFilters: initialFilters // Pass initial filters back to client-side JS
        });

    } catch (err) {
        console.error('Error rendering products page:', err);
        res.status(500).send('Failed to load products page.');
    }
});

// ✅ MODIFIED: Render Public Product Details Page (when a product is clicked)
// هذا المسار سيتم تحميله على /products/view/:id
router.get('/:id', async (req, res) => { // Corrected from /details/:id back to /:id
    try {
        const productId = req.params.id;
        console.log('DEBUG: Requesting product ID:', productId);
        const product = await Product.findById(productId);

        if (!product) {
            console.log('DEBUG: Product not found for ID:', productId);
            return res.render('product-detail', {
                title: 'Product Not Found',
                product: null
            });
        }
        console.log('DEBUG: Product found:', product.name, 'ID:', product._id);
        res.render('product-detail', {
            title: product.name,
            product: product
        });
    } catch (err) {
        console.error('DEBUG ERROR in /products/details/:id route:', err);
        if (err.name === 'CastError') {
            return res.status(400).send('Invalid product ID format.');
        }
        res.status(500).send('Failed to load product details page.');
    }
});


module.exports = router;