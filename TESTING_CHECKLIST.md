# Testing Checklist

## Setup

1. **Start Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   - Backend should start on `http://localhost:4000`
   - Check console for database initialization messages
   - Verify seed users are created

2. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - Frontend should start on `http://localhost:5173` (or similar)

## Test Logins

### Test 1: Employee Login
- **Email:** `ismail@housing.gov.om`
- **Password:** `password123`
- **Expected:** 
  - Login successful
  - Default tab: "Car Booking"
  - Can see only own requests in "My Requests"

### Test 2: IT Admin Login
- **Email:** `it@housing.gov.om`
- **Password:** `password123`
- **Expected:**
  - Login successful
  - Default tab: "My Requests"
  - Can see only IT requests (not CAR_BOOKING or ONBOARDING)

### Test 3: Super Admin Login
- **Email:** `admin@housing.gov.om`
- **Password:** `password123`
- **Expected:**
  - Login successful
  - Default tab: "My Requests"
  - Can see ALL requests (IT, CAR_BOOKING, ONBOARDING)

## Test Request Submission

### Test 4: Submit IT Request as Employee
1. Login as `ismail@housing.gov.om`
2. Go to "IT" tab
3. Fill form and submit
4. **Expected:**
   - Request created successfully
   - No SQLITE_BUSY errors in backend console
   - Request appears in "My Requests" tab
   - Employee ID column is NOT visible (normal user)

### Test 5: View IT Request as IT Admin
1. Login as `it@housing.gov.om`
2. Go to "My Requests" tab
3. **Expected:**
   - Can see the IT request submitted by employee
   - Employee ID column IS visible (admin user)
   - Can click to view details

### Test 6: Employee Cannot View Others' Requests
1. Login as `ismail@housing.gov.om`
2. Go to "My Requests"
3. **Expected:**
   - Only sees own requests
   - Cannot access other employees' requests via direct URL
   - Employee ID column is hidden

## Test Authorization

### Test 7: 401 Handling
1. Login as any user
2. Open browser DevTools → Application → Local Storage
3. Delete `authToken`
4. Try to submit a request or load requests
5. **Expected:**
   - Auto logout triggered
   - Friendly message: "Your session has expired. Please log in again."
   - Redirected to login screen

### Test 8: Role-Based Request Filtering
1. Login as `it@housing.gov.om` (IT Admin)
2. Go to "My Requests"
3. **Expected:**
   - Only IT requests visible
   - No CAR_BOOKING or ONBOARDING requests

4. Login as `fleet@housing.gov.om` (Fleet Admin)
5. Go to "My Requests"
6. **Expected:**
   - Only CAR_BOOKING requests visible

7. Login as `hr@housing.gov.om` (HR Admin)
8. Go to "My Requests"
9. **Expected:**
   - Only ONBOARDING requests visible

## Test Database Stability

### Test 9: No SQLITE_BUSY Errors
1. Submit multiple requests rapidly (3-5 requests in quick succession)
2. **Expected:**
   - All requests created successfully
   - No "SQLITE_BUSY: database is locked" errors in backend console
   - Backend logs show retry attempts if any (with exponential backoff)

### Test 10: Concurrent Requests
1. Open multiple browser tabs
2. Submit requests from different tabs simultaneously
3. **Expected:**
   - All requests processed successfully
   - No database locking issues
   - WAL mode enabled (check backend console)

## UI/UX Tests

### Test 11: Tab Names and Defaults
- **Normal User:** Default tab = "Car Booking"
- **Admin User:** Default tab = "My Requests"
- Tab name is "My Requests" (not "Request History")

### Test 12: Employee ID Column Visibility
- **Normal User:** Employee ID column hidden in table and modal
- **Admin User:** Employee ID column visible in table and modal

### Test 13: Login Screen Demo Credentials
- Login screen shows demo credentials:
  - admin@housing.gov.om (Super Admin)
  - it@housing.gov.om (IT Admin)
  - ismail@housing.gov.om (Employee)

## Verification Points

✅ All API calls include `Authorization: Bearer <token>` header  
✅ 401 responses trigger auto logout  
✅ Role-based filtering works correctly  
✅ Employee ID validation prevents null values  
✅ Database uses WAL mode and retry logic  
✅ No SQLITE_BUSY errors in normal usage  
✅ UI shows correct tab names and column visibility  
✅ Default tabs based on user role  

