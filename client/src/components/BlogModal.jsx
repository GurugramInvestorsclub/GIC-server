// /components/BlogModal.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import QuillResizeImage from 'quill-resize-image';

// --- Register modules ---
Quill.register('modules/resize', QuillResizeImage);

// --- Image alignment support: add a custom Image format that toggles ql-align-* classes on <img> ---
const BaseImage = Quill.import('formats/image');
class ImageWithAlign extends BaseImage {
  static formats(domNode) {
    const formats = super.formats(domNode) || {};
    // capture alignment class if present on the image
    if (domNode.classList.contains('ql-align-left')) formats.align = 'left';
    else if (domNode.classList.contains('ql-align-center')) formats.align = 'center';
    else if (domNode.classList.contains('ql-align-right')) formats.align = 'right';
    else if (domNode.classList.contains('ql-align-justify')) formats.align = 'justify';
    return formats;
  }

  format(name, value) {
    if (name === 'align') {
      const cls = ['ql-align-left', 'ql-align-center', 'ql-align-right', 'ql-align-justify'];
      cls.forEach(c => this.domNode.classList.remove(c));
      if (value) {
        this.domNode.classList.add(`ql-align-${value}`);
      }
    } else {
      super.format(name, value);
    }
  }
}
Quill.register(ImageWithAlign, true);

// Optional: allow block align attributor (for paragraphs)
const AlignClass = Quill.import('attributors/class/align');
Quill.register(AlignClass, true);

