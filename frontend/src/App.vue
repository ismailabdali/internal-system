<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from './composables/useAuth';
import { useToast } from './composables/useToast';
import AppLayout from './components/AppLayout.vue';
import LoginPage from './pages/LoginPage.vue';
import CarBookingPage from './pages/CarBookingPage.vue';
import ITRequestPage from './pages/ITRequestPage.vue';
import OnboardingPage from './pages/OnboardingPage.vue';
import MyRequestsPage from './pages/MyRequestsPage.vue';
import AdminPage from './pages/AdminPage.vue';
import FleetCalendarPage from './pages/FleetCalendarPage.vue';

const { isLoggedIn, currentUser, checkAuth, clearAuth } = useAuth();
const { toasts, showToast, removeToast } = useToast();

const currentTab = ref('car');

// Check auth on mount and set default tab
onMounted(async () => {
  await checkAuth();
  // Wait for auth to complete, then set default tab
  // Use watch to handle async auth state
  let unwatchFn = null;
  unwatchFn = watch([isLoggedIn, currentUser], () => {
    if (isLoggedIn.value && currentUser.value) {
      const role = currentUser.value.role;
      if (['SUPER_ADMIN', 'IT_ADMIN', 'HR_ADMIN', 'FLEET_ADMIN'].includes(role)) {
        currentTab.value = 'requests';
      } else {
        currentTab.value = 'car';
      }
      // Stop watching after first set
      if (unwatchFn) {
        unwatchFn();
      }
    }
  }, { immediate: true });
});

// Handle login success
const handleLoginSuccess = (user) => {
  // Set default tab
  if (['SUPER_ADMIN', 'IT_ADMIN', 'HR_ADMIN', 'FLEET_ADMIN'].includes(user.role)) {
    currentTab.value = 'requests';
  } else {
    currentTab.value = 'car';
  }
  // Load requests after login
  setTimeout(() => {
    if (requestsPageRef.value) {
      requestsPageRef.value.loadRequests();
    }
  }, 200);
};

// Handle logout
const handleLogout = () => {
  clearAuth();
  currentTab.value = 'car';
};

// Handle tab change
const handleTabChange = (tab) => {
  currentTab.value = tab;
};

// Handle request submission (reload requests list)
const handleRequestSubmitted = () => {
  showToast('Request submitted successfully!', 'success');
  // Reload requests if on requests page
  if (currentTab.value === 'requests' && requestsPageRef.value) {
    setTimeout(() => {
      requestsPageRef.value.loadRequests();
    }, 500);
  }
};

// Handle view request from admin page
const handleViewRequest = (requestId) => {
  currentTab.value = 'requests';
  // Wait for tab to switch, then load request details
  setTimeout(() => {
    if (requestsPageRef.value) {
      requestsPageRef.value.loadRequestDetails(requestId);
    }
  }, 300);
};

// Refs for child components
const requestsPageRef = ref(null);
</script>

<template>
  <div class="app-container">
    <div class="bg-shape shape-1"></div>
    <div class="bg-shape shape-2"></div>

    <!-- Login Screen -->
    <LoginPage v-if="!isLoggedIn" @login-success="handleLoginSuccess" />

    <!-- Portal (shown when logged in) -->
    <AppLayout 
      v-else
      :current-tab="currentTab"
      @logout="handleLogout"
      @tab-change="handleTabChange"
    >
      <transition name="fade" mode="out-in">
        <!-- Car Booking Page -->
        <CarBookingPage 
          v-if="currentTab === 'car'"
          @submitted="handleRequestSubmitted"
        />

        <!-- IT Request Page -->
        <ITRequestPage 
          v-else-if="currentTab === 'it'"
          @submitted="handleRequestSubmitted"
        />

        <!-- Onboarding Page -->
        <OnboardingPage 
          v-else-if="currentTab === 'onboarding'"
          @submitted="handleRequestSubmitted"
        />

        <!-- My Requests Page -->
        <MyRequestsPage 
          v-else-if="currentTab === 'requests'"
          ref="requestsPageRef"
        />

        <!-- Admin Page -->
        <AdminPage 
          v-else-if="currentTab === 'admin'"
          @view-request="handleViewRequest"
        />

        <!-- Fleet Calendar Page -->
        <FleetCalendarPage 
          v-else-if="currentTab === 'fleet-calendar'"
          @view-request="handleViewRequest"
        />
      </transition>
    </AppLayout>

    <!-- Toast Notifications -->
    <div class="toast-container">
      <transition-group name="toast" tag="div">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          @click="removeToast(toast.id)"
        >
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" @click.stop="removeToast(toast.id)">×</button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style>
/* Sultan Haitham City Branding Theme 
  Based on Concept Presentation 
*/
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');

