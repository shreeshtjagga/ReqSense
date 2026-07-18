import api from './axios';

export const getOverviewAnalytics = async () => {
  const response = await api.get('/analytics/overview');
  return response.data;
};

export const getProjectStabilityTrend = async (projectId) => {
  const response = await api.get(`/analytics/projects/${projectId}/stability`);
  return response.data;
};
