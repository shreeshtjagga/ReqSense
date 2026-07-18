import React from 'react';
import { Snackbar, Alert as MuiAlert } from '@mui/material';
import { useToastStore } from '../../store/toastStore';

export const ToastNotification = () => {
  const { open, message, severity, duration, hideToast } = useToastStore();

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={hideToast}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <MuiAlert
        elevation={6}
        variant="filled"
        onClose={hideToast}
        severity={severity}
        sx={{ width: '100%' }}
      >
        {message}
      </MuiAlert>
    </Snackbar>
  );
};
export default ToastNotification;
