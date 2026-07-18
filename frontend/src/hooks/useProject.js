import { useState, useEffect, useCallback } from 'react';
import { listProjects, getProject } from '../api/projects';
import { useToastStore } from '../store/toastStore';

export const useProject = (projectId = null) => {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (e) {
      showToast('Error loading projects list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchProject = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getProject(id);
      setProject(data);
    } catch (e) {
      showToast('Error loading project details.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    } else {
      fetchProjects();
    }
  }, [projectId, fetchProject, fetchProjects]);

  return {
    projects,
    project,
    loading,
    refreshProjects: fetchProjects,
    refreshProject: () => fetchProject(projectId),
  };
};

export default useProject;
