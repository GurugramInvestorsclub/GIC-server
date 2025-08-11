// Import required modules
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import database connection
const supabase = require('./src/db/supabase');

// Import routes (will be created later)
const authRoutes = require('./src/routes/auth'); // Commented out until needed
const blogRoutes = require('./src/routes/blog');

const eventRoutes = require('./src/routes/events')

// Create Express application
const app = express();

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Setup middleware functions
function setupMiddleware() {
    // Enable CORS for all routes - FIXED VERSION
    app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://gic-adminpanel.vercel.app',  // Admin panel
            'https://mygic.in',                   // ✅ NEW: Your public website
            'http://localhost:5173',              // Local development
            'http://localhost:3000'               // Local development
          ] 
        : [
            'http://localhost:3000', 
            'http://localhost:5173', 
            'https://gic-adminpanel.vercel.app',
            'https://mygic.in'                    // ✅ NEW: Allow in development too
          ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

    // Security middleware
    app.use(helmet());

    // Logging middleware
    app.use(morgan('combined'));

    // Parse JSON requests
    app.use(express.json({ limit: '10mb' }));

    // Parse URL-encoded requests
    app.use(express.urlencoded({ extended: true }));
}

// Setup API routes
function setupRoutes() {
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ 
            status: 'OK', 
            message: 'GIC Blog & Events Server is running',
            timestamp: new Date().toISOString()
        });
    });

    // API base route
    app.get('/api', (req, res) => {
        res.status(200).json({
            message: 'GIC Blog & Events API',
            version: '1.0.0',
            endpoints: {
                auth: '/api/auth',
                blogs: '/api/blogs',
                events: '/api/events (coming soon)'
            }
        });
    });

    // Mount authentication routes (uncomment when auth routes are ready)
    app.use('/api/auth', authRoutes);

    // Mount blog routes
    app.use('/api/blogs', blogRoutes);

    app.use('/api/events', eventRoutes);

    // Handle 404 errors
    app.use((req, res) => {
        res.status(404).json({
            error: 'Route not found',
            message: `The route ${req.originalUrl} does not exist`
        });
    });
}

// Setup global error handling
function setupErrorHandling() {
    app.use((error, req, res, next) => {
        console.error('Server Error:', error);
        
        res.status(error.status || 500).json({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' 
                ? error.message 
                : 'Something went wrong on the server'
        });
    });
}

// Test database connection
async function testDatabaseConnection() {
    try {
        // Test Supabase connection by getting auth info
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.log('Supabase connection test completed');
        } else {
            console.log('Supabase connected successfully');
        }
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}

// Initialize and start the server
async function startServer() {
    try {
        // Test database connection first
        await testDatabaseConnection();

        // Setup all middleware
        setupMiddleware();

        // Setup all routes
        setupRoutes();

        // Setup error handling
        setupErrorHandling();

        // Start the server
        app.listen(PORT, () => {
            console.log('========================================');
            console.log(`GIC Blog & Events Server started`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Server running on port: ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`API base: http://localhost:${PORT}/api`);
            console.log('========================================');
        });

    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start the server
startServer();