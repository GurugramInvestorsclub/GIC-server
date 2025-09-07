// /components/BlogModal.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const BlogModal = ({ isOpen, onClose, onSuccess, editingBlog = null }) => {
  const { api, uploadInlineImage } = useAuth();
  const isEditing = !!editingBlog;

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '',
    image_url: '',
    published_date: '',
    published_time: '',
    tags: [],
    resource_links: [],
    is_published: false,
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSettings, setShowSettings] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const authorRef = useRef(null);
  const fileInputRef = useRef(null);

  // Update content with debounce
  const updateContent = useCallback(
    debounce((content) => {
      setFormData((prev) => ({ ...prev, content }));
      if (content && content.trim()) {
        setErrors((prev) => ({ ...prev, content: '' }));
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && editingBlog) {
      populateForm(editingBlog);
    } else {
      resetForm();
    }
  }, [isOpen, isEditing, editingBlog?.id]);

  const populateForm = (blog) => {
    const content = blog.content || '';
    
    setFormData({
      title: blog.title || '',
      content: content,
      author: blog.author || '',
      image_url: blog.image_url || '',
      published_date: blog.published_date || '',
      published_time: blog.published_time || '',
      tags: Array.isArray(blog.tags) ? blog.tags : [],
      resource_links: Array.isArray(blog.resource_links) ? blog.resource_links : [],
      is_published: !!blog.is_published,
    });

    // Load content into editor and ensure all images are centered
    if (editorRef.current) {
      editorRef.current.innerHTML = ensureAllImagesAreCentered(content);
    }

    setImagePreview(blog.image_url || null);
    setSelectedFile(null);
    setErrors({});
  };

  const resetForm = () => {
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    const currentTime = today.toTimeString().slice(0, 5);

    setFormData({
      title: '',
      content: '',
      author: '',
      image_url: '',
      published_date: currentDate,
      published_time: currentTime,
      tags: [],
      resource_links: [],
      is_published: false,
    });

    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }

    setSelectedFile(null);
    setImagePreview(null);
    setErrors({});
    setSelectedImage(null);
  };

  // Ensure ALL images are always centered
  const ensureAllImagesAreCentered = (htmlContent) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => {
      // Determine size from existing styles
      let size = '400px';
      const currentStyle = img.getAttribute('style') || '';
      
      // Extract size from existing max-width or width
      const maxWidthMatch = currentStyle.match(/max-width:\s*(\d+)px/);
      const widthMatch = currentStyle.match(/width:\s*(\d+)px/);
      
      if (maxWidthMatch) {
        const width = parseInt(maxWidthMatch[1]);
        if (width <= 250) size = '250px';
        else if (width <= 400) size = '400px';
        else size = '580px';
      } else if (widthMatch) {
        const width = parseInt(widthMatch[1]);
        if (width <= 250) size = '250px';
        else if (width <= 400) size = '400px';
        else size = '580px';
      }
      
      // Remove the image from its current position
      const parent = img.parentNode;
      
      // Create centered wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'image-center-wrapper';
      wrapper.style.cssText = `
        text-align: center !important;
        margin: 20px 0 !important;
        clear: both !important;
        width: 100% !important;
        display: block !important;
      `;
      
      // Apply centered styles to image
      img.style.cssText = `
        max-width: ${size} !important;
        height: auto !important;
        display: inline-block !important;
        margin: 0 !important;
        border-radius: 8px !important;
        vertical-align: top !important;
        float: none !important;
      `;
      
      // Set data attributes
      img.dataset.currentSize = size;
      img.dataset.alignment = 'center';
      
      // Add click handler class
      img.classList.add('editor-image-centered');
      
      // Wrap the image
      parent.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    });
    
    return tempDiv.innerHTML;
  };

  const handleEditorChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      updateContent(content);
    }
  };

  const handleClose = () => {
    if (!loading) onClose?.();
  };

  // Custom toolbar actions
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  // Delete image functionality
  const deleteImage = () => {
    if (!selectedImage) {
      alert('Please click on an image first');
      return;
    }
    
    if (confirm('Are you sure you want to delete this image?')) {
      // Remove wrapper if exists
      const wrapper = selectedImage.closest('.image-center-wrapper');
      if (wrapper) {
        wrapper.remove();
      } else {
        selectedImage.remove();
      }
      setSelectedImage(null);
      handleEditorChange();
    }
  };

  // Insert image function - ALWAYS CENTERED
  const insertImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const upload = await uploadInlineImage(file);
        if (upload?.success) {
          // Create centered wrapper
          const wrapper = document.createElement('div');
          wrapper.className = 'image-center-wrapper';
          wrapper.style.cssText = `
            text-align: center !important;
            margin: 20px 0 !important;
            clear: both !important;
            width: 100% !important;
            display: block !important;
          `;
          
          const img = document.createElement('img');
          img.src = upload.imageUrl;
          
          // Apply centered styles
          img.style.cssText = `
            max-width: 400px !important;
            height: auto !important;
            display: inline-block !important;
            margin: 0 !important;
            border-radius: 8px !important;
            vertical-align: top !important;
            float: none !important;
          `;
          img.dataset.currentSize = '400px';
          img.dataset.alignment = 'center';
          img.classList.add('editor-image-centered');
          
          // Add click handler for selection
          img.onclick = (e) => {
            e.preventDefault();
            selectImage(img);
          };
          
          // Wrap and insert
          wrapper.appendChild(img);
          
          // Insert at cursor or end of content
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(wrapper);
            
            // Add paragraph after image
            const paragraph = document.createElement('p');
            paragraph.innerHTML = '<br>';
            range.setStartAfter(wrapper);
            range.insertNode(paragraph);
            
            // Position cursor in the new paragraph
            range.setStart(paragraph, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            editorRef.current.appendChild(wrapper);
            const paragraph = document.createElement('p');
            paragraph.innerHTML = '<br>';
            editorRef.current.appendChild(paragraph);
          }
          
          handleEditorChange();
        } else {
          alert('Failed to upload image');
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload image');
      }
    };
    
    input.click();
  };

  // Image selection function
  const selectImage = (img) => {
    // Remove previous selection highlighting
    const allImages = editorRef.current.querySelectorAll('img');
    allImages.forEach(image => image.classList.remove('image-selected'));
    
    // Highlight selected image
    img.classList.add('image-selected');
    setSelectedImage(img);
  };

  // Size functions - ALWAYS MAINTAIN CENTER ALIGNMENT
  const resizeImageSmall = () => {
    if (!selectedImage) {
      alert('Please click on an image first');
      return;
    }
    
    selectedImage.style.cssText = `
      max-width: 250px !important;
      height: auto !important;
      display: inline-block !important;
      margin: 0 !important;
      border-radius: 8px !important;
      vertical-align: top !important;
      float: none !important;
    `;
    selectedImage.dataset.currentSize = '250px';
    handleEditorChange();
  };

  const resizeImageMedium = () => {
    if (!selectedImage) {
      alert('Please click on an image first');
      return;
    }
    
    selectedImage.style.cssText = `
      max-width: 400px !important;
      height: auto !important;
      display: inline-block !important;
      margin: 0 !important;
      border-radius: 8px !important;
      vertical-align: top !important;
      float: none !important;
    `;
    selectedImage.dataset.currentSize = '400px';
    handleEditorChange();
  };

  const resizeImageLarge = () => {
    if (!selectedImage) {
      alert('Please click on an image first');
      return;
    }
    
    selectedImage.style.cssText = `
      max-width: 580px !important;
      height: auto !important;
      display: inline-block !important;
      margin: 0 !important;
      border-radius: 8px !important;
      vertical-align: top !important;
      float: none !important;
    `;
    selectedImage.dataset.currentSize = '580px';
    handleEditorChange();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    const currentContent = editorRef.current ? editorRef.current.innerHTML : formData.content;

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!currentContent || currentContent.trim() === '' || currentContent === '<br>') {
      newErrors.content = 'Content is required';
    }
    if (!formData.author.trim()) newErrors.author = 'Author is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validateForm()) return;

    setLoading(true);

    try {
      const currentContent = editorRef.current ? editorRef.current.innerHTML : formData.content;

      // Handle featured image upload
      let imageUrl = formData.image_url;
      if (selectedFile) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        const uploadRes = await api.post('/blogs/upload-inline-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes?.status >= 200 && uploadRes?.status < 300) {
          imageUrl = uploadRes.data.data?.imageUrl || uploadRes.data.imageUrl;
        }
      }

      const payload = { ...formData, content: currentContent, image_url: imageUrl };

      let res;
      if (isEditing) {
        res = await api.put(`/blogs/${editingBlog.id}`, payload);
      } else {
        res = await api.post('/blogs', payload);
      }

      if (res && res.status >= 200 && res.status < 300) {
        onSuccess?.(res.data?.blog ?? null);
        setLoading(false);
        handleClose();
      } else {
        alert(res?.data?.message || 'Something went wrong');
        setLoading(false);
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to save the blog. Please try again.');
      setLoading(false);
    }
  };

  // Setup click handlers for image selection
  useEffect(() => {
    if (editorRef.current) {
      const handleImageClick = (e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
          selectImage(e.target);
        }
      };

      const handleClickOutside = (e) => {
        if (e.target.tagName !== 'IMG') {
          // Remove all image selections when clicking elsewhere
          const allImages = editorRef.current.querySelectorAll('img');
          allImages.forEach(img => img.classList.remove('image-selected'));
          setSelectedImage(null);
        }
      };

      editorRef.current.addEventListener('click', handleImageClick);
      editorRef.current.addEventListener('click', handleClickOutside);
      
      return () => {
        if (editorRef.current) {
          editorRef.current.removeEventListener('click', handleImageClick);
          editorRef.current.removeEventListener('click', handleClickOutside);
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-700">
            {isEditing ? 'Edit Blog Post' : 'Create New Blog Post'}
          </h2>

          <div>
                    <span className="text-xs font-medium text-blue-800 block mb-2">Size (All images are automatically centered):</span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={resizeImageSmall}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Small (250px)
                      </button>
                      <button
                        type="button"
                        onClick={resizeImageMedium}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Medium (400px)
                      </button>
                      <button
                        type="button"
                        onClick={resizeImageLarge}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Large (580px)
                      </button>

                      <button type="button" onClick={insertImage} className="px-3 py-1 text-sm bg-blue-500 text-white border rounded hover:bg-blue-600">
                    📷 Add Image
                  </button>
                   <button
                      type="button"
                      onClick={deleteImage}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      🗑️ Delete Image
                    </button>
                    </div>
                  </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {showSettings ? 'Hide Settings' : 'Settings'}
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Updating...' : 'Publishing...'}
                </span>
              ) : (
                (isEditing ? 'Update' : 'Publish')
              )}
            </button>

            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {showSettings && (
              <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Featured Image */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image</label>
                      <div className="flex items-center space-x-4">
                        <div className="w-32 h-20 bg-gray-100 border border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
                          {imagePreview || formData.image_url ? (
                            <img
                              src={imagePreview || formData.image_url}
                              alt="Featured"
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs">No image</span>
                          )}
                        </div>
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={loading}
                            className="text-sm"
                          />
                          <p className="text-xs text-gray-500 mt-1">16:9 ratio recommended</p>
                        </div>
                      </div>
                    </div>

                    {/* Publish Settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                          type="date"
                          name="published_date"
                          value={formData.published_date}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                        <input
                          type="time"
                          name="published_time"
                          value={formData.published_time}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
                          disabled={loading}
                        />
                      </div>
                    </div>

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
                      <label htmlFor="is_published" className="ml-2 text-sm text-gray-700">
                        Publish immediately
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Tags */}
                    <TagsEditor
                      loading={loading}
                      tags={formData.tags}
                      setTags={(tags) => setFormData((p) => ({ ...p, tags }))}
                    />

                    {/* Resource Links */}
                    <ResourceLinks
                      loading={loading}
                      links={formData.resource_links}
                      setLinks={(links) => setFormData((p) => ({ ...p, resource_links: links }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Editor */}
            <article>
              {/* Title */}
              <div className="mb-8">
                <input
                  ref={titleRef}
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter your blog title..."
                  className={`w-full text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-gray-900 tracking-tight bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded px-2 -mx-2 ${
                    errors.title ? 'ring-2 ring-red-500' : ''
                  }`}
                  disabled={loading}
                  style={{ minHeight: '60px' }}
                />
                {errors.title && <p className="mt-2 text-sm text-red-600">{errors.title}</p>}
              </div>

              {/* Author / meta */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-8 mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-700 font-semibold text-lg">
                      {formData.author ? formData.author.charAt(0).toUpperCase() : 'A'}
                    </span>
                  </div>
                  <div>
                    <input
                      ref={authorRef}
                      type="text"
                      name="author"
                      value={formData.author}
                      onChange={handleInputChange}
                      placeholder="Author name"
                      className={`font-semibold text-gray-900 text-lg bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded px-1 -mx-1 ${
                        errors.author ? 'ring-2 ring-red-500' : ''
                      }`}
                      disabled={loading}
                    />
                    {errors.author && <p className="text-xs text-red-600 mt-1">{errors.author}</p>}
                    <div className="flex items-center text-sm text-gray-600 space-x-2 mt-1">
                      <span>{formatDate(formData.published_date)}</span>
                      <span>•</span>
                      <span>{getReadTime(formData.content)} min read</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Featured image preview */}
              {(imagePreview || formData.image_url) && (
                <div className="mb-12">
                  <img
                    src={imagePreview || formData.image_url}
                    alt="Featured"
                    className="w-full max-w-[600px] h-auto object-cover rounded-xl shadow-sm mx-auto"
                  />
                </div>
              )}

              {/* Simple Toolbar */}
              {/* <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={insertImage} className="px-3 py-1 text-sm bg-blue-500 text-white border rounded hover:bg-blue-600">
                    📷 Add Image
                  </button>
                </div>
              </div> */}

              {/* Simplified Image Controls */}
              {/* <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-3">Image Controls</h4>
                <p className="text-xs text-blue-700 mb-3">Click on an image in the editor, then use these buttons:</p> */}
                
                {/* <div className="space-y-3"> */}
                  {/* Size Controls Only */}
                  {/* <div>
                    <span className="text-xs font-medium text-blue-800 block mb-2">Size (All images are automatically centered):</span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={resizeImageSmall}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Small (250px)
                      </button>
                      <button
                        type="button"
                        onClick={resizeImageMedium}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Medium (400px)
                      </button>
                      <button
                        type="button"
                        onClick={resizeImageLarge}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Large (580px)
                      </button>
                    </div>
                  </div> */}

                  {/* Delete Control */}
                  {/* <div>
                    <span className="text-xs font-medium text-blue-800 block mb-2">Remove:</span>
                    <button
                      type="button"
                      onClick={deleteImage}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      🗑️ Delete Image
                    </button>
                  </div> */}
                {/* </div> */}
              {/* </div> */}

              {/* Rich Text Editor */}
              <div className="mb-16">
                <div className="max-w-[680px] mx-auto">
                  <div 
                    ref={editorRef}
                    contentEditable={!loading}
                    onInput={handleEditorChange}
                    className={`custom-editor min-h-[400px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black overflow-hidden ${
                      errors.content ? 'border-red-500' : 'border-gray-300'
                    }`}
                    data-placeholder="Start writing your blog content..."
                    style={{
                      fontSize: '20px',
                      lineHeight: '1.7',
                      color: '#111827',
                      wordWrap: 'break-word'
                    }}
                  />
                  {errors.content && <p className="mt-2 text-sm text-red-600">{errors.content}</p>}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* Enhanced CSS for auto-centered images */}
      <style>{`
        .custom-editor:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        
        /* Force ALL images to be centered */
        .custom-editor img {
          max-width: 100%;
          height: auto;
          display: inline-block;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin: 0 !important;
          float: none !important;
          vertical-align: top;
        }
        
        /* Image selection highlight */
        .custom-editor .image-selected {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
        }
        
        /* Centered wrapper for all images */
        .custom-editor .image-center-wrapper {
          text-align: center !important;
          margin: 20px 0 !important;
          clear: both !important;
          width: 100% !important;
          display: block !important;
        }
        
        /* Other editor styles */
        .custom-editor h1 {
          font-size: 2.5rem;
          font-weight: bold;
          margin: 2rem 0 1rem;
          clear: both;
        }
        .custom-editor h2 {
          font-size: 2rem;
          font-weight: bold;
          margin: 2rem 0 1rem;
          clear: both;
        }
        .custom-editor p {
          margin-bottom: 1rem;
          line-height: 1.7;
        }
        .custom-editor ul, .custom-editor ol {
          margin: 1rem 0;
          padding-left: 2rem;
        }
        .custom-editor li {
          margin-bottom: 0.5rem;
        }
        
        /* Ensure proper clearfix */
        .custom-editor p:after {
          content: "";
          display: table;
          clear: both;
        }
      `}</style>
    </div>
  );
};

function formatDate(dateString) {
  if (!dateString) return 'Set publish date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Set publish date';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getReadTime(content) {
  if (!content) return 0;
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.ceil(words.length / 200);
}

// Helper components remain the same
function TagsEditor({ loading, tags, setTags }) {
  const [input, setInput] = useState('');
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
      <div className="flex space-x-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { 
            if (e.key === 'Enter') { 
              e.preventDefault(); 
              if (input.trim() && !tags.includes(input.trim())) {
                setTags([...tags, input.trim()]); 
                setInput(''); 
              }
            } 
          }}
          className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
          disabled={loading}
          placeholder="Add a tag..."
        />
        <button
          type="button"
          onClick={() => { 
            if (input.trim() && !tags.includes(input.trim())) {
              setTags([...tags, input.trim()]); 
              setInput(''); 
            }
          }}
          className="px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
          disabled={loading}
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 border border-gray-300">
            {t}
            <button 
              type="button" 
              onClick={() => setTags(tags.filter(x => x !== t))} 
              className="ml-1 text-gray-500 hover:text-gray-700" 
              disabled={loading}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function ResourceLinks({ loading, links, setLinks }) {
  const [resourceInput, setResourceInput] = useState({ title: '', url: '' });
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Resource Links</label>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Link title"
          value={resourceInput.title}
          onChange={(e) => setResourceInput((p) => ({ ...p, title: e.target.value }))}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
          disabled={loading}
        />
        <div className="flex space-x-2">
          <input
            type="url"
            placeholder="https://..."
            value={resourceInput.url}
            onChange={(e) => setResourceInput((p) => ({ ...p, url: e.target.value }))}
            className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => {
              const { title, url } = resourceInput;
              if (title.trim() && url.trim()) {
                setLinks([...links, { title: title.trim(), url: url.trim() }]);
                setResourceInput({ title: '', url: '' });
              }
            }}
            className="px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
            disabled={loading}
          >
            Add
          </button>
        </div>
      </div>
      {links.length > 0 && (
        <div className="mt-2 space-y-1">
          {links.map((link, index) => (
            <div key={index} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-gray-200">
              <span className="truncate">{link.title}</span>
              <button 
                type="button" 
                onClick={() => setLinks(links.filter((_, i) => i !== index))} 
                className="text-red-600 hover:text-red-800 ml-2" 
                disabled={loading}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlogModal;