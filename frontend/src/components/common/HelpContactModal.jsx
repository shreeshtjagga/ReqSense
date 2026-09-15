import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export const HelpContactModal = ({ open, initialTab = 'help', onClose }) => {
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    setTabIndex(initialTab === 'contact' ? 1 : 0);
  }, [initialTab, open]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#1E293B',
          color: '#FFFFFF',
          py: 1.75,
          px: 2.5,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
          {tabIndex === 0 ? 'Help & Quick Guide' : 'Contact Support'}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#FFFFFF' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: '1px solid #E2E8F0', bgcolor: '#F8FAFC', px: 1.5 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          textColor="primary"
          indicatorColor="primary"
          variant="fullWidth"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              minHeight: 44,
            },
          }}
        >
          <Tab icon={<HelpOutlineIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Help" />
          <Tab icon={<SupportAgentIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Contact Us" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 2.5, bgcolor: '#FFFFFF' }}>
        {tabIndex === 0 ? (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.85rem' }}>
              How ReqSense AI works:
            </Typography>

            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#2563EB', mt: 0.2, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: '#1E293B', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  <strong>Chat with ARIA:</strong> Describe your requirements naturally in conversational sessions.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#2563EB', mt: 0.2, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: '#1E293B', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  <strong>Conflict Detection:</strong> Inconsistencies are flagged automatically for review.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#2563EB', mt: 0.2, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: '#1E293B', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  <strong>Export SRS:</strong> Generate formal specification documents (.docx) anytime.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <EmailOutlinedIcon sx={{ color: '#2563EB', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  Support Email
                </Typography>
              </Stack>
              <Typography
                component="a"
                href="mailto:shreesht.jagga@gmail.com"
                sx={{
                  color: '#2563EB',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                shreesht.jagga@gmail.com
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#64748B', mt: 0.5 }}>
                Mon – Fri: 9:00 AM – 6:00 PM EST (Response within 2h)
              </Typography>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5, px: 2.5, bgcolor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <Button onClick={onClose} size="small" color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpContactModal;
