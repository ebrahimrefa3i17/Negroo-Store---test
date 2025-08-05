const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// Helper function to recursively get all descendant category IDs
async function getDescendantCategoryIds(categoryId) {
    let descendantIds = [categoryId];
    let directChildren = await Category.find({ parentCategory: categoryId }).select('_id');

    for (const child of directChildren) {
        const grandChildren = await getDescendantCategoryIds(child._id);
        descendantIds = descendantIds.concat(grandChildren);
    }
    return descendantIds;
}

// Render Public Categories Page (initial load)
// هذا المسار سيتم تحميله على /categories/view/
router.get('/', async (req, res) => {
    try {
        // Fetch top-level categories (categories with no parent)
        const topLevelCategories = await Category.find({ parentCategory: null }).sort({ name: 1 });

        // Fetch all products (or a subset if needed for performance)
        const allProducts = await Product.find({}).sort({ createdAt: -1 });

        res.render('categories', { // Rendering views/categories.ejs
            title: 'Browse Categories & Products',
            currentCategory: null, // No specific category selected initially
            categories: topLevelCategories, // Pass top-level categories
            products: allProducts // Pass all products
        });
    } catch (err) {
        console.error('Error rendering public categories page:', err);
        res.status(500).send('Failed to load categories page.');
    }
});

// MODIFIED: Render Public Category Details Page (when a category is clicked)
// هذا المسار سيتم تحميله على /categories/view/:id
router.get('/:id', async (req, res) => { // Corrected from /details/:id back to /:id
    try {
        const categoryId = req.params.id;
        console.log('DEBUG: Requesting category ID:', categoryId);
        const currentCategory = await Category.findById(categoryId);

        if (!currentCategory) {
            console.log('DEBUG: Category not found for ID:', categoryId);
            return res.status(404).send('Category not found.');
        }
        console.log('DEBUG: Category found:', currentCategory.name, 'ID:', currentCategory._id);

        // Get all descendant category IDs, including the current category itself
        const relevantCategoryIds = await getDescendantCategoryIds(categoryId);

        // Fetch direct children of the current category
        const childCategories = await Category.find({ parentCategory: categoryId }).sort({ name: 1 });

        // Fetch products belonging to the current category AND all its descendants
        const productsInCategories = await Product.find({ category: { $in: relevantCategoryIds } }).sort({ createdAt: -1 });

        res.render('categories', { // Re-using views/categories.ejs
            title: `Category: ${currentCategory.name}`,
            currentCategory: currentCategory, // Pass the selected category
            categories: childCategories, // Pass direct children for the top half
            products: productsInCategories // Pass relevant products for the bottom half
        });

    } catch (err) {
        console.error('DEBUG ERROR in /categories/:id route:', err);
        if (err.name === 'CastError') {
            return res.status(400).send('Invalid Category ID format.');
        }
        res.status(500).send('Failed to load category details page.');
    }
});


module.exports = router;