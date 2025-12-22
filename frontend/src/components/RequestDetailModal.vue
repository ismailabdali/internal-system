<template>
  <transition name="modal">
    <div v-if="show && request" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Request Details #{{ request.id }}</h3>
          <div class="modal-header-actions">
            <button class="modal-close" @click="$emit('close')">×</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <!-- Status Update Section for IT/HR Admins - Moved to Top -->
            <div v-if="canUpdateRequest(request)" class="status-update-section status-update-section-top">
              <div class="status-update-header">
                <h4 class="status-update-title">Update Request Status</h4>
                <span v-if="updatingStatus" class="status-update-feedback">Updating...</span>
              </div>
              <div class="status-update-content">
                <div class="status-update-row">
                  <label class="status-update-label">Change Status:</label>
                  <div class="status-select-wrapper">
                    <select 
                      :value="request.status" 
                      @change="handleStatusUpdate($event.target.value)"
                      :disabled="updatingStatus"
                      class="status-select-large"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="BOOKED">Booked</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                    <span v-if="updatingStatus" class="spinner-small" style="margin-left: 0.75rem;"></span>
                  </div>
                </div>
                <small class="status-update-hint">
                  Select a new status and it will be updated immediately
                </small>
              </div>
            </div>
            
            <!-- Request Overview -->
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="type-pill" :class="request.type?.toLowerCase().replace(' ','-')">{{ request.type }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="status-indicator" :data-status="request.status">{{ formatStatus(request.status) }}</span>
            </div>
            <div v-if="request.workflowStatus" class="detail-row">
              <span class="detail-label">Workflow:</span>
              <span class="status-indicator" :data-status="request.workflowStatus">{{ formatStatus(request.workflowStatus) }}</span>
            </div>
            <div v-if="request.currentStep" class="detail-row">
              <span class="detail-label">Current Step:</span>
              <span>{{ formatStatus(request.currentStep) }}</span>
            </div>
            
            <!-- Basic Information -->
            <div class="detail-section-title">Request Information</div>
            <div class="detail-row">
              <span class="detail-label">Title:</span>
              <span class="fw-bold">{{ request.title }}</span>
            </div>
            <div v-if="canViewEmployeeId" class="detail-row">
              <span class="detail-label">Employee ID:</span>
              <span class="font-mono employee-id">{{ request.employeeId || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Requester:</span>
              <span>{{ request.requesterName }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Department:</span>
              <span>{{ request.department || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Created:</span>
              <span>{{ formatDate(request.createdAt) }}</span>
            </div>
            <div v-if="request.description" class="detail-row full-width">
              <span class="detail-label">Description:</span>
              <p class="detail-description">{{ request.description }}</p>
            </div>
            
            <!-- Car Booking Details -->
            <template v-if="request.type === 'CAR_BOOKING' && request.carBooking">
              <div class="detail-section-title">Booking Information</div>
              <div class="detail-row">
                <span class="detail-label">Vehicle:</span>
                <span>
                  {{ request.carBooking.vehicle?.name || 'N/A' }}
                  <span v-if="request.carBooking.vehicle?.plateNumber" style="margin-left: 0.5rem; color: var(--shc-text-secondary); font-size: 0.9em;">
                    ({{ formatPlateNumber(request.carBooking.vehicle.plateNumber, request.carBooking.vehicle.plateCode) }})
                  </span>
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Start:</span>
                <span>{{ formatDate(request.carBooking.startDatetime) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">End:</span>
                <span>{{ formatDate(request.carBooking.endDatetime) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Destination:</span>
                <span>{{ request.carBooking.destination || 'N/A' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Passengers:</span>
                <span>{{ request.carBooking.passengers || 'N/A' }}</span>
              </div>
              <!-- Cancel Booking Button for Fleet Admin and Employees -->
              <div v-if="canCancelBooking(request)" class="booking-actions" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--shc-bg-warm);">
                <div style="margin-bottom: 1rem;">
                  <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--shc-text-primary);">
                    Cancellation Reason <span style="color: var(--shc-magenta);">*</span>
                  </label>
                  <textarea
                    v-model="cancelReason"
                    placeholder="Please provide a reason for cancelling this booking..."
                    rows="3"
                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--shc-bg-warm); border-radius: 8px; font-family: inherit; font-size: 0.9rem; resize: vertical;"
                    :disabled="updatingStatus"
                  ></textarea>
                </div>
                <button 
                  class="btn-secondary" 
                  @click="handleCancelBooking"
                  :disabled="updatingStatus || !cancelReason || !cancelReason.trim()"
                  style="background: #ffebee; color: var(--shc-magenta); border-color: var(--shc-magenta);"
                >
                  <span v-if="updatingStatus" class="spinner-small"></span>
                  {{ updatingStatus ? 'Cancelling...' : 'Cancel Booking' }}
                </button>
              </div>
            </template>

            <!-- IT Request Details -->
            <template v-if="request.type === 'IT' && request.itRequest">
              <div class="detail-section-title">IT Details</div>
              <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span>{{ request.itRequest.category }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Urgency:</span>
                <span class="status-indicator urgency-badge" :data-urgency="request.itRequest.urgency">{{ request.itRequest.urgency }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">System:</span>
                <span>{{ request.itRequest.systemName || 'N/A' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Asset Tag:</span>
                <span>{{ request.itRequest.assetTag || 'N/A' }}</span>
              </div>
            </template>

            <!-- Onboarding Details -->
            <template v-if="request.type === 'ONBOARDING' && request.onboarding">
              <div class="detail-section-title">Onboarding Information</div>
              <div class="detail-row">
                <span class="detail-label">Employee:</span>
                <span>{{ request.onboarding.employeeName }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Position:</span>
                <span>{{ request.onboarding.position }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Start Date:</span>
                <span>{{ formatDateOnly(request.onboarding.startDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Device:</span>
                <span>{{ request.onboarding.deviceType }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">VPN Required:</span>
                <span>{{ request.onboarding.vpnRequired ? 'Yes' : 'No' }}</span>
              </div>
              <div v-if="request.onboarding.notes" class="detail-row full-width">
                <span class="detail-label">Notes:</span>
                <p class="detail-description">{{ request.onboarding.notes }}</p>
              </div>
            </template>
            
            <!-- Notes/Comments Section -->
            <div v-if="canAddNotes(request)" class="notes-section-wrapper">
              <div class="detail-section-title">Notes & Comments</div>
              <div class="notes-section">
                <textarea
                  v-model="noteText"
                  placeholder="Add a note or comment about this request..."
                  rows="4"
                  class="note-input"
                ></textarea>
                <button 
                  class="btn-primary" 
                  @click="addNote"
                  :disabled="!noteText.trim() || addingNote"
                  style="margin-top: 1rem; padding: 0.875rem 1.75rem; align-self: flex-start;"
                >
                  <span v-if="addingNote" class="spinner-small"></span>
                  {{ addingNote ? 'Adding...' : 'Add Note' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';
import { useStatusFormatter } from '../composables/useStatusFormatter';

const props = defineProps({
  show: Boolean,
  request: Object,
  updatingStatus: Boolean
});

const emit = defineEmits(['close', 'status-update', 'add-note']);

const { canUpdateRequest, canCancelBooking, canAddNotes, canViewEmployeeId } = useAuth();
const { showToast } = useToast();
const { formatStatus } = useStatusFormatter();

const noteText = ref('');
const addingNote = ref(false);
const cancelReason = ref('');

// Format plate number with code
const formatPlateNumber = (number, code) => {
  if (!number) return 'N/A';
  try {
    const num = String(number).trim();
    if (!num) return 'N/A';
    const cod = code ? String(code).trim().toUpperCase() : '';
    return cod ? `${num} ${cod}` : num;
  } catch (e) {
    console.error('Error formatting plate number:', e);
    return 'N/A';
  }
};

// Safe date formatter
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

// Safe date formatter (date only)
const formatDateOnly = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

const handleStatusUpdate = (newStatus) => {
  emit('status-update', props.request.id, newStatus, noteText.value || undefined);
  noteText.value = ''; // Clear note after status update
};

const handleCancelBooking = () => {
  if (!cancelReason.value || !cancelReason.value.trim()) {
    showToast('Please provide a cancellation reason', 'error');
    return;
  }
  
  if (confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
    emit('status-update', props.request.id, 'CANCELLED', cancelReason.value.trim());
    // Don't clear cancelReason here - let it clear after successful update
  }
};

// Clear cancel reason when request changes, modal closes, or status updates
watch(() => props.request?.id, () => {
  cancelReason.value = '';
});

watch(() => props.request?.status, (newStatus) => {
  if (newStatus === 'CANCELLED') {
    cancelReason.value = '';
  }
});

watch(() => props.show, (isOpen) => {
  if (!isOpen) {
    cancelReason.value = '';
  }
});

const addNote = async () => {
  if (!noteText.value.trim()) return;
  
  addingNote.value = true;
  try {
    // Emit add-note event to parent
    emit('add-note', props.request.id, noteText.value);
    noteText.value = '';
  } catch (e) {
    showToast('Failed to add note', 'error');
  } finally {
    addingNote.value = false;
  }
};
</script>

