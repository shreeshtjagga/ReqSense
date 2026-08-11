import React from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 2.5, px: 2 }}>
        <Paper
          elevation={0}
          sx={{
            px: 2.5,
            py: 1,
            borderRadius: 20,
            bgcolor: '#F1F5F9',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
          }}
        >
          <SettingsSuggestIcon fontSize="small" sx={{ color: '#64748B' }} />
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
            {content}
          </Typography>
        </Paper>
      </Box>
    );
  }

  let conflictData = null;
  if (message_type === 'conflict_alert') {
    try {
      conflictData = JSON.parse(content);
    } catch (e) {
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isClient ? 'flex-end' : 'flex-start',
        mb: 2.5,
        gap: 1.5,
        alignItems: 'flex-start',
        maxWidth: '100%',
      }}
    >
      {!isClient && (
        <Avatar
          sx={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)',
            boxShadow: '0 4px 10px rgba(6, 182, 212, 0.3)',
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <SmartToyIcon fontSize="small" sx={{ color: '#FFFFFF' }} />
        </Avatar>
      )}

      <Box sx={{ maxWidth: { xs: '88%', sm: '75%' } }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3.5,
            borderTopRightRadius: isClient ? 0.5 : 3.5,
            borderTopLeftRadius: isClient ? 3.5 : 0.5,
            background: isClient
              ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)'
              : '#FFFFFF',
            color: isClient ? '#FFFFFF' : '#0F172A',
            border: isClient ? 'none' : '1px solid #E2E8F0',
            boxShadow: isClient
              ? '0 6px 20px rgba(79, 70, 229, 0.25)'
              : '0 2px 8px rgba(15, 23, 42, 0.04)',
          }}
        >
          {conflictData ? (
            <ConflictAlert
              contradiction={conflictData}
              onResolve={onResolveConflict}
            />
          ) : (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.6 }}>
              {content}
            </Typography>
          )}
        </Paper>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.75,
            mx: 1,
            fontSize: '0.75rem',
            color: '#94A3B8',
            textAlign: isClient ? 'right' : 'left',
            fontWeight: 500,
          }}
        >
          {formatDateTime(created_at)}
        </Typography>
      </Box>

      {isClient && (
        <Avatar
          sx={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)',
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <PersonIcon fontSize="small" sx={{ color: '#FFFFFF' }} />
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;
