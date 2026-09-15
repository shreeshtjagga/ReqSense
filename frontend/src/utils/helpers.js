const normalizeUtc = (dateString) => {
  if (!dateString) return null;
  if (typeof dateString !== 'string') return new Date(dateString);
  const trimmed = dateString.trim();
  if (trimmed.endsWith('Z') || trimmed.includes('+') || /-\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const isoStr = trimmed.includes('T') ? trimmed + 'Z' : trimmed.replace(' ', 'T') + 'Z';
  return new Date(isoStr);
};

export const formatDate = (dateString) => {
  const date = normalizeUtc(dateString);
  if (!date || isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString) => {
  const date = normalizeUtc(dateString);
  if (!date || isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatChatTime = (dateString) => {
  const date = normalizeUtc(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

export const getFeatureStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'planned':
      return 'warning';
    default:
      return 'default';
  }
};

export const getChangeRequestStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

export const getConflictStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'resolved':
      return 'success';
    case 'ignored':
      return 'info';
    case 'pending':
      return 'warning';
    case 'unresolved':
      return 'error';
    default:
      return 'default';
  }
};

export const getRoleLabel = (role) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'developer':
      return 'Developer';
    case 'client':
      return 'Client';
    default:
      return role || 'User';
  }
};

export const formatPercent = (value) => {
  if (value === null || value === undefined) return '0%';
  return `${Math.round(value)}%`;
};

export const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};
