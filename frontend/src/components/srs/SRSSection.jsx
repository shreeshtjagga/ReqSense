import React from 'react';
import { Box, Typography } from '@mui/material';

export const SRSSection = ({ title, content }) => {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main' }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
        {content}
      </Typography>
    </Box>
  );
};

export default SRSSection;
