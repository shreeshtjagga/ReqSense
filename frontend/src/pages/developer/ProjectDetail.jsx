import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Grid,
  Box,
  Alert,
  Slider,
  Tooltip,
  Skeleton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Divider,
  Chip,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ConflictOverridePanel from '../../components/chat/ConflictOverridePanel';
import ClosureBanner from '../../components/common/ClosureBanner';
import ProjectClientsList from '../../components/dashboard/ProjectClientsList';
import SRSViewer from '../../components/srs/SRSViewer';
import VersionHistory from '../../components/srs/VersionHistory';

import {
  getProject,
  addClientToProject,
  createProjectInvite,
  lookupUserByEmail,
  updateProject,
} from '../../api/projects';
import { listSessionsForProject } from '../../api/sessions';
import { resolveContradiction } from '../../api/contradictions';
import { getProjectSummary, getLLMUsage } from '../../api/analytics';
import { listFeaturesForProject, updateFeatureStatus, createFeatureStatus } from '../../api/featureStatus';
import { listChangeRequests, reviewChangeRequest } from '../../api/changeRequests';
import { getLatestSrs, listSrsVersions, generateProjectSrs, getSrsVersionDetails } from '../../api/srs';

import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime } from '../../utils/helpers';
import { FEATURE_STATUS, CHANGE_REQUEST_STATUS, PROJECT_DOMAIN_LABELS } from '../../utils/constants';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListAltIcon from '@mui/icons-material/ListAlt';
import WarningIcon from '@mui/icons-material/Warning';
import ChatIcon from '@mui/icons-material/Chat';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RateReviewIcon from '@mui/icons-material/RateReview';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DashboardIcon from '@mui/icons-material/Dashboard';
import axios from '../../api/axios';

