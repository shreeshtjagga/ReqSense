import React, { useState } from 'react';
import { Box, TextField, IconButton, Typography, InputAdornment } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export const ChatInput = ({ onSendMessage, disabled }) => {
  const [text, setText] = useState('');
  const maxLength = 4000;

  const handleSend = () => {
    if (!text.trim() || text.length > maxLength || disabled) return;
    onSendMessage(text);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = text.length > maxLength;

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2, bgcolor: 'background.paper' }}>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Chat is disabled' : 'Type requirement or ask ARIA...'}
        disabled={disabled}
        error={isOverLimit}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  color="primary"
                  onClick={handleSend}
                  disabled={disabled || !text.trim() || isOverLimit}
                  edge="end"
                >
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
          }
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
        <Typography
          variant="caption"
          color={isOverLimit ? 'error.main' : 'text.secondary'}
          sx={{ fontWeight: isOverLimit ? 600 : 400 }}
        >
          {text.length}/{maxLength} characters
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatInput;
