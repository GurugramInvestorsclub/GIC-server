const express = require('express');
const router = express.Router();

// Import middleware
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');

// Import blog controllers
const {
    getAllBlogs,
    getBlogBySlug,
    createBlog,
    updateBlog,
    deleteBlog,
    getBlogTags
} = require('../controller/blogController');

// Public Routes (no authentication required)

// GET /api/blogs - Get all published blogs with optional filtering
// Query parameters: page, limit, tags, author, search, sortBy, sortOrder
router.get('/', getAllBlogs);

// GET /api/blogs/tags - Get all unique tags from published blogs
router.get('/tags', getBlogTags);

// GET /api/blogs/:slug - Get single blog by slug
// Uses optionalAuth to allow admin to see unpublished blogs
router.get('/:slug', optionalAuth, getBlogBySlug);

// Protected Routes (authentication required)

// POST /api/blogs - Create new blog
// Requires: title, content, author
// Optional: image_url, published_date, published_time, tags, resource_links, is_published
router.post('/', requireAuth, createBlog);

// PUT /api/blogs/:id - Update existing blog
// All fields are optional, only provided fields will be updated
router.put('/:id', requireAuth, updateBlog);

// DELETE /api/blogs/:id - Delete blog
router.delete('/:id', requireAuth, deleteBlog);

// Route not found handler for this router
router.use('*', (req, res) => {
    res.status(404).json({
        error: 'Blog route not found',
        message: `The blog route ${req.originalUrl} does not exist`,
        availableRoutes: {
            public: [
                'GET /api/blogs - Get all blogs',
                'GET /api/blogs/tags - Get all tags', 
                'GET /api/blogs/:slug - Get blog by slug'
            ],
            protected: [
                'POST /api/blogs - Create blog (requires auth)',
                'PUT /api/blogs/:id - Update blog (requires auth)',
                'DELETE /api/blogs/:id - Delete blog (requires auth)'
            ]
        }
    });
});

// Export router
module.exports = router;