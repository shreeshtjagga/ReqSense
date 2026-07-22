import api from './axios';

export const createSession = async (sessionData) => {
  const response = await api.post('/sessions', sessionData);
  return response.data;
};

export const listSessionsForProject = async (projectId) => {
  const response = await api.get(`/sessions/project/${projectId}`);
  return response.data;
};

export const getSession = async (sessionId) => {
  const response = await api.get(`/sessions/${sessionId}`);
  return response.data;
};

export const endSession = async (sessionId, status = 'completed') => {
  const response = await api.patch(`/sessions/${sessionId}/end`, { status });
  return response.data;
};

export const generateSRS = async (sessionId) => {
  const response = await api.post(`/sessions/${sessionId}/generate-srs`);
  return response.data;
};