function tryParseDelta(maybe) {
  try {
    const obj = typeof maybe === 'string' ? JSON.parse(maybe) : maybe;
    if (obj && typeof obj === 'object' && Array.isArray(obj.ops)) return obj;
    return null;
  } catch {
    return null;
  }
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const BlogModal = ({ isOpen, onClose, onSuccess, editingBlog = null }) => {
  const { api, uploadInlineImage } = useAuth(); // :contentReference[oaicite:1]{index=1}
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
  const [tagInput, setTagInput] = useState('');
  const [resourceInput, setResourceInput] = useState({ title: '', url: '' });
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const quillRef = useRef(null);
  const titleRef = useRef(null);
  const authorRef = useRef(null);
  const fileInputRef = useRef(null);
  const contentRef = useRef(''); // avoids over-renders

  // Debounced setter
  const updateContentDebounced = useCallback(
    debounce((content) => {
      setFormData((prev) => ({ ...prev, content }));
      if (content && content.trim() && content !== '<p><br></p>') {
        setErrors((prev) => ({ ...prev, content: '' }));
      }
    }, 200),
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && editingBlog) {
      populateForm(editingBlog);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditing, editingBlog?.id]); // re-populate when the record changes

  const populateForm = (blog) => {
    // Accept either HTML string or a saved Delta
    const raw = blog.content || '';
    const delta = tryParseDelta(raw);
    const contentForEditor = delta || raw; // ReactQuill accepts both

    setFormData({
      title: blog.title || '',
      content: contentForEditor,
      author: blog.author || '',
      image_url: blog.image_url || '',
      published_date: blog.published_date || '',
      published_time: blog.published_time || '',
      tags: Array.isArray(blog.tags) ? blog.tags : [],
      resource_links: Array.isArray(blog.resource_links) ? blog.resource_links : [],
      is_published: !!blog.is_published,
    });

    contentRef.current = contentForEditor;
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

    contentRef.current = '';
    setSelectedFile(null);
    setImagePreview(null);
    setErrors({});
    setTagInput('');
    setResourceInput({ title: '', url: '' });
  };

  const handleQuillChange = useCallback(
    (value, _delta, _source, _editor) => {
      contentRef.current = value;
      updateContentDebounced(value);
    },
    [updateContentDebounced]
  );

  const handleClose = () => {
    if (!loading) onClose?.();
  };

  // Inline image upload
  const imageHandler = useCallback(() => {
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

        const quill = quillRef.current?.getEditor?.();
        if (!quill) return;

        const selection = quill.getSelection();
        const index = selection ? selection.index : quill.getLength();

        quill.insertEmbed(index, 'image', upload.imageUrl, 'user');
        quill.setSelection(index + 1, 0, 'silent');
        quill.focus();
      } catch (e) {
        console.error('Image upload error:', e);
        alert('Failed to upload image. Please try again.');
      } finally {
        setUploadingInlineImage(false);
      }
    };

    input.click();
  }, [uploadInlineImage]);

  // NEW: image alignment helpers (operate on image at cursor)
  const setImageAlign = useCallback((align) => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) return;

    // Try to get the blot at cursor; if it's an image, format it; else apply block align
    const [blot, offset] = quill.scroll.descendant(ImageWithAlign, range.index);
    if (blot) {
      blot.format('align', align); // left|center|right|justify|null
    } else {
      quill.format('align', align || false);
    }
  }, []);

  const quillModules = useCallback(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image', 'blockquote', 'code-block'],
          [{ align: [] }],
          // custom alignment buttons for images
          [{ 'align-left': '' }, { 'align-center': '' }, { 'align-right': '' }],
          ['clean'],
        ],
        handlers: {
          image: imageHandler,
          'align-left': () => setImageAlign('left'),
          'align-center': () => setImageAlign('center'),
          'align-right': () => setImageAlign('right'),
        },
      },
      resize: {
        locale: {},
        modules: ['Resize', 'DisplaySize', 'Toolbar'],
      },
    }),
    [imageHandler, setImageAlign]
  );

  // IMPORTANT: do NOT include "width" or "style"
  const quillFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'link',
    'image',
    'blockquote',
    'code-block',
    'align',
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    const currentContent = contentRef.current || formData.content;

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!currentContent || (typeof currentContent === 'string' && (!currentContent.trim() || currentContent === '<p><br></p>'))) {
      newErrors.content = 'Content is required';
    }
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
      // Gather content (HTML string or Delta object as-is)
      const currentContent = contentRef.current ?? formData.content;

      let imageUrl = formData.image_url;
      if (selectedFile) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        const uploadRes = await api.post('/blogs/upload-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes?.status < 200 || uploadRes?.status >= 300) {
          alert(uploadRes?.data?.message || 'Failed to upload the main image');
          setLoading(false);
          return;
        }
        imageUrl = uploadRes.data.imageUrl || uploadRes.data?.data?.imageUrl || imageUrl;
      }

      const payload = { ...formData, content: currentContent, image_url: imageUrl };

      // Accept 2xx as success and close
      let res;
      if (isEditing) {
        res = await api.put(`/blogs/${editingBlog.id}`, payload);
      } else {
        res = await api.post('/blogs', payload);
      }

      const ok = res && res.status >= 200 && res.status < 300;
      if (ok) {
        onSuccess?.(res.data?.blog ?? null);
        setLoading(false);
        handleClose(); // close immediately after success
      } else {
        alert(res?.data?.message || 'Something went wrong');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save the blog. Please try again.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-700">
            {isEditing ? 'Edit Blog Post' : 'Create New Blog Post'}
          </h2>

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
                      resourceInput={resourceInput}
                      setResourceInput={setResourceInput}
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

              {/* Quill */}
              <div className="mb-16">
                <div className="max-w-[680px] mx-auto">
                  <div className={`wysiwyg-editor ${errors.content ? 'ring-2 ring-red-500 rounded' : ''}`}>
                    <ReactQuill
                      key={`editor-${isOpen}-${isEditing}-${editingBlog?.id || 'new'}`}
                      ref={quillRef}
                      theme="snow"
                      value={formData.content}
                      onChange={handleQuillChange}
                      modules={quillModules()}
                      formats={quillFormats}
                      style={{ minHeight: '400px' }}
                      className="blog-content-editor"
                    />
                  </div>
                  {errors.content && <p className="mt-2 text-sm text-red-600">{errors.content}</p>}
                  {uploadingInlineImage && <p className="mt-2 text-sm text-gray-500">Uploading image...</p>}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* NOTE: plain <style>, not styled-jsx */}
      <style>{`
        .wysiwyg-editor .ql-toolbar {
          border: none;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 1rem;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .wysiwyg-editor .ql-container { border: none; font-family: inherit; }
        .wysiwyg-editor .ql-editor { padding: 0; font-size: 20px; line-height: 1.7; color: #111827; }
        .wysiwyg-editor .ql-editor p { margin-bottom: 2rem; }
        .wysiwyg-editor .ql-editor h1 { font-size: 2.5rem; font-weight: bold; line-height: 1.2; margin: 2.5rem 0 1.5rem; }
        .wysiwyg-editor .ql-editor h2 { font-size: 2rem; font-weight: bold; line-height: 1.3; margin: 2.5rem 0 1.25rem; }
        .wysiwyg-editor .ql-editor h3 { font-size: 1.5rem; font-weight: bold; line-height: 1.4; margin: 2rem 0 1rem; }
        .wysiwyg-editor .ql-editor img {
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin: 2rem auto;
          max-width: 600px;
          height: auto;
          display: block;
        }
        .wysiwyg-editor .ql-editor blockquote { border-left: 4px solid #d1d5db; padding-left: 1.5rem; font-style: italic; color: #4b5563; margin: 2rem 0; }
        .wysiwyg-editor .ql-editor a { color: #111827; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
        .wysiwyg-editor .ql-editor a:hover { color: #4b5563; }
        .wysiwyg-editor .ql-editor pre { background: #f3f4f6; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
        .wysiwyg-editor .ql-editor ul, .wysiwyg-editor .ql-editor ol { margin-bottom: 2rem; }
        .wysiwyg-editor .ql-editor li { margin-bottom: 0.75rem; }

        /* Alignment helpers for images */
        .wysiwyg-editor .ql-editor img.ql-align-center { display:block; margin-left:auto; margin-right:auto; }
        .wysiwyg-editor .ql-editor img.ql-align-right { display:block; margin-left:auto; margin-right:0; }
        .wysiwyg-editor .ql-editor .ql-align-center { text-align: center; }
        .wysiwyg-editor .ql-editor .ql-align-right { text-align: right; }
        .wysiwyg-editor .ql-editor .ql-align-justify { text-align: justify; }
      `}</style>
    </div>
  );
};

