<script setup>
import { ref, onMounted, computed } from 'vue';

const currentTab = ref('car'); // 'car' | 'it' | 'onboarding' | 'requests'

const apiBase = 'http://localhost:4000/api';

// ---- Shared ----
const requests = ref([]);
const isLoadingRequests = ref(false);
const requestError = ref('');
const searchQuery = ref('');
const statusFilter = ref('all');
const typeFilter = ref('all');
const selectedRequest = ref(null);
const showRequestModal = ref(false);

// Department options
const departments = [
  'Web Development',
  'IT Support',
  'HR',
  'Finance',
  'Operations',
  'Management',
  'Engineering',
  'Administration'
];

const loadRequests = async () => {
  isLoadingRequests.value = true;
  requestError.value = '';
  try {
    const res = await fetch(`${apiBase}/requests`);
    if (!res.ok) throw new Error('Failed to load requests');
    requests.value = await res.json();
  } catch (e) {
    requestError.value = e.message;
  } finally {
    isLoadingRequests.value = false;
  }
};

const loadRequestDetails = async (requestId) => {
  try {
    const res = await fetch(`${apiBase}/requests/${requestId}`);
    if (!res.ok) throw new Error('Failed to load request details');
    selectedRequest.value = await res.json();
    showRequestModal.value = true;
  } catch (e) {
    requestError.value = e.message;
  }
};

const filteredRequests = computed(() => {
  let filtered = requests.value;
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(r => 
      r.title?.toLowerCase().includes(query) ||
      r.requesterName?.toLowerCase().includes(query) ||
      r.id.toString().includes(query) ||
      r.description?.toLowerCase().includes(query)
    );
  }
  
  // Filter by status
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(r => r.status === statusFilter.value);
  }
  
  // Filter by type
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(r => r.type === typeFilter.value);
  }
  
  return filtered;
});

const autoDismissMessage = (messageRef, delay = 5000) => {
  setTimeout(() => {
    messageRef.value = '';
  }, delay);
};

onMounted(() => {
  loadRequests();
});

// ---- Car booking ----
const carForm = ref({
  requesterName: '',
  department: '',
  startDatetime: '',
  endDatetime: '',
  pickupLocation: '',
  destination: '',
  reason: '',
  passengers: '',
  preferredType: ''
});
const carFormErrors = ref({});
const carMessage = ref('');
const carError = ref('');
const isSubmittingCar = ref(false);

const validateCarForm = () => {
  carFormErrors.value = {};
  let isValid = true;
  
  if (!carForm.value.requesterName?.trim()) {
    carFormErrors.value.requesterName = 'Full name is required';
    isValid = false;
  }
  if (!carForm.value.department?.trim()) {
    carFormErrors.value.department = 'Department is required';
    isValid = false;
  }
  if (!carForm.value.startDatetime) {
    carFormErrors.value.startDatetime = 'Start date and time is required';
    isValid = false;
  }
  if (!carForm.value.endDatetime) {
    carFormErrors.value.endDatetime = 'End date and time is required';
    isValid = false;
  }
  if (carForm.value.startDatetime && carForm.value.endDatetime) {
    if (new Date(carForm.value.startDatetime) >= new Date(carForm.value.endDatetime)) {
      carFormErrors.value.endDatetime = 'End date must be after start date';
      isValid = false;
    }
  }
  if (!carForm.value.reason?.trim()) {
    carFormErrors.value.reason = 'Purpose of trip is required';
    isValid = false;
  }
  if (!carForm.value.destination?.trim()) {
    carFormErrors.value.destination = 'Destination is required';
    isValid = false;
  }
  
  return isValid;
};

