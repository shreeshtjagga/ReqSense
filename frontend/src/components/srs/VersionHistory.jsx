import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { formatDateTime } from '../../utils/helpers';

import { API_URL, API_PREFIX } from '../../utils/constants';

export const getFullDownloadUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  if (cleanUrl.startsWith('/api/v1')) {
    return `${API_URL}${cleanUrl}`;
  }
  return `${API_URL}${API_PREFIX}${cleanUrl}`;
};

export const VersionHistory = ({ versions = [], onSelectVersion, currentVersionId }) => {
  const safeVersions = Array.isArray(versions) ? versions : [];

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        SRS Revision History
      </Typography>
      
      {safeVersions.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No revision history recorded for this project yet.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table aria-label="srs-versions-table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell><strong>Version</strong></TableCell>
                <TableCell><strong>Generated Date</strong></TableCell>
                <TableCell><strong>Generator</strong></TableCell>
                <TableCell><strong>Change Summary</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {safeVersions.map((ver) => {
                const isActive = ver.id === currentVersionId;
                
                return (
                  <TableRow
                    key={ver.id}
                    sx={{
                      bgcolor: isActive ? 'action.selected' : 'inherit',
                      '&:last-child cell': { border: 0 },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>v{ver.version}</TableCell>
                    <TableCell>{formatDateTime(ver.created_at)}</TableCell>
                    <TableCell>{ver.generated_by || 'system'}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ver.change_summary || 'No changelog description.'}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                        {isActive ? (
                          <Chip label="Viewing" size="small" color="primary" sx={{ fontWeight: 700 }} />
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() => onSelectVersion(ver)}
                          >
                            View Revision
                          </Button>
                        )}
                        {ver.file_url && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<DownloadIcon />}
                            href={getFullDownloadUrl(ver.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default VersionHistory;
