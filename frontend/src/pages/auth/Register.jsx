import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Link,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Button as MuiButton,
  Divider,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from '@mui/material';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import LockIcon from '@mui/icons-material/Lock';
import { registerUser } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';

const ReqSenseLogo = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="url(#reg-cube-top)" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="url(#reg-cube-left)" d="M15 32 L50 52 L50 88 L15 68 Z" opacity="0.95" />
    <path fill="url(#reg-cube-right)" d="M50 52 L85 32 L85 68 L50 88 Z" opacity="0.8" />
    <path fill="none" stroke="#93C5FD" strokeWidth="2" strokeOpacity="0.8" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="none" stroke="#60A5FA" strokeWidth="2" strokeOpacity="0.6" d="M50 52 L50 88" />
    <defs>
      <linearGradient id="reg-cube-top" x1="15" y1="12" x2="85" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="reg-cube-left" x1="15" y1="32" x2="50" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="reg-cube-right" x1="50" y1="32" x2="85" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E40AF" />
        <stop offset="1" stopColor="#1E3A8A" />
      </linearGradient>
    </defs>
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

export const Register = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const inviteOrg = searchParams.get('org') || '';
  const inviteRole = searchParams.get('role') || 'client';
  const inviteEmail = searchParams.get('email') || '';
  const isInviteFlow = Boolean(inviteToken);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState(isInviteFlow ? inviteRole : 'client');
  const [orgId, setOrgId] = useState(inviteOrg);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role: isInviteFlow ? inviteRole : role,
        organization_id: (isInviteFlow ? inviteOrg : orgId).trim() || null,
        invite_token: inviteToken || null,
      });

      showToast('Registration successful! Please log in.', 'success');
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Registration failed. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    showToast('Google OAuth is configured for production. Please register using email/password.', 'info');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #040E29 0%, #0B2577 50%, #1D4ED8 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
        color: '#FFFFFF',
      }}
    >
      {/* Background Grid Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.14,
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Top Bar Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: { xs: 3, md: 6 },
          py: 3,
          zIndex: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ReqSenseLogo size={38} />
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px', color: '#FFFFFF' }}>
            ReqSense <Box component="span" sx={{ color: '#60A5FA' }}>AI</Box>
          </Typography>
        </Box>

        <Stack direction="row" spacing={2.5} alignItems="center">
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

      {/* Center Layout Grid */}
      <Grid
        container
        sx={{
          flex: 1,
          px: { xs: 3, md: 8, lg: 12 },
          alignItems: 'center',
          zIndex: 1,
          pb: 2,
        }}
      >
        {/* Left 3D Cube Hero Section (Desktop) */}
        <Grid
          item
          xs={12}
          md={5.5}
          lg={6}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            pr: { md: 6, lg: 10 },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 500, position: 'relative', mb: 4 }}>
            <svg viewBox="0 0 520 440" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="regGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="20" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="regCubeTopGrad" x1="140" y1="120" x2="380" y2="240" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#93C5FD" />
                  <stop offset="35%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
                <linearGradient id="regCubeLeftGrad" x1="140" y1="240" x2="260" y2="390" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#1E40AF" />
                </linearGradient>
                <linearGradient id="regCubeRightGrad" x1="260" y1="240" x2="380" y2="390" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1E40AF" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
              </defs>

              <g opacity="0.4">
                <polygon points="100,320 260,400 420,320 260,240" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
                <polygon points="40,290 260,400 480,290 260,180" fill="none" stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 4" />
              </g>

              <polygon points="90,320 260,405 430,320 260,235" fill="rgba(29, 78, 216, 0.35)" stroke="#3B82F6" strokeWidth="2" />
              <circle cx="260" cy="240" r="140" fill="#3B82F6" opacity="0.35" filter="url(#regGlowFilter)" />

              <g filter="url(#regGlowFilter)">
                <polygon points="260,130 380,195 260,260 140,195" fill="url(#regCubeTopGrad)" />
                <polygon points="140,195 260,260 260,390 140,325" fill="url(#regCubeLeftGrad)" />
                <polygon points="260,260 380,195 380,325 260,390" fill="url(#regCubeRightGrad)" />

                <path d="M260,130 L380,195 L260,260 L140,195 Z" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" strokeOpacity="0.9" />
                <path d="M260,260 L260,390" stroke="#60A5FA" strokeWidth="3.5" />
                <path d="M140,195 L140,325 L260,390" stroke="#3B82F6" strokeWidth="2.5" />
                <path d="M380,195 L380,325 L260,390" stroke="#1D4ED8" strokeWidth="2.5" />
              </g>
            </svg>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.8, opacity: 0.95 }}>
            <VerifiedUserOutlinedIcon sx={{ color: '#60A5FA', fontSize: 26, mt: 0.2 }} />
            <Typography variant="body1" sx={{ color: '#E2E8F0', fontWeight: 500, lineHeight: 1.5, maxWidth: 400, fontSize: '0.95rem' }}>
              Trusted by developers, teams and businesses worldwide to build better software.
            </Typography>
          </Box>
        </Grid>

        {/* Right Form Card */}
        <Grid
          item
          xs={12}
          md={6.5}
          lg={6}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', md: 'flex-end' },
            justifyContent: 'center',
          }}
        >
          <Paper
            elevation={24}
            sx={{
              width: '100%',
              maxWidth: 480,
              borderRadius: '24px',
              p: { xs: 3, sm: 4 },
              bgcolor: '#FFFFFF',
              color: '#0F172A',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              my: 1.5,
            }}
          >
            {/* Form Header Logo */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
              <ReqSenseLogo size={48} />
            </Box>

            <Typography variant="h4" align="center" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5, fontSize: '1.6rem' }}>
              {isInviteFlow ? 'Join Invited Project' : 'Create an Account'}
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: '#64748B', mb: 2.5 }}>
              {isInviteFlow
                ? 'Complete your profile to accept the project invite'
                : 'Get started with your free ReqSense AI account'}
            </Typography>

            {isInviteFlow && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                You were invited as a <strong>{inviteRole}</strong>. Your account will automatically connect.
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                {/* Full Name */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.5, display: 'block' }}>
                    Full Name
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    variant="outlined"
                    autoFocus
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
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
                      '& .MuiInputBase-input': { py: 1.2, fontSize: '0.9rem' },
                    }}
                  />
                </Box>

                {/* Email Address */}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.5, display: 'block' }}>
                    Email Address
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    disabled={isInviteFlow && Boolean(inviteEmail)}
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
                        backgroundColor: isInviteFlow && Boolean(inviteEmail) ? '#F1F5F9' : '#F8FAFC',
                        '& fieldset': { borderColor: '#E2E8F0' },
                        '&:hover fieldset': { borderColor: '#CBD5E1' },
                        '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: 2 },
                      },
                      '& .MuiInputBase-input': { py: 1.2, fontSize: '0.9rem' },
                    }}
                  />
                </Box>

                {/* Passwords (Grid) */}
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.5, display: 'block' }}>
                      Password
                    </Typography>
                    <TextField
                      fullWidth
                      placeholder="Min. 8 chars"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon sx={{ color: '#94A3B8', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              size="small"
                              sx={{ color: '#94A3B8' }}
                            >
                              {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
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
                        '& .MuiInputBase-input': { py: 1.2, fontSize: '0.9rem' },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.5, display: 'block' }}>
                      Confirm Password
                    </Typography>
                    <TextField
                      fullWidth
                      placeholder="Re-enter password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon sx={{ color: '#94A3B8', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                              size="small"
                              sx={{ color: '#94A3B8' }}
                            >
                              {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
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
                        '& .MuiInputBase-input': { py: 1.2, fontSize: '0.9rem' },
                      }}
                    />
                  </Grid>
                </Grid>

                {/* Role Selector */}
                {!isInviteFlow && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.5, display: 'block' }}>
                      Register Account Type
                    </Typography>
                    <RadioGroup
                      row
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <FormControlLabel
                        value="client"
                        control={<Radio size="small" sx={{ color: '#CBD5E1', '&.Mui-checked': { color: '#2563EB' } }} />}
                        label={<Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Client</Typography>}
                      />
                      <FormControlLabel
                        value="developer"
                        control={<Radio size="small" sx={{ color: '#CBD5E1', '&.Mui-checked': { color: '#2563EB' } }} />}
                        label={<Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Developer</Typography>}
                      />
                      <FormControlLabel
                        value="admin"
                        control={<Radio size="small" sx={{ color: '#CBD5E1', '&.Mui-checked': { color: '#2563EB' } }} />}
                        label={<Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Admin</Typography>}
                      />
                    </RadioGroup>
                  </Box>
                )}

                {/* Organization ID (Optional) */}
                {!isInviteFlow && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', mb: 0.5, display: 'block' }}>
                      Organization ID (Optional)
                    </Typography>
                    <TextField
                      fullWidth
                      placeholder="Leave blank for new organization"
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
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
                        '& .MuiInputBase-input': { py: 1.2, fontSize: '0.85rem' },
                      }}
                    />
                  </Box>
                )}

                {/* Primary Register Button */}
                <MuiButton
                  type="submit"
                  fullWidth
                  disabled={loading}
                  endIcon={!loading && <ArrowForwardIcon />}
                  sx={{
                    py: 1.4,
                    borderRadius: '12px',
                    bgcolor: '#1D4ED8',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(29, 78, 216, 0.4)',
                    '&:hover': {
                      bgcolor: '#1E40AF',
                      boxShadow: '0 6px 18px rgba(29, 78, 216, 0.5)',
                    },
                    '&:disabled': {
                      bgcolor: '#93C5FD',
                      color: '#FFFFFF',
                    },
                  }}
                >
                  {loading ? 'Creating Account...' : (isInviteFlow ? 'Accept & Join' : 'Create Account')}
                </MuiButton>

                <Divider sx={{ my: 1, color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600 }}>
                  OR
                </Divider>

                <MuiButton
                  fullWidth
                  variant="outlined"
                  onClick={handleGoogleSignup}
                  startIcon={<GoogleIcon />}
                  sx={{
                    py: 1.2,
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    textTransform: 'none',
                    backgroundColor: '#FFFFFF',
                    '&:hover': {
                      borderColor: '#CBD5E1',
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  Sign up with Google
                </MuiButton>

                <Typography variant="body2" align="center" sx={{ color: '#64748B', pt: 0.5, fontSize: '0.9rem' }}>
                  Already have an account?{' '}
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
                    Sign In
                  </Link>
                </Typography>
              </Stack>
            </Box>
          </Paper>

          {/* Bottom Security Banner */}
          <Box
            sx={{
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              pt: 1,
              pb: 1.5,
              opacity: 0.95,
            }}
          >
            <LockIcon sx={{ fontSize: 16, color: '#93C5FD' }} />
            <Typography variant="caption" sx={{ color: '#E2E8F0', fontWeight: 500, fontSize: '0.83rem' }}>
              Your data is secure with enterprise-grade encryption.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Register;
