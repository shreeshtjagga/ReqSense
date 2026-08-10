import React, { useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import { requestCloseProject, approveCloseProject, cancelCloseProject } from '../../api/projects';
import { useToastStore } from '../../store/toastStore';

export const ClosureBanner = ({ project, onUpdated }) => {
  const { user } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  if (!project || project.status === 'completed') return null;

  const isRequester = project.closure_requested_by === user?.id;
  const hasPendingRequest = Boolean(project.closure_requested_by);

  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      const updated = await fn(project.id);
      showToast(successMsg, 'success');
      onUpdated?.(updated);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!hasPendingRequest) {
    return (
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        action={
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={busy}
            onClick={() => run(requestCloseProject, 'Closure request sent. Waiting for the other party to confirm.')}
          >
            Request to Close Project
          </Button>
        }
      >
        This project is active.
      </Alert>
    );
  }

  return (
    <Alert severity="warning" sx={{ mb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Typography variant="body2">
          {isRequester
            ? 'You requested to close this project. Waiting for the other party to confirm.'
            : 'The other party requested to close this project. Confirm to finalize, or cancel to keep it active.'}
        </Typography>
        <Stack direction="row" spacing={1}>
          {!isRequester && (
            <Button
              size="small"
              variant="contained"
              color="error"
              disabled={busy}
              onClick={() => run(approveCloseProject, 'Project closed successfully.')}
            >
              Confirm Close
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={busy}
            onClick={() => run(cancelCloseProject, 'Closure request cancelled.')}
          >
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
};

export default ClosureBanner;