function formatDate(dateString) {
  if (!dateString) return 'Set publish date';
  const date = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
  if (isNaN(date.getTime())) return 'Set publish date';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getReadTime(content) {
  if (!content) return 0;
  const text =
    typeof content === 'string'
      ? content.replace(/<[^>]*>/g, '')
      : Array.isArray(content?.ops)
        ? content.ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('')
        : '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.ceil(words.length / 200);
}

/* Small helpers for tags / links (kept simple) */
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
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (input.trim() && !tags.includes(input.trim())) setTags([...tags, input.trim()]); setInput(''); } }}
          className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black border-gray-300"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => { if (input.trim() && !tags.includes(input.trim())) setTags([...tags, input.trim()]); setInput(''); }}
          className="px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
          disabled={loading}
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 border border-gray-300">
            {t}
            <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="ml-1 text-gray-500 hover:text-gray-700" disabled={loading}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function ResourceLinks({ loading, links, setLinks, resourceInput, setResourceInput }) {
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const { title, url } = resourceInput;
                if (title.trim() && url.trim()) {
                  setLinks([...links, { title: title.trim(), url: url.trim() }]);
                  setResourceInput({ title: '', url: '' });
                }
              }
            }}
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
            className="px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
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
              <button type="button" onClick={() => setLinks(links.filter((_, i) => i !== index))} className="text-red-600 hover:text-red-800 ml-2" disabled={loading}>
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
