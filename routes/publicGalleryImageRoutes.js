// Negroo up/routes/publicGalleryImageRoutes.js
const express = require('express');
const router = express.Router();
const GalleryImage = require('../models/GalleryImage'); // Import the GalleryImage model

console.log('Public Gallery Image Routes: Module started loading.');

// GET all active gallery images for public display
// (http://localhost:3000/api/gallery-images)
router.get('/', async (req, res) => {
    console.log('[PublicGalleryImageRoutes] GET /api/gallery-images: Request received.');
    try {
        // Find all active images, sort by order, then by creation date
        const images = await GalleryImage.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
        console.log('[PublicGalleryImageRoutes] Found', images.length, 'active gallery images.');
        res.json(images);
    } catch (err) {
        console.error('[PublicGalleryImageRoutes] Error fetching public gallery images:', err);
        res.status(500).json({ message: 'Failed to retrieve gallery images due to a server error.' });
    }
});

module.exports = router;
