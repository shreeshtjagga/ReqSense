import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Grid,
  Stack,
  Paper,
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
  Chip,
  Skeleton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Badge,
  Button as MuiButton,
  Tooltip,
  Backdrop,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { getProject, requestDeleteProject } from '../../api/projects';
import { listSessionsForProject, createSession } from '../../api/sessions';
import { createChangeRequest, listChangeRequests, deleteChangeRequest } from '../../api/changeRequests';
import { listContradictionsForProject } from '../../api/contradictions';
import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime, formatChatTime } from '../../utils/helpers';
import { SEVERITIES, PROJECT_DOMAIN_LABELS } from '../../utils/constants';
import ClosureBanner from '../../components/common/ClosureBanner';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CommentIcon from '@mui/icons-material/Comment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const ProjectOverviewTab = ({ project, sessions, contradictions, onViewContradictions }) => {
  const pendingCount = contradictions.filter((c) => c.status === 'pending').length;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Project Overview & Status
      </Typography>

      {pendingCount > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="inherit" />}
          sx={{
            mb: 3,
            borderRadius: 2,
            border: '1px solid #FDE68A',
            '& .MuiAlert-message': { width: '100%' },
          }}
          action={
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={onViewContradictions}
              sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
            >
              View Details
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 700 }}>
            {pendingCount} Requirement Contradiction{pendingCount > 1 ? 's' : ''} Detected
          </AlertTitle>
          ARIA has flagged conflicting requirements in your project. Your developer is reviewing
          them. You can view the details in the Contradictions tab.
        </Alert>
      )}

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
            <Typography variant="caption" color="text.secondary">Gathering Sessions</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
              {sessions.length} Recorded
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              borderColor: pendingCount > 0 ? '#FCD34D' : undefined,
              bgcolor: pendingCount > 0 ? '#FFFBEB' : undefined,
              cursor: pendingCount > 0 ? 'pointer' : 'default',
            }}
            onClick={pendingCount > 0 ? onViewContradictions : undefined}
          >
            <Typography variant="caption" color="text.secondary">Contradictions</Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, mt: 0.5, color: pendingCount > 0 ? '#D97706' : 'text.primary' }}
            >
              {pendingCount > 0 ? `${pendingCount} Pending` : contradictions.length === 0 ? 'None' : 'All Resolved'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 4 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Project Description
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {project?.description || 'No detailed description provided for this project.'}
        </Typography>
      </Paper>
    </Box>
  );
};

