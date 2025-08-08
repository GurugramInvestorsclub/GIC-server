const express = require('express');
const multer = require('multer');
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

// Import file upload constants
const { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = require('../utils/fileUpload');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Check if file type is allowed
    if (ALLOWED_FILE_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Only allow single file upload
    },
    fileFilter: fileFilter
});

// Multer error handling middleware
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: `Maximum file size allowed is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Too many files',
                message: 'Only one file is allowed'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                error: 'Unexpected file field',
                message: 'File must be uploaded with field name "image"'
            });
        }
    }
    
    // Handle custom file filter errors
    if (error.message.includes('File type not allowed')) {
        return res.status(400).json({
            error: 'Invalid file type',
            message: error.message
        });
    }
    
    // Pass other errors to default error handler
    next(error);
};

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
// Optional: image (file upload) OR image_url, published_date, published_time, tags, resource_links, is_published
// Content-Type: multipart/form-data (for file upload) OR application/json (for URL only)
router.post('/', requireAuth, upload.single('image'), handleMulterError, createBlog);

// PUT /api/blogs/:id - Update existing blog
// All fields are optional, only provided fields will be updated
// Supports both file upload and URL for image updates
// Content-Type: multipart/form-data (for file upload) OR application/json (for other updates)
router.put('/:id', requireAuth, upload.single('image'), handleMulterError, updateBlog);

// DELETE /api/blogs/:id - Delete blog
router.delete('/:id', requireAuth, deleteBlog);

// Route not found handler for this router (Express 5.1.0 compatible)
router.use((req, res) => {
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
                'POST /api/blogs - Create blog (requires auth, supports file upload)',
                'PUT /api/blogs/:id - Update blog (requires auth, supports file upload)',
                'DELETE /api/blogs/:id - Delete blog (requires auth)'
            ]
        },
        fileUploadInfo: {
            fieldName: 'image',
            maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            allowedTypes: Object.keys(ALLOWED_FILE_TYPES),
            contentType: 'multipart/form-data'
        }
    });
});

// Export router
module.exports = router;