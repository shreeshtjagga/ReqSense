import React, { useEffect, useState } from 'react';
import {
  Typography,
  Grid,
  Box,
  Alert,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Divider,
} from '@mui/material';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { listProjects } from '../../api/projects';
import { listChangeRequests, reviewChangeRequest } from '../../api/changeRequests';
import { useToastStore } from '../../store/toastStore';
import { formatDateTime } from '../../utils/helpers';
import { CHANGE_REQUEST_STATUS } from '../../utils/constants';

export const ChangeRequests = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crLoading, setCrLoading] = useState(false);

  // Review modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedCr, setSelectedCr] = useState(null);
  const [note, setNote] = useState('');
  const [action, setAction] = useState('approved');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await listProjects();
      setProjects(data);
      if (data.length > 0) {
        setProjectId(data[0].id);
      }
    } catch (err) {
      showToast('Failed to load active projects.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchChangeRequests = async (pid) => {
    if (!pid) return;
    setCrLoading(true);
    try {
      const data = await listChangeRequests(pid);
      setChangeRequests(data);
    } catch (err) {
      showToast('Failed to load change requests.', 'error');
    } finally {
      setCrLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [showToast]);

  useEffect(() => {
    fetchChangeRequests(projectId);
  }, [projectId]);

  const handleReviewClick = (cr) => {
    setSelectedCr(cr);
    setNote(cr.developer_note || '');
    setAction('approved');
    setReviewOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCr) return;

    setSubmitting(true);
    try {
      await reviewChangeRequest(selectedCr.id, {
        status: action,
        developer_note: note.trim() || `Reviewed as ${action} by developer.`,
        version: selectedCr.version, // Send optimistic locking version!
      });

      showToast(`Change request ${action} successfully!`, 'success');
      setReviewOpen(false);
      
      // Refresh list
      fetchChangeRequests(projectId);
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.response?.data?.code === 'STALE_VERSION';
      if (isConflict) {
        showToast('Someone else reviewed this request. Refreshing your list...', 'error');
        setReviewOpen(false);
        fetchChangeRequests(projectId);
      } else {
        showToast(err.response?.data?.detail || 'Failed to submit review.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Change Requests review
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Process client requirement modification requests and evaluate AI enqueued impact analysis reports.
          </Typography>
        </Box>
        
        {projects.length > 0 && (
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="project-select-label">Active Project</InputLabel>
            <Select
              labelId="project-select-label"
              value={projectId}
              label="Active Project"
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No Active Projects"
          description="Create a project first to review its change requests."
        />
      ) : crLoading ? (
        <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 3 }} />
      ) : changeRequests.length === 0 ? (
        <EmptyState
          title="No Change Requests"
          description="No change requests have been submitted for this project yet."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table aria-label="change-requests-table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell><strong>Title</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Severity</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Submitted At</strong></TableCell>
                <TableCell align="right"><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changeRequests.map((cr) => (
                <TableRow key={cr.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{cr.title}</TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cr.description}
                  </TableCell>
                  <TableCell>
                    <Badge label={cr.severity} type="severity" />
                  </TableCell>
                  <TableCell>
                    <Badge label={cr.status} type="change-request" />
                  </TableCell>
                  <TableCell>{formatDateTime(cr.created_at)}</TableCell>
                  <TableCell align="right">
                    {cr.status === 'pending' ? (
                      <Button size="small" variant="contained" onClick={() => handleReviewClick(cr)}>
                        Review & Impact
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" color="inherit" onClick={() => handleReviewClick(cr)}>
                        Details
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onClose={() => !submitting && setReviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Change Request Evaluation</DialogTitle>
        <Box component="form" onSubmit={handleReviewSubmit}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {selectedCr?.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Submitted on {formatDateTime(selectedCr?.created_at)} • Severity:{' '}
                  <strong>{selectedCr?.severity?.toUpperCase()}</strong>
                </Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Client Description
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {selectedCr?.description}
                </Typography>
              </Box>

              {/* Impact report */}
              <Box sx={{ p: 2, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                  ARIA AI Impact Analysis Report
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: 'text.primary' }}>
                  {selectedCr?.impact_report ||
                    'Impact analysis is currently being processed by background worker tasks...'}
                </Typography>
              </Box>

              {selectedCr?.status === CHANGE_REQUEST_STATUS.PENDING ? (
                <>
                  <Divider />
                  
                  <FormControl fullWidth>
                    <InputLabel id="action-label">Review Action</InputLabel>
                    <Select
                      labelId="action-label"
                      value={action}
                      label="Review Action"
                      onChange={(e) => setAction(e.target.value)}
                    >
                      <MenuItem value="approved">Approve Change Request</MenuItem>
                      <MenuItem value="rejected">Reject Change Request</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Developer Response Note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    multiline
                    rows={3}
                    placeholder="Enter approval details, target release versions or rejection reasons..."
                    fullWidth
                    required
                  />
                </>
              ) : (
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Review Details (Historical)
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Status: <Badge label={selectedCr?.status} type="change-request" />
                  </Typography>
                  <Typography variant="body2">
                    Developer Note: {selectedCr?.developer_note || 'N/A'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button disabled={submitting} onClick={() => setReviewOpen(false)} color="inherit">
              Close
            </Button>
            {selectedCr?.status === CHANGE_REQUEST_STATUS.PENDING && (
              <Button type="submit" variant="contained" color="primary" loading={submitting}>
                Submit Decision
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </Layout>
  );
};

export default ChangeRequests;
