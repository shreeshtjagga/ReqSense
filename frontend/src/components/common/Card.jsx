import React from 'react';
import { Card as MuiCard, CardContent, CardActionArea } from '@mui/material';

export const Card = ({ children, onClick, sx = {}, ...props }) => {
  const cardContent = <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>{children}</CardContent>;

  return (
    <MuiCard
      sx={{
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': onClick
          ? {
              transform: 'translateY(-4px)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
            }
          : {},
        ...sx,
      }}
      {...props}
    >
      {onClick ? (
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          {cardContent}
        </CardActionArea>
      ) : (
        cardContent
      )}
    </MuiCard>
  );
};

export default Card;
