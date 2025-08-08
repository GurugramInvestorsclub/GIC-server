const supabase = require('../db/supabase');
const path = require('path');
const crypto = require('crypto');

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Storage bucket name
const BUCKET_NAME = 'blog-images';

// Generate unique filename with timestamp and random string
function generateFileName(originalName, fileExtension) {
    try {
        // Get file extension from original name if not provided
        if (!fileExtension && originalName) {
            fileExtension = path.extname(originalName).toLowerCase();
        }
        
        // Generate timestamp
        const timestamp = Date.now();
        
        // Generate random string
        const randomString = crypto.randomBytes(8).toString('hex');
        
        // Create filename: timestamp-random.ext
        const fileName = `${timestamp}-${randomString}${fileExtension}`;
        
        return {
            success: true,
            fileName: fileName
        };
        
    } catch (error) {
        console.error('Filename Generation Error:', error);
        
        return {
            success: false,
            error: 'Failed to generate unique filename'
        };
    }
}

// Validate file type and size
function validateFileType(file) {
    try {
        // Check if file exists
        if (!file || !file.buffer || !file.mimetype) {
            return {
                success: false,
                error: 'No valid file provided'
            };
        }
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return {
                success: false,
                error: `File size too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
            };
        }
        
        // Check MIME type
        if (!ALLOWED_FILE_TYPES[file.mimetype]) {
            return {
                success: false,
                error: `File type not allowed. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`
            };
        }
        
        // Get file extension
        const fileExtension = ALLOWED_FILE_TYPES[file.mimetype];
        
        return {
            success: true,
            fileExtension: fileExtension,
            mimeType: file.mimetype,
            size: file.size
        };
        
    } catch (error) {
        console.error('File Validation Error:', error);
        
        return {
            success: false,
            error: 'File validation failed'
        };
    }
}

// Upload file to Supabase Storage
async function uploadToSupabase(file, customFileName = null) {
    try {
        // Validate file first
        const validation = validateFileType(file);
        if (!validation.success) {
            return validation;
        }
        
        // Generate filename
        const fileNameResult = customFileName 
            ? { success: true, fileName: customFileName }
            : generateFileName(file.originalname, validation.fileExtension);
            
        if (!fileNameResult.success) {
            return fileNameResult;
        }
        
        const fileName = fileNameResult.fileName;
        
        // Upload file to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file.buffer, {
                contentType: validation.mimeType,
                upsert: false // Don't overwrite existing files
            });
        
        if (error) {
            console.error('Supabase Upload Error:', error);
            
            // Handle specific error cases
            if (error.message.includes('Duplicate')) {
                return {
                    success: false,
                    error: 'File with this name already exists'
                };
            }
            
            return {
                success: false,
                error: `Upload failed: ${error.message}`
            };
        }
        
        // Get public URL for the uploaded file
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);
        
        if (!urlData || !urlData.publicUrl) {
            return {
                success: false,
                error: 'Failed to generate public URL for uploaded file'
            };
        }
        
        return {
            success: true,
            data: {
                fileName: fileName,
                filePath: data.path,
                publicUrl: urlData.publicUrl,
                fileSize: file.size,
                mimeType: validation.mimeType
            }
        };
        
    } catch (error) {
        console.error('Upload to Supabase Error:', error);
        
        return {
            success: false,
            error: 'An unexpected error occurred during file upload'
        };
    }
}

// Delete file from Supabase Storage
async function deleteFromSupabase(fileName) {
    try {
        // Validate fileName
        if (!fileName || typeof fileName !== 'string') {
            return {
                success: false,
                error: 'Valid filename is required for deletion'
            };
        }
        
        // Delete file from Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([fileName]);
        
        if (error) {
            console.error('Supabase Delete Error:', error);
            
            return {
                success: false,
                error: `Delete failed: ${error.message}`
            };
        }
        
        return {
            success: true,
            message: 'File deleted successfully',
            deletedFile: fileName
        };
        
    } catch (error) {
        console.error('Delete from Supabase Error:', error);
        
        return {
            success: false,
            error: 'An unexpected error occurred during file deletion'
        };
    }
}

// Extract filename from Supabase public URL
function extractFileNameFromUrl(publicUrl) {
    try {
        if (!publicUrl || typeof publicUrl !== 'string') {
            return {
                success: false,
                error: 'Valid URL is required'
            };
        }
        
        // Extract filename from URL pattern: .../storage/v1/object/public/blog-images/filename
        const urlParts = publicUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        if (!fileName) {
            return {
                success: false,
                error: 'Could not extract filename from URL'
            };
        }
        
        return {
            success: true,
            fileName: fileName
        };
        
    } catch (error) {
        console.error('Extract Filename Error:', error);
        
        return {
            success: false,
            error: 'Failed to extract filename from URL'
        };
    }
}

// Get file info from Supabase Storage
async function getFileInfo(fileName) {
    try {
        // Get file information
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', {
                search: fileName,
                limit: 1
            });
        
        if (error) {
            return {
                success: false,
                error: `Failed to get file info: ${error.message}`
            };
        }
        
        if (!data || data.length === 0) {
            return {
                success: false,
                error: 'File not found'
            };
        }
        
        const fileInfo = data[0];
        
        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);
        
        return {
            success: true,
            data: {
                name: fileInfo.name,
                size: fileInfo.metadata?.size || 0,
                mimeType: fileInfo.metadata?.mimetype || 'unknown',
                lastModified: fileInfo.updated_at,
                publicUrl: urlData.publicUrl
            }
        };
        
    } catch (error) {
        console.error('Get File Info Error:', error);
        
        return {
            success: false,
            error: 'Failed to retrieve file information'
        };
    }
}

// Export all functions
module.exports = {
    uploadToSupabase,
    deleteFromSupabase,
    generateFileName,
    validateFileType,
    extractFileNameFromUrl,
    getFileInfo,
    ALLOWED_FILE_TYPES,
    MAX_FILE_SIZE,
    BUCKET_NAME
};