import React, { useState } from 'react';
import { Box, Typography, Container, Paper, Link, Stack } from '@mui/material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { resetPassword } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';
import LockOpenIcon from '@mui/icons-material/LockOpen';

export const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Invalid or missing reset token.', 'error');
      return;
    }

    if (!password || !confirmPassword) {
      showToast('Please fill in all fields.', 'error');
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
      await resetPassword(token, password);
      showToast('Password reset successful! Please log in with your new password.', 'success');
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to reset password. Token may be expired.';
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
            <LockOpenIcon />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
            New Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }} align="center">
            Set your new account password
          </Typography>

          {!token ? (
            <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
              <Typography variant="body2" color="error.main" align="center" sx={{ fontWeight: 600 }}>
                Reset token is missing or invalid. Please request a new password reset link.
              </Typography>
              <Button variant="contained" component={RouterLink} to="/forgot-password" fullWidth>
                Request Reset Link
              </Button>
            </Stack>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
              <Stack spacing={2.5}>
                <Input
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="Min 8 characters, with 1 uppercase letter and 1 digit"
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  loading={loading}
                >
                  Reset Password
                </Button>

                <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                  <Link component={RouterLink} to="/login" color="secondary" sx={{ fontWeight: 600 }}>
                    Cancel and login
                  </Link>
                </Typography>
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
