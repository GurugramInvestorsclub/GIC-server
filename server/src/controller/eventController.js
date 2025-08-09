const supabase = require('../db/supabase');
const { ensureUniqueSlug, validateSlugFormat } = require('../utils/slugify');
const { getCurrentDateTime, formatDateTime, validateDateFormat, validateTimeFormat, isFutureDate } = require('../utils/dateHelper');
const { uploadToSupabase, deleteFromSupabase, extractFileNameFromUrl } = require('../utils/fileUpload');

// Helper function to parse JSON fields from multipart/form-data
function parseMultipartFields(req) {
    console.log('Event - Before parsing:', req.body);
    
    // List of text fields that should be null if empty
    const optionalTextFields = [
        'description',
        'venue_details', 
        'external_payment_link',
        'registration_link',
        'image_url',
        'event_time',
        'booking_end_date',
        'booking_end_time'
    ];
    
    // Convert empty strings to null for optional text fields
    optionalTextFields.forEach(field => {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] === 'string') {
                // Convert empty strings or whitespace-only strings to null
                req.body[field] = req.body[field].trim() || null;
            }
        }
    });
    
    // Handle required text fields (ensure they're trimmed but not null)
    const requiredTextFields = ['title', 'location'];
    requiredTextFields.forEach(field => {
        if (req.body[field] !== undefined && typeof req.body[field] === 'string') {
            req.body[field] = req.body[field].trim();
        }
    });
    
    // Parse is_active boolean from string
    if (req.body.is_active !== undefined) {
        if (typeof req.body.is_active === 'string') {
            // Convert string "true"/"false" to actual boolean
            req.body.is_active = req.body.is_active.toLowerCase() === 'true';
        } else {
            // Ensure it's a boolean
            req.body.is_active = Boolean(req.body.is_active);
        }
    }
    
    // Handle date fields (ensure proper format, convert empty to null)
    const dateFields = ['event_date', 'booking_end_date'];
    dateFields.forEach(field => {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] === 'string') {
                req.body[field] = req.body[field].trim() || null;
            }
        }
    });
    
    // Handle time fields (ensure proper format, convert empty to null)  
    const timeFields = ['event_time', 'booking_end_time'];
    timeFields.forEach(field => {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] === 'string') {
                req.body[field] = req.body[field].trim() || null;
            }
        }
    });
    
    console.log('Event - After parsing:', req.body);
}

// Helper function to check if booking is still open
function isBookingOpen(bookingEndDate, bookingEndTime) {
    if (!bookingEndDate) return true; // No end date means always open
    
    try {
        const now = new Date();
        const endDateTime = new Date(`${bookingEndDate}T${bookingEndTime || '23:59:59'}.000Z`);
        return now <= endDateTime;
    } catch (error) {
        console.error('Error checking booking status:', error);
        return true; // Default to open if error
    }
}

// Get all events with optional filtering and pagination
async function getAllEvents(req, res) {
    try {
        // Extract query parameters
        const {
            page = 1,
            limit = 10,
            active = 'true',
            location,
            search,
            sortBy = 'event_date',
            sortOrder = 'asc',
            upcoming = 'false'
        } = req.query;
        
        // Validate pagination parameters
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 10)); // Max 50 per page
        const offset = (pageNum - 1) * limitNum;
        
        // Build base query
        let query = supabase
            .from('events')
            .select(`
                id,
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
                slug,
                is_active,
                created_at,
                updated_at
            `);
        
        // Apply active filter (default to active only for public access)
        if (active === 'true') {
            query = query.eq('is_active', true);
        } else if (active === 'false') {
            query = query.eq('is_active', false);
        }
        // If active === 'all', don't add filter (admin can see all)
        
        // Apply upcoming filter
        if (upcoming === 'true') {
            const today = new Date().toISOString().split('T')[0];
            query = query.gte('event_date', today);
        }
        
        // Apply search filter
        if (search && search.trim()) {
            const searchTerm = search.trim();
            query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);
        }
        
        // Apply location filter
        if (location && location.trim()) {
            query = query.ilike('location', `%${location.trim()}%`);
        }
        
        // Apply sorting
        const validSortColumns = ['event_date', 'created_at', 'updated_at', 'title', 'location'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'event_date';
        const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc';
        
        // For event_date, also sort by event_time
        if (sortColumn === 'event_date') {
            query = query.order('event_date', { ascending: sortDirection === 'asc' });
            query = query.order('event_time', { ascending: sortDirection === 'asc' });
        } else {
            query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
        }
        
        // Apply pagination
        query = query.range(offset, offset + limitNum - 1);
        
        // Execute query
        const { data: events, error } = await query;
        
        if (error) {
            console.error('Database Error fetching events:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch events'
            });
        }
        
        // Add booking status to each event
        const eventsWithStatus = events.map(event => ({
            ...event,
            booking_open: isBookingOpen(event.booking_end_date, event.booking_end_time)
        }));
        
        // Get total count for pagination (separate query for accurate count)
        let countQuery = supabase.from('events').select('*', { count: 'exact', head: true });
        
        if (active === 'true') {
            countQuery = countQuery.eq('is_active', true);
        } else if (active === 'false') {
            countQuery = countQuery.eq('is_active', false);
        }
        
        if (upcoming === 'true') {
            const today = new Date().toISOString().split('T')[0];
            countQuery = countQuery.gte('event_date', today);
        }
        
        const { count: totalCount, error: countError } = await countQuery;
        
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
            message: 'Events fetched successfully',
            data: {
                events: eventsWithStatus || [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: totalPages,
                    totalItems: total,
                    itemsPerPage: limitNum,
                    hasNextPage: hasNextPage,
                    hasPrevPage: hasPrevPage
                },
                filters: {
                    active: active,
                    upcoming: upcoming,
                    location: location,
                    search: search,
                    sortBy: sortColumn,
                    sortOrder: sortDirection
                }
            }
        });
        
    } catch (error) {
        console.error('Get All Events Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while fetching events'
        });
    }
}

