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
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { formatDateTime } from '../../utils/helpers';

export const VersionHistory = ({ versions = [], onSelectVersion, currentVersionId }) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        SRS Revision History
      </Typography>
      
      {versions.length === 0 ? (
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
              {versions.map((ver) => {
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
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button
                          size="small"
                          variant={isActive ? 'contained' : 'outlined'}
                          startIcon={<VisibilityIcon />}
                          onClick={() => onSelectVersion(ver)}
                        >
                          {isActive ? 'Active' : 'View'}
                        </Button>
                        {ver.file_url && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<DownloadIcon />}
                            href={ver.file_url}
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
