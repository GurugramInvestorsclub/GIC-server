const { validateDateFormat, validateTimeFormat } = require('../utils/dateHelper');
const { validateSlugFormat } = require('../utils/slugify');
const { validateFileType, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = require('../utils/fileUpload');

// Sanitize input data to prevent XSS and other attacks
function sanitizeInput(data) {
    if (typeof data === 'string') {
        // Remove HTML tags and trim whitespace
        return data
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .trim();
    }
    
    if (Array.isArray(data)) {
        return data.map(item => sanitizeInput(item));
    }
    
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    
    return data;
}

// Validate blog data for creation and updates
function validateBlogData(req, res, next) {
    try {
        const {
            title,
            content,
            image_url,
            author,
            published_date,
            published_time,
            tags,
            resource_links,
            is_published
        } = req.body;
        
        const errors = [];
        
        // Validate title
        if (title !== undefined) {
            if (!title || typeof title !== 'string') {
                errors.push('Title must be a non-empty string');
            } else if (title.trim().length < 3) {
                errors.push('Title must be at least 3 characters long');
            } else if (title.trim().length > 255) {
                errors.push('Title must be less than 255 characters');
            }
        }
        
        // Validate content
        if (content !== undefined) {
            if (!content || typeof content !== 'string') {
                errors.push('Content must be a non-empty string');
            } else if (content.trim().length < 10) {
                errors.push('Content must be at least 10 characters long');
            } else if (content.trim().length > 50000) {
                errors.push('Content must be less than 50,000 characters');
            }
        }
        
        // Validate author
        if (author !== undefined) {
            if (!author || typeof author !== 'string') {
                errors.push('Author must be a non-empty string');
            } else if (author.trim().length < 2) {
                errors.push('Author name must be at least 2 characters long');
            } else if (author.trim().length > 100) {
                errors.push('Author name must be less than 100 characters');
            }
        }
        
        // Validate file upload (if present)
        if (req.file) {
            const fileValidation = validateFileType(req.file);
            if (!fileValidation.success) {
                errors.push(`File upload error: ${fileValidation.error}`);
            }
            
            // If both file and image_url provided, prefer file
            if (image_url) {
                errors.push('Cannot provide both file upload and image_url. Use either file upload or image_url.');
            }
        }
        
        // Validate image URL (only if no file uploaded)
        if (!req.file && image_url !== undefined && image_url !== null && image_url !== '') {
            if (typeof image_url !== 'string') {
                errors.push('Image URL must be a string');
            } else {
                const urlPattern = /^https?:\/\/.+/;
                if (!urlPattern.test(image_url.trim())) {
                    errors.push('Image URL must be a valid HTTP/HTTPS URL');
                }
                if (image_url.trim().length > 500) {
                    errors.push('Image URL must be less than 500 characters');
                }
            }
        }
        
        // Validate published date
        if (published_date !== undefined && published_date !== null && published_date !== '') {
            const dateValidation = validateDateFormat(published_date);
            if (!dateValidation.success) {
                errors.push(`Published date error: ${dateValidation.error}`);
            }
        }
        
        // Validate published time
        if (published_time !== undefined && published_time !== null && published_time !== '') {
            const timeValidation = validateTimeFormat(published_time);
            if (!timeValidation.success) {
                errors.push(`Published time error: ${timeValidation.error}`);
            }
        }
        
        // Validate tags
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                errors.push('Tags must be an array');
            } else {
                if (tags.length > 20) {
                    errors.push('Maximum 20 tags allowed');
                }
                
                tags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        errors.push(`Tag at index ${index} must be a string`);
                    } else if (tag.trim().length === 0) {
                        errors.push(`Tag at index ${index} cannot be empty`);
                    } else if (tag.trim().length > 50) {
                        errors.push(`Tag at index ${index} must be less than 50 characters`);
                    }
                });
            }
        }
        
        // Validate resource links
        if (resource_links !== undefined) {
            if (!Array.isArray(resource_links)) {
                errors.push('Resource links must be an array');
            } else {
                if (resource_links.length > 10) {
                    errors.push('Maximum 10 resource links allowed');
                }
                
                resource_links.forEach((link, index) => {
                    if (typeof link !== 'object' || link === null) {
                        errors.push(`Resource link at index ${index} must be an object`);
                    } else {
                        if (!link.title || typeof link.title !== 'string') {
                            errors.push(`Resource link at index ${index} must have a title (string)`);
                        } else if (link.title.trim().length > 100) {
                            errors.push(`Resource link title at index ${index} must be less than 100 characters`);
                        }
                        
                        if (!link.url || typeof link.url !== 'string') {
                            errors.push(`Resource link at index ${index} must have a URL (string)`);
                        } else {
                            const urlPattern = /^https?:\/\/.+/;
                            if (!urlPattern.test(link.url.trim())) {
                                errors.push(`Resource link URL at index ${index} must be a valid HTTP/HTTPS URL`);
                            }
                            if (link.url.trim().length > 500) {
                                errors.push(`Resource link URL at index ${index} must be less than 500 characters`);
                            }
                        }
                    }
                });
            }
        }
        
        // Validate is_published
        if (is_published !== undefined) {
            if (typeof is_published !== 'boolean') {
                errors.push('is_published must be a boolean (true or false)');
            }
        }
        
        // If there are validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'The provided blog data is invalid',
                details: errors
            });
        }
        
        // Sanitize the request body (but don't sanitize file)
        req.body = sanitizeInput(req.body);
        
        // Continue to next middleware
        next();
        
    } catch (error) {
        console.error('Blog Validation Error:', error);
        
        res.status(500).json({
            error: 'Validation error',
            message: 'An error occurred during data validation'
        });
    }
}

