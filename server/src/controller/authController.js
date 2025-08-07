const supabase = require('../db/supabase');
const { generateJWT, verifyJWT, comparePassword } = require('../utils/jwtHelper');

// Login function - authenticate admin and return JWT token
async function login(req, res) {
    try {
        // Extract email and password from request body
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Both email and password are required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            });
        }
        
        // Query admin user from database
        const { data: adminUser, error: dbError } = await supabase
            .from('admin_users')
            .select('id, email, encrypted_password, is_active')
            .eq('email', email.toLowerCase().trim())
            .single();
        
        // Handle database errors
        if (dbError) {
            console.error('Database Error during login:', dbError);
            
            // If no user found
            if (dbError.code === 'PGRST116') {
                return res.status(401).json({
                    error: 'Authentication failed',
                    message: 'Invalid email or password'
                });
            }
            
            // Other database errors
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to process login request'
            });
        }
        
        // Check if admin user exists
        if (!adminUser) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid email or password'
            });
        }
        
        // Check if admin account is active
        if (!adminUser.is_active) {
            return res.status(401).json({
                error: 'Account disabled',
                message: 'This admin account has been deactivated'
            });
        }
        
        // Compare provided password with stored encrypted password
        const passwordComparison = comparePassword(password, adminUser.encrypted_password);
        
        if (!passwordComparison.success) {
            console.error('Password comparison failed:', passwordComparison.error);
            return res.status(500).json({
                error: 'Authentication error',
                message: 'Unable to verify credentials'
            });
        }
        
        // Check if passwords match
        if (!passwordComparison.match) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid email or password'
            });
        }
        
        // Prepare user data for JWT token
        const userData = {
            id: adminUser.id,
            email: adminUser.email,
            role: 'admin'
        };
        
        // Generate JWT token
        const tokenResult = generateJWT(userData);
        
        if (!tokenResult.success) {
            console.error('Token generation failed:', tokenResult.error);
            return res.status(500).json({
                error: 'Authentication error',
                message: 'Unable to generate access token'
            });
        }
        
        // Update last login time (optional)
        const { error: updateError } = await supabase
            .from('admin_users')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', adminUser.id);
        
        if (updateError) {
            console.warn('Failed to update last login time:', updateError);
            // Don't fail the login for this non-critical error
        }
        
        // Return successful login response
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token: tokenResult.token,
                expiresIn: tokenResult.expiresIn,
                user: {
                    id: adminUser.id,
                    email: adminUser.email,
                    role: 'admin'
                }
            }
        });
        
    } catch (error) {
        console.error('Login Controller Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred during login'
        });
    }
}

// Verify token function - check if JWT token is valid
async function verifyToken(req, res) {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Missing token',
                message: 'Authorization header with Bearer token is required'
            });
        }
        
        // Extract token from header
        const token = authHeader.substring(7);
        
        if (!token) {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Token not found in Authorization header'
            });
        }
        
        // Verify JWT token
        const verificationResult = verifyJWT(token);
        
        if (!verificationResult.success) {
            return res.status(401).json({
                error: 'Token verification failed',
                message: verificationResult.error,
                code: verificationResult.code
            });
        }
        
        // Optional: Check if user still exists and is active in database
        const { data: adminUser, error: dbError } = await supabase
            .from('admin_users')
            .select('id, email, is_active')
            .eq('id', verificationResult.data.id)
            .single();
        
        if (dbError || !adminUser) {
            return res.status(401).json({
                error: 'User not found',
                message: 'Admin user no longer exists'
            });
        }
        
        if (!adminUser.is_active) {
            return res.status(401).json({
                error: 'Account disabled',
                message: 'Admin account has been deactivated'
            });
        }
        
        // Return successful verification response
        res.status(200).json({
            success: true,
            message: 'Token is valid',
            data: {
                user: {
                    id: verificationResult.data.id,
                    email: verificationResult.data.email,
                    role: verificationResult.data.role
                },
                tokenInfo: {
                    issuedAt: new Date(verificationResult.data.iat * 1000).toISOString(),
                    expiresAt: new Date(verificationResult.data.exp * 1000).toISOString()
                }
            }
        });
        
    } catch (error) {
        console.error('Token Verification Controller Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred during token verification'
        });
    }
}

// Get current authenticated user info (bonus function)
async function getCurrentUser(req, res) {
    try {
        // This function assumes requireAuth middleware was used
        // so req.user should already contain user info
        
        if (!req.user) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'User information not available'
            });
        }
        
        // Get fresh user data from database
        const { data: adminUser, error: dbError } = await supabase
            .from('admin_users')
            .select('id, email, is_active, created_at, updated_at')
            .eq('id', req.user.id)
            .single();
        
        if (dbError || !adminUser) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Admin user not found in database'
            });
        }
        
        // Return user information
        res.status(200).json({
            success: true,
            message: 'User information retrieved successfully',
            data: {
                user: {
                    id: adminUser.id,
                    email: adminUser.email,
                    role: 'admin',
                    isActive: adminUser.is_active,
                    createdAt: adminUser.created_at,
                    lastUpdated: adminUser.updated_at
                }
            }
        });
        
    } catch (error) {
        console.error('Get Current User Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Unable to retrieve user information'
        });
    }
}

// Export all controller functions
module.exports = {
    login,
    verifyToken,
    getCurrentUser
};