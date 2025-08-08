const supabase = require('../db/supabase');
const { ensureUniqueSlug, validateSlugFormat } = require('../utils/slugify');
const { getCurrentDateTime, formatDateTime, validateDateFormat, validateTimeFormat } = require('../utils/dateHelper');
const { uploadToSupabase, deleteFromSupabase, extractFileNameFromUrl } = require('../utils/fileUpload');

// Get all blogs with optional filtering and pagination
async function getAllBlogs(req, res) {
    try {
        // Extract query parameters
        const {
            page = 1,
            limit = 10,
            published = 'true',
            tags,
            author,
            search,
            sortBy = 'published_date',
            sortOrder = 'desc'
        } = req.query;
        
        // Validate pagination parameters
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 10)); // Max 50 per page
        const offset = (pageNum - 1) * limitNum;
        
        // Build base query
        let query = supabase
            .from('blogs')
            .select(`
                id,
                title,
                content,
                image_url,
                author,
                published_date,
                published_time,
                tags,
                resource_links,
                slug,
                is_published,
                created_at,
                updated_at
            `);
        
        // Apply published filter (default to published only for public access)
        if (published === 'true') {
            query = query.eq('is_published', true);
        } else if (published === 'false') {
            query = query.eq('is_published', false);
        }
        // If published === 'all', don't add filter (admin can see all)
        
        // Apply search filter
        if (search && search.trim()) {
            const searchTerm = search.trim();
            query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
        }
        
        // Apply author filter
        if (author && author.trim()) {
            query = query.ilike('author', `%${author.trim()}%`);
        }
        
        // Apply tags filter
        if (tags && tags.trim()) {
            const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagList.length > 0) {
                // Check if any of the provided tags exist in the blog's tags array
                const tagConditions = tagList.map(tag => `tags.cs.{${tag}}`).join(',');
                query = query.or(tagConditions);
            }
        }
        
        // Apply sorting
        const validSortColumns = ['published_date', 'created_at', 'updated_at', 'title', 'author'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'published_date';
        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
        
        // For published_date, also sort by published_time
        if (sortColumn === 'published_date') {
            query = query.order('published_date', { ascending: sortDirection === 'asc' });
            query = query.order('published_time', { ascending: sortDirection === 'asc' });
        } else {
            query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
        }
        
        // Apply pagination
        query = query.range(offset, offset + limitNum - 1);
        
        // Execute query
        const { data: blogs, error, count } = await query;
        
        if (error) {
            console.error('Database Error fetching blogs:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch blogs'
            });
        }
        
        // Get total count for pagination (separate query for accurate count)
        const { count: totalCount, error: countError } = await supabase
            .from('blogs')
            .select('*', { count: 'exact', head: true })
            .eq('is_published', published === 'true' ? true : published === 'false' ? false : undefined);
        
        if (countError) {
            console.warn('Failed to get total count:', countError);
        }
        
        // Calculate pagination info
        const total = totalCount || 0;
        const totalPages = Math.ceil(total / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;
        
        // Return successful response
        res.status(200).json({
            success: true,
            message: 'Blogs fetched successfully',
            data: {
                blogs: blogs || [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: totalPages,
                    totalItems: total,
                    itemsPerPage: limitNum,
                    hasNextPage: hasNextPage,
                    hasPrevPage: hasPrevPage
                },
                filters: {
                    published: published,
                    tags: tags,
                    author: author,
                    search: search,
                    sortBy: sortColumn,
                    sortOrder: sortDirection
                }
            }
        });
        
    } catch (error) {
        console.error('Get All Blogs Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while fetching blogs'
        });
    }
}

// Get single blog by slug
async function getBlogBySlug(req, res) {
    try {
        const { slug } = req.params;
        
        // Validate slug parameter
        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({
                error: 'Invalid slug',
                message: 'Blog slug is required'
            });
        }
        
        // Validate slug format
        const slugValidation = validateSlugFormat(slug);
        if (!slugValidation.success) {
            return res.status(400).json({
                error: 'Invalid slug format',
                message: slugValidation.error
            });
        }
        
        // Query blog from database
        const { data: blog, error } = await supabase
            .from('blogs')
            .select(`
                id,
                title,
                content,
                image_url,
                author,
                published_date,
                published_time,
                tags,
                resource_links,
                slug,
                is_published,
                created_at,
                updated_at
            `)
            .eq('slug', slug)
            .single();
        
        if (error) {
            console.error('Database Error fetching blog:', error);
            
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Blog not found',
                    message: `No blog found with slug: ${slug}`
                });
            }
            
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch blog'
            });
        }
        
        // Check if blog is published (unless user is authenticated admin)
        if (!blog.is_published && !req.user) {
            return res.status(404).json({
                error: 'Blog not found',
                message: 'Blog is not published or does not exist'
            });
        }
        
        // Return successful response
        res.status(200).json({
            success: true,
            message: 'Blog fetched successfully',
            data: {
                blog: blog
            }
        });
        
    } catch (error) {
        console.error('Get Blog By Slug Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while fetching the blog'
        });
    }
}

