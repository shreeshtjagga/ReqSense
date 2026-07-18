import React from 'react';
import { Box, CircularProgress, Skeleton, Stack } from '@mui/material';

export const PageLoader = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      width: '100%',
    }}
  >
    <CircularProgress size={40} thickness={4} color="primary" />
  </Box>
);

export const InlineLoader = ({ size = 24 }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
    <CircularProgress size={size} thickness={4} color="primary" />
  </Box>
);

export const CardSkeleton = () => (
  <Stack spacing={1} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
    <Skeleton variant="text" sx={{ fontSize: '1.2rem' }} width="40%" />
    <Skeleton variant="rectangular" height={60} />
    <Skeleton variant="rounded" height={32} />
  </Stack>
);

export const ListSkeleton = ({ count = 3 }) => (
  <Stack spacing={2}>
    {Array.from(new Array(count)).map((_, index) => (
      <Skeleton key={index} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
    ))}
  </Stack>
);
