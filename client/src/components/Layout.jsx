import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';

const Layout = ({ children }) => {
  const { logout, user, getCurrentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get current user info
  const currentUser = getCurrentUser();

  // Determine current active tab from URL
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/events')) {
      return 'events';
    } else if (path.includes('/dashboard')) {
      return 'blog';
    }
    return 'blog'; // default
  };

  const currentTab = getCurrentTab();

  // Handle tab switching
  const handleTabSwitch = (tab) => {
    setMobileMenuOpen(false); // Close mobile menu
    
    if (tab === 'blog') {
      navigate('/dashboard');
    } else if (tab === 'events') {
      navigate('/events');
    }
  };

  // Handle logout with confirmation
  const handleLogout = async () => {
    // Show confirmation dialog
    const confirmLogout = window.confirm(
      'Are you sure you want to logout?'
    );

    if (!confirmLogout) {
      return;
    }

    setIsLoggingOut(true);

    try {
      // Call logout function from useAuth
      const result = logout();
      
      if (result.success) {
        // Logout successful - App.jsx will handle redirect to login
        console.log('Logout successful');
      } else {
        console.error('Logout failed:', result.message);
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Left side - Logo and title */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                {/* <h1 className="text-2xl font-bold text-black">
                  GIC Admin
                </h1> */}
                <img src="/Logo.png" alt="Logo" className='w-[149px]' />
              </div>
              <div className="hidden sm:block">
                <p className="text-gray-600 text-sm">
                  Content Management System
                </p>
              </div>
            </div>

            {/* Center - Navigation Tabs (Desktop) */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => handleTabSwitch('blog')}
                className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                  currentTab === 'blog'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Blog Management
              </button>
              <button
                onClick={() => handleTabSwitch('events')}
                className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                  currentTab === 'events'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Event Management
              </button>
            </div>

            {/* Right side - User info, mobile menu, and logout */}
            <div className="flex items-center space-x-4">
              
              {/* Mobile menu button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* User info (Desktop) */}
              <div className="hidden lg:block text-right">
                <p className="text-sm font-medium text-gray-900">
                  {currentUser?.email || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500">
                  Administrator
                </p>
              </div>

              {/* User avatar (Mobile/Tablet) */}
              <div className="lg:hidden">
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                  isLoggingOut
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black'
                }`}
              >
                {isLoggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span className="hidden sm:inline">Logging out...</span>
                  </>
                ) : (
                  <>
                    <svg 
                      className="w-4 h-4 sm:mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                      />
                    </svg>
                    <span className="hidden sm:inline">Logout</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-4">
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => handleTabSwitch('blog')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentTab === 'blog'
                      ? 'bg-black text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3">📝</span>
                  Blog Management
                </button>
                <button
                  onClick={() => handleTabSwitch('events')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentTab === 'events'
                      ? 'bg-black text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3">📅</span>
                  Event Management
                </button>
                
                {/* User info in mobile menu */}
                <div className="px-3 py-2 border-t border-gray-200 mt-3 pt-3">
                  <p className="text-sm font-medium text-gray-900">
                    {currentUser?.email || 'Admin User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Administrator
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            <p className="text-xs text-gray-500">
              © 2025 Gurugram Investors Club. All rights reserved.
            </p>
            <div className="flex items-center space-x-4">
              <p className="text-xs text-gray-400">
                Admin Panel v1.0
              </p>
              {/* Current page indicator */}
              <span className="text-xs text-gray-400">
                {currentTab === 'blog' ? '📝 Blog' : '📅 Events'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;