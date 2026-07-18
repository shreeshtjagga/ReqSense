import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export const Modal = ({
  open,
  onClose,
  title,
  children,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
  maxWidth = 'sm',
  fullWidth = true,
  loading = false,
}) => {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth={maxWidth} fullWidth={fullWidth}>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {onClose && (
          <IconButton
            aria-label="close"
            onClick={onClose}
            disabled={loading}
            sx={{
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        {children}
      </DialogContent>
      {(onConfirm || onClose) && (
        <DialogActions sx={{ p: 2 }}>
          {onClose && (
            <Button onClick={onClose} disabled={loading} color="inherit">
              {cancelLabel}
            </Button>
          )}
          {onConfirm && (
            <Button
              onClick={onConfirm}
              variant="contained"
              color={confirmColor}
              disabled={loading}
            >
              {loading ? 'Processing...' : confirmLabel}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default Modal;
