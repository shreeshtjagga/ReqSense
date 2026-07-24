import React, { useEffect, useState } from 'react';
import { Typography, Box, Alert, Grid, FormControl, InputLabel, Select, MenuItem, Skeleton, Stack } from '@mui/material';
import Layout from '../../components/layout/Layout';
import SRSViewer from '../../components/srs/SRSViewer';
import VersionHistory from '../../components/srs/VersionHistory';
import EmptyState from '../../components/common/EmptyState';
import { listProjects } from '../../api/projects';
import { getLatestSrs, listSrsVersions, generateProjectSrs, getSrsVersionDetails } from '../../api/srs';
import Button from '../../components/common/Button';
import DescriptionIcon from '@mui/icons-material/Description';
import { formatDateTime } from '../../utils/helpers';
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
  const [generating, setGenerating] = useState(false);

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

  const handleGenerateSrs = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      await generateProjectSrs(projectId);
      showToast('SRS document generated successfully!', 'success');
      await fetchSrsData(projectId);
    } catch (err) {
      showToast('Failed to generate SRS document.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchSrsData(projectId);
  }, [projectId]);

  const handleSelectVersion = async (versionItem) => {
    if (!versionItem) return;
    try {
      const details = await getSrsVersionDetails(versionItem.id);
      setActiveSrs(details);
    } catch (err) {
      setActiveSrs({
        id: versionItem.id,
        version: versionItem.version,
        created_at: versionItem.created_at,
        download_url: versionItem.file_url,
      });
    }
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
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {versions.length > 0 && (
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="version-select-label">Revision Version</InputLabel>
                <Select
                  labelId="version-select-label"
                  value={activeSrs?.id || ''}
                  label="Revision Version"
                  onChange={(e) => {
                    const sel = versions.find((v) => v.id === e.target.value);
                    if (sel) handleSelectVersion(sel);
                  }}
                >
                  {versions.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      Version v{v.version} ({formatDateTime(v.created_at)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              variant="contained"
              startIcon={<DescriptionIcon />}
              onClick={handleGenerateSrs}
              loading={generating}
            >
              Generate SRS Document
            </Button>
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
          </Stack>
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
          description="This project doesn't have any generated requirements specs yet. Click below to generate the initial v1.0 draft!"
          actionLabel="Generate SRS Now"
          onAction={handleGenerateSrs}
        />
      ) : (
        <Stack spacing={4}>
          <SRSViewer srsData={activeSrs} onShowHistory={null} />
          {versions.length > 1 && (
            <VersionHistory
              versions={versions}
              onSelectVersion={handleSelectVersion}
              currentVersionId={activeSrs?.id}
            />
          )}
        </Stack>
      )}
    </Layout>
  );
};

export default SRSPage;
