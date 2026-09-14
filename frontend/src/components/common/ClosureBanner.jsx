import React, { useState } from 'react';
import { Alert, AlertTitle, Button, Stack, Typography, Box } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import {
  requestCloseProject,
  approveCloseProject,
  cancelCloseProject,
  requestDeleteProject,
  approveDeleteProject,
  cancelDeleteProject,
} from '../../api/projects';
import { useToastStore } from '../../store/toastStore';
import { useNavigate } from 'react-router-dom';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

export const ClosureBanner = ({ project, onUpdated }) => {
  const { user } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);
  const navigate = useNavigate();
  const [busyClosure, setBusyClosure] = useState(false);
  const [busyDeletion, setBusyDeletion] = useState(false);

  if (!project) return null;

  // ── Closure state ──────────────────────────────────────────────────────────
  const isClosureRequester = project.closure_requested_by === user?.id;
  const hasPendingClosure = Boolean(project.closure_requested_by);

  // ── Deletion state ─────────────────────────────────────────────────────────
  const isDeletionRequester = project.deletion_requested_by === user?.id;
  const hasPendingDeletion = Boolean(project.deletion_requested_by);

  const runClosure = async (fn, successMsg) => {
    setBusyClosure(true);
    try {
      const updated = await fn(project.id);
      showToast(successMsg, 'success');
      onUpdated?.(updated);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed.', 'error');
    } finally {
      setBusyClosure(false);
    }
  };

  const runDeletion = async (fn, successMsg, andNavigate = false) => {
    setBusyDeletion(true);
    try {
      const result = await fn(project.id);
      showToast(successMsg, 'success');
      if (andNavigate) {
        navigate('/');
      } else {
        onUpdated?.(result);
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed.', 'error');
    } finally {
      setBusyDeletion(false);
    }
  };

  const showClosureBanner = hasPendingClosure && project.status !== 'completed';
  const showDeletionBanner = hasPendingDeletion;

  if (!showClosureBanner && !showDeletionBanner) return null;

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {/* ── Closure Banner ─────────────────────────────────────────────────── */}
      {showClosureBanner && (
        <Alert severity="warning">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Typography variant="body2">
              {isClosureRequester
                ? 'You requested to close this project. Waiting for the other party to confirm.'
                : 'The other party requested to close this project. Confirm to finalize, or cancel to keep it active.'}
            </Typography>
            <Stack direction="row" spacing={1}>
              {!isClosureRequester && (
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  disabled={busyClosure}
                  onClick={() => runClosure(approveCloseProject, 'Project closed successfully.')}
                >
                  Confirm Close
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={busyClosure}
                onClick={() => runClosure(cancelCloseProject, 'Closure request cancelled.')}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Alert>
      )}

      {/* ── Deletion Banner ─────────────────────────────────────────────────── */}
      {showDeletionBanner && (
        <Alert
          severity="error"
          icon={<DeleteForeverIcon fontSize="inherit" />}
          sx={{ border: '1px solid #FECACA' }}
        >
          <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>
            Project Deletion Requested
          </AlertTitle>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Typography variant="body2">
              {isDeletionRequester
                ? 'You requested to permanently delete this project. Waiting for the other party to confirm. This cannot be undone.'
                : 'The other party has requested to permanently delete this project. Confirm to delete it forever, or cancel to keep it.'}
            </Typography>
            <Stack direction="row" spacing={1} flexShrink={0}>
              {!isDeletionRequester && (
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  disabled={busyDeletion}
                  onClick={() => runDeletion(approveDeleteProject, 'Project permanently deleted.', true)}
                >
                  Confirm Delete
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={busyDeletion}
                onClick={() => runDeletion(cancelDeleteProject, 'Deletion request cancelled.')}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
};

export default ClosureBanner;
