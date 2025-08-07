const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Get JWT secret from environment variables
function getJWTSecret() {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    
    return secret;
}

// Generate JWT token for authenticated user
function generateJWT(userData) {
    try {
        const secret = getJWTSecret();
        
        // Prepare payload with user information
        const payload = {
            id: userData.id,
            email: userData.email,
            role: userData.role || 'admin',
            iat: Math.floor(Date.now() / 1000), // Issued at time
        };
        
        // JWT options
        const options = {
            expiresIn: '24h', // Token expires in 24 hours
            issuer: 'gic-blog-server',
            audience: 'gic-admin'
        };
        
        // Generate and return token
        const token = jwt.sign(payload, secret, options);
        
        return {
            success: true,
            token: token,
            expiresIn: '24h'
        };
        
    } catch (error) {
        console.error('JWT Generation Error:', error);
        
        return {
            success: false,
            error: 'Failed to generate authentication token'
        };
    }
}

// Verify and decode JWT token
function verifyJWT(token) {
    try {
        const secret = getJWTSecret();
        
        // Verify token with options
        const options = {
            issuer: 'gic-blog-server',
            audience: 'gic-admin'
        };
        
        const decoded = jwt.verify(token, secret, options);
        
        return {
            success: true,
            data: decoded
        };
        
    } catch (error) {
        console.error('JWT Verification Error:', error);
        
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            return {
                success: false,
                error: 'Token has expired',
                code: 'EXPIRED'
            };
        }
        
        if (error.name === 'JsonWebTokenError') {
            return {
                success: false,
                error: 'Invalid token format',
                code: 'INVALID'
            };
        }
        
        if (error.name === 'NotBeforeError') {
            return {
                success: false,
                error: 'Token not active yet',
                code: 'NOT_ACTIVE'
            };
        }
        
        return {
            success: false,
            error: 'Token verification failed',
            code: 'VERIFICATION_FAILED'
        };
    }
}

// Encrypt password using JWT secret as key
function encryptPassword(plainPassword) {
    try {
        const secret = getJWTSecret();
        
        // Validate input
        if (!plainPassword || typeof plainPassword !== 'string') {
            throw new Error('Valid password is required');
        }
        
        // Create a hash using the JWT secret
        const hash = crypto.createHmac('sha256', secret);
        hash.update(plainPassword);
        const encryptedPassword = hash.digest('hex');
        
        return {
            success: true,
            encryptedPassword: encryptedPassword
        };
        
    } catch (error) {
        console.error('Password Encryption Error:', error);
        
        return {
            success: false,
            error: 'Failed to encrypt password'
        };
    }
}

// Compare plain password with encrypted password
function comparePassword(plainPassword, encryptedPassword) {
    try {
        // Validate inputs
        if (!plainPassword || !encryptedPassword) {
            return {
                success: false,
                match: false,
                error: 'Both passwords are required for comparison'
            };
        }
        
        // Encrypt the plain password
        const encryptionResult = encryptPassword(plainPassword);
        
        if (!encryptionResult.success) {
            return {
                success: false,
                match: false,
                error: 'Failed to process password for comparison'
            };
        }
        
        // Compare the encrypted versions
        const isMatch = encryptionResult.encryptedPassword === encryptedPassword;
        
        return {
            success: true,
            match: isMatch
        };
        
    } catch (error) {
        console.error('Password Comparison Error:', error);
        
        return {
            success: false,
            match: false,
            error: 'Password comparison failed'
        };
    }
}

// Generate a secure random password (utility function)
function generateSecurePassword(length = 12) {
    try {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }
        
        return {
            success: true,
            password: password
        };
        
    } catch (error) {
        console.error('Password Generation Error:', error);
        
        return {
            success: false,
            error: 'Failed to generate secure password'
        };
    }
}

// Decode JWT without verification (for debugging)
function decodeJWT(token) {
    try {
        // Decode without verification
        const decoded = jwt.decode(token, { complete: true });
        
        if (!decoded) {
            return {
                success: false,
                error: 'Invalid token format'
            };
        }
        
        return {
            success: true,
            header: decoded.header,
            payload: decoded.payload,
            signature: decoded.signature
        };
        
    } catch (error) {
        console.error('JWT Decode Error:', error);
        
        return {
            success: false,
            error: 'Failed to decode token'
        };
    }
}

// Check if token is expired (without verification)
function isTokenExpired(token) {
    try {
        const decodedResult = decodeJWT(token);
        
        if (!decodedResult.success) {
            return {
                success: false,
                error: 'Cannot decode token'
            };
        }
        
        const currentTime = Math.floor(Date.now() / 1000);
        const expirationTime = decodedResult.payload.exp;
        
        return {
            success: true,
            expired: currentTime >= expirationTime,
            expiresAt: new Date(expirationTime * 1000).toISOString()
        };
        
    } catch (error) {
        console.error('Token Expiration Check Error:', error);
        
        return {
            success: false,
            error: 'Failed to check token expiration'
        };
    }
}

// Export all functions
module.exports = {
    generateJWT,
    verifyJWT,
    encryptPassword,
    comparePassword,
    generateSecurePassword,
    decodeJWT,
    isTokenExpired
};