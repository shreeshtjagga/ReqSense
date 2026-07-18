import React from 'react';
import { Alert, AlertTitle, Box, Button, Typography, Stack, Divider } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

export const ConflictAlert = ({ contradiction, onResolve }) => {
  const { user } = useAuthStore();
  const isDeveloper = user?.role === ROLES.DEVELOPER || user?.role === ROLES.ADMIN;

  const {
    id,
    conflict_type,
    confidence,
    aria_message,
    similarity_score,
  } = contradiction;

  return (
    <Alert
      severity="warning"
      icon={<WarningAmberIcon fontSize="inherit" />}
      sx={{
        backgroundColor: '#FFFBEB', // Light amber background
        color: '#92400E', // Dark amber text
        border: '1px solid #FDE68A', // Amber border
        '& .MuiAlert-icon': {
          color: '#D97706', // Accent amber warning
        },
      }}
    >
      <AlertTitle sx={{ fontWeight: 700, mb: 1 }}>Contradiction Detected</AlertTitle>
      
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 2 }}>
        {aria_message || "ARIA has detected a conflict between the client's current input and previous requirements."}
      </Typography>

      <Stack spacing={1} sx={{ fontSize: '0.8rem', opacity: 0.9, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Conflict Type:</strong>
          <span>{conflict_type || 'direct_contradiction'}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Similarity:</strong>
          <span>{similarity_score ? `${Math.round(similarity_score * 100)}%` : 'N/A'}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Confidence:</strong>
          <span>{confidence ? `${Math.round(confidence * 100)}%` : 'N/A'}</span>
        </Box>
      </Stack>

      {isDeveloper && onResolve && (
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
    </Alert>
  );
};

export default ConflictAlert;
