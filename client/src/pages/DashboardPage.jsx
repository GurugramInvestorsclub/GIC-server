import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import BlogModal from '../components/BlogModal';

const DashboardPage = () => {
  const { api } = useAuth();
  
  // State management
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null); // Track which blog is being deleted
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);

  // Fetch all blogs on component mount
  useEffect(() => {
    fetchBlogs();
  }, []);

  // Fetch blogs from API
  const fetchBlogs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all blogs (including drafts) for admin view
      const response = await api.get('/blogs?published=all&sortBy=created_at&sortOrder=desc');
      
      if (response.data.success) {
        setBlogs(response.data.data.blogs || []);
      } else {
        setError('Failed to fetch blogs');
      }
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setError(err.response?.data?.message || 'Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  // Handle blog deletion
  const handleDelete = async (blogId, blogTitle) => {
    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${blogTitle}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setDeleting(blogId);

    try {
      const response = await api.delete(`/blogs/${blogId}`);
      
      if (response.data.success) {
        // Remove deleted blog from state
        setBlogs(prevBlogs => prevBlogs.filter(blog => blog.id !== blogId));
        console.log('Blog deleted successfully');
      } else {
        alert('Failed to delete blog. Please try again.');
      }
    } catch (err) {
      console.error('Error deleting blog:', err);
      alert(err.response?.data?.message || 'Failed to delete blog. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  // Open modal for creating new blog
  const handleCreateNew = () => {
    setEditingBlog(null);
    setModalOpen(true);
  };

  // Open modal for editing existing blog
  const handleEdit = (blog) => {
    setEditingBlog(blog);
    setModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingBlog(null);
  };

  // Handle successful blog create/update
  const handleBlogSuccess = () => {
    handleCloseModal();
    fetchBlogs(); // Refresh the blog list
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

  // Truncate text for display
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Loading component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      <span className="ml-3 text-white">Loading blogs...</span>
    </div>
  );

  // Error component
  const ErrorMessage = () => (
    <div className="text-center py-12">
      <div className="text-red-500 text-4xl mb-4">⚠️</div>
      <h3 className="text-white text-lg mb-2">Failed to load blogs</h3>
      <p className="text-gray-400 mb-4">{error}</p>
      <button
        onClick={fetchBlogs}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition-colors"
      >
        Try Again
      </button>
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="text-gray-400 text-6xl mb-4">📝</div>
      <h3 className="text-white text-xl mb-2">No blogs yet</h3>
      <p className="text-gray-400 mb-6">Get started by creating your first blog post</p>
      <button
        onClick={handleCreateNew}
        className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
      >
        Create Your First Blog
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-white">Blog Management</h1>
            <p className="text-gray-400 mt-2">
              Create, edit, and manage your blog posts
            </p>
          </div>
          
          {/* Create new blog button */}
          <button
            onClick={handleCreateNew}
            className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Blog</span>
          </button>
        </div>

        {/* Stats section */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-2xl font-bold text-black">{blogs.length}</h3>
              <p className="text-gray-600">Total Blogs</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-2xl font-bold text-black">
                {blogs.filter(blog => blog.is_published).length}
              </h3>
              <p className="text-gray-600">Published</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-2xl font-bold text-black">
                {blogs.filter(blog => !blog.is_published).length}
              </h3>
              <p className="text-gray-600">Drafts</p>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorMessage />
          ) : blogs.length === 0 ? (
            <EmptyState />
          ) : (
            /* Blog grid */
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogs.map((blog) => (
                  <div
                    key={blog.id}
                    className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 group"
                  >
                    {/* Blog image */}
                    <div className="h-48 bg-gray-200 relative overflow-hidden">
                      {blog.image_url ? (
                        <img
                          src={blog.image_url}
                          alt={blog.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDEwLjc1SDNDMi41ODU3OSAxMC43NSAyLjI1IDEwLjQxNDIgMi4yNSAxMFY2QzIuMjUgNC4zNDMxNSAzLjU5MzE1IDMgNS4yNSAzSDE4Ljc1QzIwLjQwNjkgMyAyMS43NSA0LjM0MzE1IDIxLjc1IDZWMTBDMjEuNzUgMTAuNDE0MiAyMS40MTQyIDEwLjc1IDIxIDEwLjc1WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300">
                          <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          blog.is_published 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {blog.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>

                      {/* Action buttons - show on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-3">
                        <button
                          onClick={() => handleEdit(blog)}
                          className="bg-white text-black px-3 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(blog.id, blog.title)}
                          disabled={deleting === blog.id}
                          className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center space-x-1 disabled:opacity-50"
                        >
                          {deleting === blog.id ? (
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

                    {/* Blog content */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {blog.title}
                      </h3>
                      
                      <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                        {truncateText(blog.content, 120)}
                      </p>
                      
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>By {blog.author}</span>
                        <span>{formatDate(blog.published_date)}</span>
                      </div>
                      
                      {/* Tags */}
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {blog.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-md"
                            >
                              {tag}
                            </span>
                          ))}
                          {blog.tags.length > 3 && (
                            <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-md">
                              +{blog.tags.length - 3}
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

      {/* BlogModal */}
      <BlogModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSuccess={handleBlogSuccess}
        editingBlog={editingBlog}
      />
    </Layout>
  );
};

export default DashboardPage;