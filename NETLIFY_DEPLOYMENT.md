# Netlify Deployment Guide

## Overview
This guide explains how to deploy the Internal System frontend to Netlify and connect it to your backend.

## Prerequisites
- Netlify account
- Backend server deployed and accessible (e.g., Heroku, Railway, Render, or your own server)
- Git repository connected to GitHub

## Frontend Deployment Steps

### 1. Configure Netlify Build Settings

In your Netlify dashboard:
- **Build command**: `cd frontend && npm install && npm run build`
- **Publish directory**: `frontend/dist`
- **Base directory**: (leave empty or set to root)

### 2. Set Environment Variables

In Netlify dashboard → Site settings → Environment variables, add:

```
VITE_API_URL=https://your-backend-url.com
```

Replace `https://your-backend-url.com` with your actual backend URL (without trailing slash).

**Important**: 
- The frontend will use this environment variable to connect to your backend
- If not set, it defaults to `http://localhost:4000` (for local development)
- Make sure your backend URL is accessible and has CORS configured

### 3. Backend CORS Configuration

Ensure your backend (`backend/server.js`) has the Netlify URL in the `allowedOrigins` array:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4000',
  'https://glistening-semolina-68da32.netlify.app',  // Your Netlify URL
  // Add any other Netlify preview URLs if needed
];
```

**To add your Netlify URL:**
1. After deploying to Netlify, copy your site URL
2. Update `backend/server.js` with your actual Netlify URL
3. Redeploy your backend

### 4. Deploy

#### Option A: Automatic Deployment (Recommended)
1. Connect your GitHub repository to Netlify
2. Netlify will automatically deploy on every push to your main branch
3. Set the build settings and environment variables as above

#### Option B: Manual Deployment
1. Build the frontend locally:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Drag and drop the `frontend/dist` folder to Netlify dashboard

### 5. Verify Deployment

After deployment:
1. Visit your Netlify site URL
2. Check browser console for any errors
3. Test login functionality
4. Verify API calls are going to the correct backend URL

## Backend Deployment

The backend needs to be deployed separately. Options include:

- **Heroku**: Free tier available, easy PostgreSQL setup
- **Railway**: Modern platform, good for Node.js apps
- **Render**: Free tier, easy deployment
- **Your own server**: VPS, cloud instance, etc.

### Backend Environment Variables

Set these in your backend hosting platform:
- `PORT`: (usually auto-set by platform)
- `NODE_ENV`: `production`

### Backend Database

- SQLite database file (`internal_system.db`) is included
- For production, consider migrating to PostgreSQL or another production database
- Update `backend/db.js` to use production database connection if needed

## Troubleshooting

### CORS Errors
- Ensure your Netlify URL is in the backend's `allowedOrigins` array
- Check that backend CORS middleware is properly configured
- Verify backend is accessible from the internet

### API Connection Issues
- Check `VITE_API_URL` environment variable in Netlify
- Verify backend URL is correct and accessible
- Check browser console for specific error messages
- Test backend URL directly in browser/Postman

### Build Failures
- Check Netlify build logs for specific errors
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### Routing Issues (404 on refresh)
- The `_redirects` file in `frontend/public` should handle SPA routing
- Verify `netlify.toml` redirect rules are correct

## Current Configuration

- **Frontend**: Vue 3 + Vite
- **Backend**: Node.js + Express + SQLite
- **API Base**: Configured via `VITE_API_URL` environment variable
- **CORS**: Configured in `backend/server.js`

## Files Modified for Netlify

1. `frontend/src/config.js` - Uses `VITE_API_URL` environment variable
2. `frontend/src/**/*.vue` - All pages now use `API_BASE` from config
3. `frontend/public/_redirects` - SPA routing support
4. `netlify.toml` - Netlify build configuration
5. `backend/server.js` - CORS configuration updated

## Next Steps

1. Deploy backend to your hosting platform
2. Update backend CORS with your Netlify URL
3. Set `VITE_API_URL` in Netlify environment variables
4. Deploy frontend to Netlify
5. Test all functionality
6. Monitor logs for any issues

