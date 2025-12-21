# Internal System - Standard Operating Procedure (SOP) & Role Logic

**Version:** 1.0  
**Last Updated:** 2024  
**System:** Internal System (Vue + Express + SQLite)

---

## 1. System Overview

### 1.1 Modules

The Internal System consists of five main modules:

1. **Car Booking** - Vehicle requisition for official city business
2. **IT Requests** - IT support, device setup, system access, troubleshooting
3. **Onboarding** - New employee onboarding workflow (HR + IT coordination)
4. **My Requests** - Personal request history and status tracking
5. **Admin** - Master data management (Employees, Vehicles)

### 1.2 Request Model

**Core Request (`requests` table):**
- Every request has: `id`, `type` (CAR_BOOKING, IT, ONBOARDING), `title`, `description`, `requester_name`, `department`, `status`, `employee_id`, `created_at`, `updated_at`
- Workflow fields: `assigned_role`, `assigned_to_employee_id`, `workflow_status`, `current_step`

**Request Types & Detail Tables:**
- **CAR_BOOKING** → `car_bookings` (vehicle_id, start_datetime, end_datetime, destination, reason, passengers)
- **IT** → `it_requests` (category, system_name, impact, urgency, asset_tag)
- **ONBOARDING** → `onboarding_requests` (employee_name, position, location, start_date, device_type, vpn_required, notes)

### 1.3 Status & Workflow Concepts

