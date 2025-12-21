<template>
  <div class="glass-card">
    <div class="card-header flex-between">
      <div>
        <h2>{{ isAdminUser ? 'All Requests' : 'My Requests' }}</h2>
        <p class="subtitle">
          <span v-if="isSuperAdmin">View and manage all system requests</span>
          <span v-else-if="isITAdmin">View and manage IT requests</span>
          <span v-else-if="isHRAdmin">View and manage onboarding requests</span>
          <span v-else-if="isFleetAdmin">View and manage car booking requests</span>
          <span v-else>Track the status of your submissions</span>
        </p>
      </div>
      <button class="btn-secondary" @click="loadRequests" :disabled="isLoading">
        <span v-if="isLoading" class="spinner-small"></span>
        {{ isLoading ? 'Syncing...' : 'Refresh List' }}
      </button>
    </div>

    <!-- Filters and Search -->
    <div class="filters-section">
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by ID, title, requester..."
          class="search-input"
        />
      </div>
      <div class="filter-group">
        <div class="select-wrapper filter-select">
          <select v-model="statusFilter">
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="BOOKED">Booked</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="APPROVED">Approved</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div class="select-wrapper filter-select">
          <select v-model="typeFilter">
            <option value="all">All Types</option>
            <option value="CAR_BOOKING">Car Booking</option>
            <option value="IT">IT Request</option>
            <option value="ONBOARDING">Onboarding</option>
          </select>
        </div>
      </div>
    </div>

    <div class="table-container">
      <table v-if="filteredRequests.length" class="styled-table">
        <thead>
          <tr>
            <th>ID</th>
            <th v-if="canViewEmployeeId">Employee ID</th>
            <th>Type</th>
            <th>Title</th>
            <th>Requester</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filteredRequests" :key="r.id" class="table-row-clickable" @click="loadRequestDetails(r.id)">
            <td class="font-mono">#{{ r.id }}</td>
            <td v-if="canViewEmployeeId" class="font-mono employee-id">{{ r.employeeId || 'N/A' }}</td>
            <td>
              <span class="type-pill" :class="r.type.toLowerCase().replace(' ','-')">{{ r.type }}</span>
            </td>
            <td class="fw-bold">{{ r.title }}</td>
            <td>{{ r.requesterName }}</td>
            <td>
              <span class="status-indicator" :data-status="r.status">{{ r.status }}</span>
            </td>
            <td class="text-muted">{{ new Date(r.createdAt).toLocaleDateString() }}</td>
            <td>
              <button class="btn-link" @click.stop="loadRequestDetails(r.id)">View</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>{{ searchQuery || statusFilter !== 'all' || typeFilter !== 'all' ? 'No requests match your filters.' : 'No active requests found.' }}</p>
        <button v-if="searchQuery || statusFilter !== 'all' || typeFilter !== 'all'" class="btn-secondary mt-2" @click="clearFilters">Clear Filters</button>
      </div>
    </div>

    <!-- Request Detail Modal -->
    <RequestDetailModal
      :show="showRequestModal"
      :request="selectedRequest"
      :updating-status="updatingStatus"
      @close="showRequestModal = false"
      @status-update="handleStatusUpdate"
      @add-note="handleAddNote"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';
import RequestDetailModal from '../components/RequestDetailModal.vue';

const apiBase = 'http://localhost:4000/api';
const { isAdminUser, isSuperAdmin, isITAdmin, isHRAdmin, isFleetAdmin, canViewEmployeeId, getAuthHeaders, clearAuth } = useAuth();
const { showToast } = useToast();

const requests = ref([]);
const isLoading = ref(false);
const searchQuery = ref('');
const statusFilter = ref('all');
const typeFilter = ref('all');
const selectedRequest = ref(null);
const showRequestModal = ref(false);
const updatingStatus = ref(false);

const filteredRequests = computed(() => {
  let filtered = requests.value;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(r => 
      r.title?.toLowerCase().includes(query) ||
      r.requesterName?.toLowerCase().includes(query) ||
      r.id.toString().includes(query) ||
      r.description?.toLowerCase().includes(query)
    );
  }
  
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(r => r.status === statusFilter.value);
  }
  
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(r => r.type === typeFilter.value);
  }
  
  return filtered;
});

const loadRequests = async () => {
  isLoading.value = true;
  try {
    const res = await fetch(`${apiBase}/requests`, {
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load requests');
    }
    requests.value = await res.json();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    isLoading.value = false;
  }
};

const loadRequestDetails = async (requestId) => {
  try {
    const res = await fetch(`${apiBase}/requests/${requestId}`, {
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load request details');
    }
    selectedRequest.value = await res.json();
    showRequestModal.value = true;
  } catch (e) {
    showToast(e.message, 'error');
  }
};

const handleStatusUpdate = async (requestId, newStatus, note) => {
  updatingStatus.value = true;
  try {
    const res = await fetch(`${apiBase}/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus, note: note || undefined })
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update request status');
    }
    const data = await res.json();
    
    if (data.autoITRequestCreated) {
      showToast(`Status updated to ${newStatus}. IT request #${data.autoITRequestId} auto-created for device setup!`, 'success', 10000);
    } else {
      showToast(`Request status updated to ${newStatus}`, 'success');
    }
    
    await loadRequestDetails(requestId);
    await loadRequests();
  } catch (e) {
    showToast(e.message, 'error', 8000);
  } finally {
    updatingStatus.value = false;
  }
};

const handleAddNote = async (requestId, note) => {
  updatingStatus.value = true;
  try {
    const res = await fetch(`${apiBase}/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        status: selectedRequest.value?.status, // Keep current status
        note: note 
      })
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Your session has expired. Please log in again.', 'error', 8000);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to add note');
    }
    showToast('Note added successfully', 'success');
    await loadRequestDetails(requestId);
    await loadRequests();
  } catch (e) {
    showToast(e.message, 'error', 8000);
  } finally {
    updatingStatus.value = false;
  }
};

const clearFilters = () => {
  searchQuery.value = '';
  statusFilter.value = 'all';
  typeFilter.value = 'all';
};

// Expose methods for parent component
defineExpose({
  loadRequests,
  loadRequestDetails
});

onMounted(() => {
  loadRequests();
});
</script>