:root {
  /* Primary Identity  */
  --shc-deep-green: #37481f; 
  --shc-magenta: #5c1030;    /* Viva Magenta */
  --shc-gold: #dbb557;       /* Bright Yellow/Gold */
  --shc-emerald: #21423f;
  
  /* Functional Colors */
  --shc-bg-sand: #fcfbf9;    /* Clean paper look */
  --shc-bg-warm: #f3f0e9;    /* Warm beige for backgrounds */
  --shc-text-primary: #1a2212;
  --shc-text-secondary: #5e6658;
  --shc-border: #e0dcd0;
  
  /* UI Elements */
  --radius-lg: 24px;
  --radius-md: 16px;
  --radius-sm: 12px;
  --shadow-soft: 0 20px 40px -10px rgba(55, 72, 31, 0.08);
  --shadow-hover: 0 25px 50px -5px rgba(55, 72, 31, 0.12);
  
  /* Fonts */
  --font-heading: "Playfair Display", serif; /* Mimics Loren Pro [cite: 124] */
  --font-body: "Cairo", sans-serif; /* Matches Avenir Arabic/Clean sans  */
}

body {
  margin: 0;
  background-color: var(--shc-bg-warm);
  color: var(--shc-text-primary);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  background-image: radial-gradient(circle at 0% 0%, #fff 0%, transparent 50%), 
                    radial-gradient(circle at 100% 100%, #e8e2d2 0%, transparent 50%);
  background-attachment: fixed;
  min-height: 100vh;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
}

/* Abstract Background Shapes for "Nature" feel */
.bg-shape {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  z-index: -1;
  opacity: 0.4;
}
.shape-1 {
  width: 400px;
  height: 400px;
  background: var(--shc-gold);
  top: -100px;
  right: -50px;
  opacity: 0.15;
}
.shape-2 {
  width: 300px;
  height: 300px;
  background: var(--shc-emerald);
  bottom: 0;
  left: -50px;
  opacity: 0.1;
}

/* HEADER */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding: 1.5rem 0;
  border-bottom: 2px solid var(--shc-bg-warm);
  flex-wrap: wrap;
  gap: 1rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
  text-align: right;
}

.user-name {
  font-weight: 600;
  color: var(--shc-deep-green);
  font-size: 0.95rem;
}

.user-dept {
  font-size: 0.8rem;
  color: var(--shc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.logout-btn {
  padding: 0.5rem 1.2rem;
  font-size: 0.9rem;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-logo svg {
  width: 48px;
  height: 48px;
  filter: drop-shadow(0 4px 6px rgba(55, 72, 31, 0.2));
}

.brand-text h1 {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 1.75rem;
  color: var(--shc-deep-green);
  margin: 0;
  line-height: 1;
  letter-spacing: -0.02em;
}

.brand-subtitle {
  font-size: 0.85rem;
  color: var(--shc-magenta);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  margin-top: 4px;
  display: block;
}

/* NAVIGATION PILLS */
.nav-pills {
  display: flex;
  background: #fff;
  padding: 0.4rem;
  border-radius: 50px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  gap: 0.25rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.main-content {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
}

/* LOGIN SCREEN */
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 4rem);
  padding: 2rem;
}

.login-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid #fff;
  border-radius: var(--radius-lg);
  padding: 3rem;
  box-shadow: var(--shadow-soft);
  position: relative;
  overflow: hidden;
  max-width: 450px;
  width: 100%;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, var(--shc-deep-green), var(--shc-gold));
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 2.5rem;
  gap: 1rem;
}

.login-brand .brand-logo {
  display: flex;
  justify-content: center;
}

.login-brand .brand-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.login-brand .brand-text h1 {
  text-align: center;
  margin-bottom: 0.25rem;
}

.login-brand .brand-subtitle {
  text-align: center;
}

.login-form-section {
  text-align: center;
  width: 100%;
}

.login-form-section h2 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  font-size: 1.75rem;
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.login-form-section .text-muted {
  display: block;
  margin: 0 0 2rem 0;
  font-size: 0.95rem;
}

.login-subtitle {
  color: var(--shc-text-secondary);
  font-size: 0.95rem;
  margin: 0 0 2rem 0;
}

.login-form {
  text-align: left;
  margin-bottom: 1.5rem;
  width: 100%;
}

.login-form .input-group {
  margin-bottom: 1.5rem;
  width: 100%;
}

.login-form .input-group label {
  display: block;
  margin-bottom: 0.5rem;
  text-align: left;
}

.login-form .input-group input {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
}

.login-error {
  margin-top: 1rem;
  text-align: center;
  display: block;
}

.login-btn {
  width: 100%;
  margin-top: 1.5rem;
}

.login-hint {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--shc-bg-warm);
  font-size: 0.85rem;
  color: var(--shc-text-secondary);
  text-align: center;
  width: 100%;
}

