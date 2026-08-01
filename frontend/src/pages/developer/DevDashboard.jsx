import React, { useEffect, useState } from 'react';
import {
  Typography,
  Grid,
  Box,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ProjectCard from '../../components/dashboard/ProjectCard';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { listProjects, createProject } from '../../api/projects';
import { useProjectStore } from '../../store/projectStore';
import { useToastStore } from '../../store/toastStore';
import AddIcon from '@mui/icons-material/Add';
import { PROJECT_DOMAINS } from '../../utils/constants';

export const DevDashboard = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { projects, setProjects, setActiveProject } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  
  // Create Project form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('web_app');
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const projData = await listProjects();
      setProjects(projData);
    } catch (err) {
      showToast('Error loading developer projects.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [setProjects]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Project name is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createProject({
        name,
        description,
        domain,
      });

      showToast('Project created successfully!', 'success');
      setCreateOpen(false);
      setName('');
      setDescription('');
      setDomain('web_app');
      
      // Refresh list
      fetchDashboardData();
    } catch (err) {
      const errorMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : (Array.isArray(err.response?.data?.detail)
            ? err.response.data.detail.map(d => d.msg).join(', ')
            : 'Failed to create project.');
      showToast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Developer Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a project to access its dashboard, requirements sessions, feature statuses, and SRS specifications.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Create Project
        </Button>
      </Box>

      {/* Projects list */}
      <Box sx={{ mb: 2 }}>
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
            description="You have not created any projects. Click the 'Create Project' button above to get started."
            actionLabel="Create Project"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Grid container spacing={3}>
            {projects.map((proj) => (
              <Grid item xs={12} sm={6} md={4} key={proj.id}>
                <ProjectCard
                  project={proj}
                  onClick={() => {
                    setActiveProject(proj);
                    navigate(`/dev/projects/${proj.id}`);
                  }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Project</DialogTitle>
        <Box component="form" onSubmit={handleCreateProject}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <Input
                label="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={3}
              />
              <FormControl fullWidth>
                <InputLabel id="domain-label">System Domain</InputLabel>
                <Select
                  labelId="domain-label"
                  value={domain}
                  label="System Domain"
                  onChange={(e) => setDomain(e.target.value)}
                >
                  <MenuItem value={PROJECT_DOMAINS.WEB_APP}>Web App</MenuItem>
                  <MenuItem value={PROJECT_DOMAINS.MOBILE_APP}>Mobile App</MenuItem>
                  <MenuItem value={PROJECT_DOMAINS.SOFTWARE}>Desktop/Backend Software</MenuItem>
                  <MenuItem value={PROJECT_DOMAINS.API}>API Platform</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button disabled={submitting} onClick={() => setCreateOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" loading={submitting}>
              Create Project
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Layout>
  );
};

export default DevDashboard;
