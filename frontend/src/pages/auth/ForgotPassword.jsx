import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Link,
  Stack,
  TextField,
  InputAdornment,
  Button as MuiButton,
  Grid,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import LockIcon from '@mui/icons-material/Lock';
import { forgotPassword } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';

const ReqSenseLogo = ({ size = 42 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="url(#fp-cube-top)" d="M50 10 L85 30 L50 50 L15 30 Z" />
    <path fill="url(#fp-cube-left)" d="M15 30 L50 50 L50 90 L15 70 Z" opacity="0.9" />
    <path fill="url(#fp-cube-right)" d="M50 50 L85 30 L85 70 L50 90 Z" opacity="0.75" />
    <path fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeOpacity="0.4" d="M50 10 L85 30 L50 50 L15 30 Z M15 30 L50 50 L50 90 L15 70 Z M50 50 L85 30 L85 70 L50 90 Z" />
    <defs>
      <linearGradient id="fp-cube-top" x1="15" y1="10" x2="85" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="fp-cube-left" x1="15" y1="30" x2="50" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="fp-cube-right" x1="50" y1="30" x2="85" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E40AF" />
        <stop offset="1" stopColor="#1E3A8A" />
      </linearGradient>
    </defs>
  </svg>
);

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Please enter your email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
      showToast('Password reset link sent to your email.', 'success');
    } catch (err) {
      showToast('Error requesting reset. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #061332 0%, #0D2873 50%, #1D4ED8 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
        color: '#FFFFFF',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.12,
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: { xs: 3, md: 6 },
          py: 2.5,
          zIndex: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ReqSenseLogo size={36} />
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px', color: '#FFFFFF' }}>
            ReqSense <Box component="span" sx={{ color: '#60A5FA' }}>AI</Box>
          </Typography>
        </Box>

        <Stack direction="row" spacing={3} alignItems="center">
          <Link
            href="#"
            onClick={(e) => { e.preventDefault(); showToast('Documentation is accessible inside your dashboard.', 'info'); }}
            sx={{
              color: 'rgba(255,255,255,0.85)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              '&:hover': { color: '#FFFFFF' },
            }}
          >
            <HelpOutlineIcon fontSize="small" />
            Help
          </Link>
          <Box sx={{ width: '1px', height: '16px', bgcolor: 'rgba(255,255,255,0.25)' }} />
          <Link
            href="mailto:support@reqsense.ai"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              '&:hover': { color: '#FFFFFF' },
            }}
          >
            <HeadsetMicOutlinedIcon fontSize="small" />
            Contact Us
          </Link>
        </Stack>
      </Box>

      {/* Main Grid */}
      <Grid
        container
        sx={{
          flex: 1,
          px: { xs: 3, md: 8, lg: 12 },
          alignItems: 'center',
          zIndex: 1,
          py: 2,
        }}
      >
        {/* Left Hero */}
        <Grid
          item
          xs={12}
          md={6}
          lg={6.5}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            pr: { md: 6, lg: 10 },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 500, position: 'relative', mb: 4 }}>
            <svg viewBox="0 0 500 420" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
              <filter id="fpGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="16" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="fpCubeG1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <polygon points="120,310 250,375 380,310 250,245" fill="rgba(37, 99, 235, 0.22)" stroke="rgba(96, 165, 250, 0.45)" strokeWidth="1.5" />
              <polygon points="250,80 370,140 250,200 130,140" fill="url(#fpCubeG1)" filter="url(#fpGlow)" />
              <polygon points="130,140 250,200 250,310 130,250" fill="#3B82F6" opacity="0.95" />
              <polygon points="250,200 370,140 370,250 250,310" fill="#1E40AF" opacity="0.85" />
            </svg>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, opacity: 0.9 }}>
            <ShieldOutlinedIcon sx={{ color: '#60A5FA', fontSize: 26 }} />
            <Typography variant="body1" sx={{ color: '#E2E8F0', fontWeight: 500, maxWidth: 420 }}>
              Secure account recovery powered by end-to-end encrypted authentication.
            </Typography>
          </Box>
        </Grid>

        {/* Right Form Card */}
        <Grid
          item
          xs={12}
          md={6}
          lg={5.5}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', md: 'flex-end' },
            justifyContent: 'center',
          }}
        >
          <Paper
            elevation={16}
            sx={{
              width: '100%',
              maxWidth: 450,
              borderRadius: 5,
              p: { xs: 3.5, sm: 4.5 },
              bgcolor: '#FFFFFF',
              color: '#0F172A',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              my: 2,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <ReqSenseLogo size={48} />
            </Box>

            <Typography variant="h4" align="center" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5, fontSize: '1.75rem' }}>
              Reset Password
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: '#64748B', mb: 3.5 }}>
              {!submitted
                ? "Enter your email address and we'll send you a recovery link."
                : 'Instructions sent! Check your inbox to proceed.'}
            </Typography>

            {!submitted ? (
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.8, display: 'block' }}>
                      Registered Email Address
                    </Typography>
                    <TextField
                      fullWidth
                      placeholder="Enter your registered email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoFocus
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <MailOutlineIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '12px',
                          backgroundColor: '#F8FAFC',
                          '& fieldset': { borderColor: '#E2E8F0' },
                          '&:hover fieldset': { borderColor: '#CBD5E1' },
                          '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: 2 },
                        },
                        '& .MuiInputBase-input': { py: 1.5, fontSize: '0.95rem' },
                      }}
                    />
                  </Box>

                  <MuiButton
                    type="submit"
                    fullWidth
                    disabled={loading}
                    endIcon={!loading && <ArrowForwardIcon />}
                    sx={{
                      py: 1.5,
                      borderRadius: '12px',
                      bgcolor: '#1D4ED8',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '1rem',
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(29, 78, 216, 0.35)',
                      '&:hover': {
                        bgcolor: '#1E40AF',
                        boxShadow: '0 6px 16px rgba(29, 78, 216, 0.45)',
                      },
                      '&:disabled': {
                        bgcolor: '#93C5FD',
                        color: '#FFFFFF',
                      },
                    }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </MuiButton>

                  <Typography variant="body2" align="center" sx={{ color: '#64748B', pt: 1, fontSize: '0.9rem' }}>
                    Remember your password?{' '}
                    <Link
                      component={RouterLink}
                      to="/login"
                      sx={{
                        color: '#2563EB',
                        fontWeight: 700,
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      Back to Sign In
                    </Link>
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={3} alignItems="center" sx={{ width: '100%' }}>
                <Typography variant="body2" align="center" sx={{ color: '#334155', lineHeight: 1.6 }}>
                  If an account exists for <strong>{email}</strong>, a password reset link has been dispatched.
                </Typography>
                
                <MuiButton
                  fullWidth
                  component={RouterLink}
                  to="/login"
                  sx={{
                    py: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#1D4ED8',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#1E40AF' },
                  }}
                >
                  Return to Sign In
                </MuiButton>
              </Stack>
            )}
          </Paper>

          {/* Bottom Security Banner */}
          <Box
            sx={{
              width: '100%',
              maxWidth: 450,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              pt: 1.5,
              pb: 2,
              opacity: 0.9,
            }}
          >
            <LockIcon sx={{ fontSize: 15, color: '#93C5FD' }} />
            <Typography variant="caption" sx={{ color: '#E2E8F0', fontWeight: 500, fontSize: '0.82rem' }}>
              Your data is secure with enterprise-grade encryption.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ForgotPassword;
