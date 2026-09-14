import React from 'react';
import { Paper, Typography, Box, List, ListItem, ListItemText, ListItemIcon, Divider } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { formatDateTime } from '../../utils/helpers';

export const RecentActivity = ({ activities = [] }) => {
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
        Recent Audit Activity
      </Typography>
      {activities.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center', fontStyle: 'italic' }}>
          No recent activity logs found.
        </Typography>
      ) : (
        <List disablePadding>
          {activities.slice(0, 6).map((act, index) => (
            <React.Fragment key={act.id || index}>
              <ListItem disableGutters sx={{ py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {act.description || act.type}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {act.timestamp ? formatDateTime(act.timestamp) : 'Recent'}
                    </Typography>
                  }
                />
              </ListItem>
              {index < Math.min(activities.length, 6) - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default RecentActivity;
