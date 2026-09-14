import api from './axios';
import { useAuthStore } from '../store/authStore';

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

export const downloadSrsDocx = async (urlOrKey, defaultFilename = 'SRS_Document.docx') => {
  if (!urlOrKey) {
    throw new Error('Download URL or file key not available.');
  }

  const token = useAuthStore.getState().accessToken;

  // Check if it is a truly external S3/R2 presigned URL (not our own local API)
  const isInternalBackend = urlOrKey.includes('/srs/download-file') || urlOrKey.startsWith('/') || urlOrKey.startsWith('projects/');
  
  if (!isInternalBackend && (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://'))) {
    const link = document.createElement('a');
    link.href = urlOrKey;
    link.setAttribute('download', defaultFilename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 1000);
    return;
  }

  // Format the endpoint for API
  let endpoint = urlOrKey;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    try {
      const parsed = new URL(endpoint);
      endpoint = parsed.pathname + parsed.search;
    } catch (_) {}
  }

  if (endpoint.startsWith('/api/v1')) {
    endpoint = endpoint.replace('/api/v1', '');
  } else if (!endpoint.startsWith('/srs/download-file')) {
    const key = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    endpoint = `/srs/download-file?key=${encodeURIComponent(key)}`;
  }

  try {
    const response = await api.get(endpoint, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const contentType = response.headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const blob = new Blob([response.data], { type: contentType });

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', defaultFilename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(downloadUrl);
      } catch (e) {
        console.warn('[SRS download] cleanup error:', e);
      }
    }, 2000);
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.detail) {
          err.response.data = json;
        }
      } catch (_) {}
    }
    throw err;
  }
};

