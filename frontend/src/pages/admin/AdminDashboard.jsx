import React, { useEffect, useState } from 'react';
import { Typography, Grid, Box, Skeleton, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import StatsCard from '../../components/dashboard/StatsCard';
import RecentActivity from '../../components/dashboard/RecentActivity';
import QuickActions from '../../components/dashboard/QuickActions';
import ProjectCard from '../../components/dashboard/ProjectCard';
import EmptyState from '../../components/common/EmptyState';
import { getOverviewAnalytics } from '../../api/analytics';
import { listProjects } from '../../api/projects';
import { useToastStore } from '../../store/toastStore';
import FolderIcon from '@mui/icons-material/Folder';
import ForumIcon from '@mui/icons-material/Forum';
import WarningIcon from '@mui/icons-material/Warning';
import axios from '../../api/axios';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_projects: 0, total_sessions: 0, total_contradictions: 0 });
  const [projects, setProjects] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [analyticsData, projData] = await Promise.all([
        getOverviewAnalytics().catch(() => ({ total_projects: 0, total_sessions: 0, total_contradictions: 0 })),
        listProjects().catch(() => []),
      ]);

      setStats(analyticsData);
      setProjects(projData || []);

      // Fetch live audit logs for the recent activity widget
      try {
        const auditRes = await axios.get('/audit-logs', { params: { limit: 10 } });
        const logs = auditRes.data || [];
        const formattedLogs = logs.map((log) => ({
          id: String(log.id),
          type: log.action || 'system_event',
          description: `${(log.action || 'Action').replace(/_/g, ' ')} (${log.entity_type || 'system'})`,
          timestamp: log.created_at,
        }));
        setRecentActivities(formattedLogs);
      } catch (e) {
        setRecentActivities([]);
      }
    } catch (err) {
      showToast('Error loading platform metrics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [showToast]);

  const handleQuickActions = {
    onAddUser: () => navigate('/admin/users'),
    onViewAnalytics: () => navigate('/admin/analytics'),
  };

  const handleProjectDeleted = (deletedId) => {
    setProjects((prev) => prev.filter((p) => p.id !== deletedId));
  };

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          Admin Console
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor your organization's projects, manage user accounts, and view audit activity logs.
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

          {/* Managed Projects Section */}
          <Grid item xs={12}>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 2, mb: 2 }}>
              Organization Projects
            </Typography>
            {projects.length === 0 ? (
              <EmptyState title="No Projects Found" description="There are no active or completed projects in your organization." />
            ) : (
              <Grid container spacing={3}>
                {projects.map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p.id}>
                    <ProjectCard
                      project={p}
                      onClick={() => navigate(`/dev/projects/${p.id}`)}
                      onDeleteSuccess={handleProjectDeleted}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
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