const submitCarBooking = async () => {
  carMessage.value = '';
  carError.value = '';
  carFormErrors.value = {};
  
  if (!validateCarForm()) {
    return;
  }
  
  isSubmittingCar.value = true;
  try {
    const res = await fetch(`${apiBase}/car-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carForm.value)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to book car');
    }
    carMessage.value = `Car booked successfully (Vehicle: ${data.vehicle.name}, Booking ID: ${data.id})`;
    autoDismissMessage(carMessage);
    // reset only time / reason
    carForm.value.startDatetime = '';
    carForm.value.endDatetime = '';
    carForm.value.reason = '';
    carForm.value.destination = '';
    carForm.value.passengers = '';
    await loadRequests();
  } catch (e) {
    carError.value = e.message;
    autoDismissMessage(carError, 8000);
  } finally {
    isSubmittingCar.value = false;
  }
};

// ---- IT request ----
const itForm = ref({
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
const itFormErrors = ref({});
const itMessage = ref('');
const itError = ref('');
const isSubmittingIT = ref(false);

const validateITForm = () => {
  itFormErrors.value = {};
  let isValid = true;
  
  if (!itForm.value.requesterName?.trim()) {
    itFormErrors.value.requesterName = 'Requester name is required';
    isValid = false;
  }
  if (!itForm.value.department?.trim()) {
    itFormErrors.value.department = 'Department is required';
    isValid = false;
  }
  if (!itForm.value.title?.trim()) {
    itFormErrors.value.title = 'Request title is required';
    isValid = false;
  }
  if (!itForm.value.description?.trim()) {
    itFormErrors.value.description = 'Description is required';
    isValid = false;
  }
  
  return isValid;
};

const submitIT = async () => {
  itMessage.value = '';
  itError.value = '';
  itFormErrors.value = {};
  
  if (!validateITForm()) {
    return;
  }
  
  isSubmittingIT.value = true;
  try {
    const res = await fetch(`${apiBase}/it-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itForm.value)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit IT request');
    itMessage.value = `IT request created (ID: ${data.requestId})`;
    autoDismissMessage(itMessage);
    itForm.value.title = '';
    itForm.value.description = '';
    itForm.value.systemName = '';
    itForm.value.assetTag = '';
    await loadRequests();
  } catch (e) {
    itError.value = e.message;
    autoDismissMessage(itError, 8000);
  } finally {
    isSubmittingIT.value = false;
  }
};

// ---- Onboarding ----
const onboardingForm = ref({
  requesterName: '',
  department: '',
  employeeName: '',
  position: '',
  location: '',
  startDate: '',
  deviceType: 'Business Laptop',
  vpnRequired: false,
  notes: ''
});
const onboardingFormErrors = ref({});
const onboardingMessage = ref('');
const onboardingError = ref('');
const isSubmittingOnboarding = ref(false);

const validateOnboardingForm = () => {
  onboardingFormErrors.value = {};
  let isValid = true;
  
  if (!onboardingForm.value.requesterName?.trim()) {
    onboardingFormErrors.value.requesterName = 'Hiring manager name is required';
    isValid = false;
  }
  if (!onboardingForm.value.department?.trim()) {
    onboardingFormErrors.value.department = 'Department is required';
    isValid = false;
  }
  if (!onboardingForm.value.employeeName?.trim()) {
    onboardingFormErrors.value.employeeName = 'New hire name is required';
    isValid = false;
  }
  if (!onboardingForm.value.position?.trim()) {
    onboardingFormErrors.value.position = 'Position is required';
    isValid = false;
  }
  if (!onboardingForm.value.startDate) {
    onboardingFormErrors.value.startDate = 'Start date is required';
    isValid = false;
  }
  
  return isValid;
};

