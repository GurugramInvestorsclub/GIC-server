// Get current date and time in various formats
function getCurrentDateTime() {
    try {
        const now = new Date();
        
        return {
            success: true,
            data: {
                // Full ISO string for database storage
                iso: now.toISOString(),
                
                // Separate date and time for blog schema
                date: now.toISOString().split('T')[0], // YYYY-MM-DD
                time: now.toTimeString().split(' ')[0], // HH:MM:SS
                
                // Formatted for display
                displayDate: now.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                displayTime: now.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }),
                
                // Timestamp for sorting
                timestamp: now.getTime(),
                
                // Unix timestamp
                unix: Math.floor(now.getTime() / 1000)
            }
        };
        
    } catch (error) {
        console.error('Get Current DateTime Error:', error);
        
        return {
            success: false,
            error: 'Failed to get current date and time'
        };
    }
}

// Format date and time for database storage
function formatDateTime(dateInput, timeInput = null) {
    try {
        let targetDate;
        
        // Handle different input types
        if (!dateInput) {
            // If no date provided, use current date
            targetDate = new Date();
        } else if (dateInput instanceof Date) {
            // If already a Date object
            targetDate = dateInput;
        } else if (typeof dateInput === 'string') {
            // If string, try to parse
            targetDate = new Date(dateInput);
        } else if (typeof dateInput === 'number') {
            // If timestamp
            targetDate = new Date(dateInput);
        } else {
            throw new Error('Invalid date input format');
        }
        
        // Validate the date
        if (isNaN(targetDate.getTime())) {
            throw new Error('Invalid date provided');
        }
        
        // Handle time input if provided
        if (timeInput && typeof timeInput === 'string') {
            // Parse time string (HH:MM or HH:MM:SS)
            const timeParts = timeInput.split(':');
            
            if (timeParts.length >= 2) {
                const hours = parseInt(timeParts[0], 10);
                const minutes = parseInt(timeParts[1], 10);
                const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
                
                // Validate time parts
                if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
                    targetDate.setHours(hours, minutes, seconds, 0);
                }
            }
        }
        
        return {
            success: true,
            data: {
                // Database format
                date: targetDate.toISOString().split('T')[0], // YYYY-MM-DD
                time: targetDate.toTimeString().split(' ')[0], // HH:MM:SS
                
                // Full ISO for created_at/updated_at
                iso: targetDate.toISOString(),
                
                // Display formats
                displayDate: targetDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                displayTime: targetDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }),
                
                // Original Date object
                dateObject: targetDate
            }
        };
        
    } catch (error) {
        console.error('Format DateTime Error:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to format date and time'
        };
    }
}

// Validate date string format (YYYY-MM-DD)
function validateDateFormat(dateString) {
    try {
        if (!dateString || typeof dateString !== 'string') {
            return {
                success: false,
                error: 'Date must be a string'
            };
        }
        
        // Check format with regex
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        
        if (!datePattern.test(dateString)) {
            return {
                success: false,
                error: 'Date must be in YYYY-MM-DD format'
            };
        }
        
        // Check if date is valid
        const date = new Date(dateString + 'T00:00:00.000Z');
        
        if (isNaN(date.getTime())) {
            return {
                success: false,
                error: 'Invalid date provided'
            };
        }
        
        // Check if date string matches the parsed date (catches invalid dates like 2023-02-30)
        const formattedBack = date.toISOString().split('T')[0];
        
        if (formattedBack !== dateString) {
            return {
                success: false,
                error: 'Invalid date (e.g., February 30th does not exist)'
            };
        }
        
        return {
            success: true,
            date: dateString,
            dateObject: date
        };
        
    } catch (error) {
        console.error('Date Validation Error:', error);
        
        return {
            success: false,
            error: 'Date validation failed'
        };
    }
}

// Validate time string format (HH:MM or HH:MM:SS)
function validateTimeFormat(timeString) {
    try {
        if (!timeString || typeof timeString !== 'string') {
            return {
                success: false,
                error: 'Time must be a string'
            };
        }
        
        // Check format with regex (HH:MM or HH:MM:SS)
        const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
        
        if (!timePattern.test(timeString)) {
            return {
                success: false,
                error: 'Time must be in HH:MM or HH:MM:SS format (24-hour)'
            };
        }
        
        // Parse time parts
        const timeParts = timeString.split(':');
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
        
        // Create normalized time string (always include seconds)
        const normalizedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        return {
            success: true,
            time: normalizedTime,
            hours: hours,
            minutes: minutes,
            seconds: seconds
        };
        
    } catch (error) {
        console.error('Time Validation Error:', error);
        
        return {
            success: false,
            error: 'Time validation failed'
        };
    }
}

// Combine date and time strings into a full Date object
function combineDateAndTime(dateString, timeString) {
    try {
        // Validate date
        const dateValidation = validateDateFormat(dateString);
        if (!dateValidation.success) {
            return dateValidation;
        }
        
        // Validate time
        const timeValidation = validateTimeFormat(timeString);
        if (!timeValidation.success) {
            return timeValidation;
        }
        
        // Combine date and time
        const combinedDateTime = new Date(`${dateString}T${timeValidation.time}.000Z`);
        
        if (isNaN(combinedDateTime.getTime())) {
            throw new Error('Failed to combine date and time');
        }
        
        return {
            success: true,
            data: {
                dateTime: combinedDateTime,
                iso: combinedDateTime.toISOString(),
                date: dateString,
                time: timeValidation.time
            }
        };
        
    } catch (error) {
        console.error('Combine Date Time Error:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to combine date and time'
        };
    }
}

// Format date for display in different styles
function formatDateForDisplay(dateInput, style = 'full') {
    try {
        let date;
        
        // Handle different input types
        if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'string') {
            date = new Date(dateInput);
        } else {
            throw new Error('Invalid date input');
        }
        
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date provided');
        }
        
        const options = {
            full: {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            },
            short: {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            },
            compact: {
                year: '2-digit',
                month: '2-digit',
                day: '2-digit'
            },
            monthYear: {
                year: 'numeric',
                month: 'long'
            }
        };
        
        const formatOption = options[style] || options.full;
        
        return {
            success: true,
            formatted: date.toLocaleDateString('en-US', formatOption),
            iso: date.toISOString().split('T')[0]
        };
        
    } catch (error) {
        console.error('Format Date Display Error:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to format date for display'
        };
    }
}

// Check if date is in the future
function isFutureDate(dateInput) {
    try {
        let date;
        
        if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'string') {
            date = new Date(dateInput);
        } else {
            throw new Error('Invalid date input');
        }
        
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date provided');
        }
        
        const now = new Date();
        
        return {
            success: true,
            isFuture: date > now,
            daysDifference: Math.ceil((date - now) / (1000 * 60 * 60 * 24))
        };
        
    } catch (error) {
        console.error('Future Date Check Error:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to check if date is in future'
        };
    }
}

// Export all functions
module.exports = {
    getCurrentDateTime,
    formatDateTime,
    validateDateFormat,
    validateTimeFormat,
    combineDateAndTime,
    formatDateForDisplay,
    isFutureDate
};