import React, { useState } from 'react';
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
  CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { formatDateTime } from '../../utils/helpers';
import { API_URL, API_PREFIX } from '../../utils/constants';
import { downloadSrsDocx } from '../../api/srs';
import { useToastStore } from '../../store/toastStore';

export const getFullDownloadUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  if (cleanUrl.startsWith('/api/v1')) {
    return `${API_URL}${cleanUrl}`;
  }
  return `${API_URL}${API_PREFIX}${cleanUrl}`;
};

export const VersionHistory = ({ versions = [], onSelectVersion, currentVersionId, projectName = 'Project' }) => {
  const safeVersions = Array.isArray(versions) ? versions : [];
  const showToast = useToastStore((s) => s.showToast);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (ver) => {
    if (!ver?.file_url) {
      showToast('Download link not available for this revision.', 'warning');
      return;
    }
    setDownloadingId(ver.id);
    try {
      showToast(`Downloading SRS revision v${ver.version || ''}...`, 'info');
      const safeProjectName = (projectName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeProjectName}_SRS_v${ver.version || '1.0'}.docx`;
      await downloadSrsDocx(ver.file_url, filename);
      showToast(`SRS v${ver.version} downloaded successfully!`, 'success');
    } catch (err) {
      console.error('[VersionHistory] Download failed:', err);
      showToast('Failed to download SRS document.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

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
                const isDownloading = downloadingId === ver.id;
                
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
                            startIcon={isDownloading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
                            disabled={isDownloading}
                            onClick={() => handleDownload(ver)}
                          >
                            {isDownloading ? 'Downloading...' : 'Download'}
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
