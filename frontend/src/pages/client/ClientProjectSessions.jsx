import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Skeleton,
  IconButton,
  Breadcrumbs,
  Link as MuiLink,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Layout from '../../components/layout/Layout';
import EmptyState from '../../components/common/EmptyState';
import { listSessionsForProject } from '../../api/sessions';
import { getProject } from '../../api/projects';
import { useToastStore } from '../../store/toastStore';
import { formatDateTime } from '../../utils/helpers';

export const ClientProjectSessions = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [projData, sessionData] = await Promise.all([
          getProject(projectId).catch(() => null),
          listSessionsForProject(projectId),
        ]);
        setProject(projData);
        // Sort newest first
        const sorted = (sessionData || []).sort(
          (a, b) => new Date(b.created_at || b.started_at) - new Date(a.created_at || a.started_at)
        );
        setSessions(sorted);
      } catch (err) {
        showToast('Failed to load project chat sessions.', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, showToast]);

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <MuiLink
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            Dashboard
          </MuiLink>
          <Typography variant="body2" color="text.primary">
            {project?.name || 'Project History'}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/')} color="inherit" size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {project?.name ? `${project.name} — Chat Sessions` : 'Project Chat Sessions'}
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<ChatIcon sx={{ fontSize: 48 }} />}
          title="No Chat Sessions Yet"
          description="There are no chat sessions recorded for this project."
          actionLabel="Back to Dashboard"
          onAction={() => navigate('/')}
        />
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Started At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Ended At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Messages</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((sess) => {
                const isActive = sess.status === 'active';
                return (
                  <TableRow key={sess.id} hover>
                    <TableCell>
                      <Chip
                        label={isActive ? 'Active' : 'Completed'}
                        color={isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(sess.started_at || sess.created_at)}</TableCell>
                    <TableCell>{sess.ended_at ? formatDateTime(sess.ended_at) : '-'}</TableCell>
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
    </Layout>
  );
};

export default ClientProjectSessions;
