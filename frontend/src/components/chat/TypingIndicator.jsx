import React from 'react';
import { Box, Paper } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { keyframes } from '@mui/system';
import { styled } from '@mui/material/styles';

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-6px);
    opacity: 1;
  }
`;

const Dot = styled(Box)(({ theme }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: theme.palette.secondary.main,
  display: 'inline-block',
  animation: `${bounce} 1.4s infinite ease-in-out both`,
}));

export const TypingIndicator = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        mb: 2,
        gap: 1.5,
        alignItems: 'flex-start',
      }}
    >
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

      <Box sx={{ maxWidth: '70%' }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            borderTopLeftRadius: 1,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 36,
            boxSizing: 'border-box',
          }}
        >
          <Dot sx={{ animationDelay: '0s' }} />
          <Dot sx={{ animationDelay: '0.2s' }} />
          <Dot sx={{ animationDelay: '0.4s' }} />
        </Paper>
      </Box>
    </Box>
  );
};

export default TypingIndicator;
