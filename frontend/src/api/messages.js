import api from './axios';
import { API_URL, API_PREFIX } from '../utils/constants';

export const createMessage = async (sessionId, messageData) => {
  const response = await api.post(`/sessions/${sessionId}/messages`, messageData);
  return response.data;
};

export const listMessages = async (sessionId, limit = 100, offset = 0) => {
  const response = await api.get(`/sessions/${sessionId}/messages`, {
    params: { limit, offset },
  });
  return response.data;
};
