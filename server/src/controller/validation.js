const { validateDateFormat, validateTimeFormat } = require('../utils/dateHelper');
const { validateSlugFormat } = require('../utils/slugify');

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
        
        // Validate image URL
        if (image_url !== undefined && image_url !== null && image_url !== '') {
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
        
        // Sanitize the request body
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
                message: 'Blog slug is required'
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

// Validate UUID parameter (for blog IDs)
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
    validateLoginData,
    validatePagination,
    validateSlugParam,
    validateUUIDParam,
    sanitizeInput
};