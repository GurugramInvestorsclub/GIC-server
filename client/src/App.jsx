import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Import pages (we'll create these next)
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
      <p className="text-white text-lg">Loading...</p>
    </div>
  </div>
);

// Error component
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="text-center max-w-md mx-auto px-4">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-white text-xl mb-4">Something went wrong</h2>
      <p className="text-gray-300 mb-6">{error}</p>
      <button 
        onClick={onRetry}
        className="bg-white text-black px-6 py-2 rounded hover:bg-gray-200 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  console.log('ProtectedRoute - loading:', loading, 'isAuthenticated:', isAuthenticated(), 'user:', user); // Debug log

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  console.log('PublicRoute - loading:', loading, 'isAuthenticated:', isAuthenticated(), 'user:', user); // Debug log

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated() ? <Navigate to="/dashboard" replace /> : children;
};

// Main App Content
const AppContent = () => {
  const { loading, error, checkAuthStatus, clearError, isAuthenticated, user } = useAuth();
  const location = useLocation();

  console.log('AppContent - Auth state:', { loading, error, isAuthenticated: isAuthenticated(), user, pathname: location.pathname }); // Debug log

  // Check authentication status on app load and route changes
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle retry for errors
  const handleRetry = () => {
    clearError();
    checkAuthStatus();
  };

  // Show error screen if there's a critical error
  if (error && loading === false) {
    return <ErrorDisplay error={error} onRetry={handleRetry} />;
  }

  // Show loading screen during initial auth check
  if (loading && location.pathname === '/') {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-black">
      <Routes>
        {/* Default route - redirect based on auth status */}
        <Route 
          path="/" 
          element={
            <Navigate 
              to={loading ? "/" : (isAuthenticated() ? "/dashboard" : "/login")} 
              replace 
            />
          } 
        />
        
        {/* Public route - Login page */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        
        {/* Protected route - Dashboard */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch all other routes and redirect */}
        <Route 
          path="*" 
          element={
            <Navigate to="/" replace />
          } 
        />
      </Routes>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;