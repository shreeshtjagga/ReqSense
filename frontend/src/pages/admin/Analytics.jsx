import React, { useEffect, useState } from 'react';
import { Typography, Box, Alert, Grid, FormControl, InputLabel, Select, MenuItem, Skeleton } from '@mui/material';
import Layout from '../../components/layout/Layout';
import DriftChart from '../../components/analytics/DriftChart';
import ResolutionChart from '../../components/analytics/ResolutionChart';
import StabilityGauge from '../../components/analytics/StabilityGauge';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { getProjectStabilityTrend } from '../../api/analytics';
import { useToastStore } from '../../store/toastStore';
import axios from '../../api/axios'; // For custom fetches if needed

export const Analytics = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [stabilityTrend, setStabilityTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [stats, setStats] = useState({ pending: 0, resolved: 0, ignored: 0 });

  useEffect(() => {
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
    fetchProjects();
  }, [showToast]);

  const fetchProjectAnalytics = async (pid) => {
    if (!pid) return;
    setAnalyticsLoading(true);
    try {
      const trend = await getProjectStabilityTrend(pid);
      setStabilityTrend(trend);

      // Load counts of contradictions for the pie chart
      try {
        const contradictionsRes = await axios.get(`/contradictions/project/${pid}`);
        const list = contradictionsRes.data || [];
        const pendingCount = list.filter((c) => c.status === 'pending').length;
        const resolvedCount = list.filter((c) => c.status === 'resolved').length;
        const ignoredCount = list.filter((c) => c.status === 'ignored').length;
        setStats({ pending: pendingCount, resolved: resolvedCount, ignored: ignoredCount });
      } catch (e) {
        // Real endpoint returned an error — show zeros rather than fake data
        setStats({ pending: 0, resolved: 0, ignored: 0 });
      }

    } catch (err) {
      showToast('Error loading project analytics.', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectAnalytics(projectId);
  }, [projectId]);

  // Compute stability score from trend or fallback to 100%
  const currentStability = stabilityTrend.length > 0 
    ? stabilityTrend[stabilityTrend.length - 1].stability_score 
    : 100;

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Stability Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visualize requirement drift trends, contradiction frequency, and project specification stability.
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
          description="Create a project to display requirements analytics."
        />
      ) : analyticsLoading ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {/* Stability Gauge */}
          <Grid item xs={12} md={4}>
            <StabilityGauge value={currentStability} />
          </Grid>
          
          {/* Contradiction Pie Chart */}
          <Grid item xs={12} md={8}>
            <ResolutionChart
              pending={stats.pending}
              resolved={stats.resolved}
              ignored={stats.ignored}
            />
          </Grid>

          {/* Drift Line Chart */}
          <Grid item xs={12}>
            <DriftChart data={stabilityTrend} />
          </Grid>
        </Grid>
      )}
    </Layout>
  );
};

export default Analytics;
