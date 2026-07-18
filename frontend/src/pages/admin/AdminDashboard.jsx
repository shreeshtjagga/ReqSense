import React, { useEffect, useState } from 'react';
import { Typography, Grid, Box, Alert, Skeleton, Stack, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import StatsCard from '../../components/dashboard/StatsCard';
import RecentActivity from '../../components/dashboard/RecentActivity';
import QuickActions from '../../components/dashboard/QuickActions';
import { getOverviewAnalytics } from '../../api/analytics';
import { useToastStore } from '../../store/toastStore';
import FolderIcon from '@mui/icons-material/Folder';
import ForumIcon from '@mui/icons-material/Forum';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_projects: 0, total_sessions: 0, total_contradictions: 0 });
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        const data = await getOverviewAnalytics();
        setStats(data);

        // Populate some mock activities for visual polish
        setRecentActivities([
          { id: '1', type: 'session_start', description: 'Client A started a requirements session.', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: '2', type: 'contradiction_detected', description: 'ARIA detected a contradiction on Project Alpha.', timestamp: new Date(Date.now() - 7200000).toISOString() },
          { id: '3', type: 'srs_generated', description: 'SRS Document v1.0 generated successfully.', timestamp: new Date(Date.now() - 86400000).toISOString() },
        ]);
      } catch (err) {
        showToast('Error loading platform metrics.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [showToast]);

  const handleQuickActions = {
    onAddUser: () => navigate('/admin/users'),
    onViewAnalytics: () => navigate('/admin/analytics'),
  };

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          Admin Console
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor your organization's projects, manage user accounts, and view stability analytics.
        </Typography>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
      ) : (
        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} sm={4}>
            <StatsCard title="Total Projects" value={stats.total_projects} icon={FolderIcon} color="primary.main" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatsCard title="Active Sessions" value={stats.total_sessions} icon={ForumIcon} color="secondary.main" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatsCard title="Pending Contradictions" value={stats.total_contradictions} icon={WarningIcon} color="warning.main" />
          </Grid>

          {/* Activity Logs & Quick Actions */}
          <Grid item xs={12} md={8}>
            <RecentActivity activities={recentActivities} />
          </Grid>
          <Grid item xs={12} md={4}>
            <QuickActions actions={handleQuickActions} />
          </Grid>
        </Grid>
      )}
    </Layout>
  );
};

export default AdminDashboard;
