import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import HelpIcon from '@mui/icons-material/Help';

export const NotFound = () => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          textAlign: 'center',
        }}
      >
        <HelpIcon color="primary" sx={{ fontSize: 100, mb: 3, opacity: 0.8 }} />
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 1.5 }}>
          404 Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
          The page you are looking for does not exist or has been moved to another location.
        </Typography>
        <Button variant="contained" size="large" component={RouterLink} to="/">
          Go to Dashboard
        </Button>
      </Box>
    </Container>
  );
};

export default NotFound;