// ── Tab 4: Project Feature Tracker ───────────────────────────────────────────
const ProjectFeatureTrackerTab = ({ projectId }) => {
  const showToast = useToastStore((s) => s.showToast);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit Modal
  const [editOpen, setEditOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchFeatures = async () => {
    setLoading(true);
    try {
      const data = await listFeaturesForProject(projectId);
      setFeatures(data);
    } catch (err) {
      showToast('Failed to load project features.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchFeatures();
  }, [projectId]);

  const handleEditClick = (feat) => {
    setSelectedFeature(feat);
    setNewStatus(feat.status);
    setNewDescription(feat.description || '');
    setEditOpen(true);
  };

  const handleUpdateFeature = async (e) => {
    e.preventDefault();
    if (!selectedFeature) return;
    setUpdating(true);
    try {
      await updateFeatureStatus(selectedFeature.id, {
        status: newStatus,
        description: newDescription,
        version: selectedFeature.version,
      });
      showToast('Feature updated successfully!', 'success');
      setEditOpen(false);
      fetchFeatures();
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.response?.data?.code === 'STALE_VERSION';
      if (isConflict) {
        showToast('Someone else updated this feature. Refreshing data...', 'error');
        setEditOpen(false);
        fetchFeatures();
      } else {
        showToast(err.response?.data?.detail || 'Failed to update feature.', 'error');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateFeature = async (e) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      await createFeatureStatus({
        project_id: projectId,
        title: createTitle.trim(),
        description: createDescription.trim(),
      });
      showToast('New feature added successfully!', 'success');
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      fetchFeatures();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create feature.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const planned = features.filter((f) => f.status === FEATURE_STATUS.PLANNED);
  const inProgress = features.filter((f) => f.status === FEATURE_STATUS.IN_PROGRESS);
  const completed = features.filter((f) => f.status === FEATURE_STATUS.COMPLETED);

  const renderColumn = (title, colFeatures) => (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%', bgcolor: 'background.paper', minHeight: 360 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Badge label={colFeatures.length} type="info" />
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={2}>
        {colFeatures.map((feat) => (
          <Card key={feat.id} variant="outlined" sx={{ borderRadius: 2, position: 'relative' }}>
            <CardContent sx={{ pr: 6, pb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {feat.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {feat.description || 'No description provided.'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Version: v{feat.version}
              </Typography>
            </CardContent>
            <CardActions sx={{ position: 'absolute', right: 8, top: 8 }}>
              <IconButton onClick={() => handleEditClick(feat)} size="small" color="primary">
                <EditIcon fontSize="small" />
              </IconButton>
            </CardActions>
          </Card>
        ))}
        {colFeatures.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
            Empty column
          </Typography>
        )}
      </Stack>
    </Paper>
  );

  if (loading) return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Functional Features Kanban
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add Feature
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          {renderColumn('Planned', planned)}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderColumn('In Progress', inProgress)}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderColumn('Completed', completed)}
        </Grid>
      </Grid>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Feature</DialogTitle>
        <Box component="form" onSubmit={handleCreateFeature}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <TextField
                label="Feature Title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                required
                fullWidth
                placeholder="e.g. User Authentication & SSO"
              />
              <TextField
                label="Description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                multiline
                rows={3}
                fullWidth
                placeholder="Detailed description of functional requirements..."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button disabled={creating} onClick={() => setCreateOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" loading={creating}>
              Create Feature
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => !updating && setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Feature Status</DialogTitle>
        <Box component="form" onSubmit={handleUpdateFeature}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {selectedFeature?.title}
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  value={newStatus}
                  label="Status"
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <MenuItem value={FEATURE_STATUS.PLANNED}>Planned</MenuItem>
                  <MenuItem value={FEATURE_STATUS.IN_PROGRESS}>In Progress</MenuItem>
                  <MenuItem value={FEATURE_STATUS.COMPLETED}>Completed</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button disabled={updating} onClick={() => setEditOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" loading={updating}>
              Save Changes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

// ── Tab 5: Project Change Requests ───────────────────────────────────────────
const ProjectChangeRequestsTab = ({ projectId }) => {
  const showToast = useToastStore((s) => s.showToast);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review Modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedCr, setSelectedCr] = useState(null);
  const [note, setNote] = useState('');
  const [action, setAction] = useState('approved');
  const [submitting, setSubmitting] = useState(false);

  const fetchChangeRequests = async () => {
    setLoading(true);
    try {
      const data = await listChangeRequests(projectId);
      setChangeRequests(data);
    } catch (err) {
      showToast('Failed to load change requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchChangeRequests();
      const interval = setInterval(fetchChangeRequests, 15000);
      return () => clearInterval(interval);
    }
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
        version: selectedCr.version,
      });
      showToast(`Change request ${action} successfully!`, 'success');
      setReviewOpen(false);
      fetchChangeRequests();
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.response?.data?.code === 'STALE_VERSION';
      if (isConflict) {
        showToast('Someone else reviewed this request. Refreshing list...', 'error');
        setReviewOpen(false);
        fetchChangeRequests();
      } else {
        showToast(err.response?.data?.detail || 'Failed to submit review.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />;

  return (
    <Box>
      {changeRequests.length === 0 ? (
        <EmptyState
          title="No Change Requests"
          description="No requirement modification requests have been submitted for this project yet."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table aria-label="project-cr-table">
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

              <Box sx={{ p: 2, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                  ARIA AI Impact Analysis Report
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: 'text.primary' }}>
                  {selectedCr?.impact_report || 'Impact analysis is currently being processed by background worker tasks...'}
                </Typography>
              </Box>

              {selectedCr?.status === CHANGE_REQUEST_STATUS.PENDING ? (
                <>
                  <Divider />
                  <FormControl fullWidth>
                    <InputLabel id="cr-action-label">Review Action</InputLabel>
                    <Select
                      labelId="cr-action-label"
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
    </Box>
  );
};

// ── Tab 6: Project SRS Documents ──────────────────────────────────────────────
const ProjectSRSTab = ({ projectId }) => {
  const showToast = useToastStore((s) => s.showToast);
  const [activeSrs, setActiveSrs] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSrsData = async () => {
    setLoading(true);
    try {
      const latest = await getLatestSrs(projectId);
      setActiveSrs(latest);
      const list = await listSrsVersions(projectId);
      setVersions(list);
    } catch (err) {
      setActiveSrs(null);
      setVersions([]);
      if (err.response?.status !== 404) {
        showToast('Error loading SRS document versions.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchSrsData();
  }, [projectId]);

  const handleGenerateSrs = async () => {
    setGenerating(true);
    try {
      await generateProjectSrs(projectId);
      showToast('SRS document generated successfully!', 'success');
      await fetchSrsData();
    } catch (err) {
      showToast('Failed to generate SRS document.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectVersion = async (vItem) => {
    if (!vItem) return;
    try {
      const details = await getSrsVersionDetails(vItem.id);
      setActiveSrs(details);
    } catch (err) {
      setActiveSrs({
        id: vItem.id,
        version: vItem.version,
        created_at: vItem.created_at,
        download_url: vItem.file_url,
      });
    }
  };

  if (loading) return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Software Requirements Specification (SRS)
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {versions.length > 0 && (
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="srs-version-label">Revision Version</InputLabel>
              <Select
                labelId="srs-version-label"
                value={activeSrs?.id || ''}
                label="Revision Version"
                onChange={(e) => {
                  const sel = versions.find((v) => v.id === e.target.value);
                  if (sel) handleSelectVersion(sel);
                }}
              >
                {versions.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    Version v{v.version} ({formatDateTime(v.created_at)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button
            variant="contained"
            startIcon={<DescriptionIcon />}
            onClick={handleGenerateSrs}
            loading={generating}
          >
            Generate SRS Document
          </Button>
        </Stack>
      </Stack>

      {!activeSrs ? (
        <EmptyState
          title="No SRS Documents Generated"
          description="This project does not have any generated requirements specs yet. Click below to generate the initial SRS draft!"
          actionLabel="Generate SRS Now"
          onAction={handleGenerateSrs}
        />
      ) : (
        <Stack spacing={4}>
          <SRSViewer srsData={activeSrs} onShowHistory={null} />
          {versions.length > 1 && (
            <VersionHistory
              versions={versions}
              onSelectVersion={handleSelectVersion}
              currentVersionId={activeSrs?.id}
            />
          )}
        </Stack>
      )}
    </Box>
  );
};

// ── Tab 7: LLM Cost Governance ────────────────────────────────────────────────
const LLMCostTab = ({ projectId }) => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    getLLMUsage(projectId)
      .then((data) => setUsage(data))
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />;

  if (!usage || !usage.breakdown?.length) {
    return (
      <EmptyState
        title="No LLM Usage Recorded"
        description="Token and cost data will appear here once ARIA processes messages in this project."
      />
    );
  }

  const { breakdown, summary } = usage;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>LLM Cost &amp; Token Governance</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Breakdown of Groq API usage by endpoint. Costs are estimated based on per-token pricing.
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">Total Prompt Tokens</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{summary.total_prompt_tokens.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">Total Completion Tokens</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{summary.total_completion_tokens.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: '#F0FDF4' }}>
            <Typography variant="caption" color="text.secondary">Estimated Total Cost</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#16a34a' }}>
              ${summary.total_estimated_cost_usd?.toFixed(4) ?? '0.0000'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table aria-label="llm-usage-table">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell><strong>Endpoint</strong></TableCell>
              <TableCell align="right"><strong>Calls</strong></TableCell>
              <TableCell align="right"><strong>Prompt Tokens</strong></TableCell>
              <TableCell align="right"><strong>Completion Tokens</strong></TableCell>
              <TableCell align="right"><strong>Est. Cost (USD)</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {breakdown.map((row) => (
              <TableRow key={row.endpoint}>
                <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem' }}>{row.endpoint}</TableCell>
                <TableCell align="right">{row.total_calls}</TableCell>
                <TableCell align="right">{row.total_prompt_tokens.toLocaleString()}</TableCell>
                <TableCell align="right">{row.total_completion_tokens.toLocaleString()}</TableCell>
                <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 600 }}>
                  ${row.estimated_cost_usd.toFixed(6)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ── Tab 0: Project Dashboard Overview ─────────────────────────────────────────
const ProjectDashboardTab = ({ project, sessions, contradictions, atoms, engagement }) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Project Overview & Analytics
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">System Domain</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
              {PROJECT_DOMAIN_LABELS[project?.domain] || project?.domain || 'Web App'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">Total Gathering Sessions</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
              {sessions.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">Extracted Requirements</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
              {atoms.length} Atoms
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {engagement && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Client Engagement Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Messages sent</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{engagement.messages_sent ?? 0}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Avg response (s)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {engagement.avg_response_time_seconds != null
                  ? Math.round(engagement.avg_response_time_seconds)
                  : '—'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Sessions completed</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{engagement.sessions_completed ?? 0}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Last active</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                {engagement.last_active ? formatDateTime(engagement.last_active) : '—'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

// ── Main ProjectDetail Component ──────────────────────────────────────────────
export const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { setActiveProject } = useProjectStore();

  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [contradictions, setContradictions] = useState([]);
  const [atoms, setAtoms] = useState([]);
  const [engagement, setEngagement] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);

  // Chroma similarity threshold (tunable by developer)
  const [chromaThreshold, setChromaThreshold] = useState(0.3);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const handleSaveThreshold = useCallback(async (newValue) => {
    setSavingThreshold(true);
    try {
      await updateProject(projectId, { chroma_similarity_threshold: newValue });
      showToast(`Similarity threshold updated to ${newValue}`, 'success');
    } catch {
      showToast('Failed to update similarity threshold.', 'error');
    } finally {
      setSavingThreshold(false);
    }
  }, [projectId, showToast]);

  const [selectedContradiction, setSelectedContradiction] = useState(null);
  const [resolving, setResolving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLookup, setInviteLookup] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteStep, setInviteStep] = useState('lookup');

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const proj = await getProject(projectId);
      setProject(proj);
      setActiveProject(proj);
      // Sync local chroma threshold from project
      if (proj?.chroma_similarity_threshold != null) {
        setChromaThreshold(proj.chroma_similarity_threshold);
      }

      const sessList = await listSessionsForProject(projectId);
      setSessions(sessList);

      try {
        const summary = await getProjectSummary(projectId);
        setEngagement(summary);
      } catch {
        setEngagement(null);
      }

      const [contradictionsRes, atomsRes] = await Promise.all([
        axios.get(`/contradictions/project/${projectId}`).catch(() => ({ data: [] })),
        axios.get(`/requirement-atoms/project/${projectId}`).catch(() => ({ data: [] })),
      ]);
      setContradictions(contradictionsRes.data || []);
      setAtoms(atomsRes.data || []);
    } catch (err) {
      showToast('Error loading project details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();

    const interval = setInterval(() => {
      if (projectId) {
        axios.get(`/contradictions/project/${projectId}`)
          .then((res) => setContradictions(res.data || []))
          .catch(() => {});
        axios.get(`/requirement-atoms/project/${projectId}`)
          .then((res) => setAtoms(res.data || []))
          .catch(() => {});
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [projectId]);

  const handleResolveContradiction = (contradiction) => {
    setSelectedContradiction(contradiction);
  };

  const handleResolveSubmit = async (id, resolveData) => {
    setResolving(true);
    try {
      await resolveContradiction(id, resolveData);
      showToast('Contradiction resolved successfully!', 'success');
      setSelectedContradiction(null);
      fetchProjectDetails();
    } catch (err) {
      showToast('Failed to resolve contradiction.', 'error');
    } finally {
      setResolving(false);
    }
  };

  const resetInviteDialog = () => {
    setInviteEmail('');
    setInviteLookup(null);
    setInviteStep('lookup');
    setInviteBusy(false);
  };

  const handleInviteLookup = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast('Enter an email address.', 'error');
      return;
    }
    setInviteBusy(true);
    try {
      const user = await lookupUserByEmail(email);
      if (user.role !== 'client') {
        showToast(
          `That account is a ${user.role}, not a client. Each email has one role — invite a client email instead.`,
          'error',
        );
        setInviteLookup(null);
        setInviteStep('lookup');
        return;
      }
      setInviteLookup(user);
      setInviteStep('found');
    } catch (err) {
      if (err.response?.status === 404) {
        setInviteLookup(null);
        setInviteStep('not_found');
      } else {
        showToast(err.response?.data?.detail || 'Lookup failed.', 'error');
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const handleAddExistingClient = async () => {
    if (!inviteLookup?.id) return;
    setInviteBusy(true);
    try {
      await addClientToProject(projectId, inviteLookup.id);
      showToast(`${inviteLookup.name} was added to the project.`, 'success');
      setInviteOpen(false);
      resetInviteDialog();
      fetchProjectDetails();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add client.', 'error');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleSendSignupInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    setInviteBusy(true);
    try {
      await createProjectInvite(projectId, { email, role: 'client' });
      showToast(`Signup invite sent to ${email}.`, 'success');
      setInviteOpen(false);
      resetInviteDialog();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to send invite.', 'error');
    } finally {
      setInviteBusy(false);
    }
  };

  if (loading && !project) {
    return (
      <Layout>
        <Box sx={{ py: 4 }}>
          <Skeleton variant="text" height={40} width="30%" />
          <Skeleton variant="rectangular" height={250} sx={{ mt: 2, borderRadius: 2 }} />
        </Box>
      </Layout>
    );
  }

  const menuItems = [
    { text: 'Project Dashboard', icon: <DashboardIcon /> },
    { text: 'Chat Sessions', icon: <ChatIcon />, badge: sessions.length },
    { text: 'Contradictions', icon: <WarningIcon />, badge: contradictions.length },
    { text: 'Extracted Atoms', icon: <ListAltIcon />, badge: atoms.length },
    { text: 'Feature Status', icon: <CheckCircleOutlineIcon /> },
    { text: 'Change Requests', icon: <RateReviewIcon /> },
    { text: 'SRS Document', icon: <DescriptionIcon /> },
    { text: 'LLM Cost & Usage', icon: <ListAltIcon /> },
  ];

  return (
    <Layout>
      <ClosureBanner project={project} onUpdated={setProject} />
      
      <Grid container spacing={3} sx={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* Left Side: Internal Project Navigation Panel */}
        <Grid item xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Back to Dashboard
            </Button>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, flexGrow: 1, overflowY: 'auto' }}>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {project?.name}
                  </Typography>
                  <Badge label={project?.status || 'active'} type="feature" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {project?.description || 'No description provided.'}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <List component="nav" disablePadding>
                {menuItems.map((item, idx) => {
                  const isSelected = tabValue === idx;
                  return (
                    <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        selected={isSelected}
                        onClick={() => setTabValue(idx)}
                        sx={{
                          borderRadius: 2,
                          color: isSelected ? 'secondary.main' : 'text.primary',
                          '&.Mui-selected': {
                            bgcolor: 'action.selected',
                            color: 'secondary.main',
                            fontWeight: 700,
                            '& .MuiListItemIcon-root': { color: 'secondary.main' },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: isSelected ? 'secondary.main' : 'text.secondary' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{
                            fontSize: '0.9rem',
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        />
                        {item.badge !== undefined && (
                          <Typography variant="caption" sx={{ ml: 1, fontWeight: 700, color: 'text.secondary' }}>
                            ({item.badge})
                          </Typography>
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>

              <Divider sx={{ my: 2 }} />

              {/* Chroma Similarity Threshold Tuning */}
              <Box sx={{ px: 1, pb: 2 }}>
                <Tooltip
                  title="Controls how similar two requirements must be before ARIA checks for contradiction. Lower = stricter matching, fewer false positives. Higher = catches more potential conflicts."
                  placement="right"
                  arrow
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1, cursor: 'help', textDecoration: 'underline dotted' }}>
                    Contradiction Sensitivity
                  </Typography>
                </Tooltip>
                <Slider
                  value={chromaThreshold}
                  onChange={(_, val) => setChromaThreshold(val)}
                  onChangeCommitted={(_, val) => handleSaveThreshold(val)}
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${(v * 100).toFixed(0)}%`}
                  marks={[
                    { value: 0.1, label: 'Strict' },
                    { value: 0.5, label: 'Balanced' },
                    { value: 0.9, label: 'Loose' },
                  ]}
                  disabled={savingThreshold}
                  color="secondary"
                  size="small"
                />
                <Typography variant="caption" color="text.secondary">
                  Current: {(chromaThreshold * 100).toFixed(0)}% — changes auto-save
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Invited Clients
              </Typography>
              <ProjectClientsList projectId={projectId} refreshKey={sessions.length} />

              <Divider sx={{ my: 1 }} />

              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => {
                  resetInviteDialog();
                  setInviteOpen(true);
                }}
                fullWidth
                size="medium"
              >
                Invite Client
              </Button>
            </Paper>
          </Stack>
        </Grid>

        {/* Right Side: Main Content Area */}
        <Grid item xs={12} md={9}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, minHeight: '100%' }}>
            {tabValue === 0 && (
              <ProjectDashboardTab
                project={project}
                sessions={sessions}
                contradictions={contradictions}
                atoms={atoms}
                engagement={engagement}
              />
            )}

            {tabValue === 1 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Gathering Sessions History
                </Typography>
                {sessions.length === 0 ? (
                  <EmptyState
                    title="No Sessions Recorded"
                    description="No client gathering sessions have been started for this project yet."
                  />
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table aria-label="sessions-table">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell><strong>#</strong></TableCell>
                          <TableCell><strong>Status</strong></TableCell>
                          <TableCell><strong>Stability</strong></TableCell>
                          <TableCell><strong>Msg Count</strong></TableCell>
                          <TableCell><strong>Started At</strong></TableCell>
                          <TableCell align="right"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sessions.map((sess, idx) => (
                          <TableRow key={sess.id}>
                            <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>#{idx + 1}</TableCell>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{sess.status}</TableCell>
                            <TableCell>{sess.stability_score ? `${Math.round(sess.stability_score)}%` : '100%'}</TableCell>
                            <TableCell>{sess.total_messages ?? 0}</TableCell>
                            <TableCell>{formatDateTime(sess.started_at)}</TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(`/client/sessions/${sess.id}`)}
                              >
                                Watch Session
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {tabValue === 2 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Detected Requirement Contradictions
                </Typography>
                {contradictions.length === 0 ? (
                  <EmptyState
                    title="No Contradictions Found"
                    description="ARIA has not detected any contradictions or requirement conflicts in this project."
                  />
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table aria-label="contradictions-table">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell><strong>Source</strong></TableCell>
                          <TableCell><strong>Conflict Type</strong></TableCell>
                          <TableCell><strong>Confidence</strong></TableCell>
                          <TableCell><strong>Aria Warning Message</strong></TableCell>
                          <TableCell><strong>Status</strong></TableCell>
                          <TableCell><strong>False +ve</strong></TableCell>
                          <TableCell><strong>Detected Date</strong></TableCell>
                          <TableCell align="right"><strong>Override</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contradictions.map((c) => (
                          <TableRow key={c.id} sx={c.is_false_positive ? { opacity: 0.6 } : {}}>
                            <TableCell>
                              <Chip
                                size="small"
                                label={c.source === 'change_request' ? 'Change Request' : 'Live Chat'}
                                color={c.source === 'change_request' ? 'secondary' : 'default'}
                                variant="outlined"
                                sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                              />
                            </TableCell>
                            <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                              {c.conflict_type?.replace(/_/g, ' ') || 'direct contradiction'}
                            </TableCell>
                            <TableCell>{c.confidence != null ? `${Math.round(c.confidence * 100)}%` : 'N/A'}</TableCell>
                            <TableCell sx={{ maxWidth: 280 }}>{c.aria_message}</TableCell>
                            <TableCell>
                              <Badge label={c.status} type="conflict" />
                            </TableCell>
                            <TableCell>
                              {c.is_false_positive ? (
                                <Tooltip title="Tagged as AI False Positive" arrow>
                                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>FP</Typography>
                                </Tooltip>
                              ) : '—'}
                            </TableCell>
                            <TableCell>{formatDateTime(c.detected_at)}</TableCell>
                            <TableCell align="right">
                              {c.status === 'pending' ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  onClick={() => handleResolveContradiction(c)}
                                >
                                  Resolve
                                </Button>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  {c.is_false_positive ? 'False Positive' : 'Resolved'}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {tabValue === 3 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Extracted Requirement Atoms
                </Typography>
                {atoms.length === 0 ? (
                  <EmptyState
                    title="No Extracted Atoms"
                    description="No requirements atoms have been processed for this project yet."
                  />
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table aria-label="atoms-table">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell><strong>Subject</strong></TableCell>
                          <TableCell><strong>Action</strong></TableCell>
                          <TableCell><strong>Constraints</strong></TableCell>
                          <TableCell><strong>Raw Source Sentence</strong></TableCell>
                          <TableCell><strong>Status</strong></TableCell>
                          <TableCell><strong>Extracted At</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {atoms.map((atom) => (
                          <TableRow key={atom.id}>
                            <TableCell sx={{ fontWeight: 600 }}>{atom.subject || 'N/A'}</TableCell>
                            <TableCell>{atom.action || 'N/A'}</TableCell>
                            <TableCell>{atom.constraint_text || 'N/A'}</TableCell>
                            <TableCell sx={{ maxWidth: 300 }}>{atom.raw_text}</TableCell>
                            <TableCell>
                              <Badge label={atom.status || 'active'} type="feature" />
                            </TableCell>
                            <TableCell>{formatDateTime(atom.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {tabValue === 4 && <ProjectFeatureTrackerTab projectId={projectId} />}
            {tabValue === 5 && <ProjectChangeRequestsTab projectId={projectId} />}
            {tabValue === 6 && <ProjectSRSTab projectId={projectId} />}
            {tabValue === 7 && <LLMCostTab projectId={projectId} />}
          </Paper>
        </Grid>
      </Grid>

      <ConflictOverridePanel
        open={Boolean(selectedContradiction)}
        contradiction={selectedContradiction}
        onClose={() => setSelectedContradiction(null)}
        onResolveSubmit={handleResolveSubmit}
        loading={resolving}
      />

      <Dialog
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          resetInviteDialog();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Invite Client</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Look up an existing client in your organization by email, or send a one-time signup invite.
          </Typography>
          <TextField
            label="Client email"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setInviteStep('lookup');
              setInviteLookup(null);
            }}
            disabled={inviteBusy}
            sx={{ mt: 1 }}
          />
          {inviteStep === 'found' && inviteLookup && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Found <strong>{inviteLookup.name}</strong> ({inviteLookup.email}). Add them to this project?
            </Alert>
          )}
          {inviteStep === 'not_found' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No account with that email in your organization. Send a signup invite link instead?
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              setInviteOpen(false);
              resetInviteDialog();
            }}
            disabled={inviteBusy}
          >
            Cancel
          </Button>
          {inviteStep === 'lookup' && (
            <Button variant="contained" onClick={handleInviteLookup} loading={inviteBusy}>
              Look up
            </Button>
          )}
          {inviteStep === 'found' && (
            <Button variant="contained" onClick={handleAddExistingClient} loading={inviteBusy}>
              Add to project
            </Button>
          )}
          {inviteStep === 'not_found' && (
            <Button variant="contained" onClick={handleSendSignupInvite} loading={inviteBusy}>
              Send signup invite
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default ProjectDetail;
