import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Link,
  Stack,
  Checkbox,
  FormControlLabel,
  Button as MuiButton,
  Divider,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { loginUser } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

// High-resolution 3D Hexagon/Cube Logo SVG (matching top header & card header in reference image)
const ReqSenseLogo = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="url(#logo-cube-top)" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="url(#logo-cube-left)" d="M15 32 L50 52 L50 88 L15 68 Z" />
    <path fill="url(#logo-cube-right)" d="M50 52 L85 32 L85 68 L50 88 Z" />
    <path fill="none" stroke="#93C5FD" strokeWidth="2.5" strokeOpacity="0.9" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="none" stroke="#60A5FA" strokeWidth="2" strokeOpacity="0.7" d="M50 52 L50 88" />
    <defs>
      <linearGradient id="logo-cube-top" x1="15" y1="12" x2="85" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="logo-cube-left" x1="15" y1="32" x2="50" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2563EB" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="logo-cube-right" x1="50" y1="32" x2="85" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E3A8A" />
        <stop offset="1" stopColor="#172554" />
      </linearGradient>
    </defs>
  </svg>
);

// Shield-check Icon SVG (matching bottom left badge in reference image)
const ShieldCheckIcon = () => (
  <svg width="22" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2Z" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Precision 3D Glowing Isometric Cube & Platform SVG (Matching Reference Image)
const GlowingIsometricCubeArtwork = () => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      maxWidth: 480,
      height: 380,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background Grid Lines & Isometric Planes */}
      <g stroke="#1D4ED8" strokeWidth="1" strokeOpacity="0.25">
        <path d="M50 100 L450 300" />
        <path d="M450 100 L50 300" />
        <path d="M100 50 L400 350" />
        <path d="M400 50 L100 350" />
        {/* Isometric Wireframe Planes */}
        <polygon points="120,120 380,120 440,240 180,240" fill="none" stroke="#2563EB" strokeOpacity="0.2" strokeWidth="1.5" />
        <polygon points="60,200 320,200 380,320 120,320" fill="none" stroke="#38BDF8" strokeOpacity="0.25" strokeWidth="1.5" />
        <polygon points="200,80 440,80 480,160 240,160" fill="none" stroke="#2563EB" strokeOpacity="0.15" />
      </g>

      {/* Floating Isometric Cards/Nodes */}
      <polygon points="280,60 340,90 310,110 250,80" fill="url(#node-grad-1)" opacity="0.6" />
      <polygon points="360,180 420,210 390,230 330,200" fill="url(#node-grad-2)" opacity="0.5" />

      {/* Lower Platform / Pedestal */}
      <g filter="url(#drop-glow)">
        <polygon points="130,270 270,340 410,270 270,200" fill="url(#pedestal-top)" />
        <polygon points="130,270 270,340 270,360 130,290" fill="#031242" opacity="0.9" />
        <polygon points="270,340 410,270 410,290 270,360" fill="#020B28" opacity="0.9" />
      </g>

      {/* Main 3D Glowing Blue Cube */}
      <g filter="url(#cube-intense-glow)">
        {/* Top Face */}
        <polygon points="150,160 270,90 390,160 270,230" fill="url(#cube-face-top)" />
        {/* Left Face */}
        <polygon points="150,160 270,230 270,330 150,260" fill="url(#cube-face-left)" />
        {/* Right Face */}
        <polygon points="270,230 390,160 390,260 270,330" fill="url(#cube-face-right)" />

        {/* Specular Highlight Edges */}
        <polyline points="150,160 270,90 390,160" fill="none" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
        <polyline points="150,160 270,230 270,330" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="270" y1="90" x2="270" y2="230" stroke="#E0F2FE" strokeWidth="3.5" strokeLinecap="round" filter="url(#edge-glow)" />
      </g>

      {/* Gradients and Filters Definition */}
      <defs>
        <linearGradient id="cube-face-top" x1="150" y1="90" x2="390" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="0.4" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="cube-face-left" x1="150" y1="160" x2="270" y2="330" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D4ED8" />
          <stop offset="1" stopColor="#0B2577" />
        </linearGradient>
        <linearGradient id="cube-face-right" x1="270" y1="160" x2="390" y2="330" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E40AF" />
          <stop offset="1" stopColor="#06123D" />
        </linearGradient>
        <linearGradient id="pedestal-top" x1="130" y1="200" x2="410" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E3A8A" stopOpacity="0.8" />
          <stop offset="1" stopColor="#061A60" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="node-grad-1" x1="250" y1="60" x2="340" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="node-grad-2" x1="330" y1="180" x2="420" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0B2577" />
        </linearGradient>
        <filter id="cube-intense-glow" x="100" y="40" x2="440" y2="380" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="15" stdDeviation="25" floodColor="#2563EB" floodOpacity="0.5" />
        </filter>
        <filter id="edge-glow" x="250" y="70" width="40" height="180" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#7DD3FC" floodOpacity="0.9" />
        </filter>
        <filter id="drop-glow" x="80" y="160" width="380" height="230" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="10" stdDeviation="20" floodColor="#0F172A" floodOpacity="0.6" />
        </filter>
      </defs>
    </svg>
  </Box>
);

