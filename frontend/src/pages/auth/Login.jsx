import React, { useState } from 'react';
import { Box, Typography, Container, Paper, Link } from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { loginUser } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      
      // Save tokens and user details
      login(response.access_token, response.refresh_token);
      showToast('Welcome back to ReqSense AI!', 'success');
      
      // Navigation is handled dynamically based on role in App.jsx or here
      navigate('/');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Invalid email or password.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <SmartToyIcon />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Sign In
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }} align="center">
            Access your ReqSense AI dashboard
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Stack spacing={2.5}>
              <Input
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link component={RouterLink} to="/forgot-password" variant="body2" color="secondary">
                  Forgot password?
                </Link>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                loading={loading}
              >
                Sign In
              </Button>

              <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                Don't have an account?{' '}
                <Link component={RouterLink} to="/register" color="secondary" sx={{ fontWeight: 600 }}>
                  Register here
                </Link>
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

// Helper stack definition for box components
import { Stack } from '@mui/material';

export default Login;
