// Negroo up/routes/publicHeroSlideRoutes.js
const express = require('express');
const router = express.Router();
const HeroSlide = require('../models/HeroSlide'); // Import the HeroSlide model

console.log('Public Hero Slide Routes: Module started loading.');

// GET all active hero slides for public display
// (http://localhost:3000/api/hero-slides)
router.get('/', async (req, res) => {
    console.log('[PublicHeroSlideRoutes] GET /api/hero-slides: Request received.');
    try {
        // Find all active slides, sort by order, then by creation date
        const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
        console.log('[PublicHeroSlideRoutes] Found', slides.length, 'active hero slides.');
        res.json(slides);
    } catch (err) {
        console.error('[PublicHeroSlideRoutes] Error fetching public hero slides:', err);
        res.status(500).json({ message: 'Failed to retrieve hero slides due to a server error.' });
    }
});

module.exports = router;
