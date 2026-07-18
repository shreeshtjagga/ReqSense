import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { listProjects } from '../../api/projects';
import { createChangeRequest } from '../../api/changeRequests';
import { useToastStore } from '../../store/toastStore';
import { SEVERITIES } from '../../utils/constants';

export const ChangeRequestForm = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [features, setFeatures] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await listProjects();
        setProjects(data);
        if (data.length > 0) {
          setProjectId(data[0].id);
        }
      } catch (err) {
        showToast('Failed to load active projects.', 'error');
      }
    };
    fetchProjects();
  }, [showToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId || !title || !description) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setLoading(true);
    try {
      const affectedFeatures = features
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      await createChangeRequest({
        project_id: projectId,
        title,
        description,
        severity,
        affected_features: affectedFeatures,
      });

      showToast('Change request submitted successfully! Impact analysis enqueued.', 'success');
      navigate('/');
    } catch (err) {
      showToast('Failed to submit change request.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 4, maxWidth: 600 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          Submit Change Request
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Request requirements modifications. The system will automatically analyze scope changes and impact scores.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, maxWidth: 600, border: '1px solid', borderColor: 'divider' }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <FormControl fullWidth required>
              <InputLabel id="project-select-label">Target Project</InputLabel>
              <Select
                labelId="project-select-label"
                value={projectId}
                label="Target Project"
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((proj) => (
                  <MenuItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Input
              label="Request Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Add multi-factor authentication check"
            />

            <TextField
              label="Description of Change"
              multiline
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Describe in detail what requirements should be updated and why..."
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel id="severity-select-label">Estimated Severity</InputLabel>
              <Select
                labelId="severity-select-label"
                value={severity}
                label="Estimated Severity"
                onChange={(e) => setSeverity(e.target.value)}
              >
                <MenuItem value={SEVERITIES.LOW}>Low (Minor wording/UI change)</MenuItem>
                <MenuItem value={SEVERITIES.MEDIUM}>Medium (New rule/condition)</MenuItem>
                <MenuItem value={SEVERITIES.HIGH}>High (Core feature redesign)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Affected Features (Comma separated list)"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="e.g. Login, Authentication Flow, User Profiles"
              fullWidth
              helperText="List tags for sections that might be updated by this change request."
            />

            <Divider />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button color="inherit" onClick={() => navigate('/')}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary" loading={loading}>
                Submit Request
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Layout>
  );
};

export default ChangeRequestForm;