.login-hint p {
  margin: 0 0 0.75rem 0;
  text-align: center;
}

.login-hint ul {
  text-align: left;
  display: inline-block;
  margin: 0.5rem auto 0 auto;
  padding-left: 1.5rem;
  font-size: 0.9em;
  list-style-position: outside;
}

.hint-text {
  font-family: monospace;
  color: var(--shc-deep-green);
  font-weight: 600;
  font-size: 0.9rem;
}

.nav-pills button {
  background: transparent;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 40px;
  font-family: var(--font-body);
  font-weight: 600;
  color: var(--shc-text-secondary);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.9rem;
}

.nav-pills button:hover {
  color: var(--shc-deep-green);
  background: rgba(55, 72, 31, 0.05);
}

.nav-pills button.active {
  background: var(--shc-deep-green);
  color: #fff;
  box-shadow: 0 4px 12px rgba(55, 72, 31, 0.25);
}

/* GLASS CARD (Main Container) */
.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid #fff;
  border-radius: var(--radius-lg);
  padding: 3rem;
  box-shadow: var(--shadow-soft);
  position: relative;
  overflow: hidden;
  max-width: 100%;
}

/* Top accent border (Gold) */
.glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, var(--shc-deep-green), var(--shc-gold));
}

.card-header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(55, 72, 31, 0.1);
  width: 100%;
}

.card-header.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.card-header.flex-between > div {
  flex: 1;
  min-width: 200px;
}

.card-header h2 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  font-size: 2rem;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  line-height: 1.2;
}

.card-header.flex-between h2 {
  margin-bottom: 0.5rem;
}

.card-header h2::before {
  content: '';
  width: 4px;
  height: 2rem;
  background: linear-gradient(180deg, var(--shc-deep-green), var(--shc-gold));
  border-radius: 2px;
  flex-shrink: 0;
}

.subtitle {
  color: var(--shc-text-secondary);
  font-size: 1rem;
  margin: 0;
  line-height: 1.6;
  padding-left: 1.75rem;
}

.card-header.flex-between .subtitle {
  padding-left: 1.75rem;
}

/* FORM ELEMENTS */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem 2rem;
  margin-bottom: 2rem;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-md);
  border: 1px solid rgba(55, 72, 31, 0.1);
  align-items: start;
  width: 100%;
  box-sizing: border-box;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-height: fit-content;
  width: 100%;
}

.input-group label {
  margin-bottom: 0;
  line-height: 1.4;
  width: 100%;
  display: block;
}

.input-group.full-width {
  grid-column: span 2;
  width: 100%;
}

