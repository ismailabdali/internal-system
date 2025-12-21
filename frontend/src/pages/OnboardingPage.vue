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
        <strong>💡 Automatic IT Request:</strong> When you submit an onboarding request with a device selected, 
        an IT request will be automatically created for device setup and configuration.
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
      <div class="input-group">
        <label>
          Primary Device 
          <span class="info-badge" style="font-size: 0.7rem; font-weight: normal; color: var(--shc-text-secondary); text-transform: none; letter-spacing: 0; margin-left: 0.5rem;">(Auto-creates IT request)</span>
        </label>
        <div class="select-wrapper">
          <select v-model="form.deviceType">
            <option value="">No device needed</option>
            <option>Business Laptop</option>
            <option>Engineer Laptop</option>
            <option>MacBook Pro</option>
            <option>Desktop Computer</option>
            <option>Tablet</option>
          </select>
        </div>
        <span v-if="form.deviceType" class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem; display: block; line-height: 1.5; color: var(--shc-deep-green); font-weight: 500;">
          ✓ IT request will be auto-created when onboarding is completed
        </span>
      </div>
      <div class="input-group checkbox-group">
        <label class="checkbox-container">
          <input v-model="form.vpnRequired" type="checkbox" />
          <span class="checkmark"></span>
          VPN Access Required
        </label>
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
const { currentUser, isHRAdmin, isSuperAdmin, getAuthHeaders, clearAuth } = useAuth();
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
  notes: ''
});
const errors = ref({});
const isSubmitting = ref(false);

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
    const res = await fetch(`${apiBase}/onboarding`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(form.value)
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
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
    
    emit('submitted');
  } catch (e) {
    showToast(e.message, 'error', 8000);
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

