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
              <!-- HR Submit Button (if in HR_REVIEW status) -->
              <div v-if="canSubmitOnboarding(request)" class="status-update-section" style="background: #e8f4f0; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid var(--shc-deep-green);">
                <div style="margin-bottom: 1rem;">
                  <h4 style="margin: 0 0 0.5rem 0; color: var(--shc-deep-green);">Submit Onboarding</h4>
                  <p style="margin: 0; font-size: 0.9rem; color: var(--shc-text-secondary);">
                    Submit this onboarding request to create child requests for IT (email, device, system access).
                  </p>
                </div>
                <button 
                  class="btn-primary" 
                  @click="handleSubmitOnboarding"
                  :disabled="submittingOnboarding"
                  style="width: 100%;"
                >
                  <span v-if="submittingOnboarding" class="spinner-small"></span>
                  {{ submittingOnboarding ? 'Submitting...' : 'Submit to IT' }}
                </button>
              </div>
              
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
              <div v-if="request.onboarding.emailNeeded !== undefined" class="detail-row">
                <span class="detail-label">Email Needed:</span>
                <span>{{ request.onboarding.emailNeeded ? 'Yes' : 'No' }}</span>
              </div>
              <div v-if="request.onboarding.deviceNeeded !== undefined" class="detail-row">
                <span class="detail-label">Device Needed:</span>
                <span>{{ request.onboarding.deviceNeeded ? 'Yes' : 'No' }}</span>
              </div>
              <div v-if="request.onboarding.deviceType" class="detail-row">
                <span class="detail-label">Device Type:</span>
                <span>{{ request.onboarding.deviceType }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">VPN Required:</span>
                <span>{{ request.onboarding.vpnRequired ? 'Yes' : 'No' }}</span>
              </div>
              <div v-if="request.onboarding.systemsRequested && request.onboarding.systemsRequested.length > 0" class="detail-row full-width">
                <span class="detail-label">Systems Requested:</span>
                <div style="margin-top: 0.5rem;">
                  <span v-for="sys in request.onboarding.systemsRequested" :key="sys" 
                        class="type-pill" style="margin-right: 0.5rem; margin-bottom: 0.5rem; display: inline-block;">
                    {{ getSystemName(sys) }}
                  </span>
                </div>
              </div>
              <div v-if="request.onboarding.notes" class="detail-row full-width">
                <span class="detail-label">Notes:</span>
                <p class="detail-description">{{ request.onboarding.notes }}</p>
              </div>
              
              <!-- Child Requests -->
              <div v-if="request.children && request.children.length > 0" class="detail-section-title" style="margin-top: 2rem;">
                Child Requests ({{ request.children.length }})
              </div>
              <div v-for="child in request.children" :key="child.id" 
                   class="child-request-card" 
                   style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border-left: 3px solid var(--shc-deep-green);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">{{ child.title }}</div>
                    <div style="font-size: 0.85rem; color: var(--shc-text-secondary); margin-bottom: 0.5rem;">
                      Type: <span class="type-pill" style="font-size: 0.8rem;">{{ child.type }}</span>
                      <span v-if="child.systemKey" style="margin-left: 0.75rem;">
                        System: <strong>{{ getSystemName(child.systemKey) }}</strong>
                      </span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--shc-text-secondary);">
                      Assigned to: <strong>{{ child.assignedRole || 'N/A' }}</strong>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <span class="status-indicator" :data-status="child.status">{{ formatStatus(child.status) }}</span>
                    <div v-if="canUpdateChildRequest(child)" style="margin-top: 0.5rem;">
                      <select 
                        :value="child.status" 
                        @change="handleChildStatusUpdate(child.id, $event.target.value)"
                        :disabled="updatingStatus"
                        style="font-size: 0.85rem; padding: 0.25rem 0.5rem;"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            
            <!-- Child Request Details (when viewing a child) -->
            <template v-if="(request.type === 'ONBOARDING_EMAIL' || request.type === 'ONBOARDING_DEVICE' || request.type === 'ONBOARDING_SYSTEM') && request.parent">
              <div class="detail-section-title">Parent Request</div>
              <div class="detail-row">
                <span class="detail-label">Parent ID:</span>
                <span class="font-mono">#{{ request.parent.id }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Parent Title:</span>
                <span>{{ request.parent.title }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Parent Status:</span>
                <span class="status-indicator" :data-status="request.parent.status">{{ formatStatus(request.parent.status) }}</span>
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
import { API_BASE } from '../config';

const props = defineProps({
  show: Boolean,
  request: Object,
  updatingStatus: Boolean
});

const emit = defineEmits(['close', 'status-update', 'add-note']);

const { canUpdateRequest, canCancelBooking, canAddNotes, canViewEmployeeId, currentUser, isHRAdmin, isSuperAdmin } = useAuth();
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

// Helper to get system name from key
const getSystemName = (systemKey) => {
  const systems = {
    'M365': 'Microsoft 365',
    'POWER_BI': 'Power BI Pro',
    'ACONEX': 'Aconex',
    'AUTODESK': 'Autodesk',
    'P6': 'Primavera P6',
    'RISK': 'RiskHive'
  };
  return systems[systemKey] || systemKey;
};

// Check if user can update a child request
const canUpdateChildRequest = (child) => {
  if (!currentUser.value) return false;
  const role = currentUser.value.role;
  // User can update if they are the assigned role for that child
  return role === child.assignedRole || role === 'IT_ADMIN' || role === 'SUPER_ADMIN';
};

// Handle child status update
const handleChildStatusUpdate = (childId, newStatus) => {
  emit('status-update', childId, newStatus, '');
};

// Check if user can submit onboarding (HR in HR_REVIEW status)
const canSubmitOnboarding = (request) => {
  if (!request || request.type !== 'ONBOARDING') return false;
  if (!isHRAdmin.value && !isSuperAdmin.value) return false;
  // Can submit if in HR_REVIEW status and has no children yet
  return (request.workflowStatus === 'HR_REVIEW' || request.currentStep === 'HR_REVIEW') && 
         (!request.children || request.children.length === 0);
};

// Handle onboarding submission
const handleSubmitOnboarding = async () => {
  if (!props.request || !props.request.id) return;
  
  submittingOnboarding.value = true;
  try {
    const res = await fetch(`${API_BASE}/onboarding/${props.request.id}/submit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit onboarding');
    }
    
    showToast(data.message || 'Onboarding submitted successfully. Child requests created.', 'success');
    
    // Emit event to reload request details
    emit('status-update', props.request.id, props.request.status, '');
  } catch (e) {
    showToast(e.message || 'Failed to submit onboarding', 'error', 8000);
  } finally {
    submittingOnboarding.value = false;
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