// Get single event by slug
async function getEventBySlug(req, res) {
    try {
        const { slug } = req.params;
        
        // Validate slug parameter
        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({
                error: 'Invalid slug',
                message: 'Event slug is required'
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
        
        // Query event from database
        const { data: event, error } = await supabase
            .from('events')
            .select(`
                id,
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
                slug,
                is_active,
                created_at,
                updated_at
            `)
            .eq('slug', slug)
            .single();
        
        if (error) {
            console.error('Database Error fetching event:', error);
            
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Event not found',
                    message: `No event found with slug: ${slug}`
                });
            }
            
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch event'
            });
        }
        
        // Check if event is active (unless user is authenticated admin)
        if (!event.is_active && !req.user) {
            return res.status(404).json({
                error: 'Event not found',
                message: 'Event is not active or does not exist'
            });
        }
        
        // Add booking status
        const eventWithStatus = {
            ...event,
            booking_open: isBookingOpen(event.booking_end_date, event.booking_end_time)
        };
        
        // Return successful response
        res.status(200).json({
            success: true,
            message: 'Event fetched successfully',
            data: {
                event: eventWithStatus
            }
        });
        
    } catch (error) {
        console.error('Get Event By Slug Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while fetching the event'
        });
    }
}

// Get upcoming events (public endpoint)
async function getUpcomingEvents(req, res) {
    try {
        const { limit = 5 } = req.query;
        const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10) || 5)); // Max 20
        
        const today = new Date().toISOString().split('T')[0];
        
        // Query upcoming active events
        const { data: events, error } = await supabase
            .from('events')
            .select(`
                id,
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
                slug,
                is_active,
                created_at
            `)
            .eq('is_active', true)
            .gte('event_date', today)
            .order('event_date', { ascending: true })
            .order('event_time', { ascending: true })
            .limit(limitNum);
        
        if (error) {
            console.error('Database Error fetching upcoming events:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch upcoming events'
            });
        }
        
        // Add booking status to each event
        const eventsWithStatus = events.map(event => ({
            ...event,
            booking_open: isBookingOpen(event.booking_end_date, event.booking_end_time)
        }));
        
        res.status(200).json({
            success: true,
            message: 'Upcoming events fetched successfully',
            data: {
                events: eventsWithStatus || [],
                totalEvents: eventsWithStatus.length
            }
        });
        
    } catch (error) {
        console.error('Get Upcoming Events Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while fetching upcoming events'
        });
    }
}

