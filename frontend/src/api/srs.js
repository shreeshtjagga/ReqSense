import api from './axios';

export const getLatestSrs = async (projectId) => {
  const response = await api.get(`/srs/project/${projectId}/latest`);
  return response.data;
};

export const listSrsVersions = async (projectId, limit = 50, offset = 0) => {
  const response = await api.get(`/srs/project/${projectId}/versions`, {
    params: { limit, offset },
  });
  return response.data;
};

export const generateProjectSrs = async (projectId) => {
  const response = await api.post(`/srs/project/${projectId}/generate`);
  return response.data;
};

export const getSrsVersionDetails = async (versionId) => {
  const response = await api.get(`/srs/version/${versionId}`);
  return response.data;
};
