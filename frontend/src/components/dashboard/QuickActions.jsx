import React from 'react';
import { Paper, Typography, Stack, Button } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BarChartIcon from '@mui/icons-material/BarChart';

export const QuickActions = ({ actions = {} }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        height: '100%',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Quick Management
      </Typography>
      <Stack spacing={2}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={actions.onAddUser}
          sx={{ justifyContent: 'flex-start', py: 1.2, fontWeight: 600 }}
        >
          Manage Users & Invites
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<BarChartIcon />}
          onClick={actions.onViewAnalytics}
          sx={{ justifyContent: 'flex-start', py: 1.2, fontWeight: 600 }}
        >
          View Platform Analytics
        </Button>
      </Stack>
    </Paper>
  );
};

export default QuickActions;
