import React from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { MESSAGE_SENDER } from '../../utils/constants';
import { formatChatTime } from '../../utils/helpers';
import ConflictAlert from './ConflictAlert';

const renderInlineFormatting = (text, isClient) => {
  if (!text) return text;

  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={`b-${keyIdx++}`} style={{ fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      tokens.push(
        <strong key={`b-${keyIdx++}`} style={{ fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <Box
          component="code"
          key={`c-${keyIdx++}`}
          sx={{
            bgcolor: isClient ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
            color: isClient ? '#FFFFFF' : '#0F172A',
            px: 0.6,
            py: 0.2,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.88em',
          }}
        >
          {token.slice(1, -1)}
        </Box>
      );
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      tokens.push(
        <em key={`i-${keyIdx++}`} style={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </em>
      );
    } else {
      tokens.push(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
};

const FormattedChatMessage = ({ content, isClient }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^[-*•]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*•]\s+/, '');
      elements.push(
        <Box
          key={`l-${i}`}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            my: 0.35,
            pl: 0.5,
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: isClient ? '#FFFFFF' : '#4F46E5',
              mt: 1.1,
              flexShrink: 0,
            }}
          />
          <Typography
            component="span"
            variant="body1"
            sx={{ lineHeight: 1.6, wordBreak: 'break-word', color: 'inherit', fontSize: '0.95rem' }}
          >
            {renderInlineFormatting(bulletText, isClient)}
          </Typography>
        </Box>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s+(.+)$/);
      const numPrefix = match ? match[1] : '';
      const numText = match ? match[2] : trimmed;
      elements.push(
        <Box
          key={`nl-${i}`}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.75,
            my: 0.35,
            pl: 0.5,
          }}
        >
          <Typography
            component="span"
            variant="body1"
            sx={{
              fontWeight: 700,
              lineHeight: 1.6,
              color: isClient ? 'rgba(255,255,255,0.9)' : '#4F46E5',
              flexShrink: 0,
              fontSize: '0.95rem',
            }}
          >
            {numPrefix}
          </Typography>
          <Typography
            component="span"
            variant="body1"
            sx={{ lineHeight: 1.6, wordBreak: 'break-word', color: 'inherit', fontSize: '0.95rem' }}
          >
            {renderInlineFormatting(numText, isClient)}
          </Typography>
        </Box>
      );
    } else if (/^#{1,3}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,3}\s+/, '');
      elements.push(
        <Typography
          key={`h-${i}`}
          variant="subtitle1"
          sx={{
            fontWeight: 800,
            my: 0.5,
            color: 'inherit',
            lineHeight: 1.4,
          }}
        >
          {renderInlineFormatting(headingText, isClient)}
        </Typography>
      );
    } else if (trimmed === '') {
      elements.push(<Box key={`sp-${i}`} sx={{ height: 8 }} />);
    } else {
      elements.push(
        <Typography
          key={`p-${i}`}
          variant="body1"
          sx={{
            lineHeight: 1.6,
            wordBreak: 'break-word',
            color: 'inherit',
            fontSize: '0.95rem',
          }}
        >
          {renderInlineFormatting(line, isClient)}
        </Typography>
      );
    }
  }

  return <Box>{elements}</Box>;
};

export const ChatMessage = ({ message, onResolveConflict }) => {

  if (!message) return null;

  const { sender, content, message_type, created_at } = message;

  const isAria = sender === MESSAGE_SENDER.ARIA;
  const isSystem = sender === MESSAGE_SENDER.SYSTEM;
  const isClient = !isSystem && (sender === MESSAGE_SENDER.CLIENT || sender === 'user' || sender === 'client');

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
            {content || ''}
          </Typography>
        </Paper>
      </Box>
    );
  }

  let conflictData = null;
  if (message_type === 'conflict_alert' && content) {
    try {
      const parsed = JSON.parse(content);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        conflictData = parsed;
      }
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
          <AutoAwesomeIcon fontSize="small" sx={{ color: '#FFFFFF' }} />
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
            <FormattedChatMessage content={content} isClient={isClient} />
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
          {created_at ? formatChatTime(created_at) : ''}
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