label {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--shc-text-secondary);
  margin-bottom: 0;
  display: block;
  line-height: 1.4;
}

.input-group label {
  margin-bottom: 0;
}

input, textarea, select {
  background: #fff;
  border: 2px solid var(--shc-border);
  border-radius: var(--radius-sm);
  padding: 0.95rem 1.1rem;
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--shc-deep-green);
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  width: 100%;
  box-sizing: border-box;
  line-height: 1.5;
}

textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.6;
}

input:hover, textarea:hover, select:hover {
  border-color: var(--shc-gold);
  box-shadow: 0 2px 12px rgba(219, 181, 87, 0.1);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--shc-gold);
  box-shadow: 0 0 0 4px rgba(219, 181, 87, 0.2), 0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

input.error, textarea.error, select.error {
  border-color: var(--shc-magenta);
  background-color: #fff5f5;
}

input.error:focus, textarea.error:focus, select.error:focus {
  border-color: var(--shc-magenta);
  box-shadow: 0 0 0 4px rgba(219, 68, 55, 0.15), 0 4px 12px rgba(0,0,0,0.08);
}

::placeholder {
  color: #c0baa8;
}

/* Custom Select Styling */
.select-wrapper {
  position: relative;
}
.select-wrapper::after {
  content: '▼';
  font-size: 0.7rem;
  color: var(--shc-gold);
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
select {
  appearance: none;
  width: 100%;
  cursor: pointer;
}

/* CHECKBOX */
.checkbox-group {
  grid-column: span 2;
  margin-top: 0.25rem;
  padding-top: 0.5rem;
}
.checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 1rem;
  text-transform: none;
  color: var(--shc-deep-green);
  font-weight: 500;
  padding: 0.5rem 0;
}
.checkbox-container input {
  display: none;
}
.checkmark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--shc-border);
  border-radius: 6px;
  background: #fff;
  position: relative;
  transition: all 0.2s;
}
.checkbox-container input:checked ~ .checkmark {
  background: var(--shc-deep-green);
  border-color: var(--shc-deep-green);
}
.checkmark::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  display: none;
}
.checkbox-container input:checked ~ .checkmark::after {
  display: block;
}

/* BUTTONS */
.btn-primary {
  background: linear-gradient(135deg, var(--shc-deep-green), #4a5d2e);
  color: #fff;
  border: none;
  padding: 1.1rem 2.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 10px 25px rgba(55, 72, 31, 0.25);
  font-family: var(--font-body);
  position: relative;
  overflow: hidden;
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s;
}

.btn-primary:hover::before {
  left: 100%;
}

.btn-primary:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #2b3a18, var(--shc-deep-green));
  box-shadow: 0 15px 30px rgba(55, 72, 31, 0.35);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled, .btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: white;
  color: var(--shc-deep-green);
  border: 1px solid var(--shc-border);
  padding: 0.6rem 1.2rem;
  border-radius: 50px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover {
  border-color: var(--shc-deep-green);
  background: var(--shc-bg-sand);
}

/* TABLE STYLING */
.table-container {
  overflow-x: auto;
  width: 100%;
  box-sizing: border-box;
}
.styled-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  table-layout: auto;
}
.styled-table th {
  text-align: left;
  padding: 1rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--shc-text-secondary);
  border-bottom: 2px solid var(--shc-bg-warm);
  white-space: nowrap;
  vertical-align: middle;
}
.styled-table td {
  padding: 1.2rem 1rem;
  border-bottom: 1px solid var(--shc-bg-warm);
  font-size: 0.95rem;
  vertical-align: middle;
}
.font-mono {
  font-family: monospace;
  color: var(--shc-gold);
  font-weight: bold;
}

