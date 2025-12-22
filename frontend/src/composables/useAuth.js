import { ref, computed } from 'vue';

const apiBase = 'http://localhost:4000/api';

// Shared auth state
const isLoggedIn = ref(false);
const currentUser = ref(null);
const authToken = ref(null);

export function useAuth() {
  // Role-based computed properties
  const userRole = computed(() => currentUser.value?.role || 'EMPLOYEE');
  const isSuperAdmin = computed(() => userRole.value === 'SUPER_ADMIN');
  const isITAdmin = computed(() => userRole.value === 'IT_ADMIN');
  const isHRAdmin = computed(() => userRole.value === 'HR_ADMIN');
  const isFleetAdmin = computed(() => userRole.value === 'FLEET_ADMIN');
  const isAdminUser = computed(() => {
    return ['SUPER_ADMIN', 'IT_ADMIN', 'HR_ADMIN', 'FLEET_ADMIN'].includes(userRole.value);
  });
  const isLead = computed(() => currentUser.value?.isLead || false);

  // Role-based permissions
  const canManageEmployees = computed(() => isSuperAdmin.value || isHRAdmin.value);
  const canManageVehicles = computed(() => isSuperAdmin.value || isFleetAdmin.value);
  const canManageAllRequests = computed(() => isAdminUser.value);
  const canViewEmployeeId = computed(() => isSuperAdmin.value);
  
  // Check if user can update a specific request
  const canUpdateRequest = (request) => {
    if (!request) return false;
    if (isSuperAdmin.value) return true;
    if (isITAdmin.value && request.type === 'IT') return true;
    if (isITAdmin.value && request.type === 'ONBOARDING' && (request.currentStep === 'IT_SETUP' || request.workflowStatus === 'IT_SETUP')) return true;
    if (isHRAdmin.value && request.type === 'ONBOARDING') return true;
    if (isFleetAdmin.value && request.type === 'CAR_BOOKING') return true;
    return false;
  };
  
  // Check if user can cancel a specific car booking
  const canCancelBooking = (request) => {
    if (!request || request.type !== 'CAR_BOOKING') return false;
    if (request.status === 'CANCELLED' || request.status === 'COMPLETED') return false;
    
    // Fleet Admin can cancel any booking
    if (isFleetAdmin.value || isSuperAdmin.value) return true;
    
    // Employees can cancel their own bookings
    if (currentUser.value && request.employeeId === currentUser.value.id) return true;
    
    return false;
  };
  
  // Check if user can add notes to a request
  const canAddNotes = (request) => {
    if (!request) return false;
    if (isSuperAdmin.value) return true;
    if (isITAdmin.value && (request.type === 'IT' || (request.type === 'ONBOARDING' && (request.currentStep === 'IT_SETUP' || request.workflowStatus === 'IT_SETUP')))) return true;
    if (isHRAdmin.value && request.type === 'ONBOARDING') return true;
    if (isFleetAdmin.value && request.type === 'CAR_BOOKING') return true;
    return false;
  };

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken.value) {
      headers['Authorization'] = `Bearer ${authToken.value}`;
    }
    return headers;
  };
  
  // Helper to handle 401 errors - try to refresh token first
  const handle401Error = async (response) => {
    if (response.status === 401 && authToken.value) {
      // Try to refresh token once
      const refreshed = await refreshToken();
      if (refreshed) {
        // Token refreshed, return true to retry the request
        return true;
      }
      // Refresh failed, clear auth
      clearAuth();
      return false;
    }
    return false;
  };
  
  // Wrapper for fetch that automatically handles token refresh on 401
  const authenticatedFetch = async (url, options = {}) => {
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers || {})
    };
    
    let response = await fetch(url, { ...options, headers });
    
    // If we get a 401, try to refresh the token and retry once
    if (response.status === 401 && authToken.value) {
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry the request with the refreshed token
        headers['Authorization'] = `Bearer ${authToken.value}`;
        response = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed, clear auth
        clearAuth();
        throw new Error('Session expired. Please log in again.');
      }
    }
    
    return response;
  };
  
  // Start periodic token refresh (every 30 minutes)
  let refreshInterval = null;
  const startTokenRefresh = () => {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
      if (isLoggedIn.value && authToken.value) {
        await checkAndRefreshToken();
      }
    }, 30 * 60 * 1000); // Every 30 minutes
  };
  
  const stopTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };

  // Check localStorage on mount
  const checkAuth = async () => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedToken && storedUser) {
      try {
        authToken.value = storedToken;
        currentUser.value = JSON.parse(storedUser);
        isLoggedIn.value = true;
        // Verify token is still valid
        await verifyToken();
        // Start periodic token refresh if logged in
        if (isLoggedIn.value) {
          startTokenRefresh();
        }
      } catch (e) {
        console.error('Error parsing stored user data', e);
        clearAuth();
      }
    }
  };

  // Verify token with backend
  const verifyToken = async () => {
    try {
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken.value}`
        }
      });
      if (!res.ok) {
        // Only clear auth if it's a real authentication error, not a network error
        if (res.status === 401) {
          clearAuth();
        }
        return;
      }
      const user = await res.json();
      currentUser.value = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Store token expiration time if provided
      if (user.tokenExpiresAt) {
        localStorage.setItem('tokenExpiresAt', user.tokenExpiresAt.toString());
      }
    } catch (e) {
      console.error('Token verification failed', e);
      // Don't clear auth on network errors - might be temporary
      if (e.message && !e.message.includes('fetch')) {
        clearAuth();
      }
    }
  };
  
  // Refresh token before expiration
  const refreshToken = async () => {
    if (!authToken.value) return false;
    
    try {
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken.value}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          clearAuth();
          return false;
        }
        return false;
      }
      
      const data = await res.json();
      if (data.expiresAt) {
        localStorage.setItem('tokenExpiresAt', data.expiresAt.toString());
      }
      return true;
    } catch (e) {
      console.error('Token refresh failed', e);
      return false;
    }
  };
  
  // Check if token needs refresh (refresh if less than 1 hour remaining)
  const checkAndRefreshToken = async () => {
    const expiresAt = localStorage.getItem('tokenExpiresAt');
    if (!expiresAt || !authToken.value) return;
    
    const expirationTime = parseInt(expiresAt, 10);
    const timeUntilExpiry = expirationTime - Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Refresh if less than 1 hour remaining
    if (timeUntilExpiry > 0 && timeUntilExpiry < oneHour) {
      await refreshToken();
    }
  };

  // Clear authentication
  const clearAuth = () => {
    stopTokenRefresh();
    isLoggedIn.value = false;
    currentUser.value = null;
    authToken.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('tokenExpiresAt');
  };

  return {
    // State
    isLoggedIn,
    currentUser,
    authToken,
    // Computed
    userRole,
    isSuperAdmin,
    isITAdmin,
    isHRAdmin,
    isFleetAdmin,
    isAdminUser,
    isLead,
    canManageEmployees,
    canManageVehicles,
    canManageAllRequests,
    canViewEmployeeId,
    canUpdateRequest,
    canCancelBooking,
    canAddNotes,
    // Methods
    getAuthHeaders,
    checkAuth,
    verifyToken,
    refreshToken,
    checkAndRefreshToken,
    startTokenRefresh,
    handle401Error,
    authenticatedFetch,
    clearAuth
  };
}