**Status (`status` field):**
- Simple state: `SUBMITTED`, `IN_REVIEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Used for quick filtering and reporting

**Workflow (`workflow_status` + `current_step`):**
- **Workflow Status**: Overall workflow state (e.g., `SUBMITTED`, `HR_REVIEW`, `IT_SETUP`, `COMPLETED`)
- **Current Step**: Specific step within the workflow (e.g., `SUBMITTED`, `HR_REVIEW`, `IT_SETUP`, `COMPLETED`)

**Why both?** Status is for quick views; workflow tracks multi-step processes (especially onboarding: HR → IT → Complete).

**Example - Onboarding Workflow:**
1. `SUBMITTED` (Lead submits) → Status: `SUBMITTED`
2. `HR_REVIEW` (HR approves) → Status: `IN_REVIEW`
3. `IT_SETUP` (IT provisions device/accounts) → Status: `IN_PROGRESS`
4. `COMPLETED` (All done) → Status: `COMPLETED`

---

## 2. Role Matrix

| Role | Can Submit | Can View | Can Update | Can Manage Master Data | Notes |
|------|------------|----------|------------|------------------------|-------|
| **EMPLOYEE** | IT, Car Booking | Own requests only | None | None | Cannot see other employees' requests or employee IDs |
| **FLEET_ADMIN** | None | All CAR_BOOKING requests | Override bookings (vehicle/time/status) | Vehicles (add/edit/activate/deactivate) | Has Fleet Schedule view |
| **HR_ADMIN** | Onboarding (if is_lead) | All ONBOARDING requests | Onboarding status (HR steps) | Employees (create/edit/activate, set is_lead, job_level) | Manages employee master data |
| **IT_ADMIN** | None | All IT requests + Onboarding requests in IT_SETUP step | IT request status, Onboarding IT_SETUP completion | None | Receives device tasks from onboarding |
| **SUPER_ADMIN** | All types | All requests (all types) | All statuses | All master data (employees, vehicles) | Full system access |

---

## 3. Role-Specific SOPs

### 3.1 EMPLOYEE SOP

**Daily Workflow:**
- Login → Default tab: **Car Booking**
- Check "My Requests" tab to see status of submitted requests

**Car Booking Process:**
1. Fill form: dates, destination, purpose, passengers
2. System auto-assigns vehicle if available (or select specific vehicle)
3. Submit → Request appears in "My Requests" with status `BOOKED` or `IN_REVIEW`
4. Monitor status until `COMPLETED`

**IT Request Process:**
1. Fill form: title, description, category, system/device
2. Submit → IT admin receives request
3. Track in "My Requests" → Status updates: `SUBMITTED` → `IN_REVIEW` → `IN_PROGRESS` → `COMPLETED`

**Onboarding:**
- **Cannot submit** - Only Leads/Heads (is_lead=true) or HR_ADMIN can submit onboarding requests

**Limitations:**
- Cannot view other employees' requests
- Cannot see Employee ID column (privacy)
- Cannot manage vehicles or employees

---

### 3.2 HR_ADMIN SOP

**Daily Workflow:**
- Login → Default tab: **My Requests**
- Review "My Requests" for all ONBOARDING requests
- Check Admin tab → Employees section for user management

**Employee Management:**
1. **Create Employee:**
   - Fill: email, password, full name, department, role
   - Set `is_lead` checkbox if employee is a Lead/Head (can submit onboarding)
   - Set `job_level` (optional: e.g., "Senior", "Manager")
   - Activate account

2. **Edit Employee:**
   - Update role, department, is_lead, job_level
   - Activate/deactivate accounts

**Onboarding Process:**
1. Receive onboarding request (status: `SUBMITTED`, step: `SUBMITTED`)
2. Review details (employee name, position, start date, device needs)
3. **HR_REVIEW step:**
   - Approve → Move to `IT_SETUP` (if device needed) OR `COMPLETED` (if no device)
   - Reject → Set status `CANCELLED` with note
4. After IT completes setup → HR marks onboarding `COMPLETED`

**Visibility:**
- Sees all onboarding requests (regardless of requester)
- Can view all employees in Admin tab

---

### 3.3 IT_ADMIN SOP

**Daily Workflow:**
- Login → Default tab: **My Requests**
- Review queue: IT requests + Onboarding requests in `IT_SETUP` step

**IT Request Process:**
1. **Triage:**
   - Review request (category, system, impact, urgency)
   - Set priority (impact/urgency fields)
   - Assign to team member (optional: `assigned_to_employee_id`)

2. **Work:**
   - Update status: `IN_REVIEW` → `IN_PROGRESS`
   - Document progress in notes/description
   - Update asset_tag if hardware involved

3. **Resolve:**
   - Mark `COMPLETED`
   - Add resolution note (via request_actions audit log)

**Onboarding Device Tasks:**
1. **Receive Task:**
   - Onboarding request moves to `IT_SETUP` step (triggered by HR)
   - IT admin sees it in "My Requests" queue
   - Request shows: employee name, device type, VPN required, start date

2. **Provision:**
   - Set up device (laptop/desktop/tablet)
   - Configure accounts (email, VPN if needed)
   - Update asset_tag in onboarding_requests (optional)

3. **Complete:**
   - Mark onboarding `IT_SETUP` step as complete
   - Move to `COMPLETED` OR return to `HR_REVIEW` if issues

**Visibility:**
- Sees all IT requests (type='IT')
- Sees onboarding requests where `current_step='IT_SETUP'` OR `workflow_status='IT_SETUP'`
- Cannot see other onboarding steps (HR handles those)

---

### 3.4 FLEET_ADMIN SOP

**Daily Workflow:**
- Login → Default tab: **My Requests**
- Check "Fleet Schedule" view (calendar/list of bookings)
- Review Admin tab → Vehicles section

**Fleet Schedule:**
1. View all upcoming bookings by vehicle and time
2. Filter by vehicle, date range
3. See conflicts, availability gaps

**Booking Management:**
1. **Override Booking:**
   - Change vehicle (if original unavailable)
   - Adjust time (if conflict)
   - Change status (e.g., `CANCELLED` if trip cancelled)
   - Add reason/note (logged in request_actions)

2. **Vehicle Management:**
   - Add new vehicles (name, plate, type, status)
   - Edit vehicle details
   - Activate/deactivate vehicles

**Visibility:**
- Sees all CAR_BOOKING requests
- Cannot see IT or Onboarding requests

---

### 3.5 SUPER_ADMIN SOP

**Daily Workflow:**
- Login → Default tab: **My Requests**
- Full access to all modules and data

**Responsibilities:**
1. **Governance:**
   - Set employee roles
   - Deactivate accounts
   - Manage all master data (employees, vehicles)

2. **Oversight:**
   - View all requests (all types, all employees)
   - Can update any request status
   - Can override any admin decision

3. **System Administration:**
   - Monitor audit logs (request_actions table)
   - Resolve conflicts between admins
   - Handle exceptions

**Visibility:**
- Sees all requests (no filtering)
- Sees all employees and vehicles
- Can access all tabs and features

---

## 4. System-Wide SOP / Governance

### 4.1 Request Ownership

- **Requester** owns the submission (employee_id links to requester)
- **Admins** own processing (assigned_role, assigned_to_employee_id)
- Request cannot be deleted (only cancelled) - audit trail preserved

### 4.2 Audit Logging

- All actions logged in `request_actions` table:
  - `action_type`: CREATE, STATUS_UPDATE, FLEET_OVERRIDE, etc.
  - `from_status` / `to_status`: Status transitions
  - `actor_employee_id`: Who performed the action
  - `note`: Optional explanation
  - `created_at`: Timestamp

- **Audit logging never blocks requests** - if logging fails, request still succeeds (error logged to console only)

### 4.3 Data Visibility & Privacy

- **Employee ID visibility:**
  - Normal employees: Cannot see Employee ID column (privacy)
  - Admins: Can see Employee ID for tracking/assignment

- **Request visibility:**
  - Employees see only their own requests (filtered by `employee_id`)
  - Admins see requests based on role (IT sees IT + IT_SETUP onboarding, HR sees onboarding, Fleet sees car bookings)
  - SUPER_ADMIN sees all

### 4.4 Default Tabs After Login

- **EMPLOYEE** → `Car Booking` tab (primary use case)
- **Admin roles** (SUPER_ADMIN, IT_ADMIN, HR_ADMIN, FLEET_ADMIN) → `My Requests` tab (review queue first)

### 4.5 Workflow Transitions

**Onboarding Workflow:**
1. Lead/HR submits → `SUBMITTED` (HR_ADMIN assigned)
2. HR reviews → `HR_REVIEW` (HR_ADMIN)
3. HR approves + device needed → `IT_SETUP` (IT_ADMIN assigned)
4. IT completes setup → `COMPLETED` (or return to HR if issue)
5. HR finalizes → `COMPLETED`

**IT Request Workflow:**
1. Employee submits → `SUBMITTED` (IT_ADMIN assigned)
2. IT triages → `IN_REVIEW`
3. IT works → `IN_PROGRESS`
4. IT resolves → `COMPLETED`

**Car Booking Workflow:**
1. Employee submits → `SUBMITTED` (FLEET_ADMIN assigned)
2. System auto-books → `BOOKED` (if vehicle available)
3. Fleet reviews → `IN_REVIEW` (if manual review needed)
4. Trip completed → `COMPLETED`

### 4.6 Error Handling

- **Development mode:** Returns actual SQLite error details for debugging
- **Production mode:** Returns user-friendly messages (no sensitive data)
- **Transactions:** All multi-step operations use `BEGIN IMMEDIATE TRANSACTION` → `COMMIT` / `ROLLBACK`
- **Retry logic:** Database write operations retry on `SQLITE_BUSY` errors

---

## 5. Technical Notes

### 5.1 Role Naming

- All roles are **uppercase**: `EMPLOYEE`, `SUPER_ADMIN`, `IT_ADMIN`, `HR_ADMIN`, `FLEET_ADMIN`
- Employee creation defaults to `EMPLOYEE` (not `employee`)

### 5.2 API Endpoints

- `GET /api/requests` - Role-based filtering (see Role Matrix)
- `GET /api/requests/:id` - Role-based authorization
- `PATCH /api/requests/:id/status` - Admin-only (role-based)
- `GET /api/fleet/schedule` - Fleet schedule (FLEET_ADMIN, SUPER_ADMIN)
- `POST /api/admin/employees` - Employee management (HR_ADMIN, SUPER_ADMIN)
- `GET /api/admin/vehicles` - Vehicle management (FLEET_ADMIN, SUPER_ADMIN)

### 5.3 Database Schema

- `requests` - Core request table
- `car_bookings`, `it_requests`, `onboarding_requests` - Detail tables
- `request_actions` - Audit trail
- `employees` - User accounts (with `is_lead`, `job_level`)
- `vehicles` - Fleet master data

---

## 6. Quick Reference

**Who can submit what?**
- **EMPLOYEE:** IT requests, Car bookings
- **Lead/Head (is_lead=true):** IT requests, Car bookings, Onboarding
- **HR_ADMIN:** Onboarding (if is_lead), IT requests, Car bookings
- **SUPER_ADMIN:** All types

**Who sees what requests?**
- **EMPLOYEE:** Own requests only
- **IT_ADMIN:** IT requests + Onboarding in IT_SETUP step
- **HR_ADMIN:** All onboarding requests
- **FLEET_ADMIN:** All car bookings
- **SUPER_ADMIN:** All requests

**Who manages what?**
- **HR_ADMIN:** Employees (create/edit/activate, set is_lead)
- **FLEET_ADMIN:** Vehicles (add/edit/activate)
- **SUPER_ADMIN:** Everything

---

**End of SOP Document**

