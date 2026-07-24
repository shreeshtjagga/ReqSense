import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, CircularProgress, Alert, Button } from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { acceptInvite } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';

export const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('invite');
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('No invite token provided in URL.');
      setLoading(false);
      return;
    }

    const processInvite = async () => {
      try {
        setLoading(true);
        const res = await acceptInvite(token);
        if (res.user_exists) {
          showToast('Project invitation accepted successfully!', 'success');
          navigate('/login', { replace: true });
        } else {
          showToast('Invitation verified. Please register your account to continue.', 'info');
          navigate(`/register?invite_token=${res.invite_token}&email=${encodeURIComponent(res.email)}`, { replace: true });
        }
      } catch (err) {
        const msg = err.response?.data?.detail || 'Invalid or expired invite token.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    processInvite();
  }, [token, navigate, showToast]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          borderRadius: 3,
        }}
      >
        {loading ? (
          <Box sx={{ py: 4 }}>
            <CircularProgress color="secondary" size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Verifying Project Invitation...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please wait while we validate your invitation token.
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ py: 2 }}>
            <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Invitation Link Invalid
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          </Box>
        ) : (
          <Box sx={{ py: 2 }}>
            <MarkEmailReadIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Invitation Processed!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Redirecting you to the next step...
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AcceptInvite;
