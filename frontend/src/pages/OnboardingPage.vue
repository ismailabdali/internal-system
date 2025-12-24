<template>
  <div class="glass-card">
    <div class="card-header">
      <h2>Employee Onboarding</h2>
      <p class="subtitle">
        <span v-if="!isHRAdmin && !isSuperAdmin">
          Only HR Admin can submit onboarding requests.
        </span>
        <span v-else>
          Prepare assets and accounts for new talent. 
          <strong style="color: var(--shc-deep-green);">IT requests for devices will be auto-created when onboarding is submitted.</strong>
        </span>
      </p>
    </div>
    
    <div v-if="isHRAdmin || isSuperAdmin" class="info-banner" style="background: #e8f4f0; border-left: 4px solid var(--shc-deep-green); padding: 1.25rem 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
      <p style="margin: 0; font-size: 0.9rem; color: var(--shc-deep-green); line-height: 1.6;">
        <strong>💡 Child Requests:</strong> When you submit an onboarding request, child requests will be automatically created for:
        email setup, device setup (if selected), and system access (for each selected system). Each child request will be assigned to the appropriate IT admin.
      </p>
    </div>
    
    <div v-if="!isHRAdmin && !isSuperAdmin" class="empty-state">
      <p>You need to be an HR Admin to submit onboarding requests.</p>
      <p class="text-muted" style="margin-top: 0.5rem; font-size: 0.9rem;">
        Contact your administrator to update your permissions.
      </p>
    </div>
    
    <div v-else class="form-grid">
      <div class="input-group">
        <label>Hiring Manager <span class="required">*</span></label>
        <input 
          v-model="form.requesterName" 
          type="text"
          :class="{ 'error': errors.requesterName }"
          readonly
          style="background-color: #f5f5f5; cursor: not-allowed;"
        />
        <span v-if="errors.requesterName" class="error-message">{{ errors.requesterName }}</span>
      </div>
      <div class="input-group">
        <label>Department <span class="required">*</span></label>
        <input 
          v-model="form.department" 
          type="text"
          :class="{ 'error': errors.department }"
          readonly
          style="background-color: #f5f5f5; cursor: not-allowed;"
        />
        <span v-if="errors.department" class="error-message">{{ errors.department }}</span>
      </div>
      <div class="input-group">
        <label>New Hire Name <span class="required">*</span></label>
        <input 
          v-model="form.employeeName" 
          type="text"
          :class="{ 'error': errors.employeeName }"
        />
        <span v-if="errors.employeeName" class="error-message">{{ errors.employeeName }}</span>
      </div>
      <div class="input-group">
        <label>Position / Title <span class="required">*</span></label>
        <input 
          v-model="form.position" 
          type="text"
          :class="{ 'error': errors.position }"
        />
        <span v-if="errors.position" class="error-message">{{ errors.position }}</span>
      </div>
      <div class="input-group">
        <label>Start Date <span class="required">*</span></label>
        <input 
          v-model="form.startDate" 
          type="date"
          :class="{ 'error': errors.startDate }"
        />
        <span v-if="errors.startDate" class="error-message">{{ errors.startDate }}</span>
      </div>
      <div class="input-group">
        <label>Location</label>
        <input v-model="form.location" type="text" placeholder="e.g. Main Office" />
      </div>
      <div class="input-group full-width" style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin: 1rem 0;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--shc-deep-green);">IT Requirements</h3>
        
        <div class="checkbox-group" style="margin-bottom: 1rem;">
          <label class="checkbox-container">
            <input v-model="form.emailNeeded" type="checkbox" />
            <span class="checkmark"></span>
            <strong>Email Account Setup</strong>
            <span style="font-size: 0.85rem; color: var(--shc-text-secondary); display: block; margin-top: 0.25rem;">
              Creates email account for new employee
            </span>
          </label>
        </div>
        
        <div class="checkbox-group" style="margin-bottom: 1rem;">
          <label class="checkbox-container">
            <input v-model="form.deviceNeeded" type="checkbox" />
            <span class="checkmark"></span>
            <strong>Device Setup</strong>
            <span style="font-size: 0.85rem; color: var(--shc-text-secondary); display: block; margin-top: 0.25rem;">
              Creates device setup request
            </span>
          </label>
        </div>
        
        <div v-if="form.deviceNeeded" class="input-group" style="margin-top: 1rem; margin-bottom: 0;">
          <label>Device Type</label>
          <div class="select-wrapper">
            <select v-model="form.deviceType">
              <option value="">Select device type</option>
              <option>Business Laptop</option>
              <option>Engineer Laptop</option>
              <option>MacBook Pro</option>
              <option>Desktop Computer</option>
              <option>Tablet</option>
            </select>
          </div>
        </div>
        
        <div class="input-group full-width" style="margin-top: 1.5rem; margin-bottom: 0;">
          <label>System Access Required <span class="text-muted" style="font-size: 0.85rem; font-weight: normal;">(Select all that apply)</span></label>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 0.5rem;">
            <label class="checkbox-container" v-for="system in availableSystems" :key="system.key" style="padding: 0.75rem; background: white; border-radius: 6px; border: 1px solid var(--shc-border);">
              <input type="checkbox" :value="system.key" v-model="form.systemsRequested" />
              <span class="checkmark"></span>
              <span style="margin-left: 1.5rem;">{{ system.name }}</span>
            </label>
          </div>
        </div>
        
        <div class="checkbox-group" style="margin-top: 1rem;">
          <label class="checkbox-container">
            <input v-model="form.vpnRequired" type="checkbox" />
            <span class="checkmark"></span>
            VPN Access Required
          </label>
        </div>
      </div>
      <div class="input-group full-width">
        <label>Additional Notes</label>
        <textarea v-model="form.notes" rows="2" placeholder="Any additional information..."></textarea>
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="handleSubmit" :disabled="isSubmitting">
        <span v-if="isSubmitting" class="spinner-small"></span>
        <span>{{ isSubmitting ? 'Creating...' : 'Initialize Onboarding' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';

const apiBase = 'http://localhost:4000/api';
const { currentUser, isHRAdmin, isSuperAdmin, authenticatedFetch } = useAuth();
const { showToast } = useToast();

const emit = defineEmits(['submitted']);

const form = ref({
  requesterName: '',
  department: '',
  employeeName: '',
  position: '',
  location: '',
  startDate: '',
  deviceType: '',
  vpnRequired: false,
  notes: '',
  // New fields for child requests
  emailNeeded: true, // Default to true
  deviceNeeded: false,
  systemsRequested: [] // Array of system keys
});
const errors = ref({});
const isSubmitting = ref(false);

const availableSystems = [
  { key: 'M365', name: 'Microsoft 365' },
  { key: 'POWER_BI', name: 'Power BI Pro' },
  { key: 'ACONEX', name: 'Aconex' },
  { key: 'AUTODESK', name: 'Autodesk' },
  { key: 'P6', name: 'Primavera P6' },
  { key: 'RISK', name: 'RiskHive' }
];

// Auto-fill form with user info
const fillFormWithUserInfo = () => {
  if (currentUser.value) {
    form.value.requesterName = currentUser.value.fullName || '';
    form.value.department = currentUser.value.department || '';
  }
};

const validate = () => {
  errors.value = {};
  let isValid = true;
  
  if (!form.value.requesterName?.trim()) {
    errors.value.requesterName = 'Please refresh the page if your name is missing';
    isValid = false;
  }
  if (!form.value.department?.trim()) {
    errors.value.department = 'Please refresh the page if your department is missing';
    isValid = false;
  }
  if (!form.value.employeeName?.trim()) {
    errors.value.employeeName = 'New hire name is required';
    isValid = false;
  }
  if (!form.value.position?.trim()) {
    errors.value.position = 'Position is required';
    isValid = false;
  }
  if (!form.value.startDate) {
    errors.value.startDate = 'Start date is required';
    isValid = false;
  }
  
  return isValid;
};

const handleSubmit = async () => {
  if (!validate()) {
    return;
  }
  
  isSubmitting.value = true;
  try {
    const res = await authenticatedFetch(`${apiBase}/onboarding`, {
      method: 'POST',
      body: JSON.stringify(form.value)
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error || 'Failed to submit onboarding request';
      const errorDetails = data.details ? ` (${data.details})` : '';
      throw new Error(errorMsg + errorDetails);
    }
    
    let toastMessage = `Onboarding request created for ${data.employeeName}! (ID: ${data.requestId})`;
    if (data.autoITRequestCreated) {
      toastMessage += ` IT request #${data.autoITRequestId} auto-created for device setup!`;
    }
    showToast(toastMessage, 'success', data.autoITRequestCreated ? 10000 : 5000);
    
    // Reset form (keep name/department)
    form.value.employeeName = '';
    form.value.position = '';
    form.value.location = '';
    form.value.startDate = '';
    form.value.deviceType = '';
    form.value.vpnRequired = false;
    form.value.notes = '';
    form.value.emailNeeded = true;
    form.value.deviceNeeded = false;
    form.value.systemsRequested = [];
    
    emit('submitted');
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error', 8000);
    }
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  fillFormWithUserInfo();
});

watch(currentUser, () => {
  fillFormWithUserInfo();
}, { immediate: true });
</script>

