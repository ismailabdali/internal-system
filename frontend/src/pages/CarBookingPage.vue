<template>
  <div class="glass-card">
    <div class="card-header">
      <h2>Vehicle Requisition</h2>
      <p class="subtitle">Book a fleet vehicle for official city business.</p>
    </div>

    <div class="form-grid">
      <div class="input-group">
        <label>Full Name <span class="required">*</span></label>
        <input 
          v-model="form.requesterName" 
          type="text" 
          placeholder="e.g. Ismail Al Abdali"
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
        <label>Booking Date <span class="required">*</span></label>
        <input 
          v-model="selectedDate" 
          type="date"
          :min="new Date().toISOString().split('T')[0]"
          @change="loadAvailableSlots"
          :class="{ 'error': errors.selectedDate }"
        />
        <span v-if="errors.selectedDate" class="error-message">{{ errors.selectedDate }}</span>
      </div>
      <div class="input-group full-width">
        <label>Available Time Slots <span class="required">*</span></label>
        <div v-if="selectedDate && availableSlots.length" class="time-slots-grid">
          <button
            v-for="slot in availableSlots"
            :key="slot.start"
            type="button"
            :class="['time-slot-btn', { 
              'selected': isSlotSelected(slot),
              'unavailable': !slot.available 
            }]"
            :disabled="!slot.available"
            @click="selectTimeSlot(slot)"
          >
            <span class="slot-time">{{ slot.startTime }}</span>
            <span class="slot-end-time">- {{ slot.endTime }}</span>
          </button>
        </div>
        <div v-else-if="selectedDate && isLoadingSlots" class="text-muted" style="padding: 1rem; text-align: center;">
          Loading available slots...
        </div>
        <div v-else-if="selectedDate && !isLoadingSlots" class="text-muted" style="padding: 1rem; text-align: center;">
          Please select a date to view available time slots
        </div>
        <div v-else class="text-muted" style="padding: 1rem; text-align: center;">
          Select a date to see available time slots
        </div>
        <div v-if="selectedStartSlot && selectedEndSlot" class="selected-slots-info">
          <strong>Selected:</strong> {{ formatSlotTime(selectedStartSlot.startTime) }} - {{ formatSlotTime(selectedEndSlot.endTime) }}
        </div>
        <span v-if="errors.startDatetime || errors.endDatetime" class="error-message">
          {{ errors.startDatetime || errors.endDatetime }}
        </span>
      </div>
      <div class="input-group">
        <label>Destination <span class="required">*</span></label>
        <input 
          v-model="form.destination" 
          type="text"
          :class="{ 'error': errors.destination }"
        />
        <span v-if="errors.destination" class="error-message">{{ errors.destination }}</span>
      </div>
      <div class="input-group full-width">
        <label>Purpose of Trip <span class="required">*</span></label>
        <textarea 
          v-model="form.reason" 
          rows="2" 
          placeholder="Briefly describe the business need..."
          :class="{ 'error': errors.reason }"
        ></textarea>
        <span v-if="errors.reason" class="error-message">{{ errors.reason }}</span>
      </div>
      <div class="input-group">
        <label>Passengers</label>
        <input v-model.number="form.passengers" type="number" min="1" />
      </div>
      <div class="input-group">
        <label>Vehicle Selection</label>
        <div class="select-wrapper">
          <select v-model="form.vehicleId" :disabled="isLoadingVehicles">
            <option value="">Auto-assign (First Available)</option>
            <option 
              v-for="vehicle in vehicles" 
              :key="vehicle.id" 
              :value="vehicle.id"
            >
              {{ vehicle.name }} ({{ vehicle.plate_number }})
            </option>
          </select>
        </div>
        <span v-if="isLoadingVehicles" class="text-muted" style="font-size: 0.85rem;">Loading vehicles...</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="handleSubmit" :disabled="isSubmitting">
        <span v-if="isSubmitting" class="spinner-small"></span>
        <span>{{ isSubmitting ? 'Booking...' : 'Confirm Booking' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';

const apiBase = 'http://localhost:4000/api';
const { currentUser, getAuthHeaders, clearAuth } = useAuth();
const { showToast } = useToast();

const emit = defineEmits(['submitted']);

const vehicles = ref([]);
const isLoadingVehicles = ref(false);
const availableSlots = ref([]);
const isLoadingSlots = ref(false);
const selectedDate = ref('');
const selectedStartSlot = ref(null);
const selectedEndSlot = ref(null);
const form = ref({
  requesterName: '',
  department: '',
  startDatetime: '',
  endDatetime: '',
  destination: '',
  reason: '',
  passengers: '',
  vehicleId: ''
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

// Load vehicles
const loadVehicles = async () => {
  isLoadingVehicles.value = true;
  try {
    const res = await fetch(`${apiBase}/vehicles`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load vehicles');
    vehicles.value = await res.json();
  } catch (e) {
    console.error('Error loading vehicles:', e);
    vehicles.value = [];
  } finally {
    isLoadingVehicles.value = false;
  }
};

const loadAvailableSlots = async () => {
  if (!selectedDate.value) {
    availableSlots.value = [];
    return;
  }
  
  isLoadingSlots.value = true;
  try {
    const params = new URLSearchParams({ date: selectedDate.value });
    if (form.value.vehicleId) {
      params.append('vehicleId', form.value.vehicleId);
    }
    
    const res = await fetch(`${apiBase}/car-bookings/available-slots?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load available slots');
    }
    
    const data = await res.json();
    availableSlots.value = data.slots || [];
    
    // Clear selected slots when date changes
    selectedStartSlot.value = null;
    selectedEndSlot.value = null;
    form.value.startDatetime = '';
    form.value.endDatetime = '';
  } catch (e) {
    showToast(e.message, 'error');
    availableSlots.value = [];
  } finally {
    isLoadingSlots.value = false;
  }
};

const selectTimeSlot = (slot) => {
  if (!slot.available) return;
  
  if (!selectedStartSlot.value) {
    // Select start slot
    selectedStartSlot.value = slot;
    form.value.startDatetime = slot.start;
  } else if (!selectedEndSlot.value) {
    // Select end slot
    const startTime = new Date(selectedStartSlot.value.start);
    const endTime = new Date(slot.end);
    
    if (endTime <= startTime) {
      showToast('End time must be after start time', 'error');
      return;
    }
    
    selectedEndSlot.value = slot;
    form.value.endDatetime = slot.end;
  } else {
    // Reset and select new start slot
    selectedStartSlot.value = slot;
    selectedEndSlot.value = null;
    form.value.startDatetime = slot.start;
    form.value.endDatetime = '';
  }
};

const isSlotSelected = (slot) => {
  return (selectedStartSlot.value && selectedStartSlot.value.start === slot.start) ||
         (selectedEndSlot.value && selectedEndSlot.value.end === slot.end);
};

const formatSlotTime = (timeStr) => {
  return timeStr;
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
  if (!selectedDate.value) {
    errors.value.selectedDate = 'Please select a booking date';
    isValid = false;
  }
  if (!form.value.startDatetime) {
    errors.value.startDatetime = 'Please select a start time slot';
    isValid = false;
  }
  if (!form.value.endDatetime) {
    errors.value.endDatetime = 'Please select an end time slot';
    isValid = false;
  }
  if (form.value.startDatetime && form.value.endDatetime) {
    if (new Date(form.value.startDatetime) >= new Date(form.value.endDatetime)) {
      errors.value.endDatetime = 'End time must be after start time';
      isValid = false;
    }
  }
  if (!form.value.reason?.trim()) {
    errors.value.reason = 'Purpose of trip is required';
    isValid = false;
  }
  if (!form.value.destination?.trim()) {
    errors.value.destination = 'Destination is required';
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
    const payload = {
      ...form.value,
      vehicleId: form.value.vehicleId || null
    };
    
    const res = await fetch(`${apiBase}/car-bookings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error || 'Failed to book car';
      const errorDetails = data.details ? ` (${data.details})` : '';
      throw new Error(errorMsg + errorDetails);
    }
    const vehicleName = data.vehicle?.name || 'Auto-assigned';
    showToast(`Car booked successfully! Vehicle: ${vehicleName}`, 'success');
    
    // Reset form (keep name/department)
    selectedDate.value = '';
    selectedStartSlot.value = null;
    selectedEndSlot.value = null;
    form.value.startDatetime = '';
    form.value.endDatetime = '';
    form.value.reason = '';
    form.value.destination = '';
    form.value.passengers = '';
    form.value.vehicleId = '';
    availableSlots.value = [];
    
    emit('submitted');
  } catch (e) {
    showToast(e.message, 'error', 8000);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  fillFormWithUserInfo();
  loadVehicles();
});

// Watch vehicle selection to reload slots
watch(() => form.value.vehicleId, () => {
  if (selectedDate.value) {
    loadAvailableSlots();
  }
});

// Re-fill form when user changes
watch(currentUser, () => {
  fillFormWithUserInfo();
}, { immediate: true });
</script>

<style scoped>
.time-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-md);
  border: 1px solid var(--shc-border);
}

.time-slot-btn {
  padding: 1rem;
  border-radius: 50px;
  border: 2px solid var(--shc-border);
  background: #fff;
  color: var(--shc-deep-green);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.time-slot-btn:hover:not(:disabled) {
  border-color: var(--shc-gold);
  background: rgba(219, 181, 87, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.time-slot-btn.selected {
  background: var(--shc-deep-green);
  color: #fff;
  border-color: var(--shc-deep-green);
  box-shadow: 0 4px 12px rgba(55, 72, 31, 0.3);
}

.time-slot-btn.unavailable {
  background: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
  border-color: #e0e0e0;
}

.slot-time {
  font-size: 1rem;
  font-weight: 700;
}

.slot-end-time {
  font-size: 0.8rem;
  opacity: 0.8;
}

.selected-slots-info {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(55, 72, 31, 0.05);
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--shc-deep-green);
  color: var(--shc-deep-green);
  font-size: 0.95rem;
}
</style>

