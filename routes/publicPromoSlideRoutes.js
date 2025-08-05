// Negroo up/routes/publicPromoSlideRoutes.js
const express = require('express');
const router = express.Router();
const PromoSlide = require('../models/PromoSlide'); // Import the PromoSlide model

console.log('Public Promo Slide Routes: Module started loading.');

// GET all active promo slides for public display
// (http://localhost:3000/api/promo-slides)
router.get('/', async (req, res) => {
    console.log('[PublicPromoSlideRoutes] GET /api/promo-slides: Request received.');
    try {
        // Find all active slides, sort by order, then by creation date
        const slides = await PromoSlide.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
        console.log('[PublicPromoSlideRoutes] Found', slides.length, 'active promo slides.');
        res.json(slides);
    } catch (err) {
        console.error('[PublicPromoSlideRoutes] Error fetching public promo slides:', err);
        res.status(500).json({ message: 'Failed to retrieve promo slides due to a server error.' });
    }
});

module.exports = router;
