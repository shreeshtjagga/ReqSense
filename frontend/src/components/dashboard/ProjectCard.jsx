import React from 'react';
import { Typography, Box, Stack, IconButton, Tooltip } from '@mui/material';
import Card from '../common/Card';
import Badge from '../common/Badge';
import FolderIcon from '@mui/icons-material/Folder';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import { PROJECT_DOMAIN_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';

export const ProjectCard = ({ project, onClick, onHistoryClick }) => {
  const { id, name, description, domain, status, created_at } = project;
  const navigate = useNavigate();

  const handleHistory = (e) => {
    e.stopPropagation();
    if (onHistoryClick) {
      onHistoryClick(project);
    } else {
      navigate(`/client/projects/${id}/sessions`);
    }
  };

  return (
    <Card onClick={onClick} sx={{ height: '100%', position: 'relative' }}>
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="View Session History">
                <IconButton size="small" onClick={handleHistory} sx={{ color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}>
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Badge label={status} type="feature" />
            </Stack>
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
