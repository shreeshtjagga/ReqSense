import React from 'react';
import { Chip } from '@mui/material';
import {
  getFeatureStatusColor,
  getChangeRequestStatusColor,
  getConflictStatusColor,
  getSeverityColor,
} from '../../utils/helpers';

export const Badge = ({ label, type, ...props }) => {
  let color = 'default';
  
  if (type === 'feature') {
    color = getFeatureStatusColor(label);
  } else if (type === 'change-request') {
    color = getChangeRequestStatusColor(label);
  } else if (type === 'conflict') {
    color = getConflictStatusColor(label);
  } else if (type === 'severity') {
    color = getSeverityColor(label);
  }

  return (
    <Chip
      label={label}
      color={color}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600, borderRadius: 1.5 }}
      {...props}
    />
  );
};

export default Badge;
