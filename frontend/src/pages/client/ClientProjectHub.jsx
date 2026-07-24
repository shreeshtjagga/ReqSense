import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Grid,
  Stack,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { getProject } from '../../api/projects';
import { listSessionsForProject, createSession } from '../../api/sessions';
import { createChangeRequest } from '../../api/changeRequests';
import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime } from '../../utils/helpers';
import { SEVERITIES } from '../../utils/constants';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RateReviewIcon from '@mui/icons-material/RateReview';
import SmartToyIcon from '@mui/icons-material/SmartToy';

// ── Tab panel helper ──────────────────────────────────────────────────────────
const TabPanel = ({ children, value, index }) =>
  value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;

// ── Chat Sessions Tab ─────────────────────────────────────────────────────────
const ChatSessionsTab = ({ projectId, project, sessions, loadingSessions, onRefresh }) => {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const [starting, setStarting] = useState(false);

  const handleStartSession = async () => {
    setStarting(true);
    try {
      // Check for an already active session
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
          Your Sessions
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
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
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
const ChangeRequestTab = ({ projectId, project }) => {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [features, setFeatures] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

      showToast('Change request submitted! Impact analysis has been queued.', 'success');
      // Reset form
      setTitle('');
      setDescription('');
      setSeverity('medium');
      setFeatures('');
    } catch (err) {
      showToast('Failed to submit change request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        Submit a Change Request
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Request modifications to the requirements for <strong>{project?.name || 'this project'}</strong>.
        The system will automatically analyze scope and impact.
      </Typography>

      <Paper
        variant="outlined"
        sx={{ p: 4, borderRadius: 3, maxWidth: 640, border: '1px solid', borderColor: 'divider' }}
      >
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Request Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
              placeholder="e.g. Add multi-factor authentication"
            />

            <TextField
              label="Description of Change"
              multiline
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              fullWidth
              placeholder="Describe what requirements should be updated and why…"
            />

            <FormControl fullWidth>
              <InputLabel id="severity-label">Estimated Severity</InputLabel>
              <Select
                labelId="severity-label"
                value={severity}
                label="Estimated Severity"
                onChange={(e) => setSeverity(e.target.value)}
              >
                <MenuItem value={SEVERITIES.LOW}>Low — Minor wording or UI change</MenuItem>
                <MenuItem value={SEVERITIES.MEDIUM}>Medium — New rule or condition</MenuItem>
                <MenuItem value={SEVERITIES.HIGH}>High — Core feature redesign</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Affected Features (comma-separated)"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              fullWidth
              placeholder="e.g. Login, Authentication Flow, User Profiles"
              helperText="List the feature areas this change request impacts."
            />

            <Divider />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button color="inherit" onClick={() => navigate('/')}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary" loading={submitting}>
                Submit Request
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
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
      // Sort newest first
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

  return (
    <Layout>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>

        {loadingProject ? (
          <Skeleton variant="text" height={48} width="40%" />
        ) : (
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
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
        )}

        {!loadingProject && project?.description && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {project.description}
          </Typography>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            aria-label="project-hub-tabs"
          >
            <Tab icon={<ChatIcon />} label="Chat Sessions" iconPosition="start" />
            <Tab icon={<RateReviewIcon />} label="Change Request" iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ChatSessionsTab
            projectId={projectId}
            project={project}
            sessions={sessions}
            loadingSessions={loadingSessions}
            onRefresh={loadSessions}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ChangeRequestTab projectId={projectId} project={project} />
        </TabPanel>
      </Box>
    </Layout>
  );
};

export default ClientProjectHub;
