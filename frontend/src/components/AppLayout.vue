<template>
  <div>
    <header class="app-header">
      <div class="brand-group">
        <div class="brand-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="var(--shc-deep-green)"/>
            <path d="M20 40C8.9543 40 0 31.0457 0 20C0 8.9543 8.9543 0 20 0" fill="var(--shc-magenta)" style="mix-blend-mode: overlay; opacity: 0.6"/>
            <circle cx="20" cy="20" r="12" stroke="var(--shc-gold)" stroke-width="1.5"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>Sultan Haitham City</h1>
          <span class="brand-subtitle">Internal Services Portal</span>
        </div>
      </div>

      <div class="header-right">
        <div class="user-info">
          <span class="user-name">{{ currentUser?.fullName }}</span>
          <span class="user-dept">{{ currentUser?.department }}</span>
        </div>
        <button class="btn-secondary logout-btn" @click="$emit('logout')">
          Logout
        </button>
      </div>
    </header>

    <nav class="nav-pills">
      <button 
        v-for="tab in availableTabs" 
        :key="tab"
        :class="{ active: currentTab === tab }" 
        @click="$emit('tab-change', tab)"
      >
        {{ getTabLabel(tab) }}
      </button>
    </nav>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuth } from '../composables/useAuth';

const props = defineProps({
  currentTab: {
    type: String,
    required: true
  }
});

defineEmits(['logout', 'tab-change']);

const { currentUser, userRole, isLead, isAdminUser } = useAuth();

// Helper function to get tab label
const getTabLabel = (tab) => {
  const labels = {
    'car': 'Car Booking',
    'it': 'IT Request',
    'onboarding': 'Onboarding',
    'requests': 'My Requests',
    'admin': 'Admin',
    'fleet-calendar': 'Fleet Calendar'
  };
  return labels[tab] || tab;
};

// Role-based tab visibility
const availableTabs = computed(() => {
  const tabs = [];
  const role = userRole.value;
  
  // All users can access these
  tabs.push('requests');
  
  // Role-specific tabs
  if (role === 'SUPER_ADMIN' || role === 'FLEET_ADMIN' || role === 'EMPLOYEE') {
    tabs.push('car');
  }
  
  if (role === 'SUPER_ADMIN' || role === 'IT_ADMIN' || role === 'EMPLOYEE') {
    tabs.push('it');
  }
  
  // Onboarding: only HR_ADMIN or SUPER_ADMIN (removed isLead access)
  if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
    tabs.push('onboarding');
  }
  
  // Admin panel: only admins
  if (isAdminUser.value) {
    tabs.push('admin');
  }
  
  // Fleet Calendar: only FLEET_ADMIN and SUPER_ADMIN
  if (role === 'FLEET_ADMIN' || role === 'SUPER_ADMIN') {
    tabs.push('fleet-calendar');
  }
  
  return tabs;
});
</script>

