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
  Paper,
  InputAdornment,
  TextField,
  Chip,
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
import { useAuthStore } from '../../store/authStore';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { PROJECT_DOMAINS } from '../../utils/constants';

export const DevDashboard = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { projects, setProjects, setActiveProject } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const { user } = useAuthStore();

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
  });

  const activeCount = projects.filter(p => p.status === 'active').length;

  return (
    <Layout>
      {/* Visual Hero Header */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 40px -15px rgba(49, 46, 129, 0.4)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(0, 0, 0, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
          <Box sx={{ maxWidth: 640 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Chip
                label="Developer Workspace"
                size="small"
                sx={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#A5B4FC',
                  fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  fontSize: '0.75rem',
                }}
              />
            </Stack>
            <Typography variant="h2" sx={{ fontWeight: 900, mb: 1, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
              {user?.name ? `Welcome back, ${user.name}` : 'Developer Projects'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(224, 231, 255, 0.85)', lineHeight: 1.6 }}>
              Manage AI-driven requirements gathering, inspect extracted specification atoms, and review flagged contradictions in real time.
            </Typography>

            <Stack direction="row" spacing={3} sx={{ mt: 3 }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#67E8F9' }}>
                  {projects.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600 }}>
                  Total Projects
                </Typography>
              </Box>
              <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.15)', pl: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#34D399' }}>
                  {activeCount}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600 }}>
                  Active Sessions
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              color: '#FFFFFF',
              px: 3,
              py: 1.5,
              borderRadius: 3,
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: '0 8px 25px rgba(6, 182, 212, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0891B2 0%, #0E7490 100%)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            Create New Project
          </Button>
        </Box>
      </Paper>

      {/* Control Bar: Search */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
          Your Projects
        </Typography>

        <TextField
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            width: { xs: '100%', sm: 300 },
            '& .MuiOutlinedInput-root': {
              bgcolor: '#FFFFFF',
              borderRadius: 3,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Projects List Grid */}
      <Box sx={{ mb: 4 }}>
        {loading ? (
          <Grid container spacing={3}>
            {Array.from(new Array(3)).map((_, idx) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 4 }} />
              </Grid>
            ))}
          </Grid>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No Matching Projects' : 'No Projects Created Yet'}
            description={searchQuery ? `No projects match "${searchQuery}". Try clearing your search.` : 'Click below to create your first project and start gathering requirements.'}
            actionLabel="Create Project"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Grid container spacing={3}>
            {filteredProjects.map((proj) => (
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

      {/* Create Project Modal */}
      <Dialog
        open={createOpen}
        onClose={() => !submitting && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>Create New Project</DialogTitle>
        <Box component="form" onSubmit={handleCreateProject}>
          <DialogContent dividers sx={{ borderColor: '#E2E8F0' }}>
            <Stack spacing={3}>
              <Input
                label="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. E-Commerce Order Portal"
              />
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={3}
                placeholder="Describe the primary goals, target audience, and scope..."
              />
              <FormControl fullWidth>
                <InputLabel id="domain-label">System Domain</InputLabel>
                <Select
                  labelId="domain-label"
                  value={domain}
                  label="System Domain"
                  onChange={(e) => setDomain(e.target.value)}
                >
                  <MenuItem value={PROJECT_DOMAINS.WEB_APP}>Web Application</MenuItem>
                  <MenuItem value={PROJECT_DOMAINS.MOBILE_APP}>Mobile Application</MenuItem>
                  <MenuItem value={PROJECT_DOMAINS.SOFTWARE}>Desktop/Enterprise Software</MenuItem>
                  <MenuItem value={PROJECT_DOMAINS.API}>API Platform & Integrations</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
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
