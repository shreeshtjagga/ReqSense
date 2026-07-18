import React, { Component } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
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
            <ErrorIcon color="error" sx={{ fontSize: 80, mb: 3 }} />
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              An unexpected error occurred in the application interface.
            </Typography>
            <Button variant="contained" size="large" onClick={this.handleReset}>
              Go to Home Page
            </Button>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