// NEW: Validate event data for creation and updates
function validateEventData(req, res, next) {
    try {
        const {
            title,
            description,
            image_url,
            event_date,
            event_time,
            location,
            venue_details,
            booking_end_date,
            booking_end_time,
            external_payment_link,
            registration_link,
            is_active
        } = req.body;
        
        const errors = [];
        
        // Validate title
        if (title !== undefined) {
            if (!title || typeof title !== 'string') {
                errors.push('Title must be a non-empty string');
            } else if (title.trim().length < 3) {
                errors.push('Title must be at least 3 characters long');
            } else if (title.trim().length > 255) {
                errors.push('Title must be less than 255 characters');
            }
        }
        
        // Validate description (optional)
        if (description !== undefined && description !== null && description !== '') {
            if (typeof description !== 'string') {
                errors.push('Description must be a string');
            } else if (description.trim().length > 10000) {
                errors.push('Description must be less than 10,000 characters');
            }
        }
        
        // Validate location
        if (location !== undefined) {
            if (!location || typeof location !== 'string') {
                errors.push('Location must be a non-empty string');
            } else if (location.trim().length < 3) {
                errors.push('Location must be at least 3 characters long');
            } else if (location.trim().length > 255) {
                errors.push('Location must be less than 255 characters');
            }
        }
        
        // Validate venue details (optional)
        if (venue_details !== undefined && venue_details !== null && venue_details !== '') {
            if (typeof venue_details !== 'string') {
                errors.push('Venue details must be a string');
            } else if (venue_details.trim().length > 2000) {
                errors.push('Venue details must be less than 2,000 characters');
            }
        }
        
        // Validate file upload (if present)
        if (req.file) {
            const fileValidation = validateFileType(req.file);
            if (!fileValidation.success) {
                errors.push(`File upload error: ${fileValidation.error}`);
            }
            
            // If both file and image_url provided, prefer file
            if (image_url) {
                errors.push('Cannot provide both file upload and image_url. Use either file upload or image_url.');
            }
        }
        
        // Validate image URL (only if no file uploaded)
        if (!req.file && image_url !== undefined && image_url !== null && image_url !== '') {
            if (typeof image_url !== 'string') {
                errors.push('Image URL must be a string');
            } else {
                const urlPattern = /^https?:\/\/.+/;
                if (!urlPattern.test(image_url.trim())) {
                    errors.push('Image URL must be a valid HTTP/HTTPS URL');
                }
                if (image_url.trim().length > 500) {
                    errors.push('Image URL must be less than 500 characters');
                }
            }
        }
        
        // Validate event date
        if (event_date !== undefined && event_date !== null && event_date !== '') {
            const dateValidation = validateDateFormat(event_date);
            if (!dateValidation.success) {
                errors.push(`Event date error: ${dateValidation.error}`);
            } else {
                // Check if event date is in the future
                const eventDate = new Date(event_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time for fair comparison
                
                if (eventDate < today) {
                    errors.push('Event date must be today or in the future');
                }
            }
        }
        
        // Validate event time
        if (event_time !== undefined && event_time !== null && event_time !== '') {
            const timeValidation = validateTimeFormat(event_time);
            if (!timeValidation.success) {
                errors.push(`Event time error: ${timeValidation.error}`);
            }
        }
        
        // Validate booking end date
        if (booking_end_date !== undefined && booking_end_date !== null && booking_end_date !== '') {
            const dateValidation = validateDateFormat(booking_end_date);
            if (!dateValidation.success) {
                errors.push(`Booking end date error: ${dateValidation.error}`);
            } else if (event_date) {
                // Booking end date should not be after event date
                if (booking_end_date > event_date) {
                    errors.push('Booking end date cannot be after event date');
                }
            }
        }
        
        // Validate booking end time
        if (booking_end_time !== undefined && booking_end_time !== null && booking_end_time !== '') {
            const timeValidation = validateTimeFormat(booking_end_time);
            if (!timeValidation.success) {
                errors.push(`Booking end time error: ${timeValidation.error}`);
            }
        }
        
        // Validate external payment link (optional)
        if (external_payment_link !== undefined && external_payment_link !== null && external_payment_link !== '') {
            if (typeof external_payment_link !== 'string') {
                errors.push('External payment link must be a string');
            } else {
                const urlPattern = /^https?:\/\/.+/;
                if (!urlPattern.test(external_payment_link.trim())) {
                    errors.push('External payment link must be a valid HTTP/HTTPS URL');
                }
                if (external_payment_link.trim().length > 500) {
                    errors.push('External payment link must be less than 500 characters');
                }
            }
        }
        
        // Validate registration link (optional)
        if (registration_link !== undefined && registration_link !== null && registration_link !== '') {
            if (typeof registration_link !== 'string') {
                errors.push('Registration link must be a string');
            } else {
                const urlPattern = /^https?:\/\/.+/;
                if (!urlPattern.test(registration_link.trim())) {
                    errors.push('Registration link must be a valid HTTP/HTTPS URL');
                }
                if (registration_link.trim().length > 500) {
                    errors.push('Registration link must be less than 500 characters');
                }
            }
        }
        
        // Validate is_active
        if (is_active !== undefined) {
            if (typeof is_active !== 'boolean') {
                errors.push('is_active must be a boolean (true or false)');
            }
        }
        
        // If there are validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'The provided event data is invalid',
                details: errors
            });
        }
        
        // Sanitize the request body (but don't sanitize file)
        req.body = sanitizeInput(req.body);
        
        // Continue to next middleware
        next();
        
    } catch (error) {
        console.error('Event Validation Error:', error);
        
        res.status(500).json({
            error: 'Validation error',
            message: 'An error occurred during event data validation'
        });
    }
}

