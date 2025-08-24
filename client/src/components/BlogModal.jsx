import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

const BlogModal = ({ isOpen, onClose, onSuccess, editingBlog = null }) => {
  const { api, uploadInlineImage } = useAuth();

  // Determine if we're editing or creating
  const isEditing = !!editingBlog;

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '',
    image_url: '',
    published_date: '',
    published_time: '',
    tags: [],
    resource_links: [],
    is_published: false
  });

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [resourceInput, setResourceInput] = useState({ title: '', url: '' });
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Ref for textarea
  const textareaRef = useRef(null);

  // Initialize form data when modal opens or editing blog changes
  useEffect(() => {
    if (isOpen) {
      if (isEditing && editingBlog) {
        populateForm(editingBlog);
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingBlog, isEditing]);

  // Handle inline image upload
  const handleInlineImageUpload = async (file) => {
    setUploadingInlineImage(true);

    try {
      const uploadResult = await uploadInlineImage(file);

      if (uploadResult.success) {
        insertImageAtCursor(uploadResult.imageUrl);
        return true;
      } else {
        alert(`Image upload failed: ${uploadResult.message}`);
        return false;
      }
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Failed to upload image. Please try again.');
      return false;
    } finally {
      setUploadingInlineImage(false);
    }
  };

  // Insert image HTML at cursor position in textarea
  const insertImageAtCursor = (imageUrl) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = formData.content;

    const imageHtml = `<img src="${imageUrl}" alt="Uploaded image" style="max-width: 100%; height: auto; margin: 10px 0;" />`;

    const newContent = currentContent.substring(0, start) + imageHtml + currentContent.substring(end);

    setFormData((prev) => ({
      ...prev,
      content: newContent
    }));

    // Restore cursor position after the inserted image
    setTimeout(() => {
      textarea.focus();
      const caretPos = start + imageHtml.length;
      textarea.setSelectionRange(caretPos, caretPos);
    }, 0);
  };

  // Handle image upload button click
  const handleImageUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleInlineImageUpload(file);
      }
    };
    input.click();
  };

  // Populate form with existing blog data for editing
  const populateForm = (blog) => {
    setFormData({
      title: blog.title || '',
      content: blog.content || '',
      author: blog.author || '',
      image_url: blog.image_url || '',
      published_date: blog.published_date || '',
      published_time: blog.published_time || '',
      tags: blog.tags || [],
      resource_links: blog.resource_links || [],
      is_published: blog.is_published || false
    });

    if (blog.image_url) setImagePreview(blog.image_url);

    setSelectedFile(null);
    setErrors({});
    setPreviewMode(false);
  };

  // Reset form for new blog creation
  const resetForm = () => {
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    const currentTime = today.toTimeString().split(' ')[0].substring(0, 5);

    setFormData({
      title: '',
      content: '',
      author: '',
      image_url: '',
      published_date: currentDate,
      published_time: currentTime,
      tags: [],
      resource_links: [],
      is_published: false
    });

    setSelectedFile(null);
    setImagePreview(null);
    setErrors({});
    setTagInput('');
    setResourceInput({ title: '', url: '' });
    setPreviewMode(false);
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];

    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          image: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)'
        }));
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setErrors((prev) => ({
          ...prev,
          image: 'File size must be less than 10MB'
        }));
        return;
      }

      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);

      setFormData((prev) => ({ ...prev, image_url: '' }));
      setErrors((prev) => ({ ...prev, image: '' }));
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, image_url: '' }));

    const fileInput = document.getElementById('image-upload');
    if (fileInput) fileInput.value = '';
  };

  // Handle tag addition
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }));
  };

  // Handle tag input key press
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Add resource link
  const addResourceLink = () => {
    const { title, url } = resourceInput;
    if (title.trim() && url.trim()) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url.trim())) {
        setErrors((prev) => ({
          ...prev,
          resource: 'Please enter a valid URL starting with http:// or https://'
        }));
        return;
      }

      setFormData((prev) => ({
        ...prev,
        resource_links: [...prev.resource_links, { title: title.trim(), url: url.trim() }]
      }));
      setResourceInput({ title: '', url: '' });
      setErrors((prev) => ({ ...prev, resource: '' }));
    }
  };

  // Remove resource link
  const removeResourceLink = (index) => {
    setFormData((prev) => ({
      ...prev,
      resource_links: prev.resource_links.filter((_, i) => i !== index)
    }));
  };

  // Insert formatting helpers
  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    const currentContent = formData.content;

    const newText = before + selectedText + after;
    const newContent = currentContent.substring(0, start) + newText + currentContent.substring(end);

    setFormData((prev) => ({
      ...prev,
      content: newContent
    }));

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.content.trim()) newErrors.content = 'Content is required';
    if (!formData.author.trim()) newErrors.author = 'Author is required';
    if (!formData.published_date) newErrors.published_date = 'Published date is required';
    if (!formData.published_time) newErrors.published_time = 'Published time is required';

    return newErrors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const submitData = new FormData();

      submitData.append('title', formData.title.trim());
      submitData.append('content', formData.content.trim());
      submitData.append('author', formData.author.trim());
      submitData.append('published_date', formData.published_date);
      submitData.append('published_time', formData.published_time);
      submitData.append('is_published', formData.is_published);
      submitData.append('tags', JSON.stringify(formData.tags));
      submitData.append('resource_links', JSON.stringify(formData.resource_links));

      if (selectedFile) {
        submitData.append('image', selectedFile);
      } else if (formData.image_url) {
        submitData.append('image_url', formData.image_url);
      }

      let response;
      if (isEditing) {
        response = await api.put(`/blogs/${editingBlog.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await api.post('/blogs', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      if (response.data.success) {
        onSuccess();
        resetForm();
      } else {
        setErrors({ submit: response.data.message || 'Operation failed' });
      }
    } catch (err) {
      console.error('Blog submission error:', err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to save blog. Please try again.';
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
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            {isEditing ? 'Edit Blog Post' : 'Create New Blog Post'}
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
                  Title *
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
                  placeholder="Enter blog title"
                  disabled={loading}
                />
                {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
              </div>

              {/* Author */}
              <div>
                <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
                  Author *
                </label>
                <input
                  type="text"
                  id="author"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                    errors.author ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter author name"
                  disabled={loading}
                />
                {errors.author && <p className="mt-1 text-sm text-red-600">{errors.author}</p>}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="published_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    id="published_date"
                    name="published_date"
                    value={formData.published_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                      errors.published_date ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  />
                  {errors.published_date && <p className="mt-1 text-sm text-red-600">{errors.published_date}</p>}
                </div>

                <div>
                  <label htmlFor="published_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Time *
                  </label>
                  <input
                    type="time"
                    id="published_time"
                    name="published_time"
                    value={formData.published_time}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                      errors.published_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  />
                  {errors.published_time && <p className="mt-1 text-sm text-red-600">{errors.published_time}</p>}
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image</label>

                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-md border" />
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
                    <label htmlFor="image-upload" className="cursor-pointer text-black hover:text-gray-700">
                      Click to upload featured image
                    </label>
                    <p className="text-sm text-gray-500 mt-2">PNG, JPG, WebP up to 10MB</p>
                  </div>
                )}

                {errors.image && <p className="mt-1 text-sm text-red-600">{errors.image}</p>}
              </div>

              {/* Published Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_published"
                  name="is_published"
                  checked={formData.is_published}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                  disabled={loading}
                />
                <label htmlFor="is_published" className="ml-2 block text-sm text-gray-700">
                  Publish immediately
                </label>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Content with toolbar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Content *</label>

                  <div className="flex bg-gray-100 rounded-md p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode(false)}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        !previewMode ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                      }`}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(true)}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        previewMode ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                      }`}
                      disabled={loading}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {!previewMode ? (
                  <>
                    {/* Toolbar */}
                    <div className="border border-gray-300 rounded-t-md p-2 bg-gray-50 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => insertFormatting('<strong>', '</strong>')}
                        className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                        disabled={loading}
                        title="Bold"
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('<em>', '</em>')}
                        className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                        disabled={loading}
                        title="Italic"
                      >
                        <em>I</em>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('<h1>', '</h1>')}
                        className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                        disabled={loading}
                        title="Heading 1"
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('<h2>', '</h2>')}
                        className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                        disabled={loading}
                        title="Heading 2"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('<p>', '</p>')}
                        className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                        disabled={loading}
                        title="Paragraph"
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('<br>')}
                        className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-100"
                        disabled={loading}
                        title="Line Break"
                      >
                        BR
                      </button>
                      <button
                        type="button"
                        onClick={handleImageUploadClick}
                        className="px-2 py-1 text-sm bg-blue-500 text-white border rounded hover:bg-blue-600 flex items-center"
                        disabled={loading || uploadingInlineImage}
                        title="Upload Image"
                      >
                        {uploadingInlineImage ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                        ) : (
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                        Image
                      </button>
                    </div>

                    {/* Simple Textarea */}
                    <textarea
                      ref={textareaRef}
                      id="content"
                      name="content"
                      rows={12}
                      value={formData.content}
                      onChange={handleInputChange}
                      className={`w-full border-l border-r border-b border-gray-300 rounded-b-md resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                        errors.content ? 'border-red-500' : ''
                      }`}
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        padding: '8px 12px'
                      }}
                      placeholder="Write your blog content here... You can use HTML tags like <strong>, <em>, <h1>, <img>, etc."
                      disabled={loading}
                    />

                    {/* Helper text */}
                    <p className="text-xs text-gray-500 mt-2">
                      Use HTML tags for formatting. Click the toolbar buttons to insert common tags, or type them manually.
                    </p>
                  </>
                ) : (
                  /* Preview Mode */
                  <div className="border border-gray-300 rounded-md p-4 bg-white min-h-[300px] max-h-[400px] overflow-y-auto">
                    {formData.content ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: formData.content }}
                        className="prose prose-sm max-w-none"
                        style={{
                          lineHeight: '1.6',
                          color: '#374151'
                        }}
                      />
                    ) : (
                      <p className="text-gray-500 italic">No content to preview. Switch to Edit mode to add content.</p>
                    )}
                  </div>
                )}
                {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    placeholder="Enter a tag"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
                    disabled={loading || !tagInput.trim()}
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span key={index} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm flex items-center">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                        disabled={loading}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Resource Links */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resource Links</label>
                <div className="space-y-2 mb-2">
                  <input
                    type="text"
                    value={resourceInput.title}
                    onChange={(e) => setResourceInput((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    placeholder="Link title"
                    disabled={loading}
                  />
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={resourceInput.url}
                      onChange={(e) => setResourceInput((prev) => ({ ...prev, url: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="https://example.com"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={addResourceLink}
                      className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
                      disabled={loading || !resourceInput.title.trim() || !resourceInput.url.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
                {errors.resource && <p className="text-sm text-red-600 mb-2">{errors.resource}</p>}
                <div className="space-y-2">
                  {formData.resource_links.map((link, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <div>
                        <p className="font-medium text-gray-900">{link.title}</p>
                        <p className="text-sm text-gray-600">{link.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeResourceLink(index)}
                        className="text-red-600 hover:text-red-800"
                        disabled={loading}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
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
                isEditing ? 'Update Blog' : 'Create Blog'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlogModal;