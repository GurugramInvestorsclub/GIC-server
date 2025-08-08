const express = require('express');
const multer = require('multer');
const router = express.Router();

// Import middleware
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const { validateEventData, validatePagination, validateSlugParam, validateUUIDParam } = require('../controller/validation');

// Import event controllers
const {
    getAllEvents,
    getEventBySlug,
    getUpcomingEvents,
    createEvent,
    updateEvent,
    deleteEvent
} = require('../controller/eventController');

// Import file upload constants (reuse from blog system)
const { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = require('../utils/fileUpload');

// Configure multer for file uploads (REUSED from blog system)
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

// Multer error handling middleware (REUSED from blog system)
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

// GET /api/events - Get all active events with optional filtering
// Query parameters: page, limit, location, search, sortBy, sortOrder, upcoming, active
router.get('/', validatePagination, getAllEvents);

// GET /api/events/upcoming - Get upcoming active events
// Query parameters: limit (max 20)
router.get('/upcoming', getUpcomingEvents);

// GET /api/events/:slug - Get single event by slug
// Uses optionalAuth to allow admin to see inactive events
router.get('/:slug', validateSlugParam, optionalAuth, getEventBySlug);

// Protected Routes (authentication required)

// POST /api/events - Create new event
// Requires: title, event_date, location
// Optional: description, image (file upload) OR image_url, event_time, venue_details, 
//          booking_end_date, booking_end_time, external_payment_link, registration_link, is_active
// Content-Type: multipart/form-data (for file upload) OR application/json (for URL only)
router.post('/', 
    requireAuth, 
    upload.single('image'), 
    handleMulterError, 
    validateEventData, 
    createEvent
);

// PUT /api/events/:id - Update existing event
// All fields are optional, only provided fields will be updated
// Supports both file upload and URL for image updates
// Content-Type: multipart/form-data (for file upload) OR application/json (for other updates)
router.put('/:id', 
    validateUUIDParam('id'),
    requireAuth, 
    upload.single('image'), 
    handleMulterError, 
    validateEventData, 
    updateEvent
);

// DELETE /api/events/:id - Delete event
router.delete('/:id', 
    validateUUIDParam('id'),
    requireAuth, 
    deleteEvent
);

// Route not found handler for this router (Express 5.1.0 compatible)
router.use((req, res) => {
    res.status(404).json({
        error: 'Event route not found',
        message: `The event route ${req.originalUrl} does not exist`,
        availableRoutes: {
            public: [
                'GET /api/events - Get all events (with filtering)',
                'GET /api/events/upcoming - Get upcoming events',
                'GET /api/events/:slug - Get event by slug'
            ],
            protected: [
                'POST /api/events - Create event (requires auth, supports file upload)',
                'PUT /api/events/:id - Update event (requires auth, supports file upload)',
                'DELETE /api/events/:id - Delete event (requires auth)'
            ]
        },
        queryParameters: {
            getAllEvents: {
                page: 'Page number (default: 1)',
                limit: 'Items per page (default: 10, max: 50)',
                active: 'Filter by active status (true/false/all, default: true)',
                upcoming: 'Show only upcoming events (true/false, default: false)',
                location: 'Filter by location (partial match)',
                search: 'Search in title, description, location',
                sortBy: 'Sort by field (event_date, created_at, updated_at, title, location)',
                sortOrder: 'Sort direction (asc/desc, default: asc)'
            },
            getUpcomingEvents: {
                limit: 'Max events to return (default: 5, max: 20)'
            }
        },
        fileUploadInfo: {
            fieldName: 'image',
            maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            allowedTypes: Object.keys(ALLOWED_FILE_TYPES),
            contentType: 'multipart/form-data'
        },
        eventFields: {
            required: ['title', 'event_date', 'location'],
            optional: [
                'description', 
                'image (file) OR image_url', 
                'event_time', 
                'venue_details',
                'booking_end_date', 
                'booking_end_time', 
                'external_payment_link', 
                'registration_link', 
                'is_active'
            ]
        }
    });
});

// Export router
module.exports = router;