.employee-id {
  color: var(--shc-text-secondary);
  font-size: 0.85rem;
  font-weight: normal;
}
.status-indicator {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--shc-bg-warm);
  color: var(--shc-text-secondary);
}
.status-indicator[data-status="Pending"] {
  background: #fff8e1;
  color: #b58900;
}
.status-indicator[data-status="Approved"] {
  background: #e3f9e5;
  color: var(--shc-deep-green);
}
.status-indicator[data-status="BOOKED"] {
  background: #e3f2fd;
  color: #1976d2;
}
.status-indicator[data-status="IN_PROGRESS"] {
  background: #fff3e0;
  color: #f57c00;
}
.status-indicator[data-status="COMPLETED"] {
  background: #e8f5e9;
  color: #2e7d32;
}
.status-indicator[data-status="REJECTED"] {
  background: #ffebee;
  color: var(--shc-magenta);
}
.status-indicator[data-status="CANCELLED"] {
  background: #f5f5f5;
  color: #757575;
  text-decoration: line-through;
}
.status-indicator[data-status="Inactive"] {
  background: #f5f5f5;
  color: #757575;
}
.status-indicator[data-status="INACTIVE"] {
  background: #f5f5f5;
  color: #757575;
}

.type-pill {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--shc-bg-warm);
  color: var(--shc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fw-bold {
  font-weight: 700;
}

/* TRANSITIONS */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* FORM VALIDATION */
.required {
  color: var(--shc-magenta);
  font-weight: 700;
  margin-left: 0.25rem;
}

.text-muted {
  color: var(--shc-text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.error-message {
  color: var(--shc-magenta);
  font-size: 0.8rem;
  margin-top: 0.375rem;
  display: block;
  line-height: 1.4;
  font-weight: 500;
}

.mt-1 {
  margin-top: 0.5rem;
}

.mt-2 {
  margin-top: 1rem;
}

/* LOADING STATES */
.spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 0.5rem;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(55, 72, 31, 0.2);
  border-top-color: var(--shc-deep-green);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 2px solid rgba(55, 72, 31, 0.1);
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.actions .btn-primary {
  min-width: 180px;
}

.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-sm);
  margin-bottom: 2rem;
  line-height: 1.6;
}

.info-banner p {
  margin: 0;
  line-height: 1.6;
  flex: 1;
}

/* FILTERS AND SEARCH */
.filters-section {
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.search-box {
  flex: 1;
  min-width: 250px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--shc-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.95rem;
  background: #fff;
}

.filter-group {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  min-width: 150px;
}

.filter-select select {
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
}

/* TABLE IMPROVEMENTS */
.table-row-clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.table-row-clickable:hover {
  background-color: rgba(55, 72, 31, 0.03);
}

.btn-link {
  background: none;
  border: none;
  color: var(--shc-deep-green);
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn-link:hover {
  background: rgba(55, 72, 31, 0.1);
}

.text-success {
  color: var(--shc-deep-green);
}

/* EMPTY STATE */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--shc-text-secondary);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  opacity: 0.3;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

/* MODAL */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  box-sizing: border-box;
  overflow: auto;
}

.modal-content {
  background: #fff;
  border-radius: var(--radius-lg);
  max-width: 800px;
  width: 100%;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  position: relative;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--shc-bg-warm);
  flex-shrink: 0;
  min-height: fit-content;
}

.modal-header h3 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--shc-text-secondary);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--shc-bg-warm);
  color: var(--shc-deep-green);
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-update-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--shc-border);
  border-radius: var(--radius-sm);
  background: white;
  font-size: 0.9rem;
  color: var(--shc-text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.status-select:focus {
  outline: none;
  border-color: var(--shc-deep-green);
  box-shadow: 0 0 0 3px rgba(55, 72, 31, 0.1);
}

.status-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-body {
  padding: 2rem;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--shc-text-primary);
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-section-title {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--shc-deep-green);
  margin-top: 2rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--shc-bg-warm);
}

.detail-section-title:first-child {
  margin-top: 0;
}

.detail-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 1.25rem;
  align-items: start;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(55, 72, 31, 0.05);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row.full-width {
  grid-template-columns: 1fr;
  flex-direction: column;
}

.detail-label {
  font-weight: 700;
  color: var(--shc-text-secondary);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1.5;
}

