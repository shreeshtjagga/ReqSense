import { create } from 'zustand';
import { parseJwt } from '../utils/helpers';

const getInitialState = () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (accessToken) {
    const payload = parseJwt(accessToken);
    if (payload && payload.exp * 1000 > Date.now()) {
      return {
        accessToken,
        refreshToken,
        user: {
          id: payload.sub,
          role: payload.role,
          organization_id: payload.org,
        },
        isAuthenticated: true,
      };
    }
  }
  
  // Cleanup if token is expired
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  return {
    accessToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
  };
};

export const useAuthStore = create((set) => ({
  ...getInitialState(),

  login: (accessToken, refreshToken, userDetails = null) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    const payload = parseJwt(accessToken);
    const user = userDetails || {
      id: payload?.sub,
      role: payload?.role,
      organization_id: payload?.org,
    };

    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    const payload = parseJwt(accessToken);
    set((state) => ({
      accessToken,
      refreshToken,
      user: state.user ? { ...state.user, id: payload?.sub, role: payload?.role, organization_id: payload?.org } : {
        id: payload?.sub,
        role: payload?.role,
        organization_id: payload?.org,
      },
      isAuthenticated: true,
    }));
  },

  updateUserProfile: (profileData) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...profileData } : profileData,
    }));
  },
}));
