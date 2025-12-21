# Testing Checklist - Internal System SOP Implementation

**Date:** 2024  
**Version:** 1.0

---

## Pre-Testing Setup

1. **Start Backend:**
   ```bash
   cd backend
   npm install
   node server.js
   ```
   - Verify: Server starts on `http://localhost:4000`
   - Verify: Database initializes without errors
   - Verify: Demo users are seeded

2. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - Verify: Frontend starts on `http://localhost:5173` (or similar)

---

## 1. Role-Based Login & Default Tabs

### Test 1.1: EMPLOYEE Login
- **Login:** `ismail@housing.gov.om` / `password123`
- **Expected:**
  - ✅ Default tab: **Car Booking**
  - ✅ Available tabs: Car Booking, IT Request, My Requests
  - ✅ Cannot see "Admin" tab
  - ✅ Cannot see "Onboarding" tab (unless is_lead=true)

### Test 1.2: IT_ADMIN Login
- **Login:** `it@housing.gov.om` / `password123`
- **Expected:**
  - ✅ Default tab: **My Requests**
  - ✅ Sees IT requests + Onboarding requests in IT_SETUP step
  - ✅ Cannot see other onboarding steps

### Test 1.3: HR_ADMIN Login
- **Login:** `hr@housing.gov.om` / `password123`
- **Expected:**
  - ✅ Default tab: **My Requests**
  - ✅ Sees all onboarding requests
  - ✅ Can access Admin tab → Employees section

### Test 1.4: FLEET_ADMIN Login
- **Login:** `fleet@housing.gov.om` / `password123`
- **Expected:**
  - ✅ Default tab: **My Requests**
  - ✅ Sees all car booking requests
  - ✅ Can access Admin tab → Vehicles + Fleet Schedule

### Test 1.5: SUPER_ADMIN Login
- **Login:** `admin@housing.gov.om` / `password123`
- **Expected:**
  - ✅ Default tab: **My Requests**
  - ✅ Sees all requests (all types)
  - ✅ Full access to Admin tab (Employees, Vehicles, Fleet Schedule)

---

## 2. Request Submission & Visibility

### Test 2.1: Employee Submits Car Booking
- **User:** `ismail@housing.gov.om`
- **Steps:**
  1. Go to "Car Booking" tab
  2. Fill form (dates, destination, purpose)
  3. Submit
- **Expected:**
  - ✅ Request appears in "My Requests"
  - ✅ Status: `BOOKED` (if vehicle auto-assigned) or `IN_REVIEW`
  - ✅ FLEET_ADMIN can see this request
  - ✅ Employee cannot see other employees' requests

### Test 2.2: Employee Submits IT Request
- **User:** `ismail@housing.gov.om`
- **Steps:**
  1. Go to "IT Request" tab
  2. Fill form (title, description, category)
  3. Submit
- **Expected:**
  - ✅ Request appears in "My Requests"
  - ✅ Status: `SUBMITTED`
  - ✅ IT_ADMIN can see this request
  - ✅ Employee cannot see other employees' requests

### Test 2.3: Lead Submits Onboarding
- **Prerequisite:** Set `is_lead=1` for a user (via HR_ADMIN)
- **User:** User with `is_lead=true` OR `hr@housing.gov.om`
- **Steps:**
  1. Go to "Onboarding" tab
  2. Fill form (employee name, position, start date, device type)
  3. Submit
- **Expected:**
  - ✅ Request appears in "My Requests"
  - ✅ Status: `SUBMITTED`, Step: `SUBMITTED`
  - ✅ HR_ADMIN can see this request
  - ✅ IT_ADMIN does NOT see it yet (not in IT_SETUP step)

### Test 2.4: Employee Cannot Submit Onboarding
- **User:** `ismail@housing.gov.om` (not a lead)
- **Steps:**
  1. Try to access "Onboarding" tab
