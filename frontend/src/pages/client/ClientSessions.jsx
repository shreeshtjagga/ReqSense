import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Skeleton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Chip,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { listProjects } from '../../api/projects';
import { listSessionsForProject } from '../../api/sessions';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/helpers';
import ChatIcon from '@mui/icons-material/Chat';
import AddIcon from '@mui/icons-material/Add';
import { createSession } from '../../api/sessions';
import { useProjectStore } from '../../store/projectStore';

export const ClientSessions = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const { user } = useAuthStore();
  const { setActiveProject } = useProjectStore();

  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null); // project id being started

  useEffect(() => {
    const load = async () => {
      try {
        const projectList = await listProjects();
        setProjects(projectList);

        // Load sessions from all projects this client is assigned to
        const allSessions = [];
        for (const p of projectList) {
          try {
            const projectSessions = await listSessionsForProject(p.id);
            // Attach project name for display
            projectSessions.forEach((s) => {
              allSessions.push({ ...s, projectName: p.name });
            });
          } catch (_) {
            // Skip projects where sessions can't be fetched
          }
        }
        // Sort newest first
        allSessions.sort(
          (a, b) => new Date(b.started_at) - new Date(a.started_at)
        );
        setSessions(allSessions);
      } catch (err) {
        showToast('Failed to load sessions.', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  const handleStartSession = async (project) => {
    setStarting(project.id);
    try {
      setActiveProject(project);
      const session = await createSession({ project_id: project.id });
      showToast('New session started!', 'success');
      navigate(`/client/sessions/${session.id}`);
    } catch (err) {
      showToast(
        err.response?.data?.detail || 'Failed to start session.',
        'error'
      );
    } finally {
      setStarting(null);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          My Chat Sessions
        </Typography>
        <Typography variant="body1" color="text.secondary">
          All your requirements-gathering sessions with ARIA across your
          assigned projects.
        </Typography>
      </Box>

      {/* Quick-start buttons for each assigned project */}
      {projects.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              mb: 1.5,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            Start a new session
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {projects.map((p) => (
              <Button
                key={p.id}
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleStartSession(p)}
                disabled={starting === p.id}
                size="small"
              >
                {starting === p.id ? 'Starting…' : p.name}
              </Button>
            ))}
          </Stack>
        </Box>
      )}

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={64} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No Sessions Yet"
          description="You haven't started any requirement-gathering sessions yet. Click a project above to begin chatting with ARIA."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table aria-label="sessions-table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell><strong>Project</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Messages</strong></TableCell>
                <TableCell><strong>Stability</strong></TableCell>
                <TableCell><strong>Contradictions</strong></TableCell>
                <TableCell><strong>Started At</strong></TableCell>
                <TableCell align="right"><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{s.projectName}</TableCell>
                  <TableCell>
                    <Badge label={s.status} type="feature" />
                  </TableCell>
                  <TableCell>{s.total_messages ?? 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${Math.round(s.stability_score ?? 100)}%`}
                      size="small"
                      color={
                        (s.stability_score ?? 100) >= 80
                          ? 'success'
                          : (s.stability_score ?? 100) >= 50
                          ? 'warning'
                          : 'error'
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{s.contradiction_events ?? 0}</TableCell>
                  <TableCell>{formatDateTime(s.started_at)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant={s.status === 'active' ? 'contained' : 'outlined'}
                      color={s.status === 'active' ? 'secondary' : 'inherit'}
                      startIcon={<ChatIcon />}
                      onClick={() => navigate(`/client/sessions/${s.id}`)}
                    >
                      {s.status === 'active' ? 'Continue' : 'View'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Layout>
  );
};

export default ClientSessions;
