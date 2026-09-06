import React, { useState } from 'react';
import { Box, TextField, IconButton, Typography, InputAdornment } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export const ChatInput = ({ onSendMessage, disabled, sending }) => {
  const [text, setText] = useState('');
  const maxLength = 4000;

  const handleSend = () => {
    if (!text.trim() || text.length > maxLength || disabled || sending) return;
    const toSend = text;
    onSendMessage(toSend)
      .then(() => setText(''))
      .catch(() => { /* keep text so the user can retry without retyping */ });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = text.length > maxLength;

  return (
    <Box
      sx={{
        borderTop: '1px solid #E2E8F0',
        p: 2.5,
        bgcolor: '#FFFFFF',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Chat session completed' : "Describe a requirement or answer ARIA's question... (Press Enter to send)"}
        disabled={disabled || sending}
        error={isOverLimit}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
            backgroundColor: '#F8FAFC',
            px: 2,
            py: 1,
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: '#FFFFFF',
            },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.12)',
            },
          },
        }}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSend}
                  disabled={disabled || sending || !text.trim() || isOverLimit}
                  edge="end"
                  sx={{
                    background: disabled || sending || !text.trim() || isOverLimit
                      ? '#E2E8F0'
                      : 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                    color: '#FFFFFF',
                    width: 38,
                    height: 38,
                    boxShadow: disabled || sending || !text.trim() || isOverLimit ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)',
                    },
                    '&.Mui-disabled': {
                      color: '#94A3B8',
                    },
                  }}
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, px: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          Pro-tip: Describe actions, target users, and constraints clearly for optimal atom extraction.
        </Typography>
        <Typography
          variant="caption"
          color={isOverLimit ? 'error.main' : 'text.secondary'}
          sx={{ fontWeight: isOverLimit ? 700 : 500, fontSize: '0.75rem' }}
        >
          {text.length}/{maxLength}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatInput;
