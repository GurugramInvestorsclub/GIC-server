import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const Layout = ({ children }) => {
  const { logout, user, getCurrentUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get current user info
  const currentUser = getCurrentUser();

  // Handle logout with confirmation
  const handleLogout = async () => {
    // Show confirmation dialog
    const confirmLogout = window.confirm(
      'Are you sure you want to logout? You will need to login again to access the dashboard.'
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
                  Blog Management System
                </p>
              </div>
            </div>

            {/* Right side - User info and logout */}
            <div className="flex items-center space-x-4">
              
              {/* User info */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-900">
                  {currentUser?.email || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500">
                  Administrator
                </p>
              </div>

              {/* Mobile user indicator */}
              <div className="md:hidden">
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
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                  isLoggingOut
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black'
                }`}
              >
                {isLoggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Logging out...
                  </>
                ) : (
                  <>
                    <svg 
                      className="w-4 h-4 mr-2" 
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
                    <span className="sm:hidden">Exit</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
            <p className="text-xs text-gray-400">
              Admin Panel v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;  