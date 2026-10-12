import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuth } from './hooks/useAuth';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const AcceptInvite = lazy(() => import('./pages/auth/AcceptInvite'));

const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientProjectHub = lazy(() => import('./pages/client/ClientProjectHub'));
const ChatSession = lazy(() => import('./pages/client/ChatSession'));

const DevDashboard = lazy(() => import('./pages/developer/DevDashboard'));
const ProjectDetail = lazy(() => import('./pages/developer/ProjectDetail'));

import ToastNotification from './components/common/Alert';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotFound from './pages/NotFound';

const RouteFallback = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      bgcolor: 'transparent',
      opacity: 0,
    }}
  />
);

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

const DashboardSwitcher = () => {
  const { user } = useAuth();
  
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
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* Root Role-Based Dashboard */}
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
              <PrivateRoute allowedRoles={['client', 'developer']}>
                <ClientProjectHub />
              </PrivateRoute>
            }
          />
          <Route
            path="/client/sessions/:sessionId"
            element={
              <PrivateRoute allowedRoles={['client', 'developer']}>
                <ChatSession />
              </PrivateRoute>
            }
          />

          {/* Developer Routes */}
          <Route
            path="/dev/projects/:projectId"
            element={
              <PrivateRoute allowedRoles={['developer']}>
                <ProjectDetail />
              </PrivateRoute>
            }
          />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      
      <ToastNotification />
    </ErrorBoundary>
  );
};

export default App;
