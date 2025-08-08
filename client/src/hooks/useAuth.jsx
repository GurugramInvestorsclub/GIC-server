import { useState, useEffect } from 'react';
import axios from 'axios';

// Configure axios base URL (adjust this to match your server)
const API_BASE_URL = 'http://localhost:3000/api';

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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUser(response.data.data.user);
        setLoading(false);
        return true;
      } else {
        // Token is invalid, remove it
        removeToken();
        setUser(null);
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // If token verification fails, remove invalid token
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
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      console.log('Making login request...'); // Debug log

      // Make login request
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password: password
      });

      console.log('Login response:', response.data); // Debug log

      if (response.data.success) {
        const { token, user } = response.data.data;
        
        console.log('Token received:', token); // Debug log
        console.log('User data:', user); // Debug log
        
        // Save token and user data
        saveToken(token);
        setUser(user);
        setLoading(false);
        
        console.log('Login successful, user set'); // Debug log
        
        return {
          success: true,
          message: 'Login successful',
          user: user
        };
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      console.log('Login response data:', error.response?.data); // Debug log
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Login failed. Please try again.';
      
      setError(errorMessage);
      setLoading(false);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  };

  // Logout function
  const logout = () => {
    try {
      // Clear token and user data
      removeToken();
      setUser(null);
      setError(null);
      
      // Remove authorization header
      delete api.defaults.headers.common['Authorization'];
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Error during logout'
      };
    }
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!user && !!getToken();
  };

  // Get current user
  const getCurrentUser = () => {
    return user;
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Force refresh authentication
  const refreshAuth = async () => {
    return await checkAuthStatus();
  };

  // Return hook interface
  return {
    // State
    user,
    loading,
    error,
    
    // Functions
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
    getToken,
    checkAuthStatus,
    clearError,
    refreshAuth,
    
    // Axios instance for API calls
    api
  };
};

// Export axios instance for use in other components
export { api };

export default useAuth;