// Validate login data
function validateLoginData(req, res, next) {
    try {
        const { email, password } = req.body;
        const errors = [];
        
        // Validate email
        if (!email || typeof email !== 'string') {
            errors.push('Email is required and must be a string');
        } else {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email.trim())) {
                errors.push('Email must be a valid email address');
            }
            if (email.trim().length > 255) {
                errors.push('Email must be less than 255 characters');
            }
        }
        
        // Validate password
        if (!password || typeof password !== 'string') {
            errors.push('Password is required and must be a string');
        } else {
            if (password.length < 6) {
                errors.push('Password must be at least 6 characters long');
            }
            if (password.length > 255) {
                errors.push('Password must be less than 255 characters');
            }
        }
        
        // If there are validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'The provided login data is invalid',
                details: errors
            });
        }
        
        // Sanitize the request body
        req.body = sanitizeInput(req.body);
        
        // Continue to next middleware
        next();
        
    } catch (error) {
        console.error('Login Validation Error:', error);
        
        res.status(500).json({
            error: 'Validation error',
            message: 'An error occurred during login data validation'
        });
    }
}

// Validate pagination parameters
function validatePagination(req, res, next) {
    try {
        const { page, limit } = req.query;
        
        // Validate page
        if (page !== undefined) {
            const pageNum = parseInt(page, 10);
            if (isNaN(pageNum) || pageNum < 1) {
                return res.status(400).json({
                    error: 'Invalid pagination',
                    message: 'Page must be a positive integer'
                });
            }
            if (pageNum > 10000) {
                return res.status(400).json({
                    error: 'Invalid pagination',
                    message: 'Page number too large (max: 10000)'
                });
            }
        }
        
        // Validate limit
        if (limit !== undefined) {
            const limitNum = parseInt(limit, 10);
            if (isNaN(limitNum) || limitNum < 1) {
                return res.status(400).json({
                    error: 'Invalid pagination',
                    message: 'Limit must be a positive integer'
                });
            }
            if (limitNum > 50) {
                return res.status(400).json({
                    error: 'Invalid pagination',
                    message: 'Limit cannot exceed 50 items per page'
                });
            }
        }
        
        // Continue to next middleware
        next();
        
    } catch (error) {
        console.error('Pagination Validation Error:', error);
        
        res.status(500).json({
            error: 'Validation error',
            message: 'An error occurred during pagination validation'
        });
    }
}

