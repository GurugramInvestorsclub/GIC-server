const slugify = require('slugify');
const supabase = require('../db/supabase');

// Generate SEO-friendly slug from title
function generateSlug(title) {
    try {
        // Validate input
        if (!title || typeof title !== 'string') {
            throw new Error('Valid title is required to generate slug');
        }
        
        // Clean and trim the title
        const cleanTitle = title.trim();
        
        if (cleanTitle.length === 0) {
            throw new Error('Title cannot be empty');
        }
        
        // Configure slugify options
        const options = {
            replacement: '-',    // Replace spaces with hyphens
            remove: /[*+~.()'"!:@]/g,  // Remove special characters
            lower: true,         // Convert to lowercase
            strict: true,        // Strip special characters
            locale: 'en',        // Use English locale
            trim: true           // Trim leading/trailing replacement chars
        };
        
        // Generate basic slug
        let slug = slugify(cleanTitle, options);
        
        // Ensure slug is not empty after processing
        if (!slug || slug.length === 0) {
            // Fallback: create slug from first few words
            const words = cleanTitle.split(/\s+/).slice(0, 5);
            slug = words.map(word => 
                word.toLowerCase().replace(/[^a-z0-9]/g, '')
            ).filter(word => word.length > 0).join('-');
        }
        
        // Final validation
        if (!slug || slug.length === 0) {
            throw new Error('Unable to generate valid slug from title');
        }
        
        return {
            success: true,
            slug: slug
        };
        
    } catch (error) {
        console.error('Slug Generation Error:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Check if slug already exists in database
async function checkSlugExists(slug, excludeId = null) {
    try {
        // Validate input
        if (!slug || typeof slug !== 'string') {
            throw new Error('Valid slug is required');
        }
        
        // Build query to check slug existence
        let query = supabase
            .from('blogs')
            .select('id, slug')
            .eq('slug', slug);
        
        // Exclude specific blog ID if provided (for updates)
        if (excludeId) {
            query = query.neq('id', excludeId);
        }
        
        // Execute query
        const { data, error } = await query;
        
        if (error) {
            console.error('Database error checking slug:', error);
            throw new Error('Failed to check slug availability');
        }
        
        // Return whether slug exists
        return {
            success: true,
            exists: data && data.length > 0,
            existingBlog: data && data.length > 0 ? data[0] : null
        };
        
    } catch (error) {
        console.error('Slug Check Error:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Generate unique slug by adding numbers if needed
async function ensureUniqueSlug(title, excludeId = null) {
    try {
        // Generate initial slug
        const slugResult = generateSlug(title);
        
        if (!slugResult.success) {
            return slugResult;
        }
        
        let baseSlug = slugResult.slug;
        let finalSlug = baseSlug;
        let counter = 1;
        
        // Keep checking and incrementing until we find a unique slug
        while (true) {
            const existsResult = await checkSlugExists(finalSlug, excludeId);
            
            if (!existsResult.success) {
                return existsResult;
            }
            
            // If slug doesn't exist, we can use it
            if (!existsResult.exists) {
                break;
            }
            
            // If slug exists, try with a number suffix
            counter++;
            finalSlug = `${baseSlug}-${counter}`;
            
            // Prevent infinite loop
            if (counter > 100) {
                throw new Error('Unable to generate unique slug after 100 attempts');
            }
        }
        
        return {
            success: true,
            slug: finalSlug,
            isOriginal: counter === 1
        };
        
    } catch (error) {
        console.error('Unique Slug Generation Error:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Validate slug format
function validateSlugFormat(slug) {
    try {
        // Check if slug is provided
        if (!slug || typeof slug !== 'string') {
            return {
                success: false,
                error: 'Slug must be a non-empty string'
            };
        }
        
        // Check slug length
        if (slug.length < 1 || slug.length > 255) {
            return {
                success: false,
                error: 'Slug must be between 1 and 255 characters'
            };
        }
        
        // Check slug format (lowercase, hyphens, alphanumeric only)
        const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        
        if (!slugPattern.test(slug)) {
            return {
                success: false,
                error: 'Slug can only contain lowercase letters, numbers, and hyphens'
            };
        }
        
        // Check that slug doesn't start or end with hyphen
        if (slug.startsWith('-') || slug.endsWith('-')) {
            return {
                success: false,
                error: 'Slug cannot start or end with a hyphen'
            };
        }
        
        // Check for consecutive hyphens
        if (slug.includes('--')) {
            return {
                success: false,
                error: 'Slug cannot contain consecutive hyphens'
            };
        }
        
        return {
            success: true,
            slug: slug
        };
        
    } catch (error) {
        console.error('Slug Validation Error:', error);
        
        return {
            success: false,
            error: 'Slug validation failed'
        };
    }
}

// Generate slug from existing blog title for migration/update
async function regenerateSlugFromTitle(blogId) {
    try {
        // Get blog title from database
        const { data: blog, error } = await supabase
            .from('blogs')
            .select('id, title, slug')
            .eq('id', blogId)
            .single();
        
        if (error || !blog) {
            throw new Error('Blog not found');
        }
        
        // Generate new unique slug
        const slugResult = await ensureUniqueSlug(blog.title, blogId);
        
        if (!slugResult.success) {
            return slugResult;
        }
        
        // Update blog with new slug
        const { error: updateError } = await supabase
            .from('blogs')
            .update({ 
                slug: slugResult.slug,
                updated_at: new Date().toISOString()
            })
            .eq('id', blogId);
        
        if (updateError) {
            throw new Error('Failed to update blog with new slug');
        }
        
        return {
            success: true,
            oldSlug: blog.slug,
            newSlug: slugResult.slug,
            message: 'Slug regenerated successfully'
        };
        
    } catch (error) {
        console.error('Slug Regeneration Error:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Export all functions
module.exports = {
    generateSlug,
    checkSlugExists,
    ensureUniqueSlug,
    validateSlugFormat,
    regenerateSlugFromTitle
};