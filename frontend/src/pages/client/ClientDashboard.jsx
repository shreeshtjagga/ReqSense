import React, { useEffect, useState } from 'react';
import {
  Typography, Grid, Box, Alert, Skeleton, Stack, Chip, Paper, Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ProjectCard from '../../components/dashboard/ProjectCard';
import { listProjects } from '../../api/projects';
import { createSession, listSessionsForProject } from '../../api/sessions';
import { useProjectStore } from '../../store/projectStore';
import { useToastStore } from '../../store/toastStore';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import LockIcon from '@mui/icons-material/Lock';
import FolderOffIcon from '@mui/icons-material/FolderOff';
import SendIcon from '@mui/icons-material/Send';
import EmailVerificationBanner from '../../components/common/EmailVerificationBanner';

// ── Demo preview messages shown when no project is assigned ──────────────────
const DEMO_MESSAGES = [
  { id: 1, sender: 'aria', content: 'Hi! I\'m ARIA — your AI Requirements Analyst. I\'ll guide you through gathering the requirements for your project. When your developer assigns you to a project, we can begin!' },
  { id: 2, sender: 'client', content: 'Can I see what this will look like?' },
  { id: 3, sender: 'aria', content: 'Of course! During a real session, you describe your software idea and I extract structured requirements, ask clarifying questions, and flag any contradictions. Your developer sees everything in real-time.' },
];

const DemoMessage = ({ msg }) => {
  const isAria = msg.sender === 'aria';
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isAria ? 'flex-start' : 'flex-end',
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: '75%',
          px: 2,
          py: 1.2,
          borderRadius: isAria ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          bgcolor: isAria ? 'background.paper' : 'secondary.main',
          color: isAria ? 'text.primary' : '#fff',
          border: isAria ? '1px solid' : 'none',
          borderColor: 'divider',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          opacity: 0.85,
        }}
      >
        {msg.content}
      </Box>
    </Box>
  );
};

// ── Locked chat preview shown when no projects exist ─────────────────────────
const LockedChatPreview = () => (
  <Box sx={{ position: 'relative', mt: 4 }}>
    {/* Section header */}
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
      Chat Preview
    </Typography>

    {/* Chat window wrapper */}
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        filter: 'blur(1.5px)',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.7,
      }}
    >
      {/* Chat header */}
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'background.paper' }}>
        <SmartToyIcon color="secondary" />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            ARIA Requirement Gathering Session
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ARIA conducts the conversation and extracts requirements in real time.
          </Typography>
        </Box>
      </Box>
      <Divider />

      {/* Demo messages */}
      <Box sx={{ p: 3, minHeight: 220 }}>
        {DEMO_MESSAGES.map((msg) => (
          <DemoMessage key={msg.id} msg={msg} />
        ))}
      </Box>

      {/* Fake input */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2, bgcolor: 'background.paper', display: 'flex', gap: 1 }}>
        <Box sx={{ flex: 1, height: 40, borderRadius: 2, bgcolor: 'action.hover' }} />
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'action.disabledBackground', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SendIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        </Box>
      </Box>
    </Paper>

    {/* Overlay lock message */}
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        zIndex: 2,
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          px: 4,
          py: 3,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          maxWidth: 360,
        }}
      >
        <LockIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Waiting for Project Assignment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your developer hasn't invited you to a project yet.
          Once invited, you'll chat with ARIA here to gather requirements.
        </Typography>
      </Box>
    </Box>
  </Box>
);

// ── Main ClientDashboard ──────────────────────────────────────────────────────
export const ClientDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { projects, setProjects, setActiveProject } = useProjectStore();
  const showToast = useToastStore((state) => state.showToast);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const data = await listProjects();
        setProjects(data);
      } catch (err) {
        setError('Failed to load projects. Please try refreshing.');
        showToast('Error fetching projects list.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [setProjects, showToast]);

  const handleStartSession = async (project) => {
    try {
      setActiveProject(project);
      const existingSessions = await listSessionsForProject(project.id);
      const activeSession = existingSessions?.find((s) => s.status === 'active');
      if (activeSession) {
        showToast('Resuming active session...', 'info');
        navigate(`/client/sessions/${activeSession.id}`);
        return;
      }
      const session = await createSession({ project_id: project.id });
      showToast('New requirement session started!', 'success');
      navigate(`/client/sessions/${session.id}`);
    } catch (err) {
      showToast('Failed to start a session. Try again later.', 'error');
    }
  };

  return (
    <Layout>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          Client Workspace
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Collaborate with ARIA to describe your project requirements in plain language.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}



      {/* Projects section */}
      {loading ? (
        <Grid container spacing={3}>
          {Array.from(new Array(3)).map((_, idx) => (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : projects.length === 0 ? (
        <>
          {/* No project assigned — explain + show preview */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <FolderOffIcon sx={{ color: 'text.secondary' }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              No Projects Assigned Yet
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mb: 1 }}>
            You haven't been invited to any project. Ask your developer to add you, then refresh this page.
          </Alert>

          {/* Locked preview */}
          <LockedChatPreview />
        </>
      ) : (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Your Projects
          </Typography>
          <Grid container spacing={3}>
            {projects.map((proj) => (
              <Grid item xs={12} sm={6} md={4} key={proj.id}>
                <ProjectCard
                  project={proj}
                  onClick={() => handleStartSession(proj)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Layout>
  );
};

export default ClientDashboard;