const ChatSessionsTab = ({ projectId, project, sessions, loadingSessions, onRefresh }) => {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const [starting, setStarting] = useState(false);

  const handleStartSession = async () => {
    setStarting(true);
    try {
      const activeSession = sessions.find((s) => s.status === 'active');
      if (activeSession) {
        showToast('Resuming your active session…', 'info');
        navigate(`/client/sessions/${activeSession.id}`);
        return;
      }
      const session = await createSession({ project_id: projectId });
      showToast('New gathering session started!', 'success');
      navigate(`/client/sessions/${session.id}`);
    } catch (err) {
      console.error('[ClientProjectHub] Session creation failed:', err);
      const detail = err?.response?.data?.detail || 'Failed to start a session. Please try again.';
      showToast(detail, 'error');
    } finally {
      setStarting(false);
    }
  };

  if (loadingSessions) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />;
  }

  const activeSession = sessions.find((s) => s.status === 'active');

  const sessionOrderMap = React.useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      const timeA = new Date(a.started_at || a.created_at || 0).getTime();
      const timeB = new Date(b.started_at || b.created_at || 0).getTime();
      return timeA - timeB;
    });
    const map = {};
    sorted.forEach((sess, i) => {
      map[sess.id] = i + 1;
    });
    return map;
  }, [sessions]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            ARIA Requirement Gathering Sessions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chat with ARIA to describe features and extract structured project requirements.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AutoAwesomeIcon />}
          onClick={handleStartSession}
          loading={starting}
        >
          {activeSession ? 'Open Active ARIA Chat' : 'Start New ARIA Chat'}
        </Button>
      </Stack>

      {activeSession && (
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            borderColor: 'primary.main',
            bgcolor: '#F0F9FF',
            background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <AutoAwesomeIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0369A1' }}>
                  Active Gathering Session in Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Started {formatDateTime(activeSession.started_at || activeSession.created_at)} · {activeSession.total_messages || 0} message(s)
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate(`/client/sessions/${activeSession.id}`)}
              sx={{ fontWeight: 700 }}
            >
              Resume Chat Now
            </Button>
          </Stack>
        </Paper>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={<AutoAwesomeIcon sx={{ fontSize: 48, color: 'primary.main' }} />}
          title="No Sessions Yet"
          description={`You haven't started any requirement gathering sessions for ${project?.name || 'this project'} yet.`}
          actionLabel="Start First Session"
          onAction={handleStartSession}
        />
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Started At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Ended At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Messages</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((sess, idx) => {
                const isActive = sess.status === 'active';
                const sessionNum = sessionOrderMap[sess.id] || (sessions.length - idx);
                return (
                  <TableRow key={sess.id} hover>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      #{sessionNum}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isActive ? 'Active' : 'Completed'}
                        color={isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(sess.started_at || sess.created_at)}</TableCell>
                    <TableCell>{sess.ended_at ? formatDateTime(sess.ended_at) : '—'}</TableCell>
                    <TableCell>{sess.total_messages || 0}</TableCell>
                    <TableCell align="right">
                      {isActive ? (
                        <Button
                          variant="contained"
                          color="secondary"
                          size="small"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => navigate(`/client/sessions/${sess.id}`)}
                        >
                          Resume
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          color="inherit"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/client/sessions/${sess.id}`)}
                        >
                          View Transcript
                        </Button>
                      )}
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


const ImpactReportDisplay = ({ report }) => {
  if (!report) return null;

  const CONFLICT_MARKER = '⚠ Detected Requirement Conflicts:';
  const hasConflicts = report.includes(CONFLICT_MARKER);

  const summaryRaw = hasConflicts
    ? report.split(CONFLICT_MARKER)[0].replace('Architectural Impact Assessment:', '').replace('Reviewing requirement dependencies and consistency.', '').trim()
    : report.replace('Architectural Impact Assessment:', '').replace('Reviewing requirement dependencies and consistency.', '').trim();

  const conflictsRaw = hasConflicts
    ? report.split(CONFLICT_MARKER)[1]?.trim() || ''
    : '';

  const conflictItems = [];
  if (conflictsRaw) {
    const bullets = conflictsRaw.split(/\n\s*•\s+/).filter(Boolean);
    for (const bullet of bullets) {
      const withMatch = bullet.match(/Conflicts with:\s*"([^"]+)"/);
      const typeMatch = bullet.match(/\[([^\-]+)\s*-\s*(\d+)%\s*Confidence\]/);
      const noteMatch = bullet.match(/ARIA Note:\s*(.+)/s);
      conflictItems.push({
        existingReq: withMatch?.[1]?.trim() || bullet.substring(0, 80),
        conflictType: typeMatch?.[1]?.trim() || 'Conflict',
        confidence: typeMatch?.[2] ? parseInt(typeMatch[2]) : null,
        ariaNote: noteMatch?.[1]?.trim() || '',
      });
    }
  }

  const noConflictMsg = !hasConflicts && report.includes('None detected');

  return (
    <Box>
      {summaryRaw && !noConflictMsg && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: conflictItems.length > 0 ? 1.5 : 0, lineHeight: 1.7, fontSize: '0.85rem' }}>
          {summaryRaw}
        </Typography>
      )}

      {noConflictMsg && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
          <CheckCircleIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.dark', fontSize: '0.85rem' }}>
            No conflicts with existing requirements detected.
          </Typography>
        </Box>
      )}

      {conflictItems.length > 0 && (
        <Stack spacing={1.5}>
          {conflictItems.map((item, i) => (
            <Paper key={i} elevation={0} sx={{ p: 1.5, bgcolor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                <Chip label={item.conflictType} size="small" sx={{ bgcolor: '#FDE68A', color: '#92400E', fontWeight: 700, fontSize: '0.72rem' }} />
                {item.confidence !== null && (
                  <Typography variant="caption" sx={{ color: '#92400E', fontWeight: 600 }}>
                    {item.confidence}% confidence
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" sx={{ display: 'block', color: '#78350F', fontWeight: 600, mb: 0.5 }}>
                Conflicts with existing requirement:
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#92400E', mb: 0.75, fontStyle: 'italic' }}>
                "{item.existingReq}"
              </Typography>
              {item.ariaNote && (
                <Typography variant="caption" sx={{ display: 'block', color: '#78350F', lineHeight: 1.5 }}>
                  {item.ariaNote}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

const ChangeRequestTab = ({ projectId, project, onCancel, onContradictionsChanged }) => {
  const showToast = useToastStore((s) => s.showToast);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCrToDelete, setSelectedCrToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRequests = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      if (!projectId) {
        setLoading(false);
        return;
      }
      const data = await listChangeRequests(projectId);
      setRequests(data || []);
    } catch (err) {
      console.error('[ChangeRequest] fetch failed:', err);
      if (isInitial) {
        showToast('Failed to load change requests.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchRequests(true);
    const interval = setInterval(() => fetchRequests(false), 15000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Please fill in both the request title and description.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createChangeRequest({
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        affected_features: [],
      });

      showToast('Change request submitted! ARIA is analyzing impact & dependencies…', 'success');
      setTitle('');
      setDescription('');
      setShowForm(false);
      fetchRequests();
      if (onContradictionsChanged) {
        onContradictionsChanged();
      }
    } catch (err) {
      console.error('[ChangeRequest] Submit error:', err);
      const detail = err.response?.data?.detail || 'Failed to submit change request. Please try again.';
      const reqId = err.response?.data?.request_id;
      showToast(reqId ? `${detail} (ref: ${reqId.slice(0, 8)})` : detail, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (cr) => {
    setSelectedCrToDelete(cr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCrToDelete) return;
    setDeleting(true);
    try {
      await deleteChangeRequest(selectedCrToDelete.id);
      showToast('Change request and associated conflicts removed successfully.', 'success');
      setDeleteDialogOpen(false);
      setSelectedCrToDelete(null);
      fetchRequests();
      if (onContradictionsChanged) {
        onContradictionsChanged();
      }
    } catch (err) {
      console.error('[ChangeRequest] Delete error:', err);
      showToast(err.response?.data?.detail || 'Failed to delete change request.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusChip = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <Chip
            icon={<CheckCircleIcon fontSize="small" />}
            label="Approved"
            color="success"
            size="small"
            sx={{ fontWeight: 700 }}
          />
        );
      case 'rejected':
        return (
          <Chip
            icon={<CancelIcon fontSize="small" />}
            label="Rejected"
            color="error"
            size="small"
            sx={{ fontWeight: 700 }}
          />
        );
      case 'pending':
      default:
        return (
          <Chip
            icon={<HourglassEmptyIcon fontSize="small" />}
            label="Pending Review"
            color="warning"
            size="small"
            sx={{ fontWeight: 700 }}
          />
        );
    }
  };

  const getSeverityChip = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'high':
        return <Chip label="AI Severity: High" color="error" variant="outlined" size="small" sx={{ fontWeight: 700 }} />;
      case 'medium':
        return <Chip label="AI Severity: Medium" color="warning" variant="outlined" size="small" sx={{ fontWeight: 700 }} />;
      case 'low':
      default:
        return <Chip label="AI Severity: Low" color="info" variant="outlined" size="small" sx={{ fontWeight: 700 }} />;
    }
  };

  const parseFeatures = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { }
    return [raw];
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Full screen backdrop lock during change request submission */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          bgcolor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          textAlign: 'center',
          p: 3,
        }}
        open={submitting}
      >
        <CircularProgress color="primary" size={56} thickness={4} />
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
            Submitting & Analyzing Change Request…
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', maxWidth: 460 }}>
            ARIA is processing your request, analyzing project dependencies, and checking for requirement conflicts. Please wait.
          </Typography>
        </Box>
      </Backdrop>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Change Requests ({requests.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submit modification requests and track developer reviews for <strong>{project?.name || 'this project'}</strong>.
          </Typography>
        </Box>
        <Button
          variant={showForm ? 'outlined' : 'contained'}
          color={showForm ? 'inherit' : 'primary'}
          startIcon={showForm ? undefined : <AddIcon />}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close Form' : 'Raise Change Request'}
        </Button>
      </Stack>

      {/* Submission Form */}
      {showForm && (
        <Paper
          variant="outlined"
          sx={{
            p: 3.5,
            borderRadius: 3,
            mb: 4,
            borderColor: 'primary.main',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <AutoAwesomeIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Submit a New Change Request
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Describe what requirements should be added, changed, or removed. ARIA will automatically analyze your project, detect affected features, assess technical severity, and check for conflicts.
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Request Title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                fullWidth
                placeholder="e.g. Add SMS reminders for patient appointment cancellations"
                helperText="A clear, short title summarizing the business requirement"
              />

              <TextField
                label="Description of Change / Business Reason *"
                multiline
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                fullWidth
                placeholder="Explain what needs to change, the user scenario, or why this modification is required…"
                helperText="Provide business details — ARIA's AI Impact Engine will automatically identify affected modules, severity, and dependencies"
              />

              <Divider />

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button color="inherit" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" color="primary" loading={submitting}>
                  Submit Request
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      )}

      {/* Change Requests List */}
      {loading ? (
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
        </Stack>
      ) : requests.length === 0 ? (
        !showForm && (
          <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3 }}>
            <RateReviewIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              No Change Requests Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Need to adjust project requirements? Raise a change request for your developers to review.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowForm(true)}>
              Raise First Change Request
            </Button>
          </Paper>
        )
      ) : (
        <Stack spacing={2.5}>
          {requests.map((cr) => {
            const featList = parseFeatures(cr.affected_features);
            const isApproved = cr.status === 'approved';
            const isRejected = cr.status === 'rejected';

            return (
              <Card
                key={cr.id}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderColor: isApproved ? 'success.light' : isRejected ? 'error.light' : 'divider',
                  bgcolor: isApproved ? 'success.50' : isRejected ? 'error.50' : 'background.paper',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
                }}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={1.5} sx={{ mb: 1.5 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary' }}>
                        {cr.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted on {formatDateTime(cr.created_at)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {cr.severity && getSeverityChip(cr.severity)}
                      {getStatusChip(cr.status)}
                      <Tooltip title="Delete Change Request">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(cr)}
                          sx={{
                            bgcolor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            '&:hover': { bgcolor: '#FEE2E2', borderColor: '#F87171' },
                            p: 0.5,
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Typography variant="body2" color="text.primary" sx={{ mb: 2, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {cr.description}
                  </Typography>

                  {/* Affected Requirements */}
                  {featList.length > 0 && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
                          Affected Requirements:
                        </Typography>
                        {featList.map((f, i) => (
                          <Chip key={i} label={f} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.75rem', fontWeight: 600, bgcolor: '#EFF6FF' }} />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {}
                  {cr.developer_note && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        mt: 1.5,
                        borderRadius: 2,
                        bgcolor: isApproved ? '#E8F5E9' : isRejected ? '#FFEBEE' : '#FFF8E1',
                        border: '1px solid',
                        borderColor: isApproved ? '#A5D6A7' : isRejected ? '#EF9A9A' : '#FFE082',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <CommentIcon sx={{ fontSize: 18, color: isApproved ? 'success.main' : isRejected ? 'error.main' : 'warning.main' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isApproved ? 'success.dark' : isRejected ? 'error.dark' : 'warning.dark' }}>
                          Developer Feedback ({cr.reviewed_at ? formatDateTime(cr.reviewed_at) : 'Reviewed'})
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                        {cr.developer_note}
                      </Typography>
                    </Paper>
                  )}

                  {/* Impact Analysis */}
                  {cr.impact_report && (
                    <Accordion variant="outlined" sx={{ mt: 1.5, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="caption" sx={{
                          fontWeight: 700,
                          color: cr.impact_report.includes('Detected Requirement Conflicts') ? 'warning.dark' : 'text.secondary',
                        }}>
                          {cr.impact_report.includes('Detected Requirement Conflicts') ? '⚠ Impact Analysis — Conflicts Found' : 'Impact Analysis'}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <ImpactReportDisplay report={cr.impact_report} />
                      </AccordionDetails>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteForeverIcon color="error" /> Delete Change Request
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Are you sure you want to delete this change request?
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FAFC', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {selectedCrToDelete?.title}
            </Typography>
          </Paper>
          <Typography variant="caption" color="text.secondary">
            Deleting this change request will permanently remove it and any requirement conflict alerts associated with it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <MuiButton color="inherit" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </MuiButton>
          <MuiButton
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </MuiButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const CONFLICT_TYPE_LABELS = {
  direct_contradiction: 'Direct Contradiction',
  scope_conflict: 'Scope Conflict',
  value_conflict: 'Value Conflict',
  temporal_conflict: 'Temporal Conflict',
  priority_conflict: 'Priority Conflict',
};

const ContradictionsTab = ({ contradictions, loading }) => {
  if (loading) {
    return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />;
  }

  if (contradictions.length === 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Detected Contradictions
        </Typography>
        <EmptyState
          icon={<CheckCircleIcon sx={{ fontSize: 48, color: '#22C55E' }} />}
          title="No Contradictions Found"
          description="ARIA has not detected any conflicting requirements in your project. Great work keeping your requirements consistent!"
        />
      </Box>
    );
  }

  const pending = contradictions.filter((c) => c.status === 'pending');
  const resolved = contradictions.filter((c) => c.status !== 'pending');

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Detected Contradictions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        ARIA automatically flags conflicting requirements. Conflicting requirements remain strictly excluded from the official SRS specification until your development team reviews and approves resolution.
      </Typography>

      {pending.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#D97706', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon fontSize="small" />
            Pending Developer Review ({pending.length})
          </Typography>
          <Stack spacing={2}>
            {pending.map((c) => (
              <Paper
                key={c.id}
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  borderColor: '#FCD34D',
                  bgcolor: '#FFFBEB',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={CONFLICT_TYPE_LABELS[c.conflict_type] || c.conflict_type || 'Direct Contradiction'}
                      size="small"
                      sx={{ bgcolor: '#FDE68A', color: '#92400E', fontWeight: 700, fontSize: '0.75rem' }}
                    />
                    <Chip
                      icon={c.source === 'change_request' ? <RateReviewIcon fontSize="small" /> : <ChatIcon fontSize="small" />}
                      label={c.source === 'change_request' ? 'From Change Request' : 'From ARIA Chat'}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: '0.72rem', borderColor: '#D97706', color: '#92400E' }}
                    />
                  </Stack>
                  <Chip
                    icon={<HourglassEmptyIcon fontSize="small" />}
                    label="Awaiting Developer Review"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                  />
                </Stack>
                {c.aria_message && (
                  <Typography variant="body2" sx={{ color: '#78350F', mb: 1.5, lineHeight: 1.6 }}>
                    {c.aria_message}
                  </Typography>
                )}
                <Stack direction="row" spacing={2} sx={{ fontSize: '0.8rem', color: '#92400E', opacity: 0.85, mb: 1.5 }}>
                  {c.atom_1_text && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>Requirement A:</Typography>
                      <Typography variant="caption">{c.atom_1_text}</Typography>
                    </Box>
                  )}
                  {c.atom_2_text && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>Requirement B:</Typography>
                      <Typography variant="caption">{c.atom_2_text}</Typography>
                    </Box>
                  )}
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1, pt: 1, borderTop: '1px dashed #FDE68A' }}>
                  <Typography variant="caption" color="text.secondary">
                    Detected {formatChatTime(c.detected_at)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#92400E', fontWeight: 600, fontStyle: 'italic' }}>
                    🔒 Excluded from SRS document pending developer resolution
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {resolved.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#16A34A', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon fontSize="small" />
            Resolved by Developer ({resolved.length})
          </Typography>
          <Stack spacing={1.5}>
            {resolved.map((c) => (
              <Paper
                key={c.id}
                variant="outlined"
                sx={{ p: 2, borderRadius: 3, borderColor: '#BBF7D0', bgcolor: '#F0FDF4', opacity: 0.9 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ color: '#166534', fontWeight: 600 }}>
                      {CONFLICT_TYPE_LABELS[c.conflict_type] || 'Direct Contradiction'}
                    </Typography>
                    <Chip
                      icon={c.source === 'change_request' ? <RateReviewIcon fontSize="small" /> : <ChatIcon fontSize="small" />}
                      label={c.source === 'change_request' ? 'From Change Request' : 'From ARIA Chat'}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                    />
                  </Stack>
                  <Chip
                    label={c.status === 'resolved' ? '✓ Resolved by Developer' : 'Marked False Positive'}
                    size="small"
                    color={c.status === 'resolved' ? 'success' : 'default'}
                    sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                  />
                </Stack>
                {c.aria_message && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {c.aria_message}
                  </Typography>
                )}
                {c.resolution && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#15803D', fontWeight: 600 }}>
                    Developer Decision: {c.resolution}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {formatChatTime(c.resolved_at || c.detected_at)}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export const ClientProjectHub = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const { setActiveProject } = useProjectStore();

  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [contradictions, setContradictions] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingContradictions, setLoadingContradictions] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [starting, setStarting] = useState(false);

  const handleStartSession = async () => {
    setStarting(true);
    try {
      const activeSession = sessions.find((s) => s.status === 'active');
      if (activeSession) {
        showToast('Resuming your active session…', 'info');
        navigate(`/client/sessions/${activeSession.id}`);
        return;
      }
      const session = await createSession({ project_id: projectId });
      showToast('New gathering session started!', 'success');
      navigate(`/client/sessions/${session.id}`);
    } catch (err) {
      showToast('Failed to start a session. Please try again.', 'error');
    } finally {
      setStarting(false);
    }
  };

  const [requestingDeletion, setRequestingDeletion] = useState(false);

  const handleRequestDeletion = async () => {
    setRequestingDeletion(true);
    try {
      const updated = await requestDeleteProject(projectId);
      setProject(updated);
      showToast('Deletion request submitted. The developer must confirm to proceed.', 'info');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit deletion request.', 'error');
    } finally {
      setRequestingDeletion(false);
    }
  };

  const loadProject = async () => {
    try {
      setLoadingProject(true);
      const proj = await getProject(projectId);
      setProject(proj);
      setActiveProject(proj);
    } catch (err) {
      showToast('Failed to load project details.', 'error');
    } finally {
      setLoadingProject(false);
    }
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await listSessionsForProject(projectId);
      const sorted = (data || []).sort(
        (a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at)
      );
      setSessions(sorted);
    } catch (err) {
      showToast('Failed to load sessions.', 'error');
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadContradictions = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoadingContradictions(true);
      const data = await listContradictionsForProject(projectId);
      setContradictions(data || []);
    } catch (err) {

    } finally {
      if (isInitial) setLoadingContradictions(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadSessions();
      loadContradictions(true);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(() => loadContradictions(false), 15000);
    return () => clearInterval(interval);
  }, [projectId, loadContradictions]);

  if (loadingProject && !project) {
    return (
      <Layout>
        <Box sx={{ py: 4 }}>
          <Skeleton variant="text" height={40} width="30%" />
          <Skeleton variant="rectangular" height={250} sx={{ mt: 2, borderRadius: 2 }} />
        </Box>
      </Layout>
    );
  }

  const pendingContradictions = contradictions.filter((c) => c.status === 'pending').length;

  const menuItems = [
    { text: 'Project Overview', icon: <DashboardIcon /> },
    { text: 'Chat with ARIA', icon: <ChatIcon />, badge: sessions.some((s) => s.status === 'active') ? '●' : sessions.length },
    { text: 'Change Requests', icon: <RateReviewIcon /> },
    {
      text: 'Clarifications & Questions',
      icon: <WarningAmberIcon sx={{ color: pendingContradictions > 0 ? '#D97706' : undefined }} />,
      badge: pendingContradictions > 0 ? pendingContradictions : (contradictions.length > 0 ? contradictions.length : undefined),
      badgeColor: pendingContradictions > 0 ? '#D97706' : undefined,
    },
  ];

  return (
    <Layout>
      <ClosureBanner project={project} onUpdated={setProject} />
      <Grid container spacing={3} sx={{ minHeight: 'calc(100vh - 120px)' }}>
        {}
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
                    {project?.name || 'Project'}
                  </Typography>
                  {project?.status && (
                    <Chip
                      label={project.status}
                      size="small"
                      color={project.status === 'active' ? 'success' : 'default'}
                      sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                    />
                  )}
                </Stack>
                {project?.description && (
                  <Typography variant="caption" color="text.secondary">
                    {project.description}
                  </Typography>
                )}
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
            </Paper>

            {}
            <Box sx={{ mt: 'auto', pt: 1 }}>
              <Tooltip
                title={project?.deletion_requested_by
                  ? 'A deletion request is already pending'
                  : 'Request that this project be permanently deleted. The developer must also confirm.'}
                arrow
              >
                <span style={{ display: 'block' }}>
                  <MuiButton
                    fullWidth
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteForeverIcon fontSize="small" />}
                    disabled={requestingDeletion || Boolean(project?.deletion_requested_by)}
                    onClick={handleRequestDeletion}
                    sx={{
                      borderColor: 'error.light',
                      color: 'error.main',
                      '&:hover': { bgcolor: '#FEF2F2', borderColor: 'error.main' },
                    }}
                  >
                    {project?.deletion_requested_by ? 'Deletion Pending…' : 'Request Project Deletion'}
                  </MuiButton>
                </span>
              </Tooltip>
            </Box>
          </Stack>
        </Grid>

        {}
        <Grid item xs={12} md={9}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, minHeight: '100%' }}>
            {tabValue === 0 && (
              <ProjectOverviewTab
                project={project}
                sessions={sessions}
                contradictions={contradictions}
                onViewContradictions={() => setTabValue(3)}
              />
            )}
            {tabValue === 1 && (
              <ChatSessionsTab
                projectId={projectId}
                project={project}
                sessions={sessions}
                loadingSessions={loadingSessions}
                onRefresh={loadSessions}
              />
            )}
            {tabValue === 2 && (
              <ChangeRequestTab
                projectId={projectId}
                project={project}
                onCancel={() => setTabValue(0)}
                onContradictionsChanged={loadContradictions}
              />
            )}
            {tabValue === 3 && (
              <ContradictionsTab
                contradictions={contradictions}
                loading={loadingContradictions}
                onRefresh={loadContradictions}
              />
            )}
          </Paper>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default ClientProjectHub;