.detail-row span:not(.detail-label) {
  font-size: 1rem;
  color: var(--shc-text-primary);
  line-height: 1.6;
  word-break: break-word;
}

.detail-description {
  margin: 0.5rem 0 0 0;
  color: var(--shc-text-primary);
  line-height: 1.6;
}

/* URGENCY BADGES */
.urgency-normal {
  color: var(--shc-deep-green);
}

.urgency-urgent {
  color: #b58900;
}

.urgency-critical {
  color: var(--shc-magenta);
}

.urgency-badge[data-urgency="Normal"] {
  background: #e3f9e5;
  color: var(--shc-deep-green);
}

.urgency-badge[data-urgency="Urgent"] {
  background: #fff8e1;
  color: #b58900;
}

.urgency-badge[data-urgency="Critical"] {
  background: #ffebee;
  color: var(--shc-magenta);
}

/* ADMIN SECTION */
.admin-section {
  margin-bottom: 3rem;
}

.admin-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  font-size: 1.5rem;
  margin: 0;
}

/* FEEDBACK MESSAGES */
.feedback-container {
  margin-top: 1rem;
}

.feedback {
  padding: 1rem 1.5rem;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.feedback-container .feedback + .feedback {
  margin-top: 0.5rem;
}

.feedback.success {
  background: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.feedback.error {
  background: #ffebee;
  color: var(--shc-magenta);
  border-left: 4px solid var(--shc-magenta);
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* MODAL TRANSITIONS */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content, .modal-leave-active .modal-content {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from .modal-content, .modal-leave-to .modal-content {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-soft);
  background: white;
  border-left: 4px solid;
  animation: slideInRight 0.3s ease;
  cursor: pointer;
  transition: transform 0.2s;
}

.toast:hover {
  transform: translateX(-4px);
}

.toast-success {
  border-left-color: var(--shc-deep-green);
  background: #f0f7f0;
}

.toast-error {
  border-left-color: var(--shc-magenta);
  background: #fff5f5;
}

.toast-info {
  border-left-color: #1976d2;
  background: #e3f2fd;
}

.toast-warning {
  border-left-color: #b58900;
  background: #fff8e1;
}

.toast-message {
  flex: 1;
  font-size: 0.9rem;
  color: var(--shc-text-primary);
  line-height: 1.4;
}

.toast-close {
  margin-left: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--shc-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.toast-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--shc-text-primary);
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Admin Panel Enhancements */
.edit-input,
.edit-select {
  padding: 0.5rem;
  border: 1px solid var(--shc-border);
  border-radius: 6px;
  font-size: 0.9rem;
  width: 100%;
  max-width: 200px;
}

.edit-input:focus,
.edit-select:focus {
  outline: none;
  border-color: var(--shc-deep-green);
  box-shadow: 0 0 0 3px rgba(55, 72, 31, 0.1);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* RESPONSIVE */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .input-group.full-width {
    grid-column: span 1;
  }
  .app-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .header-right {
    width: 100%;
    justify-content: space-between;
    margin-top: 1rem;
  }
  .user-info {
    align-items: flex-start;
  }
  .nav-pills {
    width: 100%;
    overflow-x: auto;
  }
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-group {
    flex-direction: column;
  }
  .filter-select {
    width: 100%;
  }
  .modal-content {
    margin: 0.5rem;
    max-height: calc(100vh - 1rem);
    width: calc(100% - 1rem);
    max-width: 100%;
  }
  .modal-header, .modal-body {
    padding: 1rem;
  }
  .modal-header h3 {
    font-size: 1.25rem;
  }
  .detail-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .detail-label {
    margin-bottom: 0.25rem;
  }
  .table-container {
    overflow-x: auto;
  }
  .login-container {
    padding: 1rem;
    min-height: calc(100vh - 2rem);
  }
  .login-card {
    padding: 2rem 1.5rem;
  }
  .toast-container {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    max-width: none;
  }
  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }
}

/* Notes Section in Modal */
.notes-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--shc-bg-warm);
}

.note-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--shc-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.95rem;
  resize: vertical;
  min-height: 80px;
}
</style>
