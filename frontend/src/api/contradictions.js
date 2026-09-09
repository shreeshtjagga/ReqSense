import api from './axios';

export const resolveContradiction = async (id, resolveData) => {
  const response = await api.patch(`/contradictions/${id}`, resolveData);
  return response.data;
};

export const listContradictionsForProject = async (projectId) => {
  const response = await api.get(`/contradictions/project/${projectId}`);
  return response.data;
};

export const listContradictionsForSession = async (sessionId) => {
  const response = await api.get(`/contradictions/session/${sessionId}`);
  return response.data;
};
