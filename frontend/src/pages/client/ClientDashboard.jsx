import React, { useEffect, useState } from 'react';
import { Typography, Grid, Box, Alert, Skeleton, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ProjectCard from '../../components/dashboard/ProjectCard';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { createSession } from '../../api/sessions';
import { useProjectStore } from '../../store/projectStore';
import { useToastStore } from '../../store/toastStore';
import AddCommentIcon from '@mui/icons-material/AddComment';

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
      
      // Create new requirement gathering session
      const session = await createSession({
        project_id: project.id,
      });

      showToast('New requirement session started!', 'success');
      navigate(`/client/sessions/${session.id}`);
    } catch (err) {
      showToast('Failed to start a session. Developer might be offline.', 'error');
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          Client Workspace
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse your active development projects and collaborate with ARIA to outline requirements.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Grid container spacing={3}>
          {Array.from(new Array(3)).map((_, idx) => (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No Active Projects"
          description="Your developer has not invited you to any projects yet. When you are added, they will appear here."
        />
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
