import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { MESSAGE_SENDER } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';
import ConflictAlert from './ConflictAlert';

export const ChatMessage = ({ message, onResolveConflict }) => {
  const { sender, content, message_type, created_at } = message;

  const isAria = sender === MESSAGE_SENDER.ARIA;
  const isSystem = sender === MESSAGE_SENDER.SYSTEM;
  const isClient = sender === MESSAGE_SENDER.CLIENT;

  if (isSystem) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 2, px: 2 }}>
        <Paper
          variant="outlined"
          sx={{
            px: 2,
            py: 0.75,
            borderRadius: 4,
            bgcolor: 'action.hover',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <SettingsSuggestIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary" align="center">
            {content}
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Parse if it's a conflict alert containing JSON data
  let conflictData = null;
  if (message_type === 'conflict_alert') {
    try {
      conflictData = JSON.parse(content);
    } catch (e) {
      // Normal text content fallback
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isClient ? 'flex-end' : 'flex-start',
        mb: 2,
        gap: 1.5,
        alignItems: 'flex-start',
        maxWidth: '100%',
      }}
    >
      {!isClient && (
        <Paper
          elevation={1}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'secondary.main',
            color: 'white',
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <SmartToyIcon fontSize="small" />
        </Paper>
      )}

      <Box sx={{ maxWidth: { xs: '85%', sm: '70%' } }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            borderTopRightRadius: isClient ? 1 : 3,
            borderTopLeftRadius: isClient ? 3 : 1,
            bgcolor: isClient ? 'primary.main' : 'background.paper',
            color: isClient ? 'primary.contrastText' : 'text.primary',
            border: isClient ? 'none' : '1px solid',
            borderColor: 'divider',
          }}
        >
          {conflictData ? (
            <ConflictAlert
              contradiction={conflictData}
              onResolve={onResolveConflict}
            />
          ) : (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {content}
            </Typography>
          )}
        </Paper>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.5,
            mx: 1,
            textAlign: isClient ? 'right' : 'left',
          }}
        >
          {formatDateTime(created_at)}
        </Typography>
      </Box>

      {isClient && (
        <Paper
          elevation={1}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
            color: 'white',
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <PersonIcon fontSize="small" />
        </Paper>
      )}
    </Box>
  );
};

export default ChatMessage;
