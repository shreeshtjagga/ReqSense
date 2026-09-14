import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

export const StatsCard = ({ title, value, icon: Icon, color = 'primary.main' }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.06)',
        },
      }}
    >
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#0F172A' }}>
          {value ?? 0}
        </Typography>
      </Box>
      {Icon && (
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            bgcolor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
          }}
        >
          <Icon sx={{ fontSize: 26 }} />
        </Box>
      )}
    </Paper>
  );
};

export default StatsCard;
