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

export const downloadSrsDocx = async (urlOrKey, defaultFilename = 'SRS_Document.docx') => {
  if (!urlOrKey) {
    throw new Error('Download URL or file key not available.');
  }

  // If it's a full external HTTP/HTTPS URL (e.g. presigned S3 URL)
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    const link = document.createElement('a');
    link.href = urlOrKey;
    link.setAttribute('download', defaultFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Format the endpoint for API
  let endpoint = urlOrKey;
  if (endpoint.startsWith('/api/v1')) {
    endpoint = endpoint.replace('/api/v1', '');
  } else if (!endpoint.startsWith('/srs/download-file')) {
    const key = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    endpoint = `/srs/download-file?key=${encodeURIComponent(key)}`;
  }

  const response = await api.get(endpoint, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};
