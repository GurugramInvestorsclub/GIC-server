import { useState, useEffect } from 'react';
import axios from 'axios';

// Configure axios base URL (adjust this to match your server)
const API_BASE_URL = 'https://gic-server.onrender.com/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Custom hook for authentication
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on hook initialization
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Add token to axios requests if available
  useEffect(() => {
    const token = getToken();
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [user]);

  // Get token from localStorage
  const getToken = () => {
    try {
      return localStorage.getItem('gic_admin_token');
    } catch (error) {
      console.error('Error getting token from localStorage:', error);
      return null;
    }
  };

  // Save token to localStorage
  const saveToken = (token) => {
    try {
      localStorage.setItem('gic_admin_token', token);
    } catch (error) {
      console.error('Error saving token to localStorage:', error);
    }
  };

  // Remove token from localStorage
  const removeToken = () => {
    try {
      localStorage.removeItem('gic_admin_token');
    } catch (error) {
      console.error('Error removing token from localStorage:', error);
    }
  };

  // Check authentication status
  const checkAuthStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getToken();

      if (!token) {
        setUser(null);
        setLoading(false);
        return false;
      }

      // Verify token with server
      const response = await api.post('/auth/verify', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setUser(response.data.data.user);
        setLoading(false);
        return true;
      } else {
        removeToken();
        setUser(null);
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      removeToken();
      setUser(null);
      setError('Authentication verification failed');
      setLoading(false);
      return false;
    }
  };

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const response = await api.post('/auth/login', {
        email: email.trim(),
        password
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        saveToken(token);
        setUser(user);
        setLoading(false);
        return { success: true, message: 'Login successful', user };
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
      return { success: false, message: errorMessage };
    }
  };

  // Logout function
  const logout = () => {
    try {
      removeToken();
      setUser(null);
      setError(null);
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
      return { success: false, message: 'Error during logout' };
    }
  };

  // Upload inline image
  const uploadInlineImage = async (file) => {
    try {
      if (!file) throw new Error('No file provided');
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) throw new Error('Invalid file type');
      if (file.size > 10 * 1024 * 1024) throw new Error('File size too large. Max 10MB');

      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/blogs/upload-inline-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        return {
          success: true,
          imageUrl: response.data.data.imageUrl,
          fileName: response.data.data.fileName,
        };
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Inline image upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload image.';
      return { success: false, message: errorMessage };
    }
  };

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: () => !!user && !!getToken(),
    getCurrentUser: () => user,
    getToken,
    checkAuthStatus,
    clearError: () => setError(null),
    refreshAuth: checkAuthStatus,
    uploadInlineImage,
    api,
  };
};

// Export axios instance for reuse
export { api };
