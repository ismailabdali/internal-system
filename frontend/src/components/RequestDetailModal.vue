<template>
  <transition name="modal">
    <div v-if="show && request" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Request Details #{{ request.id }}</h3>
          <div class="modal-header-actions">
            <div v-if="canUpdateRequest(request)" class="status-update-group">
              <select 
                :value="request.status" 
                @change="handleStatusUpdate($event.target.value)"
                :disabled="updatingStatus"
                class="status-select"
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
                <option value="BOOKED">Booked</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <span v-if="updatingStatus" class="spinner-small"></span>
            </div>
            <button class="modal-close" @click="$emit('close')">×</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="type-pill" :class="request.type?.toLowerCase().replace(' ','-')">{{ request.type }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="status-indicator" :data-status="request.status">{{ request.status }}</span>
            </div>
            <div v-if="request.workflowStatus" class="detail-row">
              <span class="detail-label">Workflow:</span>
              <span class="status-indicator" :data-status="request.workflowStatus">{{ request.workflowStatus }}</span>
            </div>
            <div v-if="request.currentStep" class="detail-row">
              <span class="detail-label">Current Step:</span>
              <span>{{ request.currentStep }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Title:</span>
              <span>{{ request.title }}</span>
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
                <span>{{ request.carBooking.vehicle?.name || 'N/A' }}</span>
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
            <div v-if="canAddNotes(request)" class="detail-section-title">Notes & Comments</div>
            <div v-if="canAddNotes(request)" class="notes-section">
              <textarea
                v-model="noteText"
                placeholder="Add a note or comment about this request..."
                rows="3"
                class="note-input"
              ></textarea>
              <button 
                class="btn-primary" 
                @click="addNote"
                :disabled="!noteText.trim() || addingNote"
                style="margin-top: 0.5rem; padding: 0.75rem 1.5rem;"
              >
                <span v-if="addingNote" class="spinner-small"></span>
                {{ addingNote ? 'Adding...' : 'Add Note' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';

const props = defineProps({
  show: Boolean,
  request: Object,
  updatingStatus: Boolean
});

const emit = defineEmits(['close', 'status-update', 'add-note']);

const { canUpdateRequest, canAddNotes, canViewEmployeeId } = useAuth();
const { showToast } = useToast();

const noteText = ref('');
const addingNote = ref(false);

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

