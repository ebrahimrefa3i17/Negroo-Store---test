const express = require('express');
const router = express.Router();
const path = require('path');

const Category = require('../models/Category'); 
const Product = require('../models/Product'); 
const HeroSlide = require('../models/HeroSlide');
const PromoSlide = require('../models/PromoSlide');
const GalleryImage = require('../models/GalleryImage');
const ProductCollection = require('../models/ProductCollection'); // ✅ NEW: Import ProductCollection model

console.log('Admin Routes: Loaded and active.');

// --- Admin Dashboard Home (HTML Page) ---
router.get('/', async (req, res) => {
    console.log('Admin Routes: GET / (Dashboard) requested.');
    try {
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            activePage: 'dashboard'
        });
    } catch (error) {
        console.error('Error rendering admin dashboard HTML:', error);
        res.status(500).send('Error loading dashboard page.');
    }
});

// --- Manage Products (HTML Page) ---
router.get('/products', async (req, res) => {
    try {
        res.render('admin/products', {
            title: 'Manage Products',
            activePage: 'products'
        });
    } catch (err) {
        console.error('Error loading products for admin:', err);
        res.status(500).send('Error loading products.');
    }
});

// --- Add New Product Form (HTML Page) ---
router.get('/products/new', async (req, res) => {
    try {
        const categories = await Category.find({});
        res.render('admin/productForm', {
            title: 'Add New Product',
            categories: categories,
            product: {},
            activePage: 'products'
        });
    } catch (error) {
        console.error('Error rendering new product form:', error);
        res.status(500).send('Failed to load product form.');
    }
});

// --- Edit Product Form (HTML Page) ---
router.get('/products/edit/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const categories = await Category.find({});
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send('Product not found.');
        }

        res.render('admin/productForm', {
            title: 'Edit Product',
            productId: productId,
            categories: categories,
            product: product,
            activePage: 'products'
        });
    } catch (err) {
        console.error('Error loading product edit page:', err);
        res.status(500).send('Error loading product edit page.');
    }
});

// --- Manage Orders (HTML Page) ---
router.get('/orders', async (req, res) => {
    try {
        res.render('admin/orders', {
            title: 'Manage Orders',
            activePage: 'orders'
        });
    } catch (err) {
        console.error('Error loading orders for admin:', err);
        res.status(500).send('Error loading orders.');
    }
});

// --- Order Details (HTML Page) ---
router.get('/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        res.render('admin/orderDetails', {
            title: 'Order Details',
            orderId: orderId,
            activePage: 'orders'
        });
    } catch (err) {
        console.error('Error rendering order details page:', err);
        res.status(500).send('Error loading order details page.');
    }
});

// --- Manage Categories (HTML Page) ---
router.get('/categories', async (req, res) => {
    try {
        res.render('admin/categories', {
            title: 'Manage Categories',
            activePage: 'categories'
        });
    } catch (err) {
        console.error('Error loading categories for admin:', err);
        res.status(500).send('Error loading categories page.');
    }
});

// --- Add New Category Form (HTML Page) ---
router.get('/categories/new', async (req, res) => {
    try {
        const categories = await Category.find({});
        res.render('admin/categoryForm', {
            title: 'Add New Category',
            categories: categories,
            currentCategory: {},
            activePage: 'categories'
        });
    } catch (error) {
        console.error('Error rendering new category form:', error);
        res.status(500).send('Failed to load category form.');
    }
});

// --- Edit Category Form (HTML Page) ---
router.get('/categories/edit/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const allCategories = await Category.find({});
        const currentCategory = await Category.findById(categoryId);

        if (!currentCategory) {
            return res.status(404).send('Category not found.');
        }

        res.render('admin/categoryForm', {
            title: `Edit Category: ${currentCategory.name}`,
            categories: allCategories,
            currentCategory: currentCategory,
            activePage: 'categories'
        });
    } catch (error) {
        console.error('Error rendering edit category form:', error);
        res.status(500).send('Failed to load category edit form.');
    }
});

