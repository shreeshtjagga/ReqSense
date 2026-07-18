import React from 'react';
import { Button as MuiButton, CircularProgress } from '@mui/material';

export const Button = ({
  children,
  loading = false,
  disabled = false,
  startIcon,
  ...props
}) => {
  return (
    <MuiButton
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      {...props}
    >
      {children}
    </MuiButton>
  );
};

export default Button;