// Validate slug parameter
function validateSlugParam(req, res, next) {
    try {
        const { slug } = req.params;
        
        if (!slug) {
            return res.status(400).json({
                error: 'Missing slug',
                message: 'Slug is required'
            });
        }
        
        const slugValidation = validateSlugFormat(slug);
        if (!slugValidation.success) {
            return res.status(400).json({
                error: 'Invalid slug format',
                message: slugValidation.error
            });
        }
        
        // Continue to next middleware
        next();
        
    } catch (error) {
        console.error('Slug Validation Error:', error);
        
        res.status(500).json({
            error: 'Validation error',
            message: 'An error occurred during slug validation'
        });
    }
}

// Validate UUID parameter (for blog/event IDs)
function validateUUIDParam(paramName = 'id') {
    return (req, res, next) => {
        try {
            const paramValue = req.params[paramName];
            
            if (!paramValue) {
                return res.status(400).json({
                    error: `Missing ${paramName}`,
                    message: `${paramName} parameter is required`
                });
            }
            
            // UUID v4 pattern
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            
            if (!uuidPattern.test(paramValue)) {
                return res.status(400).json({
                    error: `Invalid ${paramName} format`,
                    message: `${paramName} must be a valid UUID`
                });
            }
            
            // Continue to next middleware
            next();
            
        } catch (error) {
            console.error(`UUID Validation Error for ${paramName}:`, error);
            
            res.status(500).json({
                error: 'Validation error',
                message: `An error occurred during ${paramName} validation`
            });
        }
    };
}

// Export all validation functions
module.exports = {
    validateBlogData,
    validateEventData,        // NEW: Event validation function
    validateLoginData,
    validatePagination,
    validateSlugParam,
    validateUUIDParam,
    sanitizeInput
};