// --- Manage Users (HTML Page) ---
router.get('/users', async (req, res) => {
    try {
        res.render('admin/users', {
            title: 'Manage Users',
            activePage: 'users'
        });
    } catch (err) {
        console.error('Error loading users management page:', err);
        res.status(500).send('Error loading users management page.');
    }
});

// ✅ Manage Reviews (HTML Page)
router.get('/reviews', async (req, res) => {
    try {
        res.render('admin/reviews', {
            title: 'Manage Reviews',
            activePage: 'reviews'
        });
    }
    catch (err) {
        console.error('Error loading reviews management page:', err);
        res.status(500).send('Error loading reviews management page.');
    }
});

// ✅ Manage Coupons (HTML Page)
router.get('/coupons', async (req, res) => { 
    res.render('admin/coupons', {
        title: 'Manage Coupons',
        activePage: 'coupons'
    });
});

// ✅ Manage Hero Slides (HTML Page)
router.get('/hero-slides', async (req, res) => {
    try {
        res.render('admin/heroSlides', {
            title: 'Manage Hero Slides',
            activePage: 'hero-slides'
        });
    } catch (err) {
        console.error('Error loading hero slides management page:', err);
        res.status(500).send('Error loading hero slides management page.');
    }
});

// ✅ Manage Promo Slides (HTML Page)
router.get('/promo-slides', async (req, res) => {
    try {
        res.render('admin/promoSlides', {
            title: 'Manage Promo Slides',
            activePage: 'promo-slides'
        });
    }
    catch (err) {
        console.error('Error loading promo slides management page:', err);
        res.status(500).send('Error loading promo slides management page.');
    }
});

// ✅ NEW: Manage Gallery Images (HTML Page)
router.get('/gallery-images', async (req, res) => {
    try {
        res.render('admin/galleryImages', {
            title: 'Manage Gallery Images',
            activePage: 'gallery-images'
        });
    } catch (err) {
        console.error('Error loading gallery images management page:', err);
        res.status(500).send('Error loading gallery images management page.');
    }
});

// ✅ NEW: Manage Collections (HTML Page)
router.get('/collections', async (req, res) => {
    try {
        res.render('admin/collections', { // This is the new EJS file we'll create
            title: 'Manage Product Collections',
            activePage: 'collections'
        });
    } catch (err) {
        console.error('Error loading product collections management page:', err);
        res.status(500).send('Error loading product collections management page.');
    }
});

// ✅ NEW: Add New Collection Form (HTML Page)
router.get('/collections/new', async (req, res) => {
    try {
        const allProducts = await Product.find({}).select('name'); // Fetch only name for dropdown
        res.render('admin/collectionForm', { // This is the new EJS form for collections
            title: 'Add New Product Collection',
            collection: {}, // Empty object for new collection
            allProducts: allProducts, // Pass all products to populate selection fields
            activePage: 'collections'
        });
    } catch (error) {
        console.error('Error rendering new collection form:', error);
        res.status(500).send('Failed to load collection form.');
    }
});

// ✅ NEW: Edit Collection Form (HTML Page)
router.get('/collections/edit/:id', async (req, res) => {
    try {
        const collectionId = req.params.id;
        const currentCollection = await ProductCollection.findById(collectionId);
        const allProducts = await Product.find({}).select('name'); // Fetch only name for dropdown

        if (!currentCollection) {
            return res.status(404).send('Product Collection not found.');
        }

        res.render('admin/collectionForm', { // Reuse the collection form
            title: `Edit Collection: ${currentCollection.name}`,
            collection: currentCollection,
            allProducts: allProducts, // Pass all products to populate selection fields
            activePage: 'collections'
        });
    } catch (error) {
        console.error('Error rendering edit collection form:', error);
        res.status(500).send('Failed to load collection edit form.');
    }
});


module.exports = router;