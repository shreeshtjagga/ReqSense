import React, { useEffect, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { getCurrentUser, resendVerificationEmail } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

/**
 * Persistent banner when the signed-in user's email is unverified.
 * Fetches /users/me so email_verified is available (JWT alone does not carry it).
 */
export const EmailVerificationBanner = () => {
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.showToast);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await getCurrentUser();
        if (!cancelled) {
          updateUserProfile(profile);
          setChecked(true);
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [updateUserProfile]);

  const handleResend = async () => {
    setLoading(true);
    try {
      await resendVerificationEmail();
      showToast('Verification email sent. Check your inbox.', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to resend verification email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!checked || user?.email_verified !== false) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      sx={{ mb: 3 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button color="inherit" size="small" onClick={handleResend} disabled={loading}>
            {loading ? 'Sending…' : 'Resend email'}
          </Button>
        </Stack>
      }
    >
      Your email is not verified yet. Some features may be limited until you confirm your address.
    </Alert>
  );
};

export default EmailVerificationBanner;
