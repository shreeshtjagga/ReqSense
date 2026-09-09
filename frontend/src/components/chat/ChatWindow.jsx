import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, Divider, Skeleton } from '@mui/material';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const ChatWindow = ({
  messages,
  sending,
  onSendMessage,
  onResolveConflict,
  disabled,
  loading = false,
  title = 'ARIA Requirement Gathering Session',
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

  // Safety: normalize messages to always be an array
  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Session Title Header */}
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'background.paper', flexShrink: 0 }}>
        <SmartToyIcon color="secondary" />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ARIA conducts the conversation and extracts requirements in real time.
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ flexShrink: 0 }} />

      {/* Messages Box */}
      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          // Loading skeleton instead of blank screen
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rounded" height={60} width="60%" sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={60} width="75%" sx={{ borderRadius: 3, alignSelf: 'flex-end' }} />
            <Skeleton variant="rounded" height={80} width="65%" sx={{ borderRadius: 3 }} />
          </Box>
        ) : safeMessages.length === 0 ? (
          <Box sx={{ m: 'auto', textAlign: 'center', maxWidth: 320 }}>
            <SmartToyIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Start Requirement Gathering
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Say hello to ARIA to begin. Explain what you would like to build!
            </Typography>
          </Box>
        ) : (
          safeMessages.map((msg, index) => (
            <ChatMessage
              key={msg?.id || index}
              message={msg}
              onResolveConflict={onResolveConflict}
            />
          ))
        )}

        {sending && <TypingIndicator />}
        <div ref={scrollRef} />
      </Box>

      {/* Input Box */}
      <Box sx={{ flexShrink: 0 }}>
        <ChatInput onSendMessage={onSendMessage} disabled={disabled} sending={sending} />
      </Box>
    </Paper>
  );
};

export default ChatWindow;