- **Expected:**
  - ✅ Tab is hidden OR shows message: "You need to be a Lead/Head or HR Admin to submit onboarding requests."

---

## 3. IT_ADMIN Sees Onboarding Device Tasks

### Test 3.1: Onboarding Moves to IT_SETUP
- **Prerequisite:** Create an onboarding request with a device (e.g., "Business Laptop")
- **Steps:**
  1. HR_ADMIN logs in
  2. Opens onboarding request
  3. Updates status/step to move to `IT_SETUP`
  4. IT_ADMIN logs in
  5. Checks "My Requests"
- **Expected:**
  - ✅ IT_ADMIN sees the onboarding request in their queue
  - ✅ Request shows: `type='ONBOARDING'`, `current_step='IT_SETUP'`
  - ✅ IT_ADMIN can update the request status

### Test 3.2: IT_ADMIN Completes Device Setup
- **User:** `it@housing.gov.om`
- **Steps:**
  1. Open onboarding request in IT_SETUP step
  2. Update status to `COMPLETED` or move step forward
- **Expected:**
  - ✅ Request status updates successfully
  - ✅ Audit log entry created in `request_actions`

---

## 4. Fleet Schedule

### Test 4.1: FLEET_ADMIN Views Schedule
- **User:** `fleet@housing.gov.om`
- **Steps:**
  1. Go to "Admin" tab
  2. Scroll to "Fleet Schedule" section
  3. Set date range (default: today to 30 days ahead)
  4. Click "Refresh"
- **Expected:**
  - ✅ Schedule loads showing all car bookings
  - ✅ Columns: Vehicle, Start, End, Requester, Destination, Status
  - ✅ Bookings sorted by start_datetime

### Test 4.2: Filter Schedule by Date Range
- **User:** `fleet@housing.gov.om`
- **Steps:**
  1. Change "from" date to tomorrow
  2. Change "to" date to next week
  3. Click "Refresh"
- **Expected:**
  - ✅ Only bookings within date range are shown

---

## 5. Employee Management (HR_ADMIN)

### Test 5.1: Create Employee
- **User:** `hr@housing.gov.om`
- **Steps:**
  1. Go to "Admin" tab → Employees section
  2. Fill "Create Employee" form:
     - Email: `test@housing.gov.om`
     - Password: `password123`
     - Full Name: `Test User`
     - Department: `IT`
     - Role: `EMPLOYEE` (default)
     - Check "Is Lead/Head" checkbox
  3. Click "Create Employee"
- **Expected:**
  - ✅ Employee created successfully
  - ✅ Toast message: "Employee created successfully"
  - ✅ Employee appears in table with `is_lead=true`
  - ✅ Role is `EMPLOYEE` (uppercase)

### Test 5.2: Edit Employee
- **User:** `hr@housing.gov.om`
- **Steps:**
  1. Find an employee in the table
  2. Click "Edit"
  3. Change role to `IT_ADMIN`
  4. Uncheck "Is Lead"
  5. Click "Save"
- **Expected:**
  - ✅ Employee updated successfully
  - ✅ Changes reflected in table

### Test 5.3: Activate/Deactivate Employee
- **User:** `hr@housing.gov.om`
- **Steps:**
  1. Find an inactive employee
  2. Click "Activate"
- **Expected:**
  - ✅ Employee status changes to active
  - ✅ Employee can now log in

---

## 6. Vehicle Management (FLEET_ADMIN)

### Test 6.1: View Vehicles
- **User:** `fleet@housing.gov.om`
- **Steps:**
  1. Go to "Admin" tab → Vehicles section
- **Expected:**
  - ✅ All vehicles listed (name, plate, type, status)

### Test 6.2: Toggle Vehicle Status
- **User:** `fleet@housing.gov.om`
- **Steps:**
  1. Find a vehicle with status `ACTIVE`
  2. Click "Deactivate"
- **Expected:**
  - ✅ Vehicle status changes to `INACTIVE`
  - ✅ Vehicle no longer appears in car booking dropdown (if filtered)

