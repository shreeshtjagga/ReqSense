import axios from 'axios';
import { API_URL, API_PREFIX } from '../utils/constants';
import { useAuthStore } from '../store/authStore';

const instance = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach access token to headers
instance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor #1: Normalize backend error envelope
// Backend returns: { "error": { "code": "...", "message": "..." } }
// Every page reads: err.response?.data?.detail
// This interceptor maps them so all existing code keeps working without changes.
instance.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.data?.error) {
      // Hoist message to .detail and code to .code at the top level
      error.response.data.detail = error.response.data.error.message;
      error.response.data.code = error.response.data.error.code;
    }
    return Promise.reject(error);
  }
);

// Response Interceptor #2: Handle 401 errors with silent refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 Unauthorized and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request while we are already refreshing tokens
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return instance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        // Call refresh endpoint to get new tokens
        // We use a fresh axios instance here to avoid request/response interceptor loops
        const refreshResponse = await axios.post(`${API_URL}${API_PREFIX}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = refreshResponse.data;

        // Save tokens in Zustand store
        useAuthStore.getState().setTokens(access_token, refresh_token);

        // Process queued requests
        processQueue(null, access_token);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        isRefreshing = false;
        return instance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear session and reject
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        isRefreshing = false;
        
        // Force redirect to login page if window is available
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default instance;
