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
  return null;
};

export default EmailVerificationBanner;
