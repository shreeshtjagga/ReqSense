import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  Paper,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import Layout from '../../components/layout/Layout';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { useToastStore } from '../../store/toastStore';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from '../../api/axios';

export const Analytics = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    total_requirements: 0,
    active_requirements: 0,
    conflicted_requirements: 0,
    superseded_requirements: 0,
    health_score: 100,
    total_contradictions: 0,
    resolved_contradictions: 0,
    pending_contradictions: 0,
    resolution_rate: 100,
    total_change_requests: 0,
    cr_approved: 0,
    cr_rejected: 0,
    cr_pending: 0,
    srs_versions_count: 0,
  });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listProjects();
      setProjects(data || []);
    } catch (err) {
      showToast('Failed to load projects.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchMetrics = useCallback(async (pid) => {
    setMetricsLoading(true);
    try {
      const params = pid && pid !== 'all' ? { project_id: pid } : {};
      const res = await axios.get('/analytics/executive-summary', { params });
      setMetrics(res.data);
    } catch (err) {
      console.error('[Analytics] fetch failed:', err);
      showToast('Failed to load analytics.', 'error');
    } finally {
      setMetricsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMetrics(selectedProjectId);
  }, [selectedProjectId, fetchMetrics]);

  return (
    <Layout>
      {/* Header */}
      <Box sx={{ mb: 3.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
            Analytics &amp; Metrics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            High-level overview of captured requirements, conflict status, and project activity.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220, bgcolor: '#FFFFFF' }}>
            <InputLabel id="project-scope-label">Project Scope</InputLabel>
            <Select
              labelId="project-scope-label"
              value={selectedProjectId}
              label="Project Scope"
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <MenuItem value="all">
                <em>All Organization Projects</em>
              </MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Refresh">
            <IconButton
              onClick={() => fetchMetrics(selectedProjectId)}
              disabled={metricsLoading}
              size="small"
              sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {metricsLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
        </Stack>
      ) : (
        <Stack spacing={3}>
          {/* Summary Metric Cards */}
          <Grid container spacing={2}>
            {/* Total Requirements */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B' }}>
                  Total Requirements
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', my: 0.5 }}>
                  {metrics.total_requirements}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {metrics.active_requirements} active in SRS
                </Typography>
              </Paper>
            </Grid>

            {/* Contradictions */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B' }}>
                  Pending Conflicts
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: metrics.pending_contradictions > 0 ? '#D97706' : '#0F172A', my: 0.5 }}>
                  {metrics.pending_contradictions}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {metrics.resolved_contradictions} resolved ({metrics.resolution_rate}%)
                </Typography>
              </Paper>
            </Grid>

            {/* Change Requests */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B' }}>
                  Change Requests
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', my: 0.5 }}>
                  {metrics.total_change_requests}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {metrics.cr_approved} approved, {metrics.cr_rejected} rejected
                </Typography>
              </Paper>
            </Grid>

            {/* SRS Versions */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B' }}>
                  SRS Releases
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', my: 0.5 }}>
                  {metrics.srs_versions_count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Specification releases generated
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Simple Breakdown Paper */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, bgcolor: '#FFFFFF', borderColor: '#E2E8F0' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A', mb: 2 }}>
              Project Status Summary
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Active Requirements
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#16A34A', mt: 0.5 }}>
                    {metrics.active_requirements}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Included in active project scope
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Conflicted / Under Review
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: metrics.conflicted_requirements > 0 ? '#D97706' : '#64748B', mt: 0.5 }}>
                    {metrics.conflicted_requirements}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pending developer contradiction resolution
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Superseded Requirements
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#64748B', mt: 0.5 }}>
                    {metrics.superseded_requirements}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Replaced by newer approved modifications
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      )}
    </Layout>
  );
};

export default Analytics;
