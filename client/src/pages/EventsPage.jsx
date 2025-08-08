import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import EventModal from '../components/EventModal';

const EventsPage = () => {
  const { api } = useAuth();
  
  // State management
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null); // Track which event is being deleted
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Fetch all events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch events from API
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all events (including inactive) for admin view
      const response = await api.get('/events?active=all&sortBy=created_at&sortOrder=desc');
      
      if (response.data.success) {
        setEvents(response.data.data.events || []);
      } else {
        setError('Failed to fetch events');
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Handle event deletion
  const handleDelete = async (eventId, eventTitle) => {
    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${eventTitle}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setDeleting(eventId);

    try {
      const response = await api.delete(`/events/${eventId}`);
      
      if (response.data.success) {
        // Remove deleted event from state
        setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
        console.log('Event deleted successfully');
      } else {
        alert('Failed to delete event. Please try again.');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(err.response?.data?.message || 'Failed to delete event. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  // Open modal for creating new event
  const handleCreateNew = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };

  // Open modal for editing existing event
  const handleEdit = (event) => {
    setEditingEvent(event);
    setModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
  };

  // Handle successful event create/update
  const handleEventSuccess = () => {
    handleCloseModal();
    fetchEvents(); // Refresh the event list
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return timeString;
    }
  };

  // Check if event is upcoming
  const isUpcoming = (eventDate) => {
    try {
      const today = new Date();
      const event = new Date(eventDate);
      return event >= today;
    } catch (error) {
      return false;
    }
  };

  // Truncate text for display
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Loading component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      <span className="ml-3 text-white">Loading events...</span>
    </div>
  );

  // Error component
  const ErrorMessage = () => (
    <div className="text-center py-12">
      <div className="text-red-500 text-4xl mb-4">⚠️</div>
      <h3 className="text-white text-lg mb-2">Failed to load events</h3>
      <p className="text-gray-400 mb-4">{error}</p>
      <button
        onClick={fetchEvents}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition-colors"
      >
        Try Again
      </button>
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="text-gray-400 text-6xl mb-4">📅</div>
      <h3 className="text-white text-xl mb-2">No events yet</h3>
      <p className="text-gray-400 mb-6">Get started by creating your first event</p>
      <button
        onClick={handleCreateNew}
        className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
      >
        Create Your First Event
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-white">Event Management</h1>
            <p className="text-gray-400 mt-2">
              Create, edit, and manage your events
            </p>
          </div>
          
          {/* Create new event button */}
          <button
            onClick={handleCreateNew}
            className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Event</span>
          </button>
        </div>

        {/* Stats section */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-2xl font-bold text-black">{events.length}</h3>
              <p className="text-gray-600">Total Events</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-2xl font-bold text-black">
                {events.filter(event => event.is_active).length}
              </h3>
              <p className="text-gray-600">Active</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-2xl font-bold text-black">
                {events.filter(event => isUpcoming(event.event_date)).length}
              </h3>
              <p className="text-gray-600">Upcoming</p>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorMessage />
          ) : events.length === 0 ? (
            <EmptyState />
          ) : (
            /* Event grid */
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 group"
                  >
                    {/* Event image */}
                    <div className="h-48 bg-gray-200 relative overflow-hidden">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDEwLjc1SDNDMi41ODU3OSAxMC43NSAyLjI1IDEwLjQxNDIgMi4yNSAxMFY2QzIuMjUgNC4zNDMxNSAzLjU5MzE1IDMgNS4yNSAzSDE4Ljc1QzIwLjQwNjkgMyAyMS43NSA0LjM0MzE1IDIxLjc1IDZWMTBDMjEuNzUgMTAuNDE0MiAyMS40MTQyIDEwLjc1IDIxIDEwLjc1WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300">
                          <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          event.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {event.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Upcoming badge */}
                      {isUpcoming(event.event_date) && event.is_active && (
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            Upcoming
                          </span>
                        </div>
                      )}

                      {/* Action buttons - show on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-3">
                        <button
                          onClick={() => handleEdit(event)}
                          className="bg-white text-black px-3 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(event.id, event.title)}
                          disabled={deleting === event.id}
                          className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center space-x-1 disabled:opacity-50"
                        >
                          {deleting === event.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Event content */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {event.title}
                      </h3>
                      
                      {/* Event details */}
                      <div className="space-y-2 mb-3">
                        {/* Date and Time */}
                        <div className="flex items-center text-gray-600 text-sm">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            {formatDate(event.event_date)}
                            {event.event_time && ` at ${formatTime(event.event_time)}`}
                          </span>
                        </div>
                        
                        {/* Location */}
                        <div className="flex items-center text-gray-600 text-sm">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{event.location}</span>
                        </div>
                      </div>
                      
                      {/* Description */}
                      {event.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                          {truncateText(event.description, 120)}
                        </p>
                      )}
                      
                      {/* Footer info */}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Created {formatDate(event.created_at)}</span>
                        {event.booking_end_date && (
                          <span>
                            Booking ends {formatDate(event.booking_end_date)}
                          </span>
                        )}
                      </div>
                      
                      {/* External links */}
                      {(event.external_payment_link || event.registration_link) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {event.external_payment_link && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md">
                              💳 Payment Link
                            </span>
                          )}
                          {event.registration_link && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md">
                              📝 Registration
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EventModal */}
      <EventModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSuccess={handleEventSuccess}
        editingEvent={editingEvent}
      />
    </Layout>
  );
};

export default EventsPage;