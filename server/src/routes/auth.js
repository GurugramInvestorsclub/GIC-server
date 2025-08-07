const express = require('express');
const router = express.Router();

// Import middleware
const { requireAuth } = require('../middleware/authMiddleware');

// Import auth controllers
const {
    login,
    verifyToken,
    getCurrentUser
} = require('../controller/authController');

// Public Routes (no authentication required)

// POST /api/auth/login - Admin login
// Required: email, password
// Returns: JWT token and user info
router.post('/login', login);

// POST /api/auth/verify - Verify JWT token
// Required: Authorization header with Bearer token
// Returns: Token validity and user info
router.post('/verify', verifyToken);

// Protected Routes (authentication required)

// GET /api/auth/me - Get current authenticated user info
// Requires: Valid JWT token in Authorization header
// Returns: Current user details
router.get('/me', requireAuth, getCurrentUser);

// Route not found handler for this router
router.use('*', (req, res) => {
    res.status(404).json({
        error: 'Auth route not found',
        message: `The auth route ${req.originalUrl} does not exist`,
        availableRoutes: {
            public: [
                'POST /api/auth/login - Admin login',
                'POST /api/auth/verify - Verify token'
            ],
            protected: [
                'GET /api/auth/me - Get current user (requires auth)'
            ]
        }
    });
});

// Export router
module.exports = router;