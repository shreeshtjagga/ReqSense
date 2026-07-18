import React, { useEffect, useState } from 'react';
import { Typography, Box, Alert, Grid, FormControl, InputLabel, Select, MenuItem, Skeleton, Stack } from '@mui/material';
import Layout from '../../components/layout/Layout';
import SRSViewer from '../../components/srs/SRSViewer';
import VersionHistory from '../../components/srs/VersionHistory';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { getLatestSrs, listSrsVersions } from '../../api/srs';
import { useToastStore } from '../../store/toastStore';

export const SRSPage = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [latestSrs, setLatestSrs] = useState(null);
  const [activeSrs, setActiveSrs] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [srsLoading, setSrsLoading] = useState(false);

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

  const fetchSrsData = async (pid) => {
    if (!pid) return;
    setSrsLoading(true);
    try {
      // Fetch latest version
      const latest = await getLatestSrs(pid);
      setLatestSrs(latest);
      setActiveSrs(latest);

      // Fetch version history
      const list = await listSrsVersions(pid);
      setVersions(list);
    } catch (err) {
      setLatestSrs(null);
      setActiveSrs(null);
      setVersions([]);
      // 404 is normal if no sessions have generated an SRS yet
      if (err.response?.status !== 404) {
        showToast('Error loading SRS document versions.', 'error');
      }
    } finally {
      setSrsLoading(false);
    }
  };

  useEffect(() => {
    fetchSrsData(projectId);
  }, [projectId]);

  const handleSelectVersion = (versionItem) => {
    // If it's a historical version, display it as active
    // Presigned download url is in file_url
    setActiveSrs({
      id: versionItem.id,
      version: versionItem.version,
      created_at: versionItem.created_at,
      download_url: versionItem.file_url,
    });
  };

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            SRS Documents
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View generated Software Requirements Specifications. These are auto-generated from completed client sessions.
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
          description="Create a project first to manage its specifications."
        />
      ) : srsLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="text" height={40} width="60%" />
          <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 3 }} />
        </Stack>
      ) : !activeSrs ? (
        <EmptyState
          title="No SRS Documents"
          description="This project doesn't have any generated requirements specs yet. Complete a gathering session to generate the initial v1.0 draft!"
        />
      ) : (
        <Grid container spacing={4}>
          <Grid item xs={12} lg={8}>
            <SRSViewer
              srsData={activeSrs}
              onShowHistory={null} // History list is already rendered on the right side
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <VersionHistory
              versions={versions}
              onSelectVersion={handleSelectVersion}
              currentVersionId={activeSrs?.id}
            />
          </Grid>
        </Grid>
      )}
    </Layout>
  );
};

export default SRSPage;