const submitOnboarding = async () => {
  onboardingMessage.value = '';
  onboardingError.value = '';
  onboardingFormErrors.value = {};
  
  if (!validateOnboardingForm()) {
    return;
  }
  
  isSubmittingOnboarding.value = true;
  try {
    const res = await fetch(`${apiBase}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(onboardingForm.value)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit onboarding request');
    onboardingMessage.value = `Onboarding created for ${data.employeeName} (Request ID: ${data.requestId})`;
    autoDismissMessage(onboardingMessage);
    onboardingForm.value.employeeName = '';
    onboardingForm.value.position = '';
    onboardingForm.value.startDate = '';
    onboardingForm.value.notes = '';
    await loadRequests();
  } catch (e) {
    onboardingError.value = e.message;
    autoDismissMessage(onboardingError, 8000);
  } finally {
    isSubmittingOnboarding.value = false;
  }
};
</script>

<template>
  <div class="app-container">
    <div class="bg-shape shape-1"></div>
    <div class="bg-shape shape-2"></div>

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

      <nav class="nav-pills">
        <button 
          v-for="tab in ['car', 'it', 'onboarding', 'requests']" 
          :key="tab"
          :class="{ active: currentTab === tab }" 
          @click="currentTab = tab"
        >
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </nav>
    </header>

    <main class="main-content">
      <transition name="fade" mode="out-in">
        
        <div v-if="currentTab === 'car'" class="glass-card">
          <div class="card-header">
            <h2>Vehicle Requisition</h2>
            <p class="subtitle">Book a fleet vehicle for official city business.</p>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Full Name <span class="required">*</span></label>
              <input 
                v-model="carForm.requesterName" 
                type="text" 
                placeholder="e.g. Ismail Al Abdali"
                :class="{ 'error': carFormErrors.requesterName }"
              />
              <span v-if="carFormErrors.requesterName" class="error-message">{{ carFormErrors.requesterName }}</span>
            </div>
            <div class="input-group">
              <label>Department <span class="required">*</span></label>
              <div class="select-wrapper">
                <select 
                  v-model="carForm.department"
                  :class="{ 'error': carFormErrors.department }"
                >
                  <option value="" disabled>Select Department</option>
                  <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
                  <option value="__other__">Other (specify)</option>
                </select>
              </div>
              <input 
                v-if="carForm.department === '__other__'"
                v-model="carForm.department" 
                type="text" 
                placeholder="Enter department name"
                class="mt-1"
              />
              <span v-if="carFormErrors.department" class="error-message">{{ carFormErrors.department }}</span>
            </div>
            <div class="input-group">
              <label>Start Date & Time <span class="required">*</span></label>
              <input 
                v-model="carForm.startDatetime" 
                type="datetime-local"
                :class="{ 'error': carFormErrors.startDatetime }"
              />
              <span v-if="carFormErrors.startDatetime" class="error-message">{{ carFormErrors.startDatetime }}</span>
            </div>
            <div class="input-group">
              <label>End Date & Time <span class="required">*</span></label>
              <input 
                v-model="carForm.endDatetime" 
                type="datetime-local"
                :class="{ 'error': carFormErrors.endDatetime }"
              />
              <span v-if="carFormErrors.endDatetime" class="error-message">{{ carFormErrors.endDatetime }}</span>
            </div>
            <div class="input-group">
              <label>Pickup Location</label>
              <input v-model="carForm.pickupLocation" type="text" placeholder="e.g. Main Office" />
            </div>
            <div class="input-group">
              <label>Destination <span class="required">*</span></label>
              <input 
                v-model="carForm.destination" 
                type="text"
                :class="{ 'error': carFormErrors.destination }"
              />
              <span v-if="carFormErrors.destination" class="error-message">{{ carFormErrors.destination }}</span>
            </div>
            <div class="input-group full-width">
              <label>Purpose of Trip <span class="required">*</span></label>
              <textarea 
                v-model="carForm.reason" 
                rows="2" 
                placeholder="Briefly describe the business need..."
                :class="{ 'error': carFormErrors.reason }"
              ></textarea>
              <span v-if="carFormErrors.reason" class="error-message">{{ carFormErrors.reason }}</span>
            </div>
            <div class="input-group">
              <label>Passengers</label>
              <input v-model.number="carForm.passengers" type="number" min="1" />
            </div>
            <div class="input-group">
              <label>Vehicle Preference</label>
              <div class="select-wrapper">
                <select v-model="carForm.preferredType">
                  <option value="" disabled selected>Select Type</option>
                  <option value="Sedan">Sedan (Standard)</option>
                  <option value="SUV">SUV (Off-site)</option>
                  <option value="Pickup">Pickup (Utility)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="btn-primary" @click="submitCarBooking" :disabled="isSubmittingCar">
              <span v-if="isSubmittingCar" class="spinner-small"></span>
              <span>{{ isSubmittingCar ? 'Booking...' : 'Confirm Booking' }}</span>
            </button>
          </div>
          
          <transition name="fade">
            <div v-if="carMessage || carError" class="feedback-container">
              <div v-if="carMessage" class="feedback success">{{ carMessage }}</div>
              <div v-if="carError" class="feedback error">{{ carError }}</div>
            </div>
          </transition>
        </div>

        <div v-else-if="currentTab === 'it'" class="glass-card">
          <div class="card-header">
            <h2>IT Support & Assets</h2>
            <p class="subtitle">Report technical issues or request hardware/software.</p>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Requester Name <span class="required">*</span></label>
              <input 
                v-model="itForm.requesterName" 
                type="text"
                :class="{ 'error': itFormErrors.requesterName }"
              />
              <span v-if="itFormErrors.requesterName" class="error-message">{{ itFormErrors.requesterName }}</span>
            </div>
            <div class="input-group">
              <label>Department <span class="required">*</span></label>
              <div class="select-wrapper">
                <select 
                  v-model="itForm.department"
                  :class="{ 'error': itFormErrors.department }"
                >
                  <option value="" disabled>Select Department</option>
                  <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
                  <option value="__other__">Other (specify)</option>
                </select>
              </div>
              <input 
                v-if="itForm.department === '__other__'"
                v-model="itForm.department" 
                type="text" 
                placeholder="Enter department name"
                class="mt-1"
              />
              <span v-if="itFormErrors.department" class="error-message">{{ itFormErrors.department }}</span>
            </div>
            <div class="input-group full-width">
              <label>Request Title <span class="required">*</span></label>
              <input 
                v-model="itForm.title" 
                type="text" 
                class="highlight-input" 
                placeholder="What do you need help with?"
                :class="{ 'error': itFormErrors.title }"
              />
              <span v-if="itFormErrors.title" class="error-message">{{ itFormErrors.title }}</span>
            </div>
            <div class="input-group full-width">
              <label>Detailed Description <span class="required">*</span></label>
              <textarea 
                v-model="itForm.description" 
                rows="3"
                :class="{ 'error': itFormErrors.description }"
              ></textarea>
              <span v-if="itFormErrors.description" class="error-message">{{ itFormErrors.description }}</span>
            </div>
            <div class="input-group">
              <label>Category</label>
              <div class="select-wrapper">
                <select v-model="itForm.category">
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
                <select v-model="itForm.urgency" :class="`urgency-${itForm.urgency.toLowerCase()}`">
                  <option>Normal</option>
                  <option>Urgent</option>
                  <option>Critical</option>
                </select>
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="btn-primary" @click="submitIT" :disabled="isSubmittingIT">
              <span v-if="isSubmittingIT" class="spinner-small"></span>
              <span>{{ isSubmittingIT ? 'Submitting...' : 'Submit Ticket' }}</span>
            </button>
          </div>
          <transition name="fade">
            <div v-if="itMessage || itError" class="feedback-container">
              <div v-if="itMessage" class="feedback success">{{ itMessage }}</div>
              <div v-if="itError" class="feedback error">{{ itError }}</div>
            </div>
          </transition>
        </div>

        <div v-else-if="currentTab === 'onboarding'" class="glass-card">
          <div class="card-header">
            <h2>Employee Onboarding</h2>
            <p class="subtitle">Prepare assets and accounts for new talent.</p>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Hiring Manager <span class="required">*</span></label>
              <input 
                v-model="onboardingForm.requesterName" 
                type="text"
                :class="{ 'error': onboardingFormErrors.requesterName }"
              />
              <span v-if="onboardingFormErrors.requesterName" class="error-message">{{ onboardingFormErrors.requesterName }}</span>
            </div>
            <div class="input-group">
              <label>Department <span class="required">*</span></label>
              <div class="select-wrapper">
                <select 
                  v-model="onboardingForm.department"
                  :class="{ 'error': onboardingFormErrors.department }"
                >
                  <option value="" disabled>Select Department</option>
                  <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
                  <option value="__other__">Other (specify)</option>
                </select>
              </div>
              <input 
                v-if="onboardingForm.department === '__other__'"
                v-model="onboardingForm.department" 
                type="text" 
                placeholder="Enter department name"
                class="mt-1"
              />
              <span v-if="onboardingFormErrors.department" class="error-message">{{ onboardingFormErrors.department }}</span>
            </div>
            <div class="input-group">
              <label>New Hire Name <span class="required">*</span></label>
              <input 
                v-model="onboardingForm.employeeName" 
                type="text"
                :class="{ 'error': onboardingFormErrors.employeeName }"
              />
              <span v-if="onboardingFormErrors.employeeName" class="error-message">{{ onboardingFormErrors.employeeName }}</span>
            </div>
            <div class="input-group">
              <label>Position / Title <span class="required">*</span></label>
              <input 
                v-model="onboardingForm.position" 
                type="text"
                :class="{ 'error': onboardingFormErrors.position }"
              />
              <span v-if="onboardingFormErrors.position" class="error-message">{{ onboardingFormErrors.position }}</span>
            </div>
            <div class="input-group">
              <label>Start Date <span class="required">*</span></label>
              <input 
                v-model="onboardingForm.startDate" 
                type="date"
                :class="{ 'error': onboardingFormErrors.startDate }"
              />
              <span v-if="onboardingFormErrors.startDate" class="error-message">{{ onboardingFormErrors.startDate }}</span>
            </div>
            <div class="input-group">
              <label>Location</label>
              <input v-model="onboardingForm.location" type="text" placeholder="e.g. Main Office" />
            </div>
            <div class="input-group">
              <label>Primary Device</label>
              <div class="select-wrapper">
                <select v-model="onboardingForm.deviceType">
                  <option>Business Laptop</option>
                  <option>Engineer Laptop</option>
                  <option>MacBook Pro</option>
                </select>
              </div>
            </div>
            <div class="input-group checkbox-group">
              <label class="checkbox-container">
                <input v-model="onboardingForm.vpnRequired" type="checkbox" />
                <span class="checkmark"></span>
                VPN Access Required
              </label>
            </div>
            <div class="input-group full-width">
              <label>Additional Notes</label>
              <textarea v-model="onboardingForm.notes" rows="2" placeholder="Any additional information..."></textarea>
            </div>
          </div>

          <div class="actions">
            <button class="btn-primary" @click="submitOnboarding" :disabled="isSubmittingOnboarding">
              <span v-if="isSubmittingOnboarding" class="spinner-small"></span>
              <span>{{ isSubmittingOnboarding ? 'Creating...' : 'Initialize Onboarding' }}</span>
            </button>
          </div>
          <transition name="fade">
            <div v-if="onboardingMessage || onboardingError" class="feedback-container">
              <div v-if="onboardingMessage" class="feedback success">{{ onboardingMessage }}</div>
              <div v-if="onboardingError" class="feedback error">{{ onboardingError }}</div>
            </div>
          </transition>
        </div>

        <div v-else class="glass-card">
          <div class="card-header flex-between">
            <div>
              <h2>Request History</h2>
              <p class="subtitle">Track the status of your submissions.</p>
            </div>
            <button class="btn-secondary" @click="loadRequests" :disabled="isLoadingRequests">
              <span v-if="isLoadingRequests" class="spinner-small"></span>
              {{ isLoadingRequests ? 'Syncing...' : 'Refresh List' }}
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
              <button v-if="searchQuery || statusFilter !== 'all' || typeFilter !== 'all'" class="btn-secondary mt-2" @click="searchQuery = ''; statusFilter = 'all'; typeFilter = 'all'">Clear Filters</button>
            </div>
          </div>
        </div>

      </transition>
    </main>

    <!-- Request Detail Modal -->
    <transition name="modal">
      <div v-if="showRequestModal && selectedRequest" class="modal-overlay" @click="showRequestModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Request Details #{{ selectedRequest.id }}</h3>
            <button class="modal-close" @click="showRequestModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="detail-section">
              <div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="type-pill" :class="selectedRequest.type?.toLowerCase().replace(' ','-')">{{ selectedRequest.type }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="status-indicator" :data-status="selectedRequest.status">{{ selectedRequest.status }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Title:</span>
                <span>{{ selectedRequest.title }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Requester:</span>
                <span>{{ selectedRequest.requesterName }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span>{{ selectedRequest.department || 'N/A' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span>{{ new Date(selectedRequest.createdAt).toLocaleString() }}</span>
              </div>
              <div v-if="selectedRequest.description" class="detail-row full-width">
                <span class="detail-label">Description:</span>
                <p class="detail-description">{{ selectedRequest.description }}</p>
              </div>
              
              <!-- Car Booking Details -->
              <template v-if="selectedRequest.type === 'CAR_BOOKING' && selectedRequest.carBooking">
                <div class="detail-section-title">Booking Information</div>
                <div class="detail-row">
                  <span class="detail-label">Vehicle:</span>
                  <span>{{ selectedRequest.carBooking.vehicle?.name || 'N/A' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Start:</span>
                  <span>{{ new Date(selectedRequest.carBooking.startDatetime).toLocaleString() }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">End:</span>
                  <span>{{ new Date(selectedRequest.carBooking.endDatetime).toLocaleString() }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Destination:</span>
                  <span>{{ selectedRequest.carBooking.destination || 'N/A' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Passengers:</span>
                  <span>{{ selectedRequest.carBooking.passengers || 'N/A' }}</span>
                </div>
              </template>

              <!-- IT Request Details -->
              <template v-if="selectedRequest.type === 'IT' && selectedRequest.itRequest">
                <div class="detail-section-title">IT Details</div>
                <div class="detail-row">
                  <span class="detail-label">Category:</span>
                  <span>{{ selectedRequest.itRequest.category }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Urgency:</span>
                  <span class="status-indicator urgency-badge" :data-urgency="selectedRequest.itRequest.urgency">{{ selectedRequest.itRequest.urgency }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">System:</span>
                  <span>{{ selectedRequest.itRequest.systemName || 'N/A' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Asset Tag:</span>
                  <span>{{ selectedRequest.itRequest.assetTag || 'N/A' }}</span>
                </div>
              </template>

              <!-- Onboarding Details -->
              <template v-if="selectedRequest.type === 'ONBOARDING' && selectedRequest.onboarding">
                <div class="detail-section-title">Onboarding Information</div>
                <div class="detail-row">
                  <span class="detail-label">Employee:</span>
                  <span>{{ selectedRequest.onboarding.employeeName }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Position:</span>
                  <span>{{ selectedRequest.onboarding.position }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Start Date:</span>
                  <span>{{ new Date(selectedRequest.onboarding.startDate).toLocaleDateString() }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Device:</span>
                  <span>{{ selectedRequest.onboarding.deviceType }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">VPN Required:</span>
                  <span>{{ selectedRequest.onboarding.vpnRequired ? 'Yes' : 'No' }}</span>
                </div>
                <div v-if="selectedRequest.onboarding.notes" class="detail-row full-width">
                  <span class="detail-label">Notes:</span>
                  <p class="detail-description">{{ selectedRequest.onboarding.notes }}</p>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </transition>
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
  max-width: 1080px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
  z-index: 1;
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
  margin-bottom: 3rem;
  flex-wrap: wrap;
  gap: 1rem;
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
  padding: 2.5rem;
  box-shadow: var(--shadow-soft);
  position: relative;
  overflow: hidden;
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
  margin-bottom: 2rem;
}

.card-header h2 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: var(--shc-text-secondary);
  font-size: 1rem;
  margin: 0;
}

/* FORM ELEMENTS */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-group.full-width {
  grid-column: span 2;
}

label {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--shc-text-secondary);
}

input, textarea, select {
  background: #fff;
  border: 1px solid var(--shc-border);
  border-radius: var(--radius-sm);
  padding: 0.9rem 1rem;
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--shc-deep-green);
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--shc-gold);
  box-shadow: 0 0 0 4px rgba(219, 181, 87, 0.15);
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
  margin-top: 0.5rem;
}
.checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 1rem;
  text-transform: none;
  color: var(--shc-deep-green);
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
  background: var(--shc-deep-green);
  color: #fff;
  border: none;
  padding: 1rem 2.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 10px 25px rgba(55, 72, 31, 0.25);
  font-family: var(--font-body);
}

.btn-primary:hover {
  transform: translateY(-2px);
  background: #2b3a18;
  box-shadow: 0 15px 30px rgba(55, 72, 31, 0.35);
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
}
.styled-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.styled-table th {
  text-align: left;
  padding: 1rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--shc-text-secondary);
  border-bottom: 2px solid var(--shc-bg-warm);
}
.styled-table td {
  padding: 1.2rem 1rem;
  border-bottom: 1px solid var(--shc-bg-warm);
  font-size: 0.95rem;
}
.font-mono {
  font-family: monospace;
  color: var(--shc-gold);
  font-weight: bold;
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
}

.error-message {
  color: var(--shc-magenta);
  font-size: 0.75rem;
  margin-top: 0.25rem;
  display: block;
}

input.error, textarea.error, select.error {
  border-color: var(--shc-magenta);
  box-shadow: 0 0 0 4px rgba(92, 16, 48, 0.1);
}

.mt-1 {
  margin-top: 0.5rem;
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

.btn-primary:disabled, .btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* FILTERS AND SEARCH */
.filters-section {
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
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
  padding: 2rem;
}

.modal-content {
  background: #fff;
  border-radius: var(--radius-lg);
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  position: relative;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--shc-bg-warm);
}

.modal-header h3 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  margin: 0;
  font-size: 1.5rem;
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

.modal-body {
  padding: 2rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-section-title {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  color: var(--shc-deep-green);
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--shc-bg-warm);
}

.detail-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 1rem;
  align-items: start;
}

.detail-row.full-width {
  grid-template-columns: 1fr;
  flex-direction: column;
}

.detail-label {
  font-weight: 700;
  color: var(--shc-text-secondary);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

/* STATUS INDICATORS ENHANCEMENT */
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
    margin: 1rem;
    max-height: calc(100vh - 2rem);
  }
  .modal-header, .modal-body {
    padding: 1.25rem;
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
}
</style>
