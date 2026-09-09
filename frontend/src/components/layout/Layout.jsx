import React, { useState } from 'react';
import { Box, CssBaseline, Toolbar } from '@mui/material';
import Navbar from '../common/Navbar';
import Sidebar from '../common/Sidebar';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

const drawerWidth = 240;

export const Layout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const hasSidebar = user?.role === ROLES.ADMIN;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      
      {/* Navbar */}
      <Navbar onSidebarToggle={hasSidebar ? handleDrawerToggle : null} />
      
      {/* Sidebar navigation (rendered for admin role only) */}
      {hasSidebar && (
        <Sidebar mobileOpen={mobileOpen} onDrawerToggle={handleDrawerToggle} />
      )}
      
      {/* Page Content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: hasSidebar ? { sm: `calc(100% - ${drawerWidth}px)` } : '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <Toolbar /> {/* Spacer matching Navbar height */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>
      </Box>
    </Box>
  );
};

export default Layout;
