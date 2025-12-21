# Quick Fix Checklist

Run these commands in order:

## 1. Stop All Servers
Press `Ctrl+C` in all terminal windows running servers

## 2. Clean Database Locks
```powershell
cd backend
Remove-Item -ErrorAction SilentlyContinue internal_system.db-wal
Remove-Item -ErrorAction SilentlyContinue internal_system.db-shm
```

## 3. Start Backend
```powershell
cd backend
npm run dev
```
**Wait until you see:** `[SERVER] Ready to accept requests`

## 4. Start Frontend (New Terminal)
```powershell
cd frontend
npm run dev
```

## 5. Test Login
1. Open browser to frontend URL (usually http://localhost:5173)
2. Open Developer Tools (F12)
3. Go to Console tab
4. Try logging in with: `ismail@housing.gov.om` / `password123`
5. Watch both browser console and backend terminal for messages

## 6. If Still Not Working

**Check Backend Terminal:**
- Do you see `[LOGIN] Request body:` when you click login?
- If NO → Frontend is not reaching backend (check URL, CORS, firewall)
- If YES → Check what error appears after that

**Check Browser Console:**
- What error message appears?
- Check Network tab - is the request being sent?
- What status code does it return?

**Common Solutions:**
- Port 4000 already in use? Change PORT in `backend/server.js`
- Database locked? Delete `.db-wal` and `.db-shm` files
- Wrong credentials? Use exact email: `ismail@housing.gov.om` password: `password123`

