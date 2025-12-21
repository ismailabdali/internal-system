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
        clearAuth();
        return;
      }
      const user = await res.json();
      currentUser.value = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {
      console.error('Token verification failed', e);
      clearAuth();
    }
  };

  // Clear authentication
  const clearAuth = () => {
    isLoggedIn.value = false;
    currentUser.value = null;
    authToken.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
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
    canAddNotes,
    // Methods
    getAuthHeaders,
    checkAuth,
    verifyToken,
    clearAuth
  };
}