---

## 7. Employee ID Visibility

### Test 7.1: Normal Employee Cannot See Employee ID
- **User:** `ismail@housing.gov.om`
- **Steps:**
  1. Go to "My Requests"
  2. View requests table
- **Expected:**
  - ✅ "Employee ID" column is NOT visible
  - ✅ Request detail modal does NOT show Employee ID

### Test 7.2: Admin Can See Employee ID
- **User:** `admin@housing.gov.om` (or any admin)
- **Steps:**
  1. Go to "My Requests"
  2. View requests table
- **Expected:**
  - ✅ "Employee ID" column IS visible
  - ✅ Request detail modal shows Employee ID

---

## 8. Error Handling & Transactions

### Test 8.1: Database Error Handling
- **Steps:**
  1. Submit a request with invalid data (e.g., missing required fields)
- **Expected:**
  - ✅ User-friendly error message displayed
  - ✅ In development mode: Detailed error in console
  - ✅ Transaction rolled back (no partial data)

### Test 8.2: 401 Unauthorized Handling
- **Steps:**
  1. Log in
  2. Manually expire token (or wait for expiration)
  3. Try to submit a request
- **Expected:**
  - ✅ Toast message: "Your session has expired. Please log in again."
  - ✅ User redirected to login screen
  - ✅ `localStorage` cleared

---

## 9. Audit Logging

### Test 9.1: Request Actions Logged
- **Steps:**
  1. Create a request (any type)
  2. Update request status
  3. Check backend console logs
- **Expected:**
  - ✅ `request_actions` table has entries
  - ✅ Actions include: `CREATE`, `STATUS_UPDATE`
  - ✅ Actor employee_id is logged
  - ✅ Logging failures don't break request flow

---

## 10. Auto IT Request Creation

### Test 10.1: Onboarding Completion Triggers IT Request
- **Prerequisite:** Create onboarding request with device (e.g., "Business Laptop")
- **Steps:**
  1. HR_ADMIN marks onboarding as `COMPLETED`
  2. Check IT_ADMIN's queue
- **Expected:**
  - ✅ New IT request auto-created
  - ✅ IT request title: "Device Setup: [device] for [employee]"
  - ✅ IT request linked to onboarding request
  - ✅ Toast message shows IT request ID

---

## 11. Role Consistency

### Test 11.1: Employee Creation Defaults to EMPLOYEE
- **User:** `hr@housing.gov.om`
- **Steps:**
  1. Create new employee
  2. Leave role as default (should be `EMPLOYEE`)
  3. Submit
- **Expected:**
  - ✅ Employee role is `EMPLOYEE` (uppercase) in database
  - ✅ Not `employee` (lowercase)

---

## 12. Tab Labels

### Test 12.1: Tab Names
- **Steps:**
  1. Log in as any user
  2. Check tab labels
- **Expected:**
  - ✅ "My Requests" (not "Request History")
  - ✅ "Car Booking"
  - ✅ "IT Request"
  - ✅ "Onboarding" (if visible)
  - ✅ "Admin" (if admin role)

---

## Known Issues / Notes

- If database is locked (`SQLITE_BUSY`), restart backend server
- WAL files (`.db-wal`, `.db-shm`) are auto-managed by SQLite
- Password is hashed with SHA-256 (not bcrypt) - acceptable for MVP

---

## Quick Test Script

```bash
# Backend
cd backend && node server.js

# Frontend (new terminal)
cd frontend && npm run dev

# Test logins:
# - admin@housing.gov.om / password123 (SUPER_ADMIN)
# - it@housing.gov.om / password123 (IT_ADMIN)
# - hr@housing.gov.om / password123 (HR_ADMIN)
# - fleet@housing.gov.om / password123 (FLEET_ADMIN)
# - ismail@housing.gov.om / password123 (EMPLOYEE)
```

---

**End of Testing Checklist**

