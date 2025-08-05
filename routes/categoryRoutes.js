const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { auth } = require('../middleware/authMiddleware');

// 1. GET all categories (http://localhost:3000/api/categories) - Public
// Added optional query parameter isFeatured=true to fetch only featured categories
router.get('/', async (req, res) => {
    try {
        const isFeatured = req.query.isFeatured; // Get isFeatured query parameter

        let query = {};
        if (isFeatured === 'true') {
            query.isFeatured = true; // Filter for featured categories
        }

        const categories = await Category.find(query)
            .populate('parentCategory', 'name')
            .sort({ name: 1 });

        res.json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'Failed to retrieve categories due to a server error.' });
    }
});

// 2. GET a single category by ID (http://localhost:3000/api/categories/:id) - Public
router.get('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
            .populate('parentCategory', 'name');

        if (!category) {
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.json(category);
    } catch (err) {
        console.error('Error fetching single category:', err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Category ID format.' });
        }
        res.status(500).json({ message: 'Failed to retrieve category due to a server error.' });
    }
});

module.exports = router;
