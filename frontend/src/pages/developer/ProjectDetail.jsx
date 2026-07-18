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
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ConflictOverridePanel from '../../components/chat/ConflictOverridePanel';
import { getProject } from '../../api/projects';
import { listSessionsForProject } from '../../api/sessions';
import { resolveContradiction } from '../../api/contradictions';
import { listMessages } from '../../api/messages'; // We can search for contradictions inside session messages, or load them from DB
import { useToastStore } from '../../store/toastStore';
import { useProjectStore } from '../../store/projectStore';
import { formatDateTime } from '../../utils/helpers';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListAltIcon from '@mui/icons-material/ListAlt';
import WarningIcon from '@mui/icons-material/Warning';
import ChatIcon from '@mui/icons-material/Chat';
import axios from '../../api/axios'; // We can fetch contradictions directly

export const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { setActiveProject } = useProjectStore();

  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [contradictions, setContradictions] = useState([]);
  const [atoms, setAtoms] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Resolve modal state
  const [selectedContradiction, setSelectedContradiction] = useState(null);
  const [resolving, setResolving] = useState(false);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const proj = await getProject(projectId);
      setProject(proj);
      setActiveProject(proj);

      const sessList = await listSessionsForProject(projectId);
      setSessions(sessList);

      // Load contradictions and requirement atoms
      // We'll call custom endpoints or list them via direct API requests if endpoints exist
      try {
        const contradictionsRes = await axios.get(`/contradictions/project/${projectId}`);
        setContradictions(contradictionsRes.data || []);
      } catch (err) {
        // Fallback: fetch contradictions via sessions
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
        // Fallback: load atoms from active sessions
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
      // Reload details
      fetchProjectDetails();
    } catch (err) {
      showToast('Failed to resolve contradiction.', 'error');
    } finally {
      setResolving(false);
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

      <Box sx={{ width: '100%', mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="project-details-tabs">
            <Tab icon={<ChatIcon />} label="Chat Sessions" sx={{ gap: 1 }} />
            <Tab icon={<WarningIcon />} label={`Contradictions (${contradictions.length})`} sx={{ gap: 1 }} />
            <Tab icon={<ListAltIcon />} label={`Extracted Atoms (${atoms.length})`} sx={{ gap: 1 }} />
          </Tabs>
        </Box>

        {/* Sessions Tab */}
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

        {/* Contradictions Tab */}
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

        {/* Requirement Atoms Tab */}
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

      {/* Resolve Override Panel Dialog */}
      <ConflictOverridePanel
        open={Boolean(selectedContradiction)}
        contradiction={selectedContradiction}
        onClose={() => setSelectedContradiction(null)}
        onResolveSubmit={handleResolveSubmit}
        loading={resolving}
      />
    </Layout>
  );
};

export default ProjectDetail;