// Create new blog (protected route)
async function createBlog(req, res) {
    try {
        // Extract blog data from request body
        const {
            title,
            content,
            image_url,
            author,
            published_date,
            published_time,
            tags = [],
            resource_links = [],
            is_published = false
        } = req.body;
        
        // Validate required fields
        if (!title || !content || !author) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Title, content, and author are required'
            });
        }

        let processedImageUrl = null;

        // Handle file upload or image URL
        if (req.file) {
            // File was uploaded via multer
            const uploadResult = await uploadToSupabase(req.file);
            if (!uploadResult.success) {
                return res.status(400).json({
                    error: 'File upload failed',
                    message: uploadResult.error
                });
            }
            processedImageUrl = uploadResult.data.publicUrl;
        } else if (image_url) {
            // URL was provided
            processedImageUrl = image_url.trim();
        }
        
        // Validate and process published date/time
        let processedDate, processedTime;
        
        if (published_date) {
            const dateValidation = validateDateFormat(published_date);
            if (!dateValidation.success) {
                return res.status(400).json({
                    error: 'Invalid published date',
                    message: dateValidation.error
                });
            }
            processedDate = published_date;
        } else {
            const currentDateTime = getCurrentDateTime();
            processedDate = currentDateTime.data.date;
        }
        
        if (published_time) {
            const timeValidation = validateTimeFormat(published_time);
            if (!timeValidation.success) {
                return res.status(400).json({
                    error: 'Invalid published time',
                    message: timeValidation.error
                });
            }
            processedTime = timeValidation.time;
        } else {
            const currentDateTime = getCurrentDateTime();
            processedTime = currentDateTime.data.time;
        }
        
        // Process tags and resource links (existing code)
        let processedTags = [];
        if (Array.isArray(tags)) {
            processedTags = tags.filter(tag => tag && typeof tag === 'string').map(tag => tag.trim());
        }
        
        let processedResourceLinks = [];
        if (Array.isArray(resource_links)) {
            processedResourceLinks = resource_links.filter(link => 
                link && 
                typeof link === 'object' && 
                link.title && 
                link.url &&
                typeof link.title === 'string' &&
                typeof link.url === 'string'
            );
        }
        
        // Generate unique slug from title
        const slugResult = await ensureUniqueSlug(title.trim());
        if (!slugResult.success) {
            return res.status(500).json({
                error: 'Slug generation failed',
                message: slugResult.error
            });
        }
        
        const currentDateTime = getCurrentDateTime();
        
        // Prepare blog data for insertion
        const blogData = {
            title: title.trim(),
            content: content.trim(),
            image_url: processedImageUrl,
            author: author.trim(),
            published_date: processedDate,
            published_time: processedTime,
            tags: processedTags,
            resource_links: processedResourceLinks,
            slug: slugResult.slug,
            is_published: Boolean(is_published),
            created_at: currentDateTime.data.iso,
            updated_at: currentDateTime.data.iso
        };
        
        // Insert blog into database
        const { data: newBlog, error } = await supabase
            .from('blogs')
            .insert([blogData])
            .select()
            .single();
        
        if (error) {
            // If database insert fails and we uploaded a file, clean it up
            if (req.file && processedImageUrl) {
                const fileNameResult = extractFileNameFromUrl(processedImageUrl);
                if (fileNameResult.success) {
                    await deleteFromSupabase(fileNameResult.fileName);
                }
            }
            
            console.error('Database Error creating blog:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to create blog'
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Blog created successfully',
            data: { blog: newBlog }
        });
        
    } catch (error) {
        console.error('Create Blog Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while creating the blog'
        });
    }
}

