const jwt = require('jsonwebtoken');

// Extract JWT token from request headers
function extractTokenFromHeader(req) {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader) {
        return null;
    }
    
    // Check if header starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    // Extract token after 'Bearer '
    const token = authHeader.substring(7);
    return token || null;
}

// Verify JWT token and decode payload
function verifyToken(token) {
    try {
        // Get JWT secret from environment
        const jwtSecret = process.env.JWT_SECRET;
        
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }
        
        // Verify and decode token
        const decoded = jwt.verify(token, jwtSecret);
        return { success: true, data: decoded };
        
    } catch (error) {
        // Handle different JWT errors
        if (error.name === 'TokenExpiredError') {
            return { success: false, error: 'Token has expired' };
        }
        
        if (error.name === 'JsonWebTokenError') {
            return { success: false, error: 'Invalid token' };
        }
        
        if (error.name === 'NotBeforeError') {
            return { success: false, error: 'Token not active yet' };
        }
        
        return { success: false, error: error.message };
    }
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    try {
        // Extract token from request header
        const token = extractTokenFromHeader(req);
        
        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No token provided. Please include Authorization header with Bearer token.'
            });
        }
        
        // Verify the token
        const verification = verifyToken(token);
        
        if (!verification.success) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: verification.error
            });
        }
        
        // Add user information to request object
        req.user = verification.data;
        
        // Add token to request for potential use
        req.token = token;
        
        // Continue to next middleware or route handler
        next();
        
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication process failed'
        });
    }
}

// Optional middleware to check if user is authenticated (doesn't fail if not)
function optionalAuth(req, res, next) {
    try {
        // Extract token from request header
        const token = extractTokenFromHeader(req);
        
        // If no token, just continue without user info
        if (!token) {
            req.user = null;
            return next();
        }
        
        // Verify the token
        const verification = verifyToken(token);
        
        // If verification fails, continue without user info
        if (!verification.success) {
            req.user = null;
            return next();
        }
        
        // Add user information to request object
        req.user = verification.data;
        req.token = token;
        
        // Continue to next middleware or route handler
        next();
        
    } catch (error) {
        console.error('Optional Auth Middleware Error:', error);
        
        // On error, continue without user info
        req.user = null;
        next();
    }
}

// Middleware to check if user has admin role (for future use)
function requireAdmin(req, res, next) {
    try {
        // Check if user is authenticated first
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Admin access required'
            });
        }
        
        // Check if user has admin role
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin privileges required'
            });
        }
        
        // Continue to next middleware or route handler
        next();
        
    } catch (error) {
        console.error('Admin Middleware Error:', error);
        
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authorization process failed'
        });
    }
}

// Utility function to validate token format
function isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
}

// Export all middleware functions
module.exports = {
    requireAuth,
    optionalAuth,
    requireAdmin,
    verifyToken,
    extractTokenFromHeader,
    isValidTokenFormat
};