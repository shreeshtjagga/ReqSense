import React, { useState } from 'react';
import { Typography, Box, Stack, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import Card from '../common/Card';
import Badge from '../common/Badge';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { PROJECT_DOMAIN_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { deleteProject } from '../../api/projects';
import { useToastStore } from '../../store/toastStore';

export const ProjectCard = ({ project, onClick, onDeleteSuccess }) => {
  const { id, name, description, domain, status, created_at } = project;
  const showToast = useToastStore((state) => state.showToast);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = status === 'completed' || status === 'archived';

  const handleDeleteConfirm = async (e) => {
    e.stopPropagation();
    try {
      setDeleting(true);
      await deleteProject(id);
      showToast(`Project "${name}" deleted successfully.`, 'success');
      setDeleteOpen(false);
      if (onDeleteSuccess) onDeleteSuccess(id);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete project.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        onClick={onClick}
        sx={{
          height: '100%',
          position: 'relative',
          cursor: 'pointer',
          p: 3,
          borderRadius: 4,
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 30px -5px rgba(79, 70, 229, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
            borderColor: '#C7D2FE',
            '& .open-arrow': {
              transform: 'translateX(4px)',
              color: 'primary.main',
            },
          },
        }}
      >
        <Stack spacing={2.5} sx={{ height: '100%', justifyContent: 'space-between' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 0 1px rgba(199, 210, 254, 0.5)',
                }}
              >
                <FolderIcon />
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                {canDelete && (
                  <Tooltip title="Delete Project">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteOpen(true);
                      }}
                      sx={{ color: 'error.main', '&:hover': { bgcolor: '#FEE2E2' } }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Badge label={status} type="feature" />
              </Stack>
            </Box>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                mb: 1,
                color: '#0F172A',
                letterSpacing: '-0.01em',
                fontSize: '1.15rem',
              }}
            >
              {name}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.6,
                minHeight: 44,
              }}
            >
              {description || 'No description provided.'}
            </Typography>
          </Box>

          <Box
            sx={{
              pt: 2,
              borderTop: '1px solid',
              borderColor: '#F1F5F9',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Domain: <Box component="span" sx={{ color: '#0F172A', fontWeight: 700 }}>{PROJECT_DOMAIN_LABELS[domain] || domain}</Box>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.2 }}>
                Created {formatDate(created_at)}
              </Typography>
            </Box>

            <IconButton
              size="small"
              className="open-arrow"
              sx={{
                color: '#94A3B8',
                transition: 'all 0.2s',
              }}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
      </Card>

      <Dialog
        open={deleteOpen}
        onClose={(e) => {
          e.stopPropagation();
          setDeleteOpen(false);
        }}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete project <strong>"{name}"</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProjectCard;
