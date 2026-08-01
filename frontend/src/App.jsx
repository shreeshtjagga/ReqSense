import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './hooks/useAuth';

// Auth Pages (small, load eagerly — first thing anyone sees)
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AcceptInvite from './pages/auth/AcceptInvite';

// Everything else — lazy-loaded per role so a client never downloads admin
// bundles and vice versa
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientProjectHub = lazy(() => import('./pages/client/ClientProjectHub'));
const ChatSession = lazy(() => import('./pages/client/ChatSession'));

const DevDashboard = lazy(() => import('./pages/developer/DevDashboard'));
const ProjectDetail = lazy(() => import('./pages/developer/ProjectDetail'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'));

import ToastNotification from './components/common/Alert';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotFound from './pages/NotFound';

const RouteFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

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
      <Suspense fallback={<RouteFallback />}>
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
            path="/client/projects/:projectId"
            element={
              <PrivateRoute allowedRoles={['client']}>
                <ClientProjectHub />
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

          {/* Developer Routes */}
          <Route
            path="/dev/projects/:projectId"
            element={
              <PrivateRoute allowedRoles={['developer', 'admin']}>
                <ProjectDetail />
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
      </Suspense>
      
      {/* Toast Notification Provider */}
      <ToastNotification />
    </ErrorBoundary>
  );
};

export default App;