// Create new event (protected route)
async function createEvent(req, res) {
    try {
        // Parse multipart fields first
        // parseMultipartFields(req);
        
        // Extract event data from request body
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
            is_active = true
        } = req.body;
        
        console.log('CreateEvent - Received data:', req.body);
        
        // Validate required fields
        if (!title || !event_date || !location) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Title, event date, and location are required'
            });
        }

        let processedImageUrl = null;

        // Handle file upload or image URL
        if (req.file) {
            const uploadResult = await uploadToSupabase(req.file);
            if (!uploadResult.success) {
                return res.status(400).json({
                    error: 'File upload failed',
                    message: uploadResult.error
                });
            }
            processedImageUrl = uploadResult.data.publicUrl;
        } else if (image_url) {
            processedImageUrl = image_url.trim();
        }
        
        // Validate event date
        const eventDateValidation = validateDateFormat(event_date);
        if (!eventDateValidation.success) {
            return res.status(400).json({
                error: 'Invalid event date',
                message: eventDateValidation.error
            });
        }
        
        // Check if event date is in the future
        const futureCheck = isFutureDate(event_date);
        if (futureCheck.success && !futureCheck.isFuture) {
            return res.status(400).json({
                error: 'Invalid event date',
                message: 'Event date must be in the future'
            });
        }
        
        // Validate event time if provided
        let processedEventTime = null;
        if (event_time) {
            const timeValidation = validateTimeFormat(event_time);
            if (!timeValidation.success) {
                return res.status(400).json({
                    error: 'Invalid event time',
                    message: timeValidation.error
                });
            }
            processedEventTime = timeValidation.time;
        }
        
        // Validate booking end date if provided
        let processedBookingEndDate = null;
        let processedBookingEndTime = null;
        
        if (booking_end_date) {
            const bookingDateValidation = validateDateFormat(booking_end_date);
            if (!bookingDateValidation.success) {
                return res.status(400).json({
                    error: 'Invalid booking end date',
                    message: bookingDateValidation.error
                });
            }
            
            // Booking end date should not be after event date
            if (booking_end_date > event_date) {
                return res.status(400).json({
                    error: 'Invalid booking end date',
                    message: 'Booking end date cannot be after event date'
                });
            }
            
            processedBookingEndDate = booking_end_date;
            
            // Validate booking end time if provided
            if (booking_end_time) {
                const bookingTimeValidation = validateTimeFormat(booking_end_time);
                if (!bookingTimeValidation.success) {
                    return res.status(400).json({
                        error: 'Invalid booking end time',
                        message: bookingTimeValidation.error
                    });
                }
                processedBookingEndTime = bookingTimeValidation.time;
            }
        }
        
        // Validate external payment link if provided
        if (external_payment_link && external_payment_link.trim()) {
            const urlPattern = /^https?:\/\/.+/;
            if (!urlPattern.test(external_payment_link.trim())) {
                return res.status(400).json({
                    error: 'Invalid external payment link',
                    message: 'External payment link must be a valid HTTP/HTTPS URL'
                });
            }
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
        
        // Prepare event data for insertion
        const eventData = {
            title: title.trim(),
            description: description ? description.trim() : null,
            image_url: processedImageUrl,
            event_date: event_date,
            event_time: processedEventTime,
            location: location.trim(),
            venue_details: venue_details ? venue_details.trim() : null,
            booking_end_date: processedBookingEndDate,
            booking_end_time: processedBookingEndTime,
            external_payment_link: external_payment_link ? external_payment_link.trim() : null,
            registration_link: registration_link ? registration_link.trim() : null,
            slug: slugResult.slug,
            is_active: Boolean(is_active),
            created_at: currentDateTime.data.iso,
            updated_at: currentDateTime.data.iso
        };
        
        console.log('CreateEvent - Final eventData:', eventData);
        
        // Insert event into database
        const { data: newEvent, error } = await supabase
            .from('events')
            .insert([eventData])
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
            
            console.error('Database Error creating event:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to create event'
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: { event: newEvent }
        });
        
    } catch (error) {
        console.error('Create Event Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while creating the event'
        });
    }
}

