import React from 'react';
import { Paper, Typography, Box, Button, Stack, Divider } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import { formatDateTime } from '../../utils/helpers';
import SRSSection from './SRSSection';

export const SRSViewer = ({ srsData, onShowHistory }) => {
  if (!srsData) return null;

  const { version, created_at, download_url, sections = [] } = srsData;

  const defaultSections = sections.length > 0 ? sections : [
    {
      title: '1. Introduction',
      content: 'This Software Requirements Specification (SRS) document outlines the requirements and scope for the project. It provides details on the intended features, user roles, system flows, and non-functional goals.',
    },
    {
      title: '2. Functional Requirements',
      content: 'The core functional capabilities extracted from user interviews. These details outline the behavior of features that must be developed and verified.',
    },
    {
      title: '3. Technical & Non-Functional Requirements',
      content: 'Security constraints, latency budgets, scalability objectives, and operational environment conditions mapping direct requirements constraints.',
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Software Requirements Specification
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Version <strong>v{version}</strong> • Generated on {formatDateTime(created_at)}
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1.5}>
          {onShowHistory && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<HistoryIcon />}
              onClick={onShowHistory}
            >
              History
            </Button>
          )}
          {download_url && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadIcon />}
              href={download_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download .DOCX
            </Button>
          )}
        </Stack>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Sections rendering */}
      <Stack spacing={4}>
        {defaultSections.map((sec, index) => (
          <SRSSection key={index} title={sec.title} content={sec.content} />
        ))}
      </Stack>
    </Paper>
  );
};

export default SRSViewer;
