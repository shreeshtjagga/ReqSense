import React, { useEffect, useState } from 'react';
import { Typography, Box, Grid, FormControl, InputLabel, Select, MenuItem, Skeleton, Paper } from '@mui/material';
import Layout from '../../components/layout/Layout';
import DriftChart from '../../components/analytics/DriftChart';
import ResolutionChart from '../../components/analytics/ResolutionChart';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { getProjectSummary } from '../../api/analytics';
import { listSessionsForProject } from '../../api/sessions';
import { useToastStore } from '../../store/toastStore';
import axios from '../../api/axios';

export const Analytics = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [sessionTrend, setSessionTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [stats, setStats] = useState({ pending: 0, resolved: 0, ignored: 0 });
  const [conflictTypes, setConflictTypes] = useState({});

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
      const sessions = await listSessionsForProject(pid);
      setSessionTrend(sessions || []);

      // Load counts of contradictions for the pie chart
      try {
        const contradictionsRes = await axios.get(`/contradictions/project/${pid}`);
        const list = contradictionsRes.data || [];
        const pendingCount = list.filter((c) => c.status === 'pending').length;
        const resolvedCount = list.filter((c) => c.status === 'resolved').length;
        const ignoredCount = list.filter((c) => c.status === 'ignored').length;
        setStats({ pending: pendingCount, resolved: resolvedCount, ignored: ignoredCount });
      } catch (e) {
        setStats({ pending: 0, resolved: 0, ignored: 0 });
      }

      try {
        const summary = await getProjectSummary(pid);
        setConflictTypes(summary.conflict_type_distribution || {});
      } catch (e) {
        setConflictTypes({});
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

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Requirements &amp; Contradictions Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visualize contradiction frequency, session trends, and conflict type distribution across active projects.
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
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {/* Contradiction Pie Chart */}
          <Grid item xs={12}>
            <ResolutionChart
              pending={stats.pending}
              resolved={stats.resolved}
              ignored={stats.ignored}
            />
          </Grid>

          {/* Drift Line Chart */}
          <Grid item xs={12}>
            <DriftChart data={sessionTrend} />
          </Grid>

          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Conflict type distribution
              </Typography>
              {Object.keys(conflictTypes).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No contradictions logged for this project yet.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(conflictTypes).map(([type, count]) => (
                    <Grid item xs={6} sm={3} key={type}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {type.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{count}</Typography>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Layout>
  );
};

export default Analytics;
