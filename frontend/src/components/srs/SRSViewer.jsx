import React from 'react';
import { Paper, Typography, Box, Button, Stack, Divider, Chip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import { formatDateTime } from '../../utils/helpers';
import SRSSection from './SRSSection';
import { getFullDownloadUrl } from './VersionHistory';

export const SRSViewer = ({ srsData, onShowHistory }) => {
  if (!srsData) return null;

  const { version, created_at, download_url, sections = [], atoms = [], generated_by } = srsData;
  const targetDownloadUrl = getFullDownloadUrl(download_url);

  const displaySections = sections.length > 0 ? sections : [
    {
      title: '1. Executive Summary & Overview',
      content: `Software Requirements Specification (v${version || '1.0'}). This document captures all extracted requirements, constraints, and specifications from client sessions.`,
    },
    {
      title: '2. Functional Requirements',
      content: atoms.length > 0
        ? atoms.map((a, i) => `[${i + 1}] ${a.subject}: ${a.action}`).join('\n\n')
        : 'No functional requirements recorded yet.',
    },
    {
      title: '3. Technical & Non-Functional Requirements',
      content: 'Standard security, encryption, and operational latency targets.',
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Software Requirements Specification
            </Typography>
            <Chip label={`v${version || '1.0'}`} color="primary" size="small" sx={{ fontWeight: 700 }} />
            {generated_by && <Chip label={`By: ${generated_by}`} variant="outlined" size="small" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Generated on {formatDateTime(created_at)}
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
          {targetDownloadUrl && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadIcon />}
              href={targetDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download .DOCX
            </Button>
          )}
        </Stack>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Dynamic Sections rendering */}
      <Stack spacing={4}>
        {displaySections.map((sec, index) => (
          <SRSSection key={index} title={sec.title} content={sec.content} />
        ))}

        {/* Atom Cards if atoms list exists */}
        {atoms && atoms.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Extracted Requirement Statements ({atoms.length})
            </Typography>
            <Stack spacing={2}>
              {atoms.map((atom, idx) => (
                <Paper key={atom.id || idx} variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip label={`#${idx + 1}`} size="small" color="default" sx={{ fontWeight: 700 }} />
                    <Chip label={atom.subject} size="small" color="info" variant="outlined" sx={{ fontWeight: 600 }} />
                  </Stack>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                    {atom.action}
                  </Typography>
                  {atom.constraint_text && (
                    <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 500, mb: 1 }}>
                      Constraint: {atom.constraint_text}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontStyle: 'italic', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                    Client Raw Statement: "{atom.raw_text}"
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default SRSViewer;
