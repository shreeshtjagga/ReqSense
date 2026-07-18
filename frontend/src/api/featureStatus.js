import api from './axios';

export const createFeatureStatus = async (featureData) => {
  const response = await api.post('/feature-status', featureData);
  return response.data;
};

export const listFeaturesForProject = async (projectId, limit = 50, offset = 0) => {
  const response = await api.get(`/feature-status/project/${projectId}`, {
    params: { limit, offset },
  });
  return response.data;
};

export const getFeatureStatus = async (id) => {
  const response = await api.get(`/feature-status/${id}`);
  return response.data;
};

export const updateFeatureStatus = async (id, updateData) => {
  const response = await api.patch(`/feature-status/${id}`, updateData);
  return response.data;
};
