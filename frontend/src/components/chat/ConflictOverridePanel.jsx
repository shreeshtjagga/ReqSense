import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Typography,
  Stack,
  Box,
  Divider,
  Checkbox,
  Chip,
  Paper,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

export const ConflictOverridePanel = ({ open, contradiction, onClose, onResolveSubmit, loading }) => {
  const isFromChangeRequest = contradiction?.source === 'change_request' || Boolean(contradiction?.change_request_id);
  const [action, setAction] = useState('rejected');
  const [resolution, setResolution] = useState('');
  const [isFalsePositive, setIsFalsePositive] = useState(false);

  useEffect(() => {
    if (contradiction) {
      setAction(isFromChangeRequest ? 'rejected' : 'resolved');
      setResolution('');
      setIsFalsePositive(Boolean(contradiction.is_false_positive));
    }
  }, [contradiction, isFromChangeRequest]);

  if (!contradiction) return null;

  const handleSubmit = () => {
    onResolveSubmit(contradiction.id, {
      action,
      resolution: resolution.trim() || `Marked as ${action} by developer.`,
      is_false_positive: isFalsePositive,
    });
  };

  const req1Text = contradiction.atom_1_raw || contradiction.atom_1_text || 'No baseline requirement text available.';
  let req2Text = contradiction.atom_2_raw || contradiction.atom_2_text;
  if (!req2Text && isFromChangeRequest && contradiction.change_request_title) {
    req2Text = `${contradiction.change_request_title}${contradiction.change_request_description ? `: ${contradiction.change_request_description}` : ''}`;
  }
  if (!req2Text) {
    req2Text = 'No incoming requirement text available.';
  }

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Clean Slate Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#1E293B',
          color: '#FFFFFF',
          py: 2,
          px: 3,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <WarningAmberIcon sx={{ color: '#F59E0B', fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', fontSize: '1.05rem' }}>
            Resolve Requirement Contradiction
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={isFromChangeRequest ? 'Change Request Conflict' : 'Live Chat Conflict'}
            size="small"
            sx={{ bgcolor: '#334155', color: '#E2E8F0', fontWeight: 600, fontSize: '0.72rem' }}
          />
          <IconButton onClick={onClose} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#FFFFFF' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: '#FFFFFF' }}>
        <Stack spacing={3}>
          {/* Change Request Context if applicable */}
          {isFromChangeRequest && contradiction.change_request_title && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Associated Change Request
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mt: 0.5 }}>
                {contradiction.change_request_title}
              </Typography>
              {contradiction.change_request_description && (
                <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                  {contradiction.change_request_description}
                </Typography>
              )}
            </Paper>
          )}

          {/* ── Side-by-Side Requirement Comparison ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: '#0F172A' }}>
              Requirement Comparison
            </Typography>

            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
              {/* Baseline Requirement */}
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  bgcolor: '#F8FAFC',
                  borderRadius: 2,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Requirement A — Baseline
                  </Typography>
                  <Chip
                    label="Current Active in SRS"
                    size="small"
                    sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontSize: '0.68rem', fontWeight: 600, height: 22 }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: '#1E293B', lineHeight: 1.6, fontWeight: 500, flex: 1 }}>
                  {req1Text}
                </Typography>
                {contradiction.atom_1_category && (
                  <Box sx={{ mt: 1.5 }}>
                    <Chip
                      label={contradiction.atom_1_category}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.68rem', height: 20, borderColor: '#CBD5E1', color: '#64748B' }}
                    />
                  </Box>
                )}
              </Box>

              {/* Incoming Requirement */}
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  bgcolor: '#F8FAFC',
                  borderRadius: 2,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Requirement B — Incoming
                  </Typography>
                  <Chip
                    label={isFromChangeRequest ? 'Proposed Change' : 'New Chat Input'}
                    size="small"
                    sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontSize: '0.68rem', fontWeight: 600, height: 22 }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: '#1E293B', lineHeight: 1.6, fontWeight: 500, flex: 1 }}>
                  {req2Text}
                </Typography>
                {contradiction.atom_2_category && (
                  <Box sx={{ mt: 1.5 }}>
                    <Chip
                      label={contradiction.atom_2_category}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.68rem', height: 20, borderColor: '#CBD5E1', color: '#64748B' }}
                    />
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>

          {/* ARIA Analysis */}
          {contradiction.aria_message && (
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, borderLeft: '3px solid #2563EB', border: '1px solid #E2E8F0', borderLeftWidth: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ARIA AI Conflict Analysis:
              </Typography>
              <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6 }}>
                {contradiction.aria_message}
              </Typography>
            </Box>
          )}

          <Divider />

          {/* ── Choose Resolution Action ── */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ fontWeight: 700, color: '#0F172A', mb: 1.5, fontSize: '0.9rem' }}>
              Choose Resolution Action:
            </FormLabel>
            <RadioGroup
              aria-label="resolution-action"
              name="action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              {/* Option 1: Reject change */}
              <Paper
                variant="outlined"
                onClick={() => setAction('rejected')}
                sx={{
                  p: 1.5,
                  mb: 1.25,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderColor: action === 'rejected' ? '#DC2626' : '#E2E8F0',
                  bgcolor: action === 'rejected' ? '#FEF2F2' : '#FFFFFF',
                  transition: 'all 0.15s ease',
                }}
              >
                <FormControlLabel
                  value="rejected"
                  control={<Radio color="error" size="small" />}
                  label={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: action === 'rejected' ? '#991B1B' : '#0F172A' }}>
                        Reject Incoming Change & Keep Baseline
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.3 }}>
                        {isFromChangeRequest
                          ? 'Rejects the change request, dismisses this contradiction alert, and preserves Requirement A in the SRS.'
                          : 'Dismisses the incoming change and preserves Requirement A in the SRS.'}
                      </Typography>
                    </Box>
                  }
                />
              </Paper>

              {/* Option 2: Accept change */}
              <Paper
                variant="outlined"
                onClick={() => setAction('resolved')}
                sx={{
                  p: 1.5,
                  mb: 1.25,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderColor: action === 'resolved' ? '#2563EB' : '#E2E8F0',
                  bgcolor: action === 'resolved' ? '#EFF6FF' : '#FFFFFF',
                  transition: 'all 0.15s ease',
                }}
              >
                <FormControlLabel
                  value="resolved"
                  control={<Radio color="primary" size="small" />}
                  label={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: action === 'resolved' ? '#1E40AF' : '#0F172A' }}>
                        Accept Incoming Change & Replace Baseline
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.3 }}>
                        {isFromChangeRequest
                          ? 'Approves the change request and replaces Requirement A with Requirement B in the SRS.'
                          : 'Overrides Requirement A with Requirement B in the active specification.'}
                      </Typography>
                    </Box>
                  }
                />
              </Paper>

              {/* Option 3: Keep both */}
              <Paper
                variant="outlined"
                onClick={() => setAction('ignored')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderColor: action === 'ignored' ? '#475569' : '#E2E8F0',
                  bgcolor: action === 'ignored' ? '#F8FAFC' : '#FFFFFF',
                  transition: 'all 0.15s ease',
                }}
              >
                <FormControlLabel
                  value="ignored"
                  control={<Radio color="default" size="small" />}
                  label={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: action === 'ignored' ? '#334155' : '#0F172A' }}>
                        Keep Both (Allow Coexistence)
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.3 }}>
                        Both requirements will remain active concurrently in the project without further warnings.
                      </Typography>
                    </Box>
                  }
                />
              </Paper>
            </RadioGroup>
          </FormControl>

          {/* AI False Positive Flag */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isFalsePositive}
                onChange={(e) => setIsFalsePositive(e.target.checked)}
                size="small"
                color="warning"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#475569', fontSize: '0.85rem' }}>
                Tag as AI False Positive (ARIA misidentified these requirements as conflicting)
              </Typography>
            }
          />

          {/* Notes */}
          <TextField
            label="Decision Note (Optional)"
            multiline
            rows={2}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Add context for why this resolution decision was chosen..."
            fullWidth
            size="small"
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 3, bgcolor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <Button onClick={onClose} disabled={loading} color="inherit" size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color={action === 'rejected' ? 'error' : action === 'resolved' ? 'primary' : 'inherit'}
          disabled={loading}
          sx={{ px: 2.5, fontWeight: 700, textTransform: 'none' }}
        >
          {loading
            ? 'Applying...'
            : action === 'rejected'
            ? 'Reject Change & Keep Baseline'
            : action === 'resolved'
            ? 'Accept & Apply Change'
            : 'Keep Both Requirements'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictOverridePanel;