// Update existing event (protected route)
async function updateEvent(req, res) {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                error: 'Missing event ID',
                message: 'Event ID is required'
            });
        }
        
        // Parse multipart fields first
        // parseMultipartFields(req);
        
        // Check if event exists
        const { data: existingEvent, error: fetchError } = await supabase
            .from('events')
            .select('id, title, slug, image_url')
            .eq('id', id)
            .single();
        
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Event not found',
                    message: `No event found with ID: ${id}`
                });
            }
            
            console.error('Database Error fetching event for update:', fetchError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch event for update'
            });
        }
        
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
        
        console.log('UpdateEvent - Received data:', req.body);
        
        const updateData = {};
        let oldImageUrl = null;
        
        // Handle image update
        if (req.file) {
            const uploadResult = await uploadToSupabase(req.file);
            if (!uploadResult.success) {
                return res.status(400).json({
                    error: 'File upload failed',
                    message: uploadResult.error
                });
            }
            updateData.image_url = uploadResult.data.publicUrl;
            oldImageUrl = existingEvent.image_url;
        } else if (image_url !== undefined) {
            updateData.image_url = image_url ? image_url.trim() : null;
            if (image_url !== existingEvent.image_url) {
                oldImageUrl = existingEvent.image_url;
            }
        }
        
        // Handle title and slug regeneration
        if (title && title.trim() !== existingEvent.title) {
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
        
        // Handle other fields
        if (description !== undefined) updateData.description = description ? description.trim() : null;
        if (location !== undefined) updateData.location = location.trim();
        if (venue_details !== undefined) updateData.venue_details = venue_details ? venue_details.trim() : null;
        if (registration_link !== undefined) updateData.registration_link = registration_link ? registration_link.trim() : null;
        if (is_active !== undefined) updateData.is_active = Boolean(is_active);
        
        // Validate and update event date
        if (event_date !== undefined && event_date) {
            const dateValidation = validateDateFormat(event_date);
            if (!dateValidation.success) {
                return res.status(400).json({
                    error: 'Invalid event date',
                    message: dateValidation.error
                });
            }
            updateData.event_date = event_date;
        }
        
        // Validate and update event time
        if (event_time !== undefined && event_time) {
            const timeValidation = validateTimeFormat(event_time);
            if (!timeValidation.success) {
                return res.status(400).json({
                    error: 'Invalid event time',
                    message: timeValidation.error
                });
            }
            updateData.event_time = timeValidation.time;
        }
        
        // Validate and update booking end date
        if (booking_end_date !== undefined) {
            if (booking_end_date) {
                const bookingDateValidation = validateDateFormat(booking_end_date);
                if (!bookingDateValidation.success) {
                    return res.status(400).json({
                        error: 'Invalid booking end date',
                        message: bookingDateValidation.error
                    });
                }
                updateData.booking_end_date = booking_end_date;
            } else {
                updateData.booking_end_date = null;
            }
        }
        
        // Validate and update booking end time
        if (booking_end_time !== undefined) {
            if (booking_end_time) {
                const timeValidation = validateTimeFormat(booking_end_time);
                if (!timeValidation.success) {
                    return res.status(400).json({
                        error: 'Invalid booking end time',
                        message: timeValidation.error
                    });
                }
                updateData.booking_end_time = timeValidation.time;
            } else {
                updateData.booking_end_time = null;
            }
        }
        
        // Validate and update external payment link
        if (external_payment_link !== undefined) {
            if (external_payment_link && external_payment_link.trim()) {
                const urlPattern = /^https?:\/\/.+/;
                if (!urlPattern.test(external_payment_link.trim())) {
                    return res.status(400).json({
                        error: 'Invalid external payment link',
                        message: 'External payment link must be a valid HTTP/HTTPS URL'
                    });
                }
                updateData.external_payment_link = external_payment_link.trim();
            } else {
                updateData.external_payment_link = null;
            }
        }
        
        const currentDateTime = getCurrentDateTime();
        updateData.updated_at = currentDateTime.data.iso;
        
        if (Object.keys(updateData).length === 1) { // Only updated_at
            return res.status(400).json({
                error: 'No update data provided',
                message: 'At least one field must be provided for update'
            });
        }
        
        console.log('Final updateData being sent to database:', updateData);
        
        // Update event in database
        const { data: updatedEvent, error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Database Error updating event:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to update event'
            });
        }
        
        // Delete old image file if it was replaced and it's from our storage
        if (oldImageUrl && oldImageUrl.includes('/storage/v1/object/public/blog-images/')) {
            const fileNameResult = extractFileNameFromUrl(oldImageUrl);
            if (fileNameResult.success) {
                await deleteFromSupabase(fileNameResult.fileName);
            }
        }
        
        console.log('Event updated successfully:', updatedEvent);
        
        res.status(200).json({
            success: true,
            message: 'Event updated successfully',
            data: { event: updatedEvent }
        });
        
    } catch (error) {
        console.error('Update Event Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while updating the event'
        });
    }
}

// Delete event (protected route)
async function deleteEvent(req, res) {
    try {
        const { id } = req.params;
        
        // Validate event ID
        if (!id) {
            return res.status(400).json({
                error: 'Missing event ID',
                message: 'Event ID is required'
            });
        }
        
        // Check if event exists
        const { data: existingEvent, error: fetchError } = await supabase
            .from('events')
            .select('id, title, slug')
            .eq('id', id)
            .single();
        
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Event not found',
                    message: `No event found with ID: ${id}`
                });
            }
            
            console.error('Database Error fetching event for deletion:', fetchError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch event for deletion'
            });
        }
        
        // Delete event from database
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Database Error deleting event:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to delete event'
            });
        }
        
        // Return successful response
        res.status(200).json({
            success: true,
            message: 'Event deleted successfully',
            data: {
                deletedEvent: {
                    id: existingEvent.id,
                    title: existingEvent.title,
                    slug: existingEvent.slug
                }
            }
        });
        
    } catch (error) {
        console.error('Delete Event Error:', error);
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while deleting the event'
        });
    }
}

// Export all controller functions
module.exports = {
    getAllEvents,
    getEventBySlug,
    getUpcomingEvents,
    createEvent,
    updateEvent,
    deleteEvent
};