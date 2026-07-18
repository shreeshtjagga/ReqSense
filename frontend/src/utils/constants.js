export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_PREFIX = '/api/v1';

export const ROLES = {
  CLIENT: 'client',
  DEVELOPER: 'developer',
  ADMIN: 'admin',
};

export const PROJECT_DOMAINS = {
  MOBILE_APP: 'mobile_app',
  WEB_APP: 'web_app',
  SOFTWARE: 'software',
  API: 'api',
};

export const PROJECT_DOMAIN_LABELS = {
  mobile_app: 'Mobile App',
  web_app: 'Web App',
  software: 'Software System',
  api: 'API Platform',
};

export const PROJECT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  ARCHIVED: 'archived',
};

export const SESSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
};

export const MESSAGE_SENDER = {
  CLIENT: 'client',
  ARIA: 'aria',
  SYSTEM: 'system',
};

export const MESSAGE_TYPE = {
  NORMAL: 'normal',
  QUESTION: 'question',
  CONFLICT_ALERT: 'conflict_alert',
  CLARIFICATION: 'clarification',
  SUMMARY: 'summary',
};

export const CONFLICT_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  UNRESOLVED: 'unresolved',
  IGNORED: 'ignored',
};

export const FEATURE_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const CHANGE_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};
