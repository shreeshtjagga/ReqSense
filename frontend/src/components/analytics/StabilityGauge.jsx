import React from 'react';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';

export const StabilityGauge = ({ value = 100 }) => {
  const score = Math.round(value);

  const getStatus = (val) => {
    if (val >= 80) return { label: 'Highly Stable', color: 'success.main' };
    if (val >= 50) return { label: 'Moderate Drift', color: 'warning.main' };
    return { label: 'Highly Unstable', color: 'error.main' };
  };

  const status = getStatus(score);

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Current Project Stability
      </Typography>
      
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 240,
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={120}
            thickness={6}
            sx={{ color: 'action.hover' }}
          />
          <CircularProgress
            variant="determinate"
            value={score}
            size={120}
            thickness={6}
            sx={{
              color: status.color,
              position: 'absolute',
              left: 0,
            }}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>
              {score}%
            </Typography>
          </Box>
        </Box>
        
        <Typography variant="h6" sx={{ fontWeight: 600, color: status.color, mb: 0.5 }}>
          {status.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" sx={{ maxWidth: 200 }}>
          Stability increases when there are fewer contradiction events relative to message counts.
        </Typography>
      </Box>
    </Paper>
  );
};

export default StabilityGauge;
