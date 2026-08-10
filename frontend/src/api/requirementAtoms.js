import axios from './axios';

export const listAtomsForProject = (projectId, params = {}) =>
  axios.get(`/requirement-atoms/project/${projectId}`, { params }).then((r) => r.data);

export const listAtomsForSession = (sessionId, params = {}) =>
  axios.get(`/requirement-atoms/session/${sessionId}`, { params }).then((r) => r.data);
