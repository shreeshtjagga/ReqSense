import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { getProject } from '../../api/projects';
import { listSessionsForProject, createSession } from '../../api/sessions';
import { createChangeRequest, listChangeRequests } from '../../api/changeRequests';
import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime } from '../../utils/helpers';
import { SEVERITIES, PROJECT_DOMAIN_LABELS } from '../../utils/constants';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RateReviewIcon from '@mui/icons-material/RateReview';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CommentIcon from '@mui/icons-material/Comment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// ── Project Overview Tab ──────────────────────────────────────────────────────
const ProjectOverviewTab = ({ project, sessions }) => {

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Project Overview & Status
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">System Domain</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
              {PROJECT_DOMAIN_LABELS[project?.domain] || project?.domain || 'Web App'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">Gathering Sessions</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
              {sessions.length} Recorded Sessions
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


// ── Chat Sessions Tab ─────────────────────────────────────────────────────────
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
      showToast('Failed to start a session. Please try again.', 'error');
    } finally {
      setStarting(false);
    }
  };

  if (loadingSessions) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Your Gathering Sessions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleStartSession}
          loading={starting}
        >
          {sessions.some((s) => s.status === 'active') ? 'Resume Active Session' : 'Start New Session'}
        </Button>
      </Stack>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<SmartToyIcon sx={{ fontSize: 48 }} />}
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
                return (
                  <TableRow key={sess.id} hover>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      #{idx + 1}
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

// ── Change Request Tab ────────────────────────────────────────────────────────
const ChangeRequestTab = ({ projectId, project, onCancel }) => {
  const showToast = useToastStore((s) => s.showToast);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [features, setFeatures] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await listChangeRequests(projectId);
      setRequests(data || []);
    } catch (err) {
      showToast('Failed to load change requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) {
      showToast('Please fill in the title and description.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const affectedFeatures = features
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      await createChangeRequest({
        project_id: projectId,
        title,
        description,
        severity,
        affected_features: affectedFeatures,
      });

      showToast('Change request submitted successfully!', 'success');
      setTitle('');
      setDescription('');
      setSeverity('medium');
      setFeatures('');
      setShowForm(false);
      fetchRequests();
    } catch (err) {
      console.error('[ChangeRequest] Submit error:', err);
      const detail = err.response?.data?.detail || 'Failed to submit change request. Please try again.';
      const reqId = err.response?.data?.request_id;
      showToast(reqId ? `${detail} (ref: ${reqId.slice(0, 8)})` : detail, 'error');
    } finally {
      setSubmitting(false);
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
        return <Chip label="High Severity" color="error" variant="outlined" size="small" sx={{ fontWeight: 600 }} />;
      case 'medium':
        return <Chip label="Medium Severity" color="warning" variant="outlined" size="small" sx={{ fontWeight: 600 }} />;
      case 'low':
      default:
        return <Chip label="Low Severity" color="info" variant="outlined" size="small" sx={{ fontWeight: 600 }} />;
    }
  };

  const parseFeatures = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return [raw];
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Change Requests ({requests.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track status, developer reviews, and submit new modification requests for <strong>{project?.name || 'this project'}</strong>.
          </Typography>
        </Box>
        <Button
          variant={showForm ? 'outlined' : 'contained'}
          color={showForm ? 'inherit' : 'primary'}
          startIcon={showForm ? undefined : <AddIcon />}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close Form' : '+ Raise Change Request'}
        </Button>
      </Stack>

      {/* ── Submission Form ────────────────────────────────────────────── */}
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
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
            Submit a New Change Request
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Request Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                fullWidth
                placeholder="e.g. Add multi-factor authentication or support non-financial data"
              />

              <TextField
                label="Description of Change"
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                fullWidth
                placeholder="Describe what requirements should be updated and why…"
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="severity-label">Estimated Severity</InputLabel>
                    <Select
                      labelId="severity-label"
                      value={severity}
                      label="Estimated Severity"
                      onChange={(e) => setSeverity(e.target.value)}
                    >
                      <MenuItem value={SEVERITIES.LOW}>Low — Minor wording or UI tweak</MenuItem>
                      <MenuItem value={SEVERITIES.MEDIUM}>Medium — New rule or condition</MenuItem>
                      <MenuItem value={SEVERITIES.HIGH}>High — Core architectural change</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Affected Features (comma-separated)"
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    fullWidth
                    placeholder="e.g. Authentication, Billing, Dashboard"
                  />
                </Grid>
              </Grid>

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

      {/* ── List / Cards of Submitted Requests ──────────────────────────── */}
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
                      {getSeverityChip(cr.severity)}
                      {getStatusChip(cr.status)}
                    </Stack>
                  </Stack>

                  <Typography variant="body2" color="text.primary" sx={{ mb: 2, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {cr.description}
                  </Typography>

                  {/* Affected Features Tags */}
                  {featList.length > 0 && (
                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
                        Affected Features:
                      </Typography>
                      {featList.map((f, i) => (
                        <Chip key={i} label={f} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                      ))}
                    </Stack>
                  )}

                  {/* Developer Note Callout (Approve/Reject Reason) */}
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

                  {/* AI Impact Report (if available) */}
                  {cr.impact_report && (
                    <Accordion variant="outlined" sx={{ mt: 1.5, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <SmartToyIcon sx={{ fontSize: 18, color: cr.impact_report.includes('Requirement Conflicts Detected') ? 'warning.main' : 'primary.main' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: cr.impact_report.includes('Requirement Conflicts Detected') ? 'warning.dark' : 'primary.main' }}>
                            {cr.impact_report.includes('Requirement Conflicts Detected') ? 'AI Impact & Requirement Conflict Analysis' : 'AI Impact Analysis'}
                          </Typography>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        {cr.impact_report.includes('Requirement Conflicts Detected') ? (
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mb: 1.5 }}>
                              {cr.impact_report.split('⚠ Requirement Conflicts Detected')[0].trim()}
                            </Typography>
                            <Paper
                              elevation={0}
                              sx={{
                                p: 1.5,
                                bgcolor: '#FFFBEB',
                                border: '1px solid #FCD34D',
                                borderRadius: 2,
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#92400E', display: 'block', mb: 0.5 }}>
                                ⚠ Requirement Conflicts Detected:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#78350F', whiteSpace: 'pre-line' }}>
                                {cr.impact_report.split('⚠ Requirement Conflicts Detected')[1]?.replace(/^ by RDCD:\n?|^:\n?/, '').trim()}
                              </Typography>
                            </Paper>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                            {cr.impact_report}
                          </Typography>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

// ── Main ClientProjectHub page ────────────────────────────────────────────────
export const ClientProjectHub = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const { setActiveProject } = useProjectStore();

  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
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

  useEffect(() => {
    loadProject();
    loadSessions();
  }, [projectId]);

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

  const menuItems = [
    { text: 'Project Overview', icon: <DashboardIcon /> },
    { text: 'Chat with ARIA', icon: <ChatIcon />, badge: sessions.some((s) => s.status === 'active') ? '●' : sessions.length },
    { text: 'Submit Change Request', icon: <RateReviewIcon /> },
  ];

  return (
    <Layout>
      <Grid container spacing={3} sx={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* Left Side: Internal Navigation Side Panel */}
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
          </Stack>
        </Grid>

        {/* Right Side: Main Content Area */}
        <Grid item xs={12} md={9}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, minHeight: '100%' }}>
            {tabValue === 0 && (
              <ProjectOverviewTab
                project={project}
                sessions={sessions}
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
            {tabValue === 2 && <ChangeRequestTab projectId={projectId} project={project} onCancel={() => setTabValue(0)} />}
          </Paper>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default ClientProjectHub;
