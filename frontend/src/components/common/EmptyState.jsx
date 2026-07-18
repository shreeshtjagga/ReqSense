import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export const EmptyState = ({
  title = 'No items found',
  description = 'There are no items to display at the moment.',
  actionLabel,
  onAction,
  icon: IconComponent = InfoOutlinedIcon,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: 4,
        my: 4,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <IconComponent sx={{ fontSize: 60, color: 'text.secondary', mb: 2, opacity: 0.6 }} />
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" color="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
