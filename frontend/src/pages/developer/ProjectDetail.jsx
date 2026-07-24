import React, { useEffect, useState } from 'react';
import {
  Typography,
  Grid,
  Box,
  Alert,
  Skeleton,
  Tabs,
  Tab,
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
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ConflictOverridePanel from '../../components/chat/ConflictOverridePanel';
import EmailVerificationBanner from '../../components/common/EmailVerificationBanner';
import SRSViewer from '../../components/srs/SRSViewer';
import VersionHistory from '../../components/srs/VersionHistory';

import {
  getProject,
  addClientToProject,
  createProjectInvite,
  lookupUserByEmail,
} from '../../api/projects';
import { listSessionsForProject } from '../../api/sessions';
import { resolveContradiction } from '../../api/contradictions';
import { getProjectSummary } from '../../api/analytics';
import { listFeaturesForProject, updateFeatureStatus, createFeatureStatus } from '../../api/featureStatus';
import { listChangeRequests, reviewChangeRequest } from '../../api/changeRequests';
import { getLatestSrs, listSrsVersions, generateProjectSrs, getSrsVersionDetails } from '../../api/srs';

import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime } from '../../utils/helpers';
import { FEATURE_STATUS, CHANGE_REQUEST_STATUS } from '../../utils/constants';

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
    <Box sx={{ py: 2 }}>
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
    if (projectId) fetchChangeRequests();
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
    <Box sx={{ py: 2 }}>
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
    <Box sx={{ py: 2 }}>
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

      const sessList = await listSessionsForProject(projectId);
      setSessions(sessList);

      try {
        const summary = await getProjectSummary(projectId);
        setEngagement(summary);
      } catch {
        setEngagement(null);
      }

      try {
        const contradictionsRes = await axios.get(`/contradictions/project/${projectId}`);
        setContradictions(contradictionsRes.data || []);
      } catch (err) {
        const allContradictions = [];
        for (const s of sessList) {
          try {
            const res = await axios.get(`/contradictions/session/${s.id}`);
            if (res.data) allContradictions.push(...res.data);
          } catch (e) {}
        }
        setContradictions(allContradictions);
      }

      try {
        const atomsRes = await axios.get(`/requirement-atoms/project/${projectId}`);
        setAtoms(atomsRes.data || []);
      } catch (err) {
        const allAtoms = [];
        for (const s of sessList) {
          try {
            const res = await axios.get(`/requirement-atoms/session/${s.id}`);
            if (res.data) allAtoms.push(...res.data);
          } catch (e) {}
        }
        setAtoms(allAtoms);
      }
    } catch (err) {
      showToast('Error loading project details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

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

  return (
    <Layout>
      <EmailVerificationBanner />
      <Box sx={{ mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              resetInviteDialog();
              setInviteOpen(true);
            }}
          >
            Invite Client
          </Button>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h3" sx={{ fontWeight: 800 }}>
            {project?.name}
          </Typography>
          <Badge label={project?.status || 'active'} type="feature" />
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          {project?.description || 'No description provided.'}
        </Typography>
      </Box>

      {engagement && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Client Engagement
          </Typography>
          <Grid container spacing={2}>
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

      <Box sx={{ width: '100%', mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="project-details-tabs" variant="scrollable" scrollButtons="auto">
            <Tab icon={<ChatIcon />} label="Chat Sessions" sx={{ gap: 1 }} />
            <Tab icon={<WarningIcon />} label={`Contradictions (${contradictions.length})`} sx={{ gap: 1 }} />
            <Tab icon={<ListAltIcon />} label={`Extracted Atoms (${atoms.length})`} sx={{ gap: 1 }} />
            <Tab icon={<CheckCircleOutlineIcon />} label="Feature Status" sx={{ gap: 1 }} />
            <Tab icon={<RateReviewIcon />} label="Change Requests" sx={{ gap: 1 }} />
            <Tab icon={<DescriptionIcon />} label="SRS Document" sx={{ gap: 1 }} />
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <Box sx={{ py: 3 }}>
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

        {tabValue === 1 && (
          <Box sx={{ py: 3 }}>
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
                      <TableCell><strong>Conflict Type</strong></TableCell>
                      <TableCell><strong>Confidence</strong></TableCell>
                      <TableCell><strong>Aria Warning Message</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Detected Date</strong></TableCell>
                      <TableCell align="right"><strong>Override</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contradictions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                          {c.conflict_type?.replace('_', ' ') || 'direct_contradiction'}
                        </TableCell>
                        <TableCell>{c.confidence ? `${Math.round(c.confidence * 100)}%` : 'N/A'}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>{c.aria_message}</TableCell>
                        <TableCell>
                          <Badge label={c.status} type="conflict" />
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
                              Resolved by developer
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

        {tabValue === 2 && (
          <Box sx={{ py: 3 }}>
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

        {tabValue === 3 && <ProjectFeatureTrackerTab projectId={projectId} />}
        {tabValue === 4 && <ProjectChangeRequestsTab projectId={projectId} />}
        {tabValue === 5 && <ProjectSRSTab projectId={projectId} />}
      </Box>

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
