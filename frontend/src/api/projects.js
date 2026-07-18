import api from './axios';

export const listProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await api.post('/projects', projectData);
  return response.data;
};

export const getProject = async (projectId) => {
  const response = await api.get(`/projects/${projectId}`);
  return response.data;
};

export const updateProject = async (projectId, projectData) => {
  const response = await api.patch(`/projects/${projectId}`, projectData);
  return response.data;
};

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}`);
  return response.data;
};

export const addClientToProject = async (projectId, clientId) => {
  const response = await api.post(`/projects/${projectId}/clients`, { client_id: clientId });
  return response.data;
};

export const removeClientFromProject = async (projectId, clientId) => {
  const response = await api.delete(`/projects/${projectId}/clients/${clientId}`);
  return response.data;
};
