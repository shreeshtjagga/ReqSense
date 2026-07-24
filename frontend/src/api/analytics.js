import api from './axios';

export const getOverviewAnalytics = async () => {
  const response = await api.get('/analytics/overview');
  return response.data;
};

export const getProjectStabilityTrend = async (projectId) => {
  const response = await api.get(`/analytics/projects/${projectId}/stability`);
  return response.data;
};

export const getProjectSummary = async (projectId) => {
  const response = await api.get(`/analytics/projects/${projectId}/summary`);
  return response.data;
};

export const getDeveloperPortfolio = async () => {
  const response = await api.get('/analytics/developer/portfolio');
  return response.data;
};

export const getConflictTypeDistribution = async () => {
  const response = await api.get('/analytics/conflict-types');
  return response.data;
};
