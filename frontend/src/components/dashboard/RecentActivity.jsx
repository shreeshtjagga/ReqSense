import React from 'react';
import {
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Box,
  Divider,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { formatDateTime } from '../../utils/helpers';

export const RecentActivity = ({ activities = [] }) => {
  const getActivityIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'session_start':
      case 'session_end':
        return <ChatIcon color="info" />;
      case 'contradiction_detected':
        return <WarningIcon color="warning" />;
      case 'srs_generated':
        return <AssignmentIcon color="success" />;
      case 'contradiction_resolved':
        return <TaskAltIcon color="success" />;
      default:
        return <AssignmentIcon color="action" />;
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Recent Activity Log
      </Typography>
      
      {activities.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No recent activity recorded.
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {activities.map((act, index) => (
            <React.Fragment key={act.id || index}>
              <ListItem sx={{ py: 1.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {getActivityIcon(act.type)}
                </ListItemIcon>
                <ListItemText
                  primary={act.description}
                  secondary={formatDateTime(act.timestamp)}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: 500,
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem',
                  }}
                />
              </ListItem>
              {index < activities.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default RecentActivity;
