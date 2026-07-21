import React, { useEffect, useState } from 'react';
import {
  Typography,
  Grid,
  Box,
  Alert,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { listProjects } from '../../api/projects';
import { listFeaturesForProject, updateFeatureStatus } from '../../api/featureStatus';
import { useToastStore } from '../../store/toastStore';
import { FEATURE_STATUS } from '../../utils/constants';

export const FeatureTracker = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await listProjects();
      setProjects(data);
      if (data.length > 0) {
        setProjectId(data[0].id);
      }
    } catch (err) {
      showToast('Failed to load active projects.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatures = async (pid) => {
    if (!pid) return;
    setFeaturesLoading(true);
    try {
      const data = await listFeaturesForProject(pid);
      setFeatures(data);
    } catch (err) {
      showToast('Failed to load features.', 'error');
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [showToast]);

  useEffect(() => {
    fetchFeatures(projectId);
  }, [projectId]);

  const handleEditClick = (feature) => {
    setSelectedFeature(feature);
    setNewStatus(feature.status);
    setNewDescription(feature.description || '');
    setEditOpen(true);
  };

  const handleUpdateFeature = async (e) => {
    e.preventDefault();
    if (!selectedFeature) return;

    setUpdating(true);
    try {
      // Send optimistic version in payload
      await updateFeatureStatus(selectedFeature.id, {
        status: newStatus,
        description: newDescription,
        version: selectedFeature.version, // Send optimistic locking version!
      });

      showToast('Feature updated successfully!', 'success');
      setEditOpen(false);
      
      // Refresh features from database
      fetchFeatures(projectId);
    } catch (err) {
      const isConflict = err.response?.status === 409 || err.response?.data?.code === 'STALE_VERSION';
      if (isConflict) {
        // Handle STALE_VERSION 409 conflict
        showToast('Someone else updated this feature. Refreshing your layout...', 'error');
        setEditOpen(false);
        fetchFeatures(projectId);
      } else {
        showToast(err.response?.data?.detail || 'Failed to update feature.', 'error');
      }
    } finally {
      setUpdating(false);
    }
  };

  // Group features by column status
  const plannedFeatures = features.filter((f) => f.status === FEATURE_STATUS.PLANNED);
  const inProgressFeatures = features.filter((f) => f.status === FEATURE_STATUS.IN_PROGRESS);
  const completedFeatures = features.filter((f) => f.status === FEATURE_STATUS.COMPLETED);

  const renderColumn = (title, columnFeatures, statusKey) => {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%', bgcolor: 'background.paper', minHeight: 400 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Badge label={columnFeatures.length} type="info" />
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        <Stack spacing={2}>
          {columnFeatures.map((feat) => (
            <Card key={feat.id} variant="outlined" sx={{ borderRadius: 2, position: 'relative' }}>
              <CardContent sx={{ pr: 6, pb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {feat.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feat.description || 'No description provided.'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Version: v{feat.version}
                </Typography>
              </CardContent>
              <CardActions sx={{ position: 'absolute', right: 8, top: 8 }}>
                <IconButton onClick={() => handleEditClick(feat)} size="small" color="primary">
                  <EditIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
          {columnFeatures.length === 0 && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
              Empty column
            </Typography>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Feature Status Tracker
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage functional requirement statuses with optimistic concurrency locking control.
          </Typography>
        </Box>
        
        {projects.length > 0 && (
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="project-select-label">Active Project</InputLabel>
            <Select
              labelId="project-select-label"
              value={projectId}
              label="Active Project"
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No Active Projects"
          description="Create a project to track its functional features."
        />
      ) : featuresLoading ? (
        <Grid container spacing={3}>
          {Array.from(new Array(3)).map((_, idx) => (
            <Grid item xs={12} md={4} key={idx}>
              <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            {renderColumn('Planned', plannedFeatures, FEATURE_STATUS.PLANNED)}
          </Grid>
          <Grid item xs={12} md={4}>
            {renderColumn('In Progress', inProgressFeatures, FEATURE_STATUS.IN_PROGRESS)}
          </Grid>
          <Grid item xs={12} md={4}>
            {renderColumn('Completed', completedFeatures, FEATURE_STATUS.COMPLETED)}
          </Grid>
        </Grid>
      )}

      {/* Edit Feature Status Dialog */}
      <Dialog open={editOpen} onClose={() => !updating && setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Feature Status</DialogTitle>
        <Box component="form" onSubmit={handleUpdateFeature}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {selectedFeature?.title}
              </Typography>
              
              <FormControl fullWidth>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  value={newStatus}
                  label="Status"
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <MenuItem value={FEATURE_STATUS.PLANNED}>Planned</MenuItem>
                  <MenuItem value={FEATURE_STATUS.IN_PROGRESS}>In Progress</MenuItem>
                  <MenuItem value={FEATURE_STATUS.COMPLETED}>Completed</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button disabled={updating} onClick={() => setEditOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" loading={updating}>
              Save Changes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Layout>
  );
};

export default FeatureTracker;
