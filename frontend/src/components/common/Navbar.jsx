import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
  Chip,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';

const ReqSenseLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="url(#brand-grad-1)" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="url(#brand-grad-2)" d="M15 32 L50 52 L50 88 L15 68 Z" />
    <path fill="url(#brand-grad-3)" d="M50 52 L85 32 L85 68 L50 88 Z" />
    <path fill="none" stroke="#C7D2FE" strokeWidth="2.5" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="none" stroke="#818CF8" strokeWidth="2" d="M50 52 L50 88" />
    <defs>
      <linearGradient id="brand-grad-1" x1="15" y1="12" x2="85" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" /><stop offset="1" stopColor="#4F46E5" />
      </linearGradient>
      <linearGradient id="brand-grad-2" x1="15" y1="32" x2="50" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F46E5" /><stop offset="1" stopColor="#3730A3" />
      </linearGradient>
      <linearGradient id="brand-grad-3" x1="50" y1="32" x2="85" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0EA5E9" /><stop offset="1" stopColor="#0369A1" />
      </linearGradient>
    </defs>
  </svg>
);

export const Navbar = ({ onSidebarToggle }) => {
  const { user, logout, updateUserProfile } = useAuthStore();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  React.useEffect(() => {
    if (user && !user.name) {
      import('../../api/auth').then(({ getCurrentUser }) => {
        getCurrentUser()
          .then((profile) => {
            if (profile?.name) updateUserProfile(profile);
          })
          .catch(() => {});
      });
    }
  }, [user, updateUserProfile]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.email || 'User';

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: { xs: 2, sm: 3 } }}>
        {onSidebarToggle && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onSidebarToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            flexGrow: 1,
            userSelect: 'none',
          }}
          onClick={() => navigate('/')}
        >
          <ReqSenseLogo size={32} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#0F172A',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            ReqSense
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #0EA5E9 0%, #4F46E5 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
              }}
            >
              AI
            </Box>
          </Typography>
        </Box>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={getRoleLabel(user.role)}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                color: '#4F46E5',
                border: '1px solid #C7D2FE',
                display: { xs: 'none', md: 'inline-flex' },
              }}
            />

            <Box
              onClick={handleMenu}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                cursor: 'pointer',
                px: 1.5,
                py: 0.75,
                borderRadius: 20,
                border: '1px solid #E2E8F0',
                bgcolor: '#FFFFFF',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: '#C7D2FE',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.1)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </Avatar>

              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', display: { xs: 'none', sm: 'block' } }}>
                {displayName}
              </Typography>
            </Box>

            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                elevation: 0,
                sx: {
                  mt: 1,
                  borderRadius: 3,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
                  minWidth: 180,
                },
              }}
            >
              <MenuItem disabled sx={{ py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Role: {getRoleLabel(user.role)}
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ gap: 1, color: 'error.main', fontWeight: 600, py: 1 }}>
                <LogoutIcon fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
