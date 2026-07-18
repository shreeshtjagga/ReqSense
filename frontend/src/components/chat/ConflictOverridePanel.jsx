import React, { useState } from 'react';
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
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

export const ConflictOverridePanel = ({ open, contradiction, onClose, onResolveSubmit, loading }) => {
  const [action, setAction] = useState('resolved');
  const [resolution, setResolution] = useState('');

  if (!contradiction) return null;

  const handleSubmit = () => {
    onResolveSubmit(contradiction.id, {
      action,
      resolution: resolution.trim() || `Marked as ${action} by developer.`,
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#FFFBEB', color: '#92400E' }}>
        <WarningIcon color="warning" />
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          Resolve Contradiction
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers sx={{ py: 3 }}>
        <Stack spacing={3}>
          {/* Compare the two atoms */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
              Contradicting Requirements
            </Typography>
            
            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} divider={<Divider orientation="vertical" flexItem />}>
              {/* Atom 1 */}
              <Box sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                  Requirement A
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
                  {contradiction.atom_1_text || 'Subject: ' + (contradiction.atom_1?.subject || 'N/A')}
                </Typography>
                {contradiction.atom_1?.raw_text && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                    "{contradiction.atom_1.raw_text}"
                  </Typography>
                )}
              </Box>

              {/* Atom 2 */}
              <Box sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>
                  Requirement B
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
                  {contradiction.atom_2_text || 'Subject: ' + (contradiction.atom_2?.subject || 'N/A')}
                </Typography>
                {contradiction.atom_2?.raw_text && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                    "{contradiction.atom_2.raw_text}"
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>

          <Divider />

          {/* ARIA Message Context */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 600 }}>
              ARIA Prompt/Warning
            </Typography>
            <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#FFFBEB', borderRadius: 1.5, fontStyle: 'italic' }}>
              {contradiction.aria_message}
            </Typography>
          </Box>

          {/* Resolution Options */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
              Resolution Action
            </FormLabel>
            <RadioGroup
              aria-label="resolution-action"
              name="action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              row
            >
              <FormControlLabel
                value="resolved"
                control={<Radio />}
                label="Resolve (Approve replacement/override)"
              />
              <FormControlLabel
                value="ignored"
                control={<Radio />}
                label="Ignore (Allow both requirement versions to persist)"
              />
            </RadioGroup>
          </FormControl>

          {/* Resolution Notes */}
          <TextField
            label="Resolution Notes / Developer Decision"
            multiline
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Explain why this resolution action was chosen. This will be added to the SRS changelog..."
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Apply Resolution'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictOverridePanel;
