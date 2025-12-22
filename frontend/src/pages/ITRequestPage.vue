<template>
  <div class="glass-card">
    <div class="card-header">
      <h2>IT Support & Assets</h2>
      <p class="subtitle">Report technical issues or request hardware/software.</p>
    </div>

    <div class="form-grid">
      <div class="input-group">
        <label>Requester Name <span class="required">*</span></label>
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
      <div class="input-group full-width">
        <label>Request Title <span class="required">*</span></label>
        <input 
          v-model="form.title" 
          type="text" 
          class="highlight-input" 
          placeholder="What do you need help with?"
          :class="{ 'error': errors.title }"
        />
        <span v-if="errors.title" class="error-message">{{ errors.title }}</span>
      </div>
      <div class="input-group full-width">
        <label>Detailed Description <span class="required">*</span></label>
        <textarea 
          v-model="form.description" 
          rows="3"
          :class="{ 'error': errors.description }"
        ></textarea>
        <span v-if="errors.description" class="error-message">{{ errors.description }}</span>
      </div>
      <div class="input-group">
        <label>Category</label>
        <div class="select-wrapper">
          <select v-model="form.category">
            <option>Support / Incident</option>
            <option>Devices & Materials</option>
            <option>Access & Permissions</option>
            <option>Software / License</option>
          </select>
        </div>
      </div>
      <div class="input-group">
        <label>Urgency Level</label>
        <div class="select-wrapper">
          <select v-model="form.urgency" :class="`urgency-${form.urgency.toLowerCase()}`">
            <option>Normal</option>
            <option>Urgent</option>
            <option>Critical</option>
          </select>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="handleSubmit" :disabled="isSubmitting">
        <span v-if="isSubmitting" class="spinner-small"></span>
        <span>{{ isSubmitting ? 'Submitting...' : 'Submit Ticket' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';

const apiBase = 'http://localhost:4000/api';
const { currentUser, authenticatedFetch } = useAuth();
const { showToast } = useToast();

const emit = defineEmits(['submitted']);

const form = ref({
  requesterName: '',
  department: '',
  title: '',
  description: '',
  category: 'Support / Incident',
  systemName: '',
  impact: 'Medium',
  urgency: 'Normal',
  assetTag: ''
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
  if (!form.value.title?.trim()) {
    errors.value.title = 'Request title is required';
    isValid = false;
  }
  if (!form.value.description?.trim()) {
    errors.value.description = 'Description is required';
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
    const res = await authenticatedFetch(`${apiBase}/it-requests`, {
      method: 'POST',
      body: JSON.stringify(form.value)
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error || 'Failed to submit IT request';
      const errorDetails = data.details ? ` (${data.details})` : '';
      throw new Error(errorMsg + errorDetails);
    }
    showToast(`IT request created successfully! (ID: ${data.requestId})`, 'success');
    
    // Reset form (keep name/department)
    form.value.title = '';
    form.value.description = '';
    form.value.systemName = '';
    form.value.assetTag = '';
    
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