// Update existing blog (protected route)
async function updateBlog(req, res) {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                error: 'Missing blog ID',
                message: 'Blog ID is required'
            });
        }
        
        // Check if blog exists
        const { data: existingBlog, error: fetchError } = await supabase
            .from('blogs')
            .select('id, title, slug, image_url')
            .eq('id', id)
            .single();
        
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Blog not found',
                    message: `No blog found with ID: ${id}`
                });
            }
            
            console.error('Database Error fetching blog for update:', fetchError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch blog for update'
            });
        }
        
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
        
        const updateData = {};
        let oldImageUrl = null;
        
        // Handle image update
        if (req.file) {
            // New file uploaded
            const uploadResult = await uploadToSupabase(req.file);
            if (!uploadResult.success) {
                return res.status(400).json({
                    error: 'File upload failed',
                    message: uploadResult.error
                });
            }
            updateData.image_url = uploadResult.data.publicUrl;
            oldImageUrl = existingBlog.image_url; // Save old URL for deletion
        } else if (image_url !== undefined) {
            // URL provided or cleared
            updateData.image_url = image_url ? image_url.trim() : null;
            if (image_url !== existingBlog.image_url) {
                oldImageUrl = existingBlog.image_url; // Save old URL for deletion
            }
        }
        
        // Handle title and slug regeneration
        if (title && title.trim() !== existingBlog.title) {
            updateData.title = title.trim();
            const slugResult = await ensureUniqueSlug(title.trim(), id);
            if (!slugResult.success) {
                return res.status(500).json({
                    error: 'Slug generation failed',
                    message: slugResult.error
                });
            }
            updateData.slug = slugResult.slug;
        }
        
        // Handle other fields (existing logic)
        if (content !== undefined) updateData.content = content.trim();
        if (author !== undefined) updateData.author = author.trim();
        if (is_published !== undefined) updateData.is_published = Boolean(is_published);
        
        if (published_date !== undefined && published_date) {
            const dateValidation = validateDateFormat(published_date);
            if (!dateValidation.success) {
                return res.status(400).json({
                    error: 'Invalid published date',
                    message: dateValidation.error
                });
            }
            updateData.published_date = published_date;
        }
        
        if (published_time !== undefined && published_time) {
            const timeValidation = validateTimeFormat(published_time);
            if (!timeValidation.success) {
                return res.status(400).json({
                    error: 'Invalid published time',
                    message: timeValidation.error
                });
            }
            updateData.published_time = timeValidation.time;
        }
        
        if (tags !== undefined) {
            updateData.tags = Array.isArray(tags) ? 
                tags.filter(tag => tag && typeof tag === 'string').map(tag => tag.trim()) : [];
        }
        
        if (resource_links !== undefined) {
            updateData.resource_links = Array.isArray(resource_links) ? 
                resource_links.filter(link => 
                    link && typeof link === 'object' && link.title && link.url &&
                    typeof link.title === 'string' && typeof link.url === 'string'
                ) : [];
        }
        
        const currentDateTime = getCurrentDateTime();
        updateData.updated_at = currentDateTime.data.iso;
        
        if (Object.keys(updateData).length === 1) { // Only updated_at
            return res.status(400).json({
                error: 'No update data provided',
                message: 'At least one field must be provided for update'
            });
        }
        
        // Update blog in database
        const { data: updatedBlog, error } = await supabase
            .from('blogs')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Database Error updating blog:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to update blog'
            });
        }
        
        // Delete old image file if it was replaced and it's from our storage
        if (oldImageUrl && oldImageUrl.includes('/storage/v1/object/public/blog-images/')) {
            const fileNameResult = extractFileNameFromUrl(oldImageUrl);
            if (fileNameResult.success) {
                await deleteFromSupabase(fileNameResult.fileName);
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Blog updated successfully',
            data: { blog: updatedBlog }
        });
        
    } catch (error) {
        console.error('Update Blog Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while updating the blog'
        });
    }
}

// Delete blog (protected route)
async function deleteBlog(req, res) {
    try {
        const { id } = req.params;
        
        // Validate blog ID
        if (!id) {
            return res.status(400).json({
                error: 'Missing blog ID',
                message: 'Blog ID is required'
            });
        }
        
        // Check if blog exists
        const { data: existingBlog, error: fetchError } = await supabase
            .from('blogs')
            .select('id, title, slug')
            .eq('id', id)
            .single();
        
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Blog not found',
                    message: `No blog found with ID: ${id}`
                });
            }
            
            console.error('Database Error fetching blog for deletion:', fetchError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch blog for deletion'
            });
        }
        
        // Delete blog from database
        const { error } = await supabase
            .from('blogs')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Database Error deleting blog:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to delete blog'
            });
        }
        
        // Return successful response
        res.status(200).json({
            success: true,
            message: 'Blog deleted successfully',
            data: {
                deletedBlog: {
                    id: existingBlog.id,
                    title: existingBlog.title,
                    slug: existingBlog.slug
                }
            }
        });
        
    } catch (error) {
        console.error('Delete Blog Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while deleting the blog'
        });
    }
}

// Get all unique tags from published blogs
async function getBlogTags(req, res) {
    try {
        // Query all published blogs to extract tags
        const { data: blogs, error } = await supabase
            .from('blogs')
            .select('tags')
            .eq('is_published', true);
        
        if (error) {
            console.error('Database Error fetching tags:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch blog tags'
            });
        }
        
        // Extract and deduplicate tags
        const allTags = [];
        
        if (blogs && blogs.length > 0) {
            blogs.forEach(blog => {
                if (Array.isArray(blog.tags)) {
                    allTags.push(...blog.tags);
                }
            });
        }
        
        // Remove duplicates and sort
        const uniqueTags = [...new Set(allTags)]
            .filter(tag => tag && tag.trim())
            .map(tag => tag.trim())
            .sort();
        
        // Return successful response
        res.status(200).json({
            success: true,
            message: 'Blog tags fetched successfully',
            data: {
                tags: uniqueTags,
                totalTags: uniqueTags.length
            }
        });
        
    } catch (error) {
        console.error('Get Blog Tags Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while fetching blog tags'
        });
    }
}

// Export all controller functions
module.exports = {
    getAllBlogs,
    getBlogBySlug,
    createBlog,
    updateBlog,
    deleteBlog,
    getBlogTags
};