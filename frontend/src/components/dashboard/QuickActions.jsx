import React from 'react';
import { Typography, Grid, Paper } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import AssessmentIcon from '@mui/icons-material/Assessment';
import Button from '../common/Button';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../utils/constants';

export const QuickActions = ({ actions = {} }) => {
  const { user } = useAuthStore();
  const role = user?.role;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Quick Actions
      </Typography>
      
      <Grid container spacing={2}>
        {role === ROLES.CLIENT && (
          <>
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                startIcon={<ChatIcon />}
                onClick={actions.onStartSession}
              >
                Start Requirement Session
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                onClick={actions.onViewChangeRequests}
              >
                View Change Requests
              </Button>
            </Grid>
          </>
        )}

        {role === ROLES.DEVELOPER && (
          <>
            <Grid item xs={12} sm={6} md={12}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<AddIcon />}
                onClick={actions.onCreateProject}
              >
                Create New Project
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={12}>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                startIcon={<DescriptionIcon />}
                onClick={actions.onViewSrs}
              >
                Browse SRS Documents
              </Button>
            </Grid>
          </>
        )}

        {role === ROLES.ADMIN && (
          <>
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<AddIcon />}
                onClick={actions.onAddUser}
              >
                Add User Account
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                startIcon={<AssessmentIcon />}
                onClick={actions.onViewAnalytics}
              >
                View Analytics Reports
              </Button>
            </Grid>
          </>
        )}
      </Grid>
    </Paper>
  );
};

export default QuickActions;
