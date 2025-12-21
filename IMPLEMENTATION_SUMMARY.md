# Workflow/SOP Implementation Summary

## Files Changed

### Frontend Changes

1. **`frontend/src/App.vue`**
   - Fixed default tab logic after login/refresh to handle async `checkAuth()`
   - Added `watch` to properly wait for authentication state before setting default tab
   - Default tab: EMPLOYEE → 'car', Admins → 'requests'

2. **`frontend/src/composables/useAuth.js`**
   - Made `checkAuth()` async and await `verifyToken()`
   - Changed `canViewEmployeeId` to only return `true` for SUPER_ADMIN (was all admins)

3. **`frontend/src/pages/ITRequestPage.vue`**
   - Improved error messages to show backend error details in development

4. **`frontend/src/pages/OnboardingPage.vue`**
   - Improved error messages to show backend error details in development

5. **`frontend/src/pages/CarBookingPage.vue`**
   - Improved error messages to show backend error details in development

6. **`frontend/src/components/AppLayout.vue`**
   - Already has "My Requests" label (no change needed)

### Backend Changes

1. **`backend/server.js`**
   - **GET `/api/requests`**: Already correctly filters by role:
     - SUPER_ADMIN: all requests (with optional type/status filters)
     - IT_ADMIN: IT requests + ONBOARDING requests where `current_step = 'IT_SETUP'`
     - HR_ADMIN: only ONBOARDING requests
     - FLEET_ADMIN: only CAR_BOOKING requests
     - EMPLOYEE: only their own requests
   
   - **GET `/api/requests/:id`**: Updated to allow IT_ADMIN to view ONBOARDING requests in IT_SETUP step
   
   - **PATCH `/api/requests/:id/status`**: Added comprehensive workflow validation:
     - **ONBOARDING workflow**: SUBMITTED → HR_REVIEW → IT_SETUP → COMPLETED
       - HR_ADMIN can move: SUBMITTED → HR_REVIEW → IT_SETUP (auto-assigns to IT_ADMIN when moving to IT_SETUP)
       - IT_ADMIN can only update when `current_step = 'IT_SETUP'` and can mark COMPLETED
     - **IT requests**: Only IT_ADMIN can update
     - **CAR_BOOKING**: Only FLEET_ADMIN can update
     - SUPER_ADMIN can do anything
   
   - **Request creation endpoints**: Made `logRequestAction()` failures non-blocking:
     - Changed error logging from `console.error` to `console.warn` with "(non-critical)" message
     - Request creation will succeed even if audit logging fails

2. **`backend/db.js`**
   - `request_actions` table already exists (lines 297-316) - no changes needed

## Testing Guide

### Test Users (password: `password123`)

- `admin@housing.gov.om` - SUPER_ADMIN
- `it@housing.gov.om` - IT_ADMIN
- `hr@housing.gov.om` - HR_ADMIN
- `fleet@housing.gov.om` - FLEET_ADMIN
- `ismail@housing.gov.om` - EMPLOYEE

### Test Scenarios

#### 1. Default Tab After Login
- **EMPLOYEE**: Should default to "Car Booking" tab
- **Any Admin**: Should default to "My Requests" tab
- **After refresh**: Should maintain correct default tab based on role

#### 2. Employee ID Column Visibility
- **EMPLOYEE**: Should NOT see "Employee ID" column in My Requests table
- **SUPER_ADMIN**: Should see "Employee ID" column
- **Other admins**: Should NOT see "Employee ID" column (only SUPER_ADMIN)

#### 3. Request Visibility by Role

**SUPER_ADMIN:**
- Should see ALL requests (all types, all statuses)
- Can filter by type and status

**IT_ADMIN:**
- Should see:
  - All IT requests
  - ONBOARDING requests ONLY when `current_step = 'IT_SETUP'`
- Should NOT see:
  - ONBOARDING requests in SUBMITTED or HR_REVIEW steps
  - CAR_BOOKING requests

**HR_ADMIN:**
- Should see:
  - All ONBOARDING requests (all steps)
- Should NOT see:
  - IT requests
  - CAR_BOOKING requests

**FLEET_ADMIN:**
- Should see:
  - All CAR_BOOKING requests
- Should NOT see:
  - IT requests
  - ONBOARDING requests

**EMPLOYEE:**
- Should see:
  - Only their own requests (all types they created)
- Should NOT see:
  - Requests created by other employees

#### 4. Onboarding Workflow

**Test Flow:**
1. **HR_ADMIN** creates onboarding request → `SUBMITTED` (assigned to HR_ADMIN)
2. **HR_ADMIN** moves to `HR_REVIEW` → Still assigned to HR_ADMIN
3. **HR_ADMIN** moves to `IT_SETUP` → Automatically assigned to IT_ADMIN
4. **IT_ADMIN** can now see the onboarding request in "My Requests"
5. **IT_ADMIN** can update and mark as `COMPLETED`
6. **HR_ADMIN** should NOT be able to update after IT_SETUP

**Validation:**
- HR_ADMIN cannot move from IT_SETUP to COMPLETED (should get 403 error)
- IT_ADMIN cannot update when `current_step` is not `IT_SETUP` (should get 403 error)
- IT_ADMIN can mark COMPLETED directly from IT_SETUP

#### 5. Error Messages

**Test Error Handling:**
- Create IT request with invalid data → Should show detailed error message
- Create onboarding request with missing fields → Should show detailed error message
- Create car booking with conflict → Should show detailed error message

**Expected:**
- In development: Shows `error` + `details` (SQLite error)
- In production: Shows only user-friendly `error` message

#### 6. Audit Trail

**Test:**
- Create any request → Should log to `request_actions` table
- Update request status → Should log status change
- If `request_actions` table is missing → Request creation should still succeed (non-blocking)

**Verify:**
- Check backend console for audit log warnings (non-critical)
- Request creation should not fail even if logging fails

## Expected Behavior Summary

### My Requests Page by Role

**SUPER_ADMIN:**
- Sees all requests
- Has type and status filters
- Can see Employee ID column
- Can update any request

**IT_ADMIN:**
- Sees IT requests + ONBOARDING in IT_SETUP
- No Employee ID column
- Can update IT requests and ONBOARDING in IT_SETUP

**HR_ADMIN:**
- Sees all ONBOARDING requests
- No Employee ID column
- Can update ONBOARDING (SUBMITTED → HR_REVIEW → IT_SETUP)

**FLEET_ADMIN:**
- Sees all CAR_BOOKING requests
- No Employee ID column
- Can update CAR_BOOKING requests

**EMPLOYEE:**
- Sees only own requests
- No Employee ID column
- Cannot update requests (read-only)

## Notes

- All workflow rules are enforced at the backend API level
- Frontend provides user-friendly error messages
- Audit trail logging is non-blocking (won't break request creation)
- `request_actions` table already exists in database schema
- Default tab selection properly handles async authentication

