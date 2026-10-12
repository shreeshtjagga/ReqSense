import React from 'react';
import { Alert, AlertTitle, Box, Button, Chip, Typography, Stack, Divider } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

const STATUS_META = {
  pending: { label: 'Pending Review', color: 'warning' },
  resolved: { label: 'Accepted by Developer', color: 'success' },
  approved: { label: 'Accepted by Developer', color: 'success' },
  rejected: { label: 'Rejected by Developer', color: 'error' },
  ignored: { label: 'Ignored / False Positive', color: 'default' },
};

export const ConflictAlert = ({ contradiction, onResolve }) => {
  const { user } = useAuthStore();
  const canResolve = Boolean(user && (user.role === ROLES.DEVELOPER || user.role === ROLES.ADMIN));

  if (!contradiction) return null;

  const {
    contradiction_id,
    conflict_type,
    aria_message,
    status,
  } = contradiction;

  const statusInfo = STATUS_META[status] ?? STATUS_META.pending;
  const isRejected = status === 'rejected';
  const isAccepted = status === 'resolved' || status === 'approved';
  const isAlreadyResolved = isRejected || isAccepted || status === 'ignored';

  return (
    <Alert
      severity={isRejected ? 'error' : isAccepted ? 'success' : 'warning'}
      icon={
        isRejected ? (
          <RemoveCircleOutlineIcon fontSize="inherit" sx={{ color: '#DC2626' }} />
        ) : isAccepted ? (
          <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: '#16A34A' }} />
        ) : (
          <WarningAmberIcon fontSize="inherit" />
        )
      }
      sx={{
        backgroundColor: isRejected ? '#FEF2F2' : isAccepted ? '#F0FDF4' : '#FFFBEB',
        color: isRejected ? '#991B1B' : isAccepted ? '#166534' : '#92400E',
        border: `1px solid ${isRejected ? '#FECACA' : isAccepted ? '#BBF7D0' : '#FDE68A'}`,
        '& .MuiAlert-icon': {
          color: isRejected ? '#DC2626' : isAccepted ? '#16A34A' : '#D97706',
        },
      }}
    >
      <AlertTitle sx={{ fontWeight: 700, mb: 1 }}>
        Contradiction {isRejected ? 'Rejected' : isAccepted ? 'Resolved' : 'Detected'}
        {' '}
        <Chip
          label={statusInfo.label}
          color={statusInfo.color}
          size="small"
          sx={{ ml: 1, fontSize: '0.7rem', height: 20, fontWeight: 700 }}
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
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: isRejected ? '#DC2626' : isAccepted ? '#16A34A' : '#64748B',
          }}
        >
          {isRejected
            ? '✕ Rejected by Developer'
            : isAccepted
            ? '✓ Accepted by Developer'
            : '— Ignored / False Positive'}
        </Typography>
      )}
    </Alert>
  );
};

export default ConflictAlert;
