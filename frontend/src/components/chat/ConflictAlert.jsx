import React from 'react';
import { Alert, AlertTitle, Box, Button, Chip, Typography, Stack, Divider } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

const STATUS_META = {
  pending: { label: 'Pending Review', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
  ignored: { label: 'Ignored / False Positive', color: 'default' },
};

export const ConflictAlert = ({ contradiction, onResolve }) => {
  const { user } = useAuthStore();
  const canResolve = Boolean(user);

  // Safety: handle null/undefined contradiction gracefully
  if (!contradiction) return null;

  const {
    contradiction_id,
    conflict_type,
    confidence,
    aria_message,
    status,
  } = contradiction;

  const statusInfo = STATUS_META[status] ?? STATUS_META.pending;
  const isAlreadyResolved = status === 'resolved' || status === 'ignored';

  return (
    <Alert
      severity={isAlreadyResolved ? 'success' : 'warning'}
      icon={<WarningAmberIcon fontSize="inherit" />}
      sx={{
        backgroundColor: isAlreadyResolved ? '#F0FDF4' : '#FFFBEB',
        color: isAlreadyResolved ? '#166534' : '#92400E',
        border: `1px solid ${isAlreadyResolved ? '#BBF7D0' : '#FDE68A'}`,
        '& .MuiAlert-icon': {
          color: isAlreadyResolved ? '#16A34A' : '#D97706',
        },
      }}
    >
      <AlertTitle sx={{ fontWeight: 700, mb: 1 }}>
        Contradiction Detected
        {' '}
        {/* Chip without icon prop to avoid undefined icon crash */}
        <Chip
          label={statusInfo.label}
          color={statusInfo.color}
          size="small"
          sx={{ ml: 1, fontSize: '0.7rem', height: 20 }}
        />
      </AlertTitle>

      <Typography variant="body2" sx={{ fontWeight: 500, mb: 2 }}>
        {aria_message || "ARIA has detected a conflict between the client's current input and previous requirements."}
      </Typography>

      <Stack spacing={1} sx={{ fontSize: '0.8rem', opacity: 0.9, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Conflict Type:</strong>
          <span>{(conflict_type || 'direct_contradiction').replace(/_/g, ' ')}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Confidence:</strong>
          <span>{confidence ? `${Math.round(confidence * 100)}%` : 'N/A'}</span>
        </Box>
      </Stack>

      {canResolve && onResolve && !isAlreadyResolved && (
        <Box>
          <Divider sx={{ my: 1.5, borderColor: '#FDE68A' }} />
          <Button
            size="small"
            variant="contained"
            color="warning"
            sx={{
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#B45309',
                boxShadow: 'none',
              },
            }}
            onClick={() => onResolve(contradiction)}
          >
            Resolve Contradiction
          </Button>
        </Box>
      )}
      {isAlreadyResolved && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: status === 'resolved' ? '#16A34A' : '#64748B' }}>
          {status === 'resolved' ? '✓ Resolved' : '— Ignored / False Positive'}
        </Typography>
      )}
    </Alert>
  );
};

export default ConflictAlert;
