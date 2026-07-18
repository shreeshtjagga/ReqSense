import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, Divider } from '@mui/material';
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
  title = 'ARIA Requirement Gathering Session',
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
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
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'background.paper' }}>
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
      <Divider />

      {/* Messages Box */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
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
          messages.map((msg, index) => (
            <ChatMessage
              key={msg.id || index}
              message={msg}
              onResolveConflict={onResolveConflict}
            />
          ))
        )}

        {sending && <TypingIndicator />}
        <div ref={scrollRef} />
      </Box>

      {/* Input Box */}
      <ChatInput onSendMessage={onSendMessage} disabled={disabled} />
    </Paper>
  );
};

export default ChatWindow;
