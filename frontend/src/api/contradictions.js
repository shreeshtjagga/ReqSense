import api from './axios';

export const resolveContradiction = async (id, resolveData) => {
  const response = await api.patch(`/contradictions/${id}`, resolveData);
  return response.data;
};
