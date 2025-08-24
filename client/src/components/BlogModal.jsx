import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';   // ✅ named import (your hook file uses `export const useAuth`)
import ReactQuill from 'react-quill';
import Quill from 'quill';
import 'react-quill/dist/quill.snow.css';

// ✅ Image resize plugin (ESM export)
// import ImageResize from 'quill-image-resize-module-react';
// import { ImageDrop } from 'quill-image-drop-module';

// // Register Quill modules
// Quill.register('modules/imageResize', ImageResize);
// Quill.register('modules/imageDrop', ImageDrop);

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
    is_published: false
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [resourceInput, setResourceInput] = useState({ title: '', url: '' });
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const textareaRef = useRef(null);
  const quillRef = useRef(null);

useEffect(() => {
  if (isOpen && isEditing && editingBlog) {
    populateForm(editingBlog);
  } else if (isOpen && !isEditing) {
    resetForm();
  }
}, [isOpen, isEditing, editingBlog]);

// ✅ Add this here
const handleQuillChange = (html) => {
  setFormData((prev) => ({ ...prev, content: html }));
  if (errors?.content) {
    setErrors((prev) => ({ ...prev, content: '' }));
  }
};

  const handleClose = () => {
    if (!loading) onClose?.();
  };

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

  const insertImageAtCursor = (imageUrl) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = formData.content;

    const imageHtml = `<img src="${imageUrl}" alt="Uploaded image" style="max-width: 100%; height: auto; margin: 10px 0;" />`;

    const newContent = currentContent.substring(0, start) + imageHtml + currentContent.substring(end);

    setFormData((prev) => ({
      ...prev,
      content: newContent
    }));

    setTimeout(() => {
      textarea.focus();
      const caretPos = start + imageHtml.length;
      textarea.setSelectionRange(caretPos, caretPos);
    }, 0);
  };

  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setUploadingInlineImage(true);
      try {
        const upload = await uploadInlineImage(file);
        if (!upload?.success) {
          alert(upload?.message || 'Image upload failed');
          return;
        }
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);
        if (range) {
          quill.insertEmbed(range.index, 'image', upload.imageUrl, 'user');
          quill.setSelection(range.index + 1, 0, 'user');
        }
      } catch (e) {
        console.error(e);
        alert('Failed to upload image. Please try again.');
      } finally {
        setUploadingInlineImage(false);
      }
    };
    input.click();
  };

  const quillToolbar = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image', 'blockquote', 'code-block'],
    [{ align: [] }],
    ['clean']
  ];

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'image', 'blockquote', 'code-block',
    'align'
  ];

  const quillModules = {
    toolbar: {
      container: quillToolbar,
      handlers: { image: imageHandler }
    },
    // imageResize: {},
    // imageDrop: true
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
      tags: Array.isArray(blog.tags) ? blog.tags : [],
      resource_links: Array.isArray(blog.resource_links) ? blog.resource_links : [],
      is_published: !!blog.is_published
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

    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.content.trim()) newErrors.content = 'Content is required';
    if (!formData.author.trim()) newErrors.author = 'Author is required';

    if (formData.published_date && !/^\d{4}-\d{2}-\d{2}$/.test(formData.published_date)) {
      newErrors.published_date = 'Date must be in YYYY-MM-DD format';
    }
    if (formData.published_time && !/^\d{2}:\d{2}$/.test(formData.published_time)) {
      newErrors.published_time = 'Time must be in HH:MM format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle image file selection (main blog image)
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

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Upload main image if selected
      let imageUrl = formData.image_url;
      if (selectedFile) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        const uploadRes = await api.post('/blogs/upload-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (!uploadRes?.data?.success) {
          alert(uploadRes?.data?.message || 'Failed to upload the main image');
          setLoading(false);
          return;
        }
        imageUrl = uploadRes.data.imageUrl;
      }

      const payload = {
        ...formData,
        image_url: imageUrl
      };

      let res;
      if (isEditing) {
        res = await api.put(`/blogs/${editingBlog.id}`, payload);
      } else {
        res = await api.post('/blogs', payload);
      }

      if (res?.data?.success) {
        onSuccess?.(res.data.blog || null);
        handleClose();
      } else {
        alert(res?.data?.message || 'Something went wrong');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save the blog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Tag management
  const addTag = () => {
    const val = tagInput.trim();
    if (!val) return;
    if (formData.tags.includes(val)) return;

    setFormData((prev) => ({ ...prev, tags: [...prev.tags, val] }));
    setTagInput('');
  };

  const removeTag = (tag) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  // Resource links
  const addResourceLink = () => {
    const { title, url } = resourceInput;
    if (!title.trim() || !url.trim()) return;
    const link = { title: title.trim(), url: url.trim() };
    setFormData((prev) => ({ ...prev, resource_links: [...prev.resource_links, link] }));
    setResourceInput({ title: '', url: '' });
  };

  const removeResourceLink = (index) => {
    setFormData((prev) => ({
      ...prev,
      resource_links: prev.resource_links.filter((_, i) => i !== index)
    }));
  };

  // Keyboard helpers
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleResourceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addResourceLink();
    }
  };

  

  // NOTE: These legacy helpers were for the plain textarea toolbar; keeping them
  // no-ops to avoid runtime references. You can remove them if you like.
  const insertFormatting = () => {};
  
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
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 bg-gray-100 border border-gray-300 rounded overflow-hidden flex items-center justify-center">
                {imagePreview || formData.image_url ? (
                  <img
                    src={imagePreview || formData.image_url}
                    alt="Preview"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-gray-400 text-sm">No image</span>
                )}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handleFileChange} disabled={loading} />
                <p className="text-xs text-gray-500 mt-1">Recommended: 1200×630 (or similar 16:9)</p>
              </div>
            </div>
          </div>

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

              {/* Publish date/time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="published_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Publish Date
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
                  {errors.published_date && (
                    <p className="mt-1 text-sm text-red-600">{errors.published_date}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="published_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Publish Time
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
                  {errors.published_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.published_time}</p>
                  )}
                </div>
              </div>

              {/* Publish switch */}
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
              {/* Content */}
              <div>
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

                {!previewMode ? (
                  <>
                    <div className="border border-gray-300 rounded-md bg-white">
                      <ReactQuill
                        ref={quillRef}
                        theme="snow"
                        value={formData.content}
                        onChange={handleQuillChange}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Write your post… You can paste, drag & drop, or use the toolbar to insert images."
                        className="min-h-[300px]"
                      />
                    </div>
                    {uploadingInlineImage && (
                      <p className="mt-2 text-xs text-slate-500">Uploading image…</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Tip: Use the image button, drag & drop from your desktop, or paste an image. You can resize images via handles.
                    </p>
                  </>
                ) : (
                  /* Preview Mode */
                  <div className="border border-gray-300 rounded-md p-4 bg-white min-h-[300px] max-h-[400px] overflow-y-auto">
                    {formData.content ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: formData.content }}
                        className="prose prose-sm max-w-none"
                        style={{ lineHeight: '1.6', color: '#374151' }}
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
                    onKeyDown={handleTagKeyDown}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
                    placeholder="Add a tag and press Enter"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-black text-white rounded-md hover:bg-gray-900"
                    disabled={loading}
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-gray-100 border border-gray-300"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                        title="Remove tag"
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
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-2">
                  <input
                    type="text"
                    className="sm:col-span-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
                    placeholder="Title"
                    value={resourceInput.title}
                    onChange={(e) => setResourceInput((prev) => ({ ...prev, title: e.target.value }))}
                    onKeyDown={handleResourceKeyDown}
                    disabled={loading}
                  />
                  <input
                    type="url"
                    className="sm:col-span-3 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
                    placeholder="https://example.com"
                    value={resourceInput.url}
                    onChange={(e) => setResourceInput((prev) => ({ ...prev, url: e.target.value }))}
                    onKeyDown={handleResourceKeyDown}
                    disabled={loading}
                  />
                </div>
                <button
                  type="button"
                  onClick={addResourceLink}
                  className="px-3 py-2 bg-black text-white rounded-md hover:bg-gray-900"
                  disabled={loading}
                >
                  Add Link
                </button>

                {formData.resource_links.length > 0 && (
                  <div className="mt-3 space-y-2">
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-black text-white hover:bg-gray-900 disabled:opacity-50 inline-flex items-center"
              disabled={loading}
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
