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
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ConflictOverridePanel from '../../components/chat/ConflictOverridePanel';
import EmailVerificationBanner from '../../components/common/EmailVerificationBanner';
import {
  getProject,
  addClientToProject,
  createProjectInvite,
  lookupUserByEmail,
} from '../../api/projects';
import { listSessionsForProject } from '../../api/sessions';
import { resolveContradiction } from '../../api/contradictions';
import { getProjectSummary } from '../../api/analytics';
import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime } from '../../utils/helpers';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListAltIcon from '@mui/icons-material/ListAlt';
import WarningIcon from '@mui/icons-material/Warning';
import ChatIcon from '@mui/icons-material/Chat';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import axios from '../../api/axios';

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
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="project-details-tabs">
            <Tab icon={<ChatIcon />} label="Chat Sessions" sx={{ gap: 1 }} />
            <Tab icon={<WarningIcon />} label={`Contradictions (${contradictions.length})`} sx={{ gap: 1 }} />
            <Tab icon={<ListAltIcon />} label={`Extracted Atoms (${atoms.length})`} sx={{ gap: 1 }} />
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
                      <TableCell><strong>Session ID</strong></TableCell>
                      <TableCell><strong>Client</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Stability</strong></TableCell>
                      <TableCell><strong>Msg Count</strong></TableCell>
                      <TableCell><strong>Started At</strong></TableCell>
                      <TableCell align="right"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sessions.map((sess) => (
                      <TableRow key={sess.id}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{sess.id}</TableCell>
                        <TableCell>{sess.client_name || 'Anonymous Client'}</TableCell>
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
