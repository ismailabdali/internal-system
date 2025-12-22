<template>
  <div class="glass-card">
    <div class="card-header flex-between">
      <div>
        <h2>Fleet Calendar</h2>
        <p class="subtitle">View and manage vehicle bookings by day</p>
      </div>
      <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <div class="select-wrapper filter-select">
          <select v-model="selectedVehicleId" @change="loadSchedule">
            <option value="">All Vehicles</option>
            <option v-for="v in vehicles" :key="v.id" :value="v.id">
              {{ v.name }} ({{ formatPlateNumber(v.plate_number, v.plate_code) }})
            </option>
          </select>
        </div>
        <input 
          v-model="selectedDate" 
          type="date" 
          class="edit-input"
          style="width: auto; min-width: 150px;"
          @change="loadSchedule"
        />
        <button class="btn-secondary" @click="loadSchedule" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-small"></span>
          {{ isLoading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Daily Calendar View -->
    <div class="calendar-container">
      <div class="calendar-day-header">
        <h3>{{ formatDateHeader(selectedDate) }}</h3>
        <div class="time-slot-legend">
          <span class="legend-item">
            <span class="legend-color available"></span>
            Available
          </span>
          <span class="legend-item">
            <span class="legend-color booked"></span>
            Booked
          </span>
        </div>
      </div>

      <div class="vehicles-timeline">
        <div 
          v-for="vehicle in displayVehicles" 
          :key="vehicle.id" 
          class="vehicle-row"
        >
          <div class="vehicle-header">
            <div class="vehicle-info">
              <strong>{{ vehicle.name }}</strong>
              <span class="vehicle-plate">{{ formatPlateNumber(vehicle.plate_number, vehicle.plate_code) }}</span>
            </div>
            <span class="vehicle-type">{{ vehicle.type }}</span>
          </div>
          
          <div class="time-slots-container">
            <div 
              v-for="slot in timeSlots" 
              :key="slot.start"
              :class="['time-slot', getSlotClass(vehicle.id, slot)]"
              :title="getSlotTooltip(vehicle.id, slot)"
              @click="handleSlotClick(vehicle.id, slot)"
            >
              <span class="slot-time">{{ slot.startTime }}</span>
              <span v-if="getBookingForSlot(vehicle.id, slot)" class="slot-booking">
                {{ getBookingForSlot(vehicle.id, slot).requesterName }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Booking Details Modal -->
      <div v-if="selectedBooking" class="booking-detail-card">
        <div class="booking-detail-header">
          <h4>Booking Details</h4>
          <button class="btn-secondary" @click="selectedBooking = null">Close</button>
        </div>
        <div class="booking-detail-body">
          <div class="detail-row">
            <span class="detail-label">Vehicle:</span>
            <span>{{ selectedBooking.vehicleName }} ({{ formatPlateNumber(selectedBooking.vehiclePlateNumber, selectedBooking.vehiclePlateCode) }})</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span>{{ formatTime(selectedBooking.startDatetime) }} - {{ formatTime(selectedBooking.endDatetime) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Requester:</span>
            <span>{{ selectedBooking.requesterName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Destination:</span>
            <span>{{ selectedBooking.destination || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="status-indicator" :data-status="selectedBooking.status">
              {{ formatStatus(selectedBooking.status) }}
            </span>
          </div>
          <div class="booking-detail-actions">
            <button class="btn-link" @click="viewRequest(selectedBooking.requestId)">View Full Request</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';
import { useStatusFormatter } from '../composables/useStatusFormatter';

const apiBase = 'http://localhost:4000/api';
const { authenticatedFetch } = useAuth();
const { showToast } = useToast();
const { formatStatus } = useStatusFormatter();

const emit = defineEmits(['view-request']);

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

const vehicles = ref([]);
const bookings = ref([]);
const isLoading = ref(false);
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const selectedVehicleId = ref('');
const selectedBooking = ref(null);

// Generate time slots (30-minute intervals from 6 AM to 10 PM)
const timeSlots = computed(() => {
  const slots = [];
  const date = new Date(selectedDate.value);
  
  for (let hour = 6; hour < 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);
      
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        endTime: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`
      });
    }
  }
  
  return slots;
});

const displayVehicles = computed(() => {
  if (selectedVehicleId.value) {
    return vehicles.value.filter(v => v.id === parseInt(selectedVehicleId.value));
  }
  return vehicles.value;
});

const loadVehicles = async () => {
  try {
    const res = await authenticatedFetch(`${apiBase}/vehicles`);
    if (!res.ok) throw new Error('Failed to load vehicles');
    vehicles.value = await res.json();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
    vehicles.value = [];
  }
};

const loadSchedule = async () => {
  isLoading.value = true;
  try {
    const date = new Date(selectedDate.value);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const params = new URLSearchParams({
      from: startOfDay.toISOString(),
      to: endOfDay.toISOString()
    });
    
    if (selectedVehicleId.value) {
      params.append('vehicleId', selectedVehicleId.value);
    }
    
    const res = await authenticatedFetch(`${apiBase}/fleet/schedule?${params.toString()}`);
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load schedule');
    }
    
    bookings.value = await res.json();
  } catch (e) {
    if (e.message && e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message || 'Failed to load schedule', 'error');
    }
    bookings.value = [];
  } finally {
    isLoading.value = false;
  }
};

const getSlotClass = (vehicleId, slot) => {
  const booking = getBookingForSlot(vehicleId, slot);
  if (booking) {
    return 'booked';
  }
  return 'available';
};

const getBookingForSlot = (vehicleId, slot) => {
  return bookings.value.find(booking => {
    if (booking.vehicleId !== vehicleId) return false;
    // Don't show cancelled bookings in the calendar slots
    if (booking.status === 'CANCELLED') return false;
    const bookingStart = new Date(booking.startDatetime);
    const bookingEnd = new Date(booking.endDatetime);
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);
    return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
  });
};

const getSlotTooltip = (vehicleId, slot) => {
  const booking = getBookingForSlot(vehicleId, slot);
  if (booking) {
    return `${booking.requesterName} - ${booking.destination || 'N/A'}`;
  }
  return 'Available';
};

const handleSlotClick = (vehicleId, slot) => {
  const booking = getBookingForSlot(vehicleId, slot);
  if (booking) {
    selectedBooking.value = booking;
  }
};

const formatDateHeader = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const viewRequest = (requestId) => {
  emit('view-request', requestId);
  selectedBooking.value = null;
};

onMounted(() => {
  loadVehicles();
  loadSchedule();
});
</script>

<style scoped>
.calendar-container {
  margin-top: 2rem;
}

.calendar-day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--shc-bg-warm);
}

.calendar-day-header h3 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  font-size: 1.5rem;
  margin: 0;
}

.time-slot-legend {
  display: flex;
  gap: 1.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--shc-text-secondary);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-block;
}

.legend-color.available {
  background: #e8f5e9;
  border: 1px solid #4caf50;
}

.legend-color.booked {
  background: #ffebee;
  border: 1px solid #f44336;
}

.legend-color.cancelled {
  background: #f5f5f5;
  border: 1px solid #9e9e9e;
}

.legend-color.cancelled {
  background: #f5f5f5;
  border: 1px solid #9e9e9e;
}

.vehicles-timeline {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.vehicle-row {
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  border: 1px solid var(--shc-border);
}

.vehicle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--shc-bg-warm);
}

.vehicle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.vehicle-info strong {
  color: var(--shc-deep-green);
  font-size: 1.1rem;
}

.vehicle-plate {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--shc-text-secondary);
}

.vehicle-type {
  font-size: 0.9rem;
  color: var(--shc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.time-slots-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.time-slot {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 60px;
  justify-content: center;
}

.time-slot.available {
  background: #e8f5e9;
  border-color: #4caf50;
  color: var(--shc-deep-green);
}

.time-slot.booked {
  background: #ffebee;
  border-color: #f44336;
  color: var(--shc-magenta);
  cursor: pointer;
}

.time-slot.cancelled {
  background: #f5f5f5;
  border-color: #9e9e9e;
  color: #757575;
  text-decoration: line-through;
  opacity: 0.6;
  cursor: pointer;
}

.time-slot:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.slot-time {
  font-weight: 600;
  font-size: 0.9rem;
}

.slot-booking {
  font-size: 0.75rem;
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.booking-detail-card {
  margin-top: 2rem;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  border: 1px solid var(--shc-border);
}

.booking-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--shc-bg-warm);
}

.booking-detail-header h4 {
  font-family: var(--font-heading);
  color: var(--shc-deep-green);
  margin: 0;
  font-size: 1.3rem;
}

.booking-detail-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.booking-detail-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--shc-bg-warm);
}
</style>

