# Debugging Guide - Login Issues

## Step 1: Verify Backend Server is Running

1. Open a terminal in the `backend` directory
2. Run: `npm run dev` or `node server.js`
3. You should see:
   ```
   [DB] Database connection opened successfully
   [DB] Busy timeout set to 30000ms
   [DB] Database initialization complete
   Backend running on http://localhost:4000
   [SERVER] Ready to accept requests
   ```

**If you see errors:**
- Check if port 4000 is already in use
- Check if database file exists: `backend/internal_system.db`
- Delete `.db-wal` and `.db-shm` files if they exist and restart

## Step 2: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Try to login
4. Look for any red error messages

**Common errors:**
- `Failed to fetch` → Backend server is not running
- `CORS error` → Backend CORS not configured
- `401 Unauthorized` → Wrong credentials
- `500 Internal Server Error` → Check backend terminal

## Step 3: Check Network Tab

1. Open browser Developer Tools (F12)
2. Go to **Network** tab
3. Try to login
4. Look for the `/api/auth/login` request

**What to check:**
- Status code: Should be `200` for success, `401` for wrong credentials
- Response: Should contain `token` and `user` object
- Request payload: Should contain `email` and `password`

## Step 4: Check Backend Terminal

When you try to login, you should see in the backend terminal:
```
[LOGIN] Request body: {...}
[LOGIN] Extracted email: ...
[LOGIN] Has password: true
[LOGIN] Validation passed, hashing password...
[LOGIN] Password hash generated, waiting for DB...
[LOGIN] Database ready, querying employee...
[LOGIN] Query completed. Employee found: true/false
[LOGIN] Employee found: ... (if found)
[LOGIN] Token generated, sending response...
[LOGIN] Response sent successfully
```

**If you don't see these logs:**
- Request is not reaching the backend
- Check if frontend is pointing to correct URL: `http://localhost:4000/api`

## Step 5: Verify Database Has Users

1. In backend directory, run: `node -e "const db = require('./db'); const { waitForDb } = require('./db'); waitForDb((err) => { if (err) { console.error(err); process.exit(1); } const sqlite3 = require('sqlite3').verbose(); const db2 = new sqlite3.Database('./internal_system.db'); db2.all('SELECT email, role FROM employees WHERE is_active = 1', [], (err, rows) => { if (err) console.error(err); else console.log('Active users:', rows); db2.close(); process.exit(0); }); });"`
2. You should see a list of users

**Test credentials (password: password123):**
- `admin@housing.gov.om` (Super Admin)
- `it@housing.gov.om` (IT Admin)
- `hr@housing.gov.om` (HR Admin)
- `fleet@housing.gov.om` (Fleet Admin)
- `ismail@housing.gov.om` (Employee)

## Step 6: Common Issues and Fixes

### Issue: "Cannot connect to server"
**Fix:** 
- Make sure backend is running on port 4000
- Check firewall settings
- Verify `apiBase` in `frontend/src/App.vue` is `http://localhost:4000/api`

### Issue: "Login request timed out"
**Fix:**
- Backend might be stuck waiting for database
- Check backend terminal for errors
- Restart backend server

### Issue: "Invalid email or password"
**Fix:**
- Verify you're using correct credentials
- Check database has the user with correct password hash
- Password should be: `password123`

### Issue: "Database is initializing"
**Fix:**
- Wait a few seconds and try again
- Check backend terminal for database initialization errors
- Delete `.db-wal` and `.db-shm` files and restart

## Step 7: Reset Everything

If nothing works:

1. **Stop both frontend and backend servers**

2. **Delete database lock files:**
   ```bash
   cd backend
   del internal_system.db-wal
   del internal_system.db-shm
   ```

3. **Restart backend:**
   ```bash
   cd backend
   npm run dev
   ```

4. **Wait for "Database initialization complete" message**

5. **Restart frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

6. **Clear browser cache and localStorage:**
   - Open browser console
   - Run: `localStorage.clear()`
   - Refresh page

7. **Try login again**

## Still Having Issues?

1. **Check backend terminal** - Look for any error messages
2. **Check browser console** - Look for JavaScript errors
3. **Check network tab** - See what requests are being made
4. **Share the error messages** you see in both places

