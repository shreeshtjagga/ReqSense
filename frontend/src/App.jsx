import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AcceptInvite from './pages/auth/AcceptInvite';

// Client Pages
import ClientDashboard from './pages/client/ClientDashboard';
import ClientSessions from './pages/client/ClientSessions';
import ClientProjectSessions from './pages/client/ClientProjectSessions';
import ChatSession from './pages/client/ChatSession';
import ChangeRequestForm from './pages/client/ChangeRequestForm';

// Developer Pages
import DevDashboard from './pages/developer/DevDashboard';
import ProjectDetail from './pages/developer/ProjectDetail';
import FeatureTracker from './pages/developer/FeatureTracker';
import ChangeRequests from './pages/developer/ChangeRequests';
import SRSPage from './pages/developer/SRSPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import Analytics from './pages/admin/Analytics';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';

// Common Components
import ToastNotification from './components/common/Alert';
import ErrorBoundary from './components/common/ErrorBoundary';

// Scoped Route Guards
const PrivateRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Root Dashboard Switcher
const DashboardSwitcher = () => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  if (user?.role === 'developer') {
    return <DevDashboard />;
  }
  return <ClientDashboard />;
};

export const App = () => {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* Private Unified Dashboard Root */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardSwitcher />
            </PrivateRoute>
          }
        />

        {/* Client Routes */}
        <Route
          path="/client/sessions"
          element={
            <PrivateRoute allowedRoles={['client']}>
              <ClientSessions />
            </PrivateRoute>
          }
        />
        <Route
          path="/client/projects/:projectId/sessions"
          element={
            <PrivateRoute allowedRoles={['client', 'developer', 'admin']}>
              <ClientProjectSessions />
            </PrivateRoute>
          }
        />
        <Route
          path="/client/sessions/:sessionId"
          element={
            <PrivateRoute allowedRoles={['client', 'developer', 'admin']}>
              <ChatSession />
            </PrivateRoute>
          }
        />
        <Route
          path="/client/change-request/new"
          element={
            <PrivateRoute allowedRoles={['client']}>
              <ChangeRequestForm />
            </PrivateRoute>
          }
        />

        {/* Developer Routes */}
        <Route
          path="/dev/projects/:projectId"
          element={
            <PrivateRoute allowedRoles={['developer', 'admin']}>
              <ProjectDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/dev/features"
          element={
            <PrivateRoute allowedRoles={['developer', 'admin']}>
              <FeatureTracker />
            </PrivateRoute>
          }
        />
        <Route
          path="/dev/change-requests"
          element={
            <PrivateRoute allowedRoles={['developer', 'admin']}>
              <ChangeRequests />
            </PrivateRoute>
          }
        />
        <Route
          path="/dev/srs"
          element={
            <PrivateRoute allowedRoles={['developer', 'admin']}>
              <SRSPage />
            </PrivateRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/users"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <UserManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <PrivateRoute allowedRoles={['admin', 'developer']}>
              <Analytics />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <AdminAuditLogs />
            </PrivateRoute>
          }
        />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Toast Notification Provider */}
      <ToastNotification />
    </ErrorBoundary>
  );
};

export default App;
