import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

const drawerWidth = 240;

export const Sidebar = ({ mobileOpen, onDrawerToggle }) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role;

  if (role !== ROLES.ADMIN) {
    return null;
  }

  const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'User Management', icon: <PeopleIcon />, path: '/admin/users' },
    { text: 'Analytics Reports', icon: <BarChartIcon />, path: '/admin/analytics' },
    { text: 'Audit Logs', icon: <HistoryIcon />, path: '/admin/audit-logs' },
  ];

  const drawerContent = (
    <Box>
      <Toolbar />
      <Divider />
      <List>
        {navItems.map((item) => {
          const isSelected =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (onDrawerToggle) onDrawerToggle();
                }}
                selected={isSelected}
                sx={{
                  mx: 1,
                  borderRadius: 1.5,
                  my: 0.5,
                  color: isSelected ? 'secondary.main' : 'text.primary',
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    color: 'secondary.main',
                    fontWeight: 600,
                    '& .MuiListItemIcon-root': {
                      color: 'secondary.main',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: isSelected ? 'secondary.main' : 'text.secondary', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: isSelected ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      aria-label="mailbox folders"
    >
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #CBD5E1' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #CBD5E1' },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
