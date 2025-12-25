<template>
  <div class="glass-card">
    <div class="card-header">
      <h2>Admin Panel</h2>
      <p class="subtitle">
        <span v-if="isSuperAdmin">Full system administration</span>
        <span v-else-if="isHRAdmin">HR Management</span>
        <span v-else-if="isFleetAdmin">Fleet Management</span>
        <span v-else-if="isITAdmin">IT Management</span>
      </p>
    </div>

    <!-- Section 1: Employees (SUPER_ADMIN, HR_ADMIN only) -->
    <div v-if="canManageEmployees" class="admin-section">
      <div class="section-header">
        <h3>Employees</h3>
        <button class="btn-secondary" @click="loadEmployees" :disabled="isLoadingEmployees">
          <span v-if="isLoadingEmployees" class="spinner-small"></span>
          {{ isLoadingEmployees ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
      <div class="table-container">
        <table v-if="employees.length" class="styled-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Role</th>
              <th>Lead</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in employees" :key="emp.id">
              <td class="fw-bold">{{ emp.fullName }}</td>
              <td>{{ emp.email }}</td>
              <td>
                <template v-if="editingEmployee === emp.id">
                  <input 
                    v-model="employeeEditForm.department" 
                    type="text" 
                    class="edit-input"
                    placeholder="Department"
                  />
                </template>
                <template v-else>
                  {{ emp.department || 'N/A' }}
                </template>
              </td>
              <td>
                <template v-if="editingEmployee === emp.id">
                  <select v-model="employeeEditForm.role" class="edit-select">
                    <option value="EMPLOYEE">Employee</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="IT_ADMIN">IT Admin</option>
                    <option value="HR_ADMIN">HR Admin</option>
                    <option value="FLEET_ADMIN">Fleet Admin</option>
                  </select>
                </template>
                <template v-else>
                  <span class="type-pill">{{ emp.role }}</span>
                </template>
              </td>
              <td>
                <template v-if="editingEmployee === emp.id">
                  <label class="checkbox-container">
                    <input v-model="employeeEditForm.isLead" type="checkbox" />
                    <span class="checkmark"></span>
                    <span style="margin-left: 0.5rem; font-size: 0.9rem;">Lead</span>
                  </label>
                </template>
                <template v-else>
                  <span class="status-indicator" :data-status="emp.isLead ? 'Yes' : 'No'">
                    {{ emp.isLead ? 'Yes' : 'No' }}
                  </span>
                </template>
              </td>
              <td>
                <span class="status-indicator" :data-status="emp.isActive ? 'Active' : 'Inactive'">
                  {{ emp.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <template v-if="editingEmployee === emp.id">
                    <button class="btn-link text-success" @click="saveEmployee(emp.id)">Save</button>
                    <button class="btn-link text-muted" @click="cancelEditEmployee">Cancel</button>
                  </template>
                  <template v-else>
                    <button class="btn-link" @click="startEditEmployee(emp)">Edit</button>
                    <button 
                      v-if="!emp.isActive" 
                      class="btn-link text-success" 
                      @click="activateEmployee(emp.id)"
                    >
                      Activate
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <p>No employees found.</p>
        </div>
      </div>
    </div>
    
    <!-- Create New Employee (SUPER_ADMIN only) -->
    <div v-if="canManageEmployees && isSuperAdmin" class="admin-section">
      <div class="section-header">
        <h3>Create New Employee</h3>
      </div>
      <div class="form-grid" style="max-width: 800px;">
        <div class="input-group">
          <label>Email <span class="required">*</span></label>
          <input v-model="newEmployeeForm.email" type="email" placeholder="email@housing.gov.om" />
        </div>
        <div class="input-group">
          <label>Password <span class="required">*</span></label>
          <input v-model="newEmployeeForm.password" type="password" placeholder="Set initial password" />
        </div>
        <div class="input-group">
          <label>Full Name <span class="required">*</span></label>
          <input v-model="newEmployeeForm.fullName" type="text" placeholder="Full Name" />
        </div>
        <div class="input-group">
          <label>Department</label>
          <input v-model="newEmployeeForm.department" type="text" placeholder="Department" />
        </div>
        <div class="input-group">
          <label>Role <span class="required">*</span></label>
          <div class="select-wrapper">
            <select v-model="newEmployeeForm.role">
              <option value="EMPLOYEE">Employee</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="IT_ADMIN">IT Admin</option>
              <option value="HR_ADMIN">HR Admin</option>
              <option value="FLEET_ADMIN">Fleet Admin</option>
            </select>
          </div>
        </div>
        <div class="input-group checkbox-group">
          <label class="checkbox-container">
            <input v-model="newEmployeeForm.isLead" type="checkbox" />
            <span class="checkmark"></span>
            Is Lead/Head
          </label>
        </div>
        <div class="input-group full-width">
          <button class="btn-primary" @click="createEmployee" :disabled="isCreatingEmployee">
            <span v-if="isCreatingEmployee" class="spinner-small"></span>
            {{ isCreatingEmployee ? 'Creating...' : 'Create Employee' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Section 2: Fleet Schedule (SUPER_ADMIN, FLEET_ADMIN only) -->
    <div v-if="canManageVehicles" class="admin-section">
      <div class="section-header">
        <h3>Fleet Schedule</h3>
        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <input 
            v-model="scheduleDateFrom" 
            type="date" 
            class="edit-input"
            style="width: auto; min-width: 150px;"
            @change="loadFleetSchedule"
          />
          <span>to</span>
          <input 
            v-model="scheduleDateTo" 
            type="date" 
            class="edit-input"
            style="width: auto; min-width: 150px;"
            @change="loadFleetSchedule"
          />
          <button class="btn-secondary" @click="loadFleetSchedule" :disabled="isLoadingSchedule">
            <span v-if="isLoadingSchedule" class="spinner-small"></span>
            {{ isLoadingSchedule ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>
      <div class="table-container">
        <table v-if="fleetSchedule.length" class="styled-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Start</th>
              <th>End</th>
              <th>Requester</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="booking in fleetSchedule" :key="booking.requestId">
              <td class="fw-bold">
                <span v-if="booking.vehicleName">{{ booking.vehicleName }}</span>
                <span v-else class="text-muted">Unassigned</span>
                <br>
                <span class="font-mono" style="font-size: 0.85rem; color: var(--shc-text-secondary);">
                  {{ formatPlateNumber(booking.vehiclePlateNumber, booking.vehiclePlateCode) || 'N/A' }}
                </span>
              </td>
              <td>{{ new Date(booking.startDatetime).toLocaleString() }}</td>
              <td>{{ new Date(booking.endDatetime).toLocaleString() }}</td>
              <td>{{ booking.requesterName }}</td>
              <td>{{ booking.destination || 'N/A' }}</td>
              <td>
                <span class="status-indicator" :data-status="booking.status">
                  {{ formatStatus(booking.status) }}
                </span>
              </td>
              <td>
                <button class="btn-link" @click="$emit('view-request', booking.requestId)">View</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <p>{{ isLoadingSchedule ? 'Loading schedule...' : 'No bookings found for selected date range.' }}</p>
        </div>
      </div>
    </div>

    <!-- Section 3: Vehicles (SUPER_ADMIN, FLEET_ADMIN only) -->
    <div v-if="canManageVehicles" class="admin-section">
      <div class="section-header">
        <h3>Vehicles</h3>
        <button class="btn-secondary" @click="loadVehicles" :disabled="isLoadingVehicles">
          <span v-if="isLoadingVehicles" class="spinner-small"></span>
          {{ isLoadingVehicles ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
      
      <!-- Add New Vehicle Form -->
      <div class="form-grid" style="max-width: 800px; margin-bottom: 2rem; padding: 1.5rem; background: rgba(255, 255, 255, 0.5); border-radius: var(--radius-md); border: 1px solid var(--shc-border);">
        <div class="input-group">
          <label>Vehicle Name <span class="required">*</span></label>
          <input v-model="newVehicleForm.name" type="text" placeholder="e.g. Prado White" />
        </div>
        <div class="input-group">
          <label>Plate Number <span class="required">*</span></label>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input 
              v-model="newVehicleForm.plateNumber" 
              type="text" 
              placeholder="e.g. 6598" 
              style="flex: 1;"
              maxlength="10"
            />
            <input 
              v-model="newVehicleForm.plateCode" 
              type="text" 
              placeholder="e.g. HY" 
              style="width: 80px; text-transform: uppercase;"
              maxlength="5"
            />
          </div>
          <small style="color: var(--shc-text-secondary); font-size: 0.85rem; margin-top: 0.25rem; display: block;">
            Format: Number (e.g. 6598) and Code (e.g. HY)
          </small>
        </div>
        <div class="input-group">
          <label>Vehicle Type</label>
          <div class="select-wrapper">
            <select v-model="newVehicleForm.type">
              <option value="">Select Type</option>
              <option>SUV</option>
              <option>Sedan</option>
              <option>Pickup</option>
              <option>Van</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div class="input-group full-width">
          <button class="btn-primary" @click="createVehicle" :disabled="isCreatingVehicle">
            <span v-if="isCreatingVehicle" class="spinner-small"></span>
            {{ isCreatingVehicle ? 'Adding...' : 'Add Vehicle' }}
          </button>
        </div>
      </div>
      <div class="table-container">
        <table v-if="vehicles.length" class="styled-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Plate</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vehicle in vehicles" :key="vehicle.id">
              <td class="fw-bold">{{ vehicle.name }}</td>
              <td class="font-mono">{{ formatPlateNumber(vehicle.plate_number, vehicle.plate_code) }}</td>
              <td>{{ vehicle.type || 'N/A' }}</td>
              <td>
                <span class="status-indicator" :data-status="vehicle.status">
                  {{ vehicle.status }}
                </span>
              </td>
              <td>
                <button 
                  class="btn-link" 
                  @click="toggleVehicleStatus(vehicle.id, vehicle.status)"
                >
                  {{ vehicle.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <p>No vehicles found.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';
import { useStatusFormatter } from '../composables/useStatusFormatter';

import { API_BASE } from '../config';
const apiBase = API_BASE;
const { isSuperAdmin, isHRAdmin, isFleetAdmin, isITAdmin, canManageEmployees, canManageVehicles, authenticatedFetch } = useAuth();
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

// Employees
const employees = ref([]);
const isLoadingEmployees = ref(false);
const editingEmployee = ref(null);
const employeeEditForm = ref({
  role: '',
  department: '',
  isLead: false
});
const newEmployeeForm = ref({
  email: '',
  password: '',
  fullName: '',
  department: '',
  role: 'EMPLOYEE',
  isLead: false
});
const isCreatingEmployee = ref(false);

// Vehicles
const vehicles = ref([]);
const isLoadingVehicles = ref(false);
const newVehicleForm = ref({
  name: '',
  plateNumber: '',
  plateCode: '',
  type: ''
});
const isCreatingVehicle = ref(false);

// Fleet Schedule
const fleetSchedule = ref([]);
const isLoadingSchedule = ref(false);
const scheduleDateFrom = ref(new Date().toISOString().split('T')[0]);
const scheduleDateTo = ref(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

const loadEmployees = async () => {
  isLoadingEmployees.value = true;
  try {
    const res = await authenticatedFetch(`${apiBase}/admin/employees`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load employees');
    }
    employees.value = await res.json();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
    employees.value = [];
  } finally {
    isLoadingEmployees.value = false;
  }
};

const activateEmployee = async (employeeId) => {
  try {
    const res = await authenticatedFetch(`${apiBase}/admin/employees/${employeeId}/activate`, {
      method: 'PATCH'
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to activate employee');
    }
    showToast('Employee activated successfully', 'success');
    await loadEmployees();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
  }
};

const startEditEmployee = (employee) => {
  editingEmployee.value = employee.id;
  employeeEditForm.value.role = employee.role;
  employeeEditForm.value.department = employee.department || '';
  employeeEditForm.value.isLead = employee.isLead || false;
};

const cancelEditEmployee = () => {
  editingEmployee.value = null;
  employeeEditForm.value = { role: '', department: '', isLead: false };
};

const saveEmployee = async (employeeId) => {
  try {
    const res = await authenticatedFetch(`${apiBase}/admin/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify(employeeEditForm.value)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update employee');
    }
    showToast('Employee updated successfully', 'success');
    editingEmployee.value = null;
    await loadEmployees();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
  }
};

const createEmployee = async () => {
  if (!newEmployeeForm.value.email || !newEmployeeForm.value.password || !newEmployeeForm.value.fullName) {
    showToast('Email, password, and full name are required', 'error');
    return;
  }
  
  isCreatingEmployee.value = true;
  try {
    const res = await authenticatedFetch(`${apiBase}/admin/employees`, {
      method: 'POST',
      body: JSON.stringify(newEmployeeForm.value)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create employee');
    }
    showToast('Employee created successfully', 'success');
    newEmployeeForm.value = {
      email: '',
      password: '',
      fullName: '',
      department: '',
      role: 'EMPLOYEE',
      isLead: false
    };
    await loadEmployees();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
  } finally {
    isCreatingEmployee.value = false;
  }
};

const loadVehicles = async () => {
  isLoadingVehicles.value = true;
  try {
    const res = await authenticatedFetch(`${apiBase}/admin/vehicles`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load vehicles');
    }
    vehicles.value = await res.json();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
    vehicles.value = [];
  } finally {
    isLoadingVehicles.value = false;
  }
};

const toggleVehicleStatus = async (vehicleId, currentStatus) => {
  try {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const res = await authenticatedFetch(`${apiBase}/admin/vehicles/${vehicleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update vehicle status');
    }
    showToast(`Vehicle status updated to ${newStatus}`, 'success');
    await loadVehicles();
  } catch (e) {
    if (e.message.includes('Session expired')) {
      showToast('Your session has expired. Please log in again.', 'error', 8000);
    } else {
      showToast(e.message, 'error');
    }
  }
};

const createVehicle = async () => {
  if (!newVehicleForm.value.name || !newVehicleForm.value.plateNumber) {
    showToast('Vehicle name and plate number are required', 'error');
    return;
  }
  
  // Validate plate code format (optional, but if provided should be 2-5 uppercase letters)
  if (newVehicleForm.value.plateCode && !/^[A-Z]{2,5}$/i.test(newVehicleForm.value.plateCode)) {
    showToast('Plate code must be 2-5 letters', 'error');
    return;
  }
  
  isCreatingVehicle.value = true;
  try {
    const res = await authenticatedFetch(`${apiBase}/admin/vehicles`, {
      method: 'POST',
      body: JSON.stringify({
        name: newVehicleForm.value.name,
        plateNumber: newVehicleForm.value.plateNumber,
        plateCode: (newVehicleForm.value.plateCode || '').toUpperCase().trim(),
        type: newVehicleForm.value.type || null
      })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create vehicle');
    }
    
    showToast('Vehicle added successfully', 'success');
    newVehicleForm.value = { name: '', plateNumber: '', plateCode: '', type: '' };
    await loadVehicles();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    isCreatingVehicle.value = false;
  }
};

const loadFleetSchedule = async () => {
  if (!canManageVehicles.value) return;
  
  isLoadingSchedule.value = true;
  try {
    const params = new URLSearchParams();
    if (scheduleDateFrom.value) params.append('from', scheduleDateFrom.value);
    if (scheduleDateTo.value) params.append('to', scheduleDateTo.value);
    
    const res = await authenticatedFetch(`${apiBase}/fleet/schedule?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load fleet schedule');
    }
    fleetSchedule.value = await res.json();
  } catch (e) {
    showToast(e.message, 'error');
    fleetSchedule.value = [];
  } finally {
    isLoadingSchedule.value = false;
  }
};

onMounted(() => {
  if (canManageEmployees.value) {
    loadEmployees();
  }
  if (canManageVehicles.value) {
    loadVehicles();
    loadFleetSchedule();
  }
});
</script>

