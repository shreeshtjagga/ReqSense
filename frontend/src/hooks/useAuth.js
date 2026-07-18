import { useAuthStore } from '../store/authStore';
import { ROLES } from '../utils/constants';

export const useAuth = () => {
  const { user, accessToken, isAuthenticated, logout } = useAuthStore();

  const hasRole = (allowedRoles) => {
    if (!user?.role) return false;
    return allowedRoles.includes(user.role);
  };

  return {
    user,
    accessToken,
    isAuthenticated,
    logout,
    hasRole,
    isAdmin: user?.role === ROLES.ADMIN,
    isDeveloper: user?.role === ROLES.DEVELOPER,
    isClient: user?.role === ROLES.CLIENT,
  };
};

export default useAuth;
