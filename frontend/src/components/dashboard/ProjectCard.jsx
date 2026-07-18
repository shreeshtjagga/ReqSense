import React from 'react';
import { Typography, Box, Stack } from '@mui/material';
import Card from '../common/Card';
import Badge from '../common/Badge';
import FolderIcon from '@mui/icons-material/Folder';
import { PROJECT_DOMAIN_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';

export const ProjectCard = ({ project, onClick }) => {
  const { name, description, domain, status, created_at } = project;

  return (
    <Card onClick={onClick} sx={{ height: '100%' }}>
      <Stack spacing={2} sx={{ height: '100%', justifyContent: 'space-between' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: 'primary.light',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.85,
              }}
            >
              <FolderIcon />
            </Box>
            <Badge label={status} type="feature" /> {/* Same status color mapping works */}
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
            {name}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 60,
            }}
          >
            {description || 'No description provided.'}
          </Typography>
        </Box>

        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Domain: <strong>{PROJECT_DOMAIN_LABELS[domain] || domain}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Created: {formatDate(created_at)}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
};

export default ProjectCard;
