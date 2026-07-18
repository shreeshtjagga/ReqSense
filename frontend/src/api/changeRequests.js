import api from './axios';

export const createChangeRequest = async (changeRequestData) => {
  const response = await api.post('/change-requests', changeRequestData);
  return response.data;
};

export const listChangeRequests = async (projectId, limit = 50, offset = 0) => {
  const response = await api.get(`/change-requests/project/${projectId}`, {
    params: { limit, offset },
  });
  return response.data;
};

export const getChangeRequest = async (id) => {
  const response = await api.get(`/change-requests/${id}`);
  return response.data;
};

export const reviewChangeRequest = async (id, reviewData) => {
  const response = await api.patch(`/change-requests/${id}`, reviewData);
  return response.data;
};
