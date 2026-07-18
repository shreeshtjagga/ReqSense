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
import ChatIcon from '@mui/icons-material/Chat';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import RateReviewIcon from '@mui/icons-material/RateReview';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

const drawerWidth = 240;

export const Sidebar = ({ mobileOpen, onDrawerToggle }) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role;

  // Define sidebar navigation items based on role
  const getNavItems = () => {
    const common = [{ text: 'Dashboard', icon: <DashboardIcon />, path: '/' }];

    if (role === ROLES.CLIENT) {
      return [
        ...common,
        { text: 'Chat Sessions', icon: <ChatIcon />, path: '/client/sessions' },
        { text: 'Submit Change Request', icon: <RateReviewIcon />, path: '/client/change-request/new' },
      ];
    }

    if (role === ROLES.DEVELOPER) {
      return [
        ...common,
        { text: 'Feature Status', icon: <ListAltIcon />, path: '/dev/features' },
        { text: 'Change Requests', icon: <RateReviewIcon />, path: '/dev/change-requests' },
        { text: 'SRS Documents', icon: <AssignmentIcon />, path: '/dev/srs' },
      ];
    }

    if (role === ROLES.ADMIN) {
      return [
        ...common,
        { text: 'User Management', icon: <PeopleIcon />, path: '/admin/users' },
        { text: 'Analytics Reports', icon: <BarChartIcon />, path: '/admin/analytics' },
        { text: 'Audit Logs', icon: <HistoryIcon />, path: '/admin/audit-logs' },
      ];
    }

    return common;
  };

  const navItems = getNavItems();

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
          keepMounted: true, // Better open performance on mobile.
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
