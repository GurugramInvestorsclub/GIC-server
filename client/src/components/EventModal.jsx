import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const EventModal = ({ isOpen, onClose, onSuccess, editingEvent = null }) => {
  const { api } = useAuth();
  
  // Determine if we're editing or creating
  const isEditing = !!editingEvent;
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    event_date: '',
    event_time: '',
    location: '',
    venue_details: '',
    booking_end_date: '',
    booking_end_time: '',
    external_payment_link: '',
    registration_link: '',
    is_active: true
  });
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data when modal opens or editing event changes
  useEffect(() => {
    if (isOpen) {
      if (isEditing && editingEvent) {
        populateForm(editingEvent);
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingEvent, isEditing]);

  // Populate form with existing event data for editing
  const populateForm = (event) => {
    setFormData({
      title: event.title || '',
      description: event.description || '',
      image_url: event.image_url || '',
      event_date: event.event_date || '',
      event_time: event.event_time || '',
      location: event.location || '',
      venue_details: event.venue_details || '',
      booking_end_date: event.booking_end_date || '',
      booking_end_time: event.booking_end_time || '',
      external_payment_link: event.external_payment_link || '',
      registration_link: event.registration_link || '',
      is_active: event.is_active !== undefined ? event.is_active : true
    });
    
    // Set image preview if URL exists
    if (event.image_url) {
      setImagePreview(event.image_url);
    }
    
    setSelectedFile(null);
    setErrors({});
  };

  // Reset form for new event creation
  const resetForm = () => {
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    const currentTime = today.toTimeString().split(' ')[0].substring(0, 5);
    
    setFormData({
      title: '',
      description: '',
      image_url: '',
      event_date: currentDate,
      event_time: currentTime,
      location: '',
      venue_details: '',
      booking_end_date: '',
      booking_end_time: '',
      external_payment_link: '',
      registration_link: '',
      is_active: true
    });
    
    setSelectedFile(null);
    setImagePreview(null);
    setErrors({});
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({
          ...prev,
          image: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)'
        }));
        return;
      }
      
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setErrors(prev => ({
          ...prev,
          image: 'File size must be less than 10MB'
        }));
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Clear image URL if file is selected
      setFormData(prev => ({ ...prev, image_url: '' }));
      setErrors(prev => ({ ...prev, image: '' }));
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
    
    // Reset file input
    const fileInput = document.getElementById('image-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.event_date) {
      newErrors.event_date = 'Event date is required';
    } else {
      // Check if event date is in the future
      const eventDate = new Date(formData.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (eventDate < today) {
        newErrors.event_date = 'Event date must be today or in the future';
      }
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    // Validate booking end date if provided
    if (formData.booking_end_date && formData.event_date) {
      if (formData.booking_end_date > formData.event_date) {
        newErrors.booking_end_date = 'Booking end date cannot be after event date';
      }
    }
    
    // Validate URLs if provided
    if (formData.external_payment_link && formData.external_payment_link.trim()) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(formData.external_payment_link.trim())) {
        newErrors.external_payment_link = 'Please enter a valid URL starting with http:// or https://';
      }
    }
    
    if (formData.registration_link && formData.registration_link.trim()) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(formData.registration_link.trim())) {
        newErrors.registration_link = 'Please enter a valid URL starting with http:// or https://';
      }
    }
    
    return newErrors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validate form
  const formErrors = validateForm();
  if (Object.keys(formErrors).length > 0) {
    setErrors(formErrors);
    return;
  }
  
  setLoading(true);
  setErrors({});
  
  try {
    // Prepare form data
    const submitData = new FormData();
    
    // Add REQUIRED text fields (safe to trim)
    submitData.append('title', formData.title.trim());
    submitData.append('event_date', formData.event_date);
    submitData.append('location', formData.location.trim());
    submitData.append('is_active', formData.is_active);
    
    // Add OPTIONAL text fields (with null/undefined checks)
    if (formData.description && formData.description.trim()) {
      submitData.append('description', formData.description.trim());
    }
    
    if (formData.venue_details && formData.venue_details.trim()) {
      submitData.append('venue_details', formData.venue_details.trim());
    }
    
    // Add optional time fields
    if (formData.event_time) {
      submitData.append('event_time', formData.event_time);
    }
    
    if (formData.booking_end_date) {
      submitData.append('booking_end_date', formData.booking_end_date);
    }
    
    if (formData.booking_end_time) {
      submitData.append('booking_end_time', formData.booking_end_time);
    }
    
    // Add optional URL fields (with validation)
    if (formData.external_payment_link && formData.external_payment_link.trim()) {
      submitData.append('external_payment_link', formData.external_payment_link.trim());
    }
    
    if (formData.registration_link && formData.registration_link.trim()) {
      submitData.append('registration_link', formData.registration_link.trim());
    }
    
    // Handle image
    if (selectedFile) {
      submitData.append('image', selectedFile);
    } else if (formData.image_url) {
      submitData.append('image_url', formData.image_url);
    }
    
    let response;
    
    if (isEditing) {
      // Update existing event
      response = await api.put(`/events/${editingEvent.id}`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } else {
      // Create new event
      response = await api.post('/events', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    }
    
    if (response.data.success) {
      onSuccess();
      resetForm();
    } else {
      setErrors({ submit: response.data.message || 'Operation failed' });
    }
    
  } catch (err) {
    console.error('Event submission error:', err);
    const errorMessage = err.response?.data?.message || 
                        err.response?.data?.error || 
                        'Failed to save event. Please try again.';
    setErrors({ submit: errorMessage });
  } finally {
    setLoading(false);
  }
};

  // Handle modal close
  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            {isEditing ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Global Error */}
          {errors.submit && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-4">
              
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter event title"
                  disabled={loading}
                />
                {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                    errors.location ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter event location"
                  disabled={loading}
                />
                {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}
              </div>

              {/* Event Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    id="event_date"
                    name="event_date"
                    value={formData.event_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                      errors.event_date ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  />
                  {errors.event_date && <p className="mt-1 text-sm text-red-600">{errors.event_date}</p>}
                </div>
                
                <div>
                  <label htmlFor="event_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Event Time
                  </label>
                  <input
                    type="time"
                    id="event_time"
                    name="event_time"
                    value={formData.event_time}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Booking End Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="booking_end_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Booking End Date
                  </label>
                  <input
                    type="date"
                    id="booking_end_date"
                    name="booking_end_date"
                    value={formData.booking_end_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                      errors.booking_end_date ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  />
                  {errors.booking_end_date && <p className="mt-1 text-sm text-red-600">{errors.booking_end_date}</p>}
                </div>
                
                <div>
                  <label htmlFor="booking_end_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Booking End Time
                  </label>
                  <input
                    type="time"
                    id="booking_end_time"
                    name="booking_end_time"
                    value={formData.booking_end_time}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Image
                </label>
                
                {imagePreview ? (
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                      disabled={loading}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={loading}
                    />
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer text-black hover:text-gray-700"
                    >
                      Click to upload image
                    </label>
                    <p className="text-sm text-gray-500 mt-2">
                      PNG, JPG, WebP up to 10MB
                    </p>
                  </div>
                )}
                
                {errors.image && <p className="mt-1 text-sm text-red-600">{errors.image}</p>}
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                  disabled={loading}
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Event is active
                </label>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              
              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Enter event description..."
                  disabled={loading}
                />
              </div>

              {/* Venue Details */}
              <div>
                <label htmlFor="venue_details" className="block text-sm font-medium text-gray-700 mb-2">
                  Venue Details
                </label>
                <textarea
                  id="venue_details"
                  name="venue_details"
                  rows={4}
                  value={formData.venue_details}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Enter venue details, directions, parking info, etc."
                  disabled={loading}
                />
              </div>

              {/* External Payment Link */}
              <div>
                <label htmlFor="external_payment_link" className="block text-sm font-medium text-gray-700 mb-2">
                  External Payment Link
                </label>
                <input
                  type="url"
                  id="external_payment_link"
                  name="external_payment_link"
                  value={formData.external_payment_link}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                    errors.external_payment_link ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://payment.example.com"
                  disabled={loading}
                />
                {errors.external_payment_link && <p className="mt-1 text-sm text-red-600">{errors.external_payment_link}</p>}
              </div>

              {/* Registration Link */}
              <div>
                <label htmlFor="registration_link" className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Link
                </label>
                <input
                  type="url"
                  id="registration_link"
                  name="registration_link"
                  value={formData.registration_link}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                    errors.registration_link ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://registration.example.com"
                  disabled={loading}
                />
                {errors.registration_link && <p className="mt-1 text-sm text-red-600">{errors.registration_link}</p>}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Event' : 'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;