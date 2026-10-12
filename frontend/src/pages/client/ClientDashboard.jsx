import React, { useEffect, useState } from 'react';
import {
  Typography, Grid, Box, Alert, Skeleton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ProjectCard from '../../components/dashboard/ProjectCard';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { useProjectStore } from '../../store/projectStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import FolderOffIcon from '@mui/icons-material/FolderOff';

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

  const handleOpenProject = (project) => {
    setActiveProject(project);
    navigate(`/client/projects/${project.id}`);
  };

  const { user } = useAuthStore();

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          {user?.name ? `${user.name}'s Projects` : 'Projects'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Collaborate with ARIA to describe your project requirements in plain language.
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
          icon={FolderOffIcon}
          title="No Projects Assigned Yet"
          description="You haven't been invited to any project yet. Ask your developer to add you to begin gathering requirements."
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
                  onClick={() => handleOpenProject(proj)}
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
