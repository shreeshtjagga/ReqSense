import React, { useState } from 'react';
import { Box, Typography, Container, Paper, Link, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { forgotPassword } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';
import MailIcon from '@mui/icons-material/Mail';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast('Please enter your email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
      showToast('Password reset link sent to your email.', 'success');
    } catch (err) {
      showToast('Error requesting reset. Please try again.', 'error');
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
            <MailIcon />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
            Reset Password
          </Typography>
          
          {!submitted ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }} align="center">
                Enter your email address and we'll send you a link to reset your password.
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

                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    loading={loading}
                  >
                    Send Reset Link
                  </Button>

                  <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                    <Link component={RouterLink} to="/login" color="secondary" sx={{ fontWeight: 600 }}>
                      Back to Login
                    </Link>
                  </Typography>
                </Stack>
              </Box>
            </>
          ) : (
            <Stack spacing={3} alignItems="center" sx={{ width: '100%' }}>
              <Typography variant="body2" color="text.secondary" align="center">
                If the email <strong>{email}</strong> is registered, a password reset link will be sent shortly. Please check your inbox and spam folders.
              </Typography>
              
              <Button
                variant="contained"
                color="primary"
                fullWidth
                component={RouterLink}
                to="/login"
              >
                Return to Login
              </Button>
            </Stack>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