// Multi-color Google "G" SVG Icon
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    const savedEmail = localStorage.getItem('reqsense_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({ email: email.trim(), password });
      login(response.access_token, response.refresh_token);

      if (rememberMe) {
        localStorage.setItem('reqsense_remember_email', email.trim());
      } else {
        localStorage.removeItem('reqsense_remember_email');
      }

      showToast('Welcome back to ReqSense AI!', 'success');
      navigate('/');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Invalid email or password.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    showToast('Google Sign-In coming soon! Please log in using email/password.', 'info');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #02081E 0%, #061A60 35%, #0B46D1 80%, #0F52E8 100%)',
      }}
    >
      {/* ── LEFT COLUMN (55% Width, Deep Vibrant Royal Blue Gradient) ────────────── */}
      <Box
        sx={{
          flex: { xs: 'none', md: '0 0 55%' },
          minHeight: { xs: 'auto', md: '100vh' },
          p: { xs: 3, md: 5 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          color: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        {/* Top Header Row (Logo + Help Links) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Logo + Wordmark */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ReqSenseLogo size={40} />
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, color: '#FFFFFF', fontSize: '1.5rem' }}>
              ReqSense <Box component="span" sx={{ color: '#38BDF8' }}>AI</Box>
            </Typography>
          </Stack>

          {/* Top Right Help Links */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Link
              href="#"
              onClick={(e) => { e.preventDefault(); showToast('Help documentation is available in your dashboard.', 'info'); }}
              sx={{
                color: 'rgba(255, 255, 255, 0.85)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': { color: '#FFFFFF' },
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: 18 }} /> Help
            </Link>

            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>|</Typography>

            <Link
              href="#"
              onClick={(e) => { e.preventDefault(); showToast('Contact support at support@reqsense.ai', 'info'); }}
              sx={{
                color: 'rgba(255, 255, 255, 0.85)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': { color: '#FFFFFF' },
              }}
            >
              <HeadsetMicOutlinedIcon sx={{ fontSize: 18 }} /> Contact Us
            </Link>
          </Stack>
        </Box>

        {/* Center Artwork (3D Isometric Glowing Cube & Pedestal) */}
        <Box
          sx={{
            my: { xs: 4, md: 'auto' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <GlowingIsometricCubeArtwork />
        </Box>

        {/* Bottom Left Trust Text */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            position: 'relative',
            zIndex: 2,
            maxWidth: 420,
          }}
        >
          <ShieldCheckIcon />
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.4, fontSize: '0.875rem' }}>
            Trusted by developers, teams and businesses worldwide to build better software.
          </Typography>
        </Stack>
      </Box>

      {/* ── RIGHT COLUMN (45% Width, Centered Pure White Card) ────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justify: 'center',
          p: { xs: 2.5, sm: 4 },
          position: 'relative',
        }}
      >
        {/* Main Floating White Container */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 480,
            p: { xs: 3.5, sm: 5 },
            borderRadius: '24px',
            bgcolor: '#FFFFFF',
            boxShadow: '0 30px 70px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Top Logo Icon */}
          <Box sx={{ textCenter: 'center', textAlign: 'center', mb: 2 }}>
            <Box sx={{ display: 'inline-flex' }}>
              <ReqSenseLogo size={48} />
            </Box>
          </Box>

          {/* Heading & Subtitle */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.8, letterSpacing: -0.5, fontSize: '1.85rem' }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.9rem' }}>
              Sign in to continue to ReqSense AI
            </Typography>
          </Box>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              {/* Email Address */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155', mb: 0.8, fontSize: '0.875rem' }}>
                  Email Address
                </Typography>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  startIcon={<MailOutlineIcon sx={{ color: '#94A3B8', fontSize: 20 }} />}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: '#FAFAFA',
                      '& fieldset': { borderColor: '#E2E8F0' },
                      '&:hover fieldset': { borderColor: '#CBD5E1' },
                      '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '1.5px' },
                    },
                    '& input': { py: 1.4, fontSize: '0.95rem' },
                  }}
                />
              </Box>

              {/* Password */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155', mb: 0.8, fontSize: '0.875rem' }}>
                  Password
                </Typography>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  startIcon={<LockOutlinedIcon sx={{ color: '#94A3B8', fontSize: 20 }} />}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: '#FAFAFA',
                      '& fieldset': { borderColor: '#E2E8F0' },
                      '&:hover fieldset': { borderColor: '#CBD5E1' },
                      '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '1.5px' },
                    },
                    '& input': { py: 1.4, fontSize: '0.95rem' },
                  }}
                />
              </Box>

              {/* Remember Me & Forgot Password Row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  pt: 0.5,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      size="small"
                      sx={{
                        color: '#CBD5E1',
                        '&.Mui-checked': { color: '#2563EB' },
                      }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ color: '#475569', fontSize: '0.875rem' }}>Remember me</Typography>}
                />

                <Link
                  component={RouterLink}
                  to="/forgot-password"
                  variant="body2"
                  sx={{
                    color: '#2563EB',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Forgot Password?
                </Link>
              </Box>

              {/* Solid Royal Blue Sign In Button */}
              <Button
                type="submit"
                variant="contained"
                size="large"
                loading={loading}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  bgcolor: '#1649FF',
                  color: '#FFFFFF',
                  textTransform: 'none',
                  boxShadow: '0 8px 25px rgba(22, 73, 255, 0.3)',
                  '&:hover': {
                    bgcolor: '#0D3BEA',
                  },
                }}
              >
                Sign In
              </Button>

              {/* OR Divider */}
              <Divider sx={{ my: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#94A3B8', px: 1, fontWeight: 500 }}>
                  OR
                </Typography>
              </Divider>

              {/* Outlined Google Button */}
              <MuiButton
                variant="outlined"
                size="large"
                onClick={handleGoogleLogin}
                startIcon={<GoogleIcon />}
                sx={{
                  py: 1.4,
                  borderRadius: '12px',
                  borderColor: '#E2E8F0',
                  color: '#1E293B',
                  fontWeight: 600,
                  fontSize: '0.925rem',
                  textTransform: 'none',
                  bgcolor: '#FFFFFF',
                  '&:hover': {
                    borderColor: '#CBD5E1',
                    bgcolor: '#F8FAFC',
                  },
                }}
              >
                Continue with Google
              </MuiButton>

              {/* Register Link */}
              <Typography variant="body2" align="center" sx={{ color: '#64748B', pt: 1, fontSize: '0.875rem' }}>
                Don't have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/register"
                  sx={{
                    color: '#2563EB',
                    textDecoration: 'none',
                    fontWeight: 700,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Register here
                </Link>
              </Typography>
            </Stack>
          </form>
        </Paper>


      </Box>
    </Box>
  );
};

export default Login;
