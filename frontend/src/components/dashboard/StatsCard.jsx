import React from 'react';
import { Typography, Box, Stack } from '@mui/material';
import Card from '../common/Card';

export const StatsCard = ({ title, value, icon: IconComponent, color = 'primary.main', subtitle }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        
        {IconComponent && (
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 3,
              bgcolor: 'background.default',
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <IconComponent sx={{ fontSize: 28 }} />
          </Box>
        )}
      </Stack>
    </Card>
  );
};

export default StatsCard;
