// server.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db');
const { waitForDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

// Token storage with expiration (in production, use Redis or database)
// Structure: Map<token, { userId, expiresAt }>
const activeTokens = new Map();

// Token expiration time: 24 hours (in milliseconds)
const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [token, data] of activeTokens.entries()) {
    if (data.expiresAt && data.expiresAt < now) {
      activeTokens.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[AUTH] Cleaned up ${cleaned} expired token(s)`);
  }
}, 60 * 60 * 1000); // Every hour

// Helper function to hash passwords
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Helper function to generate token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Helper function to check if role is admin
const isAdminRole = (role) => {
  const adminRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'HR_ADMIN', 'FLEET_ADMIN',
    'IT_M365_ADMIN', 'IT_BI_ADMIN', 'IT_ACONEX_ADMIN', 'IT_AUTODESK_ADMIN',
    'IT_P6_ADMIN', 'IT_RISK_ADMIN', 'IT_DEVICES_EMAIL_ADMIN'];
  return adminRoles.includes(role);
};

// System to role mapping for IT requests
const SYSTEM_TO_ROLE = {
  'M365': 'IT_M365_ADMIN',
  'POWER_BI': 'IT_BI_ADMIN',
  'ACONEX': 'IT_ACONEX_ADMIN',
  'AUTODESK': 'IT_AUTODESK_ADMIN',
  'P6': 'IT_P6_ADMIN',
  'RISK': 'IT_RISK_ADMIN'
};

// Helper to get assigned role for IT request based on category and system
const getITAssignedRole = (category, systemKey) => {
  // Devices & Materials -> IT_DEVICES_EMAIL_ADMIN
  if (category === 'Devices & Materials') {
    return 'IT_DEVICES_EMAIL_ADMIN';
  }
  
  // Access & Permissions or Software / License with system -> system admin
  if ((category === 'Access & Permissions' || category === 'Software / License') && systemKey) {
    return SYSTEM_TO_ROLE[systemKey] || 'IT_ADMIN';
  }
  
  // Support / Incident or no system -> IT_ADMIN (super IT admin)
  return 'IT_ADMIN';
};

// Structured logging for failed operations
const logError = (endpoint, operation, error, context = {}) => {
  // Sanitize sensitive data in context
  const safeContext = { ...context };
  if (safeContext.password) safeContext.password = '[REDACTED]';
  if (safeContext.passwordHash) safeContext.passwordHash = '[REDACTED]';
  if (safeContext.token) safeContext.token = '[REDACTED]';
  
  const errorInfo = {
    timestamp: new Date().toISOString(),
    endpoint,
    operation,
    errorCode: error?.code || 'UNKNOWN',
    errorMessage: error?.message || String(error),
    ...safeContext
  };
  console.error(`[ERROR] ${endpoint} - ${operation}:`, JSON.stringify(errorInfo, null, 2));
};

// RBAC Helpers
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const tokenData = activeTokens.get(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Check if token has expired
  if (tokenData.expiresAt && tokenData.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Token has expired. Please log in again.' });
  }
  
  const userId = tokenData.userId;
  
  // Fetch employee from database
  waitForDb((dbErr) => {
    if (dbErr) {
      return res.status(503).json({ error: 'Database is initializing. Please try again in a moment.' });
    }
    
    db.get(
      `SELECT id, email, full_name, department, role, is_active, is_lead 
       FROM employees 
       WHERE id = ? AND is_active = 1`,
      [userId],
      (err, employee) => {
        if (err) {
          console.error('Error in requireAuth:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!employee) {
          return res.status(401).json({ error: 'User not found or inactive' });
        }
        
        // Attach employee to request object
        req.user = {
          id: employee.id,
          email: employee.email,
          fullName: employee.full_name,
          department: employee.department,
          role: employee.role,
          isLead: !!employee.is_lead
        };
        
        next();
      }
    );
  });
};

// Require specific role(s)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// Middleware to check if user has required admin roles (kept for backward compatibility)
const requireAdminRoles = (...allowedRoles) => {
  return requireRole(...allowedRoles);
};

// Authentication middleware - kept for backward compatibility, uses requireAuth
const authRequired = requireAuth;

// Helper to validate employee_id exists (for safety)
const validateEmployeeId = (employeeId, callback) => {
  if (!employeeId || isNaN(employeeId)) {
    return callback(new Error('Invalid employee ID'));
  }
  db.get(
    `SELECT id FROM employees WHERE id = ? AND is_active = 1`,
    [employeeId],
    (err, employee) => {
      if (err) {
        return callback(err);
      }
      if (!employee) {
        return callback(new Error('Employee not found or inactive'));
      }
      callback(null);
    }
  );
};

// Helper function to get employee_id from token (returns null if no token)
// This is kept for backward compatibility but should use req.user.id when authRequired is used
const getEmployeeIdFromToken = (req) => {
  if (req.user) {
    return req.user.id;
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const tokenData = activeTokens.get(token);
  if (!tokenData) return null;
  // Check expiration
  if (tokenData.expiresAt && tokenData.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return null;
  }
  return tokenData.userId || null;
};

// Helpers
function toIsoString(localDateTime) {
  // expects "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
  if (!localDateTime) {
    throw new Error('Invalid datetime: empty value');
  }
  const date = new Date(localDateTime);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime format: ${localDateTime}`);
  }
  return date.toISOString();
}

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Helper to format error response - shows SQLite errors in development
const formatErrorResponse = (err, userFriendlyMessage) => {
  if (isDevelopment) {
    // In development, include the actual SQLite error for debugging
    return {
      error: userFriendlyMessage,
      details: err.message,
      code: err.code
    };
  } else {
    // In production, only return user-friendly message
    return {
      error: userFriendlyMessage
    };
  }
};

// Helper to retry database operations on SQLITE_BUSY errors
const retryOnBusy = (operation, maxRetries = 3, delay = 100) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryOperation = () => {
      attempts++;
      operation((err, result) => {
        if (err) {
          if (err.code === 'SQLITE_BUSY' && attempts < maxRetries) {
            console.log(`[RETRY] SQLITE_BUSY error, retrying (attempt ${attempts + 1}/${maxRetries})...`);
            setTimeout(tryOperation, delay * attempts); // Exponential backoff
            return;
          }
          reject(err);
        } else {
          resolve(result);
        }
      });
    };
    
    tryOperation();
  });
};

// Validation helpers
const validateRequired = (obj, fields, endpoint) => {
  const missing = fields.filter(field => !obj[field] || (typeof obj[field] === 'string' && !obj[field].trim()));
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  return { valid: true };
};

const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Both start and end dates are required' };
  }
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }
    if (start >= end) {
      return { valid: false, error: 'End date must be after start date' };
    }
    // Allow dates in the past for now (can be changed if needed)
    // if (start < new Date()) {
    //   return { valid: false, error: 'Start date cannot be in the past' };
    // }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid date values' };
  }
};

// ---------------- Authentication Routes (Public) ----------------

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  // Debug logging (remove in production)
  console.log('[LOGIN] Request body:', JSON.stringify({ 
    email: req.body?.email ? req.body.email.substring(0, 20) + '...' : 'missing',
    hasPassword: !!req.body?.password,
    bodyKeys: Object.keys(req.body || {})
  }));
  
  const { email, password } = req.body;

  console.log('[LOGIN] Extracted email:', email ? email.substring(0, 30) : 'missing');
  console.log('[LOGIN] Has password:', !!password);

  // Better validation with specific error messages
  if (!email || (typeof email === 'string' && !email.trim())) {
    console.log('[LOGIN] Validation failed: Email missing or empty');
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!password || (typeof password === 'string' && !password.trim())) {
    console.log('[LOGIN] Validation failed: Password missing or empty');
    return res.status(400).json({ error: 'Password is required' });
  }

  console.log('[LOGIN] Validation passed, hashing password...');
  const passwordHash = hashPassword(password);
  console.log('[LOGIN] Password hash generated, waiting for DB...');

  // Wait for database to be ready before querying
  waitForDb((dbErr) => {
    if (dbErr) {
      console.error('[LOGIN] Database not ready:', dbErr);
      logError('/api/auth/login', 'db_not_ready', dbErr);
      return res.status(503).json({ error: 'Database is initializing. Please try again in a moment.' });
    }
    
    console.log('[LOGIN] Database ready, querying employee...');
    db.get(
      `SELECT id, email, full_name, department, role, is_active, is_lead 
       FROM employees 
       WHERE email = ? AND password_hash = ? AND is_active = 1`,
      [email.trim(), passwordHash],
      (err, employee) => {
        if (err) {
          console.error('[LOGIN] Database query error:', err);
          logError('/api/auth/login', 'select_employee', err, { email: email?.substring(0, 20) });
          return res.status(500).json(formatErrorResponse(
            err,
            'Authentication service error. Please try again.'
          ));
        }

        console.log('[LOGIN] Query completed. Employee found:', !!employee);
        if (!employee) {
          console.log('[LOGIN] No employee found or password mismatch');
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log('[LOGIN] Employee found:', employee.email, employee.role);
        // Generate token with expiration
        const token = generateToken();
        const expiresAt = Date.now() + TOKEN_EXPIRATION_MS;
        activeTokens.set(token, {
          userId: employee.id,
          expiresAt: expiresAt,
          createdAt: Date.now()
        });
        console.log('[LOGIN] Token generated, sending response...');

        // Return user info and token (exclude sensitive data)
        res.json({
          token,
          tokenExpiresAt: expiresAt,
          user: {
            id: employee.id,
            email: employee.email,
            fullName: employee.full_name,
            department: employee.department,
            role: employee.role,
            isLead: !!employee.is_lead
          }
        });
        console.log('[LOGIN] Response sent successfully');
      }
    );
  });
});

// Get current user endpoint
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const tokenData = activeTokens.get(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Check if token has expired
  if (tokenData.expiresAt && tokenData.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Token has expired. Please log in again.' });
  }
  
  const userId = tokenData.userId;

  // Wait for database to be ready
  waitForDb((dbErr) => {
    if (dbErr) {
      logError('/api/auth/me', 'db_not_ready', dbErr);
      return res.status(503).json({ error: 'Database is initializing. Please try again in a moment.' });
    }
    
    db.get(
      `SELECT id, email, full_name, department, role, is_active, is_lead, created_at 
       FROM employees 
       WHERE id = ? AND is_active = 1`,
      [userId],
      (err, employee) => {
        if (err) {
          logError('/api/auth/me', 'select_employee', err, { userId });
          return res.status(500).json(formatErrorResponse(
            err,
            'Failed to load user information. Please try again.'
          ));
        }

        if (!employee) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Extend token expiration on successful verification (refresh token)
        const newExpiresAt = Date.now() + TOKEN_EXPIRATION_MS;
        tokenData.expiresAt = newExpiresAt;
        activeTokens.set(token, tokenData);
        
        // Return user info (exclude sensitive data)
        res.json({
          id: employee.id,
          email: employee.email,
          fullName: employee.full_name,
          department: employee.department,
          role: employee.role,
          isLead: !!employee.is_lead,
          createdAt: employee.created_at,
          tokenExpiresAt: newExpiresAt
        });
      }
    );
  });
});

// Token refresh endpoint - extends token expiration
// This endpoint allows expired tokens within a grace period (1 hour) to be refreshed
app.post('/api/auth/refresh', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const tokenData = activeTokens.get(token);
  
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Allow refresh if token is expired but within grace period (1 hour)
  const now = Date.now();
  const gracePeriod = 60 * 60 * 1000; // 1 hour grace period
  const isExpired = tokenData.expiresAt && tokenData.expiresAt < now;
  const isWithinGracePeriod = isExpired && (now - tokenData.expiresAt) < gracePeriod;
  
  if (isExpired && !isWithinGracePeriod) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Token has expired and cannot be refreshed' });
  }
  
  // Extend token expiration
  const newExpiresAt = Date.now() + TOKEN_EXPIRATION_MS;
  tokenData.expiresAt = newExpiresAt;
  activeTokens.set(token, tokenData);
  
  res.json({
    message: 'Token refreshed successfully',
    expiresAt: newExpiresAt
  });
});

// ---------------- Workflow Definitions ----------------

// Workflow definitions for each request type
const workflows = {
  CAR_BOOKING: {
    type: 'CAR_BOOKING',
    steps: [
      { id: 'SUBMITTED', name: 'Submitted', description: 'Request submitted by user', status: 'SUBMITTED' },
      { id: 'AUTO_BOOKED', name: 'Auto-Booked', description: 'System automatically assigned vehicle', status: 'BOOKED' },
      { id: 'FLEET_REVIEW', name: 'Fleet Review', description: 'Fleet team reviewing booking', status: 'IN_REVIEW' },
      { id: 'COMPLETED', name: 'Completed', description: 'Trip completed', status: 'COMPLETED' }
    ],
    defaultStep: 'SUBMITTED',
    assignedRole: 'FLEET_ADMIN'
  },
  IT: {
    type: 'IT',
    steps: [
      { id: 'SUBMITTED', name: 'Submitted', description: 'Request submitted by user', status: 'SUBMITTED' },
      { id: 'TRIAGE', name: 'Triage', description: 'IT admin reviewing and prioritizing', status: 'IN_REVIEW' },
      { id: 'IN_PROGRESS', name: 'In Progress', description: 'IT team working on request', status: 'IN_PROGRESS' },
      { id: 'COMPLETED', name: 'Completed', description: 'Request resolved', status: 'COMPLETED' }
    ],
    defaultStep: 'SUBMITTED',
    assignedRole: 'IT_ADMIN'
  },
  ONBOARDING: {
    type: 'ONBOARDING',
    steps: [
      { id: 'SUBMITTED', name: 'Submitted', description: 'Onboarding request submitted by Lead/Head', status: 'SUBMITTED' },
      { id: 'HR_REVIEW', name: 'HR Review', description: 'HR team reviewing request', status: 'IN_REVIEW' },
      { id: 'IT_SETUP', name: 'IT Setup', description: 'IT setting up accounts and devices', status: 'IN_PROGRESS' },
      { id: 'COMPLETED', name: 'Completed', description: 'Onboarding completed', status: 'COMPLETED' }
    ],
    defaultStep: 'SUBMITTED',
    assignedRole: 'HR_ADMIN'
  }
};

// Helper to get workflow for request type
const getWorkflow = (requestType) => {
  return workflows[requestType] || null;
};

// Helper to get next step in workflow
const getNextStep = (requestType, currentStep) => {
  const workflow = getWorkflow(requestType);
  if (!workflow) return null;
  
  const currentIndex = workflow.steps.findIndex(s => s.id === currentStep);
  if (currentIndex === -1 || currentIndex === workflow.steps.length - 1) return null;
  
  return workflow.steps[currentIndex + 1];
};

// Helper to map workflow step status to request status
// This ensures consistency across all request types
const mapWorkflowStatusToRequestStatus = (workflowStepStatus) => {
  const statusMap = {
    'SUBMITTED': 'PENDING',
    'IN_REVIEW': 'APPROVED',
    'IN_PROGRESS': 'IN_PROGRESS',
    'COMPLETED': 'COMPLETED',
    'BOOKED': 'BOOKED',
    'AUTO_BOOKED': 'BOOKED',
    'FLEET_REVIEW': 'APPROVED',
    'TRIAGE': 'APPROVED',
    'HR_REVIEW': 'APPROVED',
    'IT_SETUP': 'IN_PROGRESS'
  };
  return statusMap[workflowStepStatus] || workflowStepStatus;
};

// Helper to get status from workflow step
const getStatusFromWorkflowStep = (requestType, stepId) => {
  const workflow = getWorkflow(requestType);
  if (!workflow || !stepId) return 'PENDING';
  const step = workflow.steps.find(s => s.id === stepId);
  if (!step) return 'PENDING';
  return mapWorkflowStatusToRequestStatus(step.status);
};

// Helper to normalize request status to match workflow step
// This ensures consistency when loading requests from the database
const normalizeRequestStatus = (request) => {
  if (!request) return request;
  
  // Only normalize for request types that use workflow steps
  if (request.type !== 'ONBOARDING' && request.type !== 'IT' && request.type !== 'CAR_BOOKING') {
    return request;
  }
  
  // Don't normalize if status is REJECTED or CANCELLED (these are terminal states)
  if (request.status === 'REJECTED' || request.status === 'CANCELLED') {
    return request;
  }
  
  // Get the current step (handle both camelCase and snake_case)
  const stepId = request.currentStep || request.current_step || request.workflowStatus || request.workflow_status;
  if (!stepId) {
    // If no step but status exists, keep it (might be an old record)
    return request;
  }
  
  // Get the correct status for this workflow step
  const correctStatus = getStatusFromWorkflowStep(request.type, stepId);
  
  // Update the status if it doesn't match (but preserve REJECTED/CANCELLED)
  if (request.status !== correctStatus && request.status !== 'REJECTED' && request.status !== 'CANCELLED') {
    const oldStatus = request.status;
    request.status = correctStatus;
    // Update in database (async, non-blocking)
    db.run(
      'UPDATE requests SET status = ? WHERE id = ?',
      [correctStatus, request.id],
      (err) => {
        if (err) {
          logError('/normalize-status', 'update_status', err, { requestId: request.id, oldStatus, newStatus: correctStatus });
        }
      }
    );
  }
  
  return request;
};

// Helper to log request action for audit trail
const logRequestAction = (requestId, actionType, fromStatus, toStatus, actorEmployeeId, note, callback) => {
  db.run(
    `INSERT INTO request_actions (request_id, action_type, from_status, to_status, actor_employee_id, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, actionType, fromStatus || null, toStatus || null, actorEmployeeId || null, note || null],
    function(err) {
      if (callback) {
        callback(err);
      } else if (err) {
        console.error('[AUDIT] Failed to log request action:', err);
      }
    }
  );
};

// ---------------- Protected Routes (require authentication) ----------------

// Get workflows endpoint (public, no auth needed for workflow definitions)
app.get('/api/workflows', (req, res) => {
  res.json(workflows);
});

// ---------------- Vehicles ----------------

app.get('/api/vehicles', authRequired, (req, res) => {
  db.all(
    `SELECT * FROM vehicles WHERE status = 'ACTIVE'`,
    [],
    (err, rows) => {
      if (err) {
        logError('/api/vehicles', 'select_vehicles', err);
        return res.status(500).json({ error: 'Failed to load vehicles. Please try again.' });
      }
      res.json(rows);
    }
  );
});

// ---------------- Car Booking ----------------

// Get available time slots for a date and vehicle (optional)
app.get('/api/car-bookings/available-slots', authRequired, (req, res) => {
  const { date, vehicleId } = req.query;
  
  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }
  
  // Parse date and create time range for the day
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);
  
  const startIso = startOfDay.toISOString();
  const endIso = endOfDay.toISOString();
  
  // Get all bookings for the day (excluding cancelled bookings)
  let query = `
    SELECT 
      cb.start_datetime,
      cb.end_datetime,
      cb.vehicle_id,
      v.name AS vehicle_name
    FROM car_bookings cb
    INNER JOIN requests r ON cb.request_id = r.id
    LEFT JOIN vehicles v ON cb.vehicle_id = v.id
    WHERE cb.start_datetime >= ? AND cb.start_datetime <= ?
      AND r.status != 'CANCELLED'
  `;
  
  const params = [startIso, endIso];
  
  if (vehicleId) {
    query += ` AND cb.vehicle_id = ?`;
    params.push(vehicleId);
  }
  
  query += ` ORDER BY cb.start_datetime ASC`;
  
  db.all(query, params, (err, bookings) => {
    if (err) {
      logError('/api/car-bookings/available-slots', 'select_bookings', err, { date, vehicleId });
      return res.status(500).json({ error: 'Failed to load available slots. Please try again.' });
    }
    
    // If vehicleId is specified, check availability for that specific vehicle
    if (vehicleId) {
      // Generate 30-minute time slots from 6 AM to 10 PM
      const slots = [];
      const startHour = 6;
      const endHour = 22;
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotStart = new Date(dateObj);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + 30);
          
          // Check if slot is booked for this specific vehicle
          const isBooked = bookings.some(booking => {
            const bookingStart = new Date(booking.start_datetime);
            const bookingEnd = new Date(booking.end_datetime);
            return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
          });
          
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
            endTime: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
            available: !isBooked
          });
        }
      }
      
      res.json({
        date,
        vehicleId: vehicleId || null,
        slots
      });
    } else {
      // Auto-assign mode: Get all active vehicles and check availability for each
      db.all('SELECT id, name, plate_number, plate_code, type FROM vehicles WHERE status = ?', ['ACTIVE'], (err2, allVehicles) => {
        if (err2) {
          logError('/api/car-bookings/available-slots', 'select_vehicles', err2, { date });
          return res.status(500).json({ error: 'Failed to load vehicles. Please try again.' });
        }
        
        // Generate 30-minute time slots from 6 AM to 10 PM
        const slots = [];
        const startHour = 6;
        const endHour = 22;
        
        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const slotStart = new Date(dateObj);
            slotStart.setHours(hour, minute, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + 30);
            
            const slotStartIso = slotStart.toISOString();
            const slotEndIso = slotEnd.toISOString();
            
            // Check if at least one vehicle is available for this slot
            // A vehicle is available if it's not booked during this time slot
            const hasAvailableVehicle = allVehicles.some(vehicle => {
              // Check if this vehicle has any booking that overlaps with this slot
              const isBooked = bookings.some(booking => {
                if (booking.vehicle_id !== vehicle.id) return false;
                const bookingStart = new Date(booking.start_datetime);
                const bookingEnd = new Date(booking.end_datetime);
                return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
              });
              return !isBooked;
            });
            
            slots.push({
              start: slotStartIso,
              end: slotEndIso,
              startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
              endTime: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
              available: hasAvailableVehicle
            });
          }
        }
        
        res.json({
          date,
          vehicleId: null,
          slots
        });
      });
    }
  });
});

app.post('/api/car-bookings', authRequired, (req, res) => {
  const {
    requesterName,
    department,
    startDatetime,
    endDatetime,
    destination,
    reason,
    passengers,
    vehicleId
  } = req.body;

  // Validation
  const requiredCheck = validateRequired(req.body, ['requesterName', 'startDatetime', 'endDatetime', 'reason', 'destination'], '/api/car-bookings');
  if (!requiredCheck.valid) {
    return res.status(400).json({ error: requiredCheck.error });
  }

  // Date validation
  let startIso, endIso;
  try {
    // Validate dates before conversion
    const dateRangeCheck = validateDateRange(startDatetime, endDatetime);
    if (!dateRangeCheck.valid) {
      return res.status(400).json({ error: dateRangeCheck.error });
    }
    
    startIso = toIsoString(startDatetime);
    endIso = toIsoString(endDatetime);
  } catch (e) {
    logError('/api/car-bookings', 'date_conversion', e, { startDatetime, endDatetime });
    return res.status(400).json({ error: e.message });
  }

  // Function to check if a vehicle is available in the time range
  const checkVehicleAvailability = (vehicleId, startIso, endIso, callback) => {
    db.get(
      `SELECT v.*
      FROM vehicles v
       WHERE v.id = ? 
         AND v.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM car_bookings b
        INNER JOIN requests r ON b.request_id = r.id
        WHERE b.vehicle_id = v.id
        AND r.status != 'CANCELLED'
        AND NOT (b.end_datetime <= ? OR b.start_datetime >= ?)
         )`,
      [vehicleId, startIso, endIso],
      callback
    );
  };

  // Function to find first available vehicle
  const findAvailableVehicle = (callback) => {
    db.get(
      `SELECT v.*
      FROM vehicles v
       WHERE v.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM car_bookings b
        INNER JOIN requests r ON b.request_id = r.id
        WHERE b.vehicle_id = v.id
        AND r.status != 'CANCELLED'
        AND NOT (b.end_datetime <= ? OR b.start_datetime >= ?)
      )
       LIMIT 1`,
      [startIso, endIso],
      callback
    );
  };

  // If vehicleId is provided, check its availability
  if (vehicleId) {
    // Validate vehicleId is a number
    const vehicleIdNum = parseInt(vehicleId, 10);
    if (isNaN(vehicleIdNum) || vehicleIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }
    
    checkVehicleAvailability(vehicleIdNum, startIso, endIso, (err, vehicle) => {
    if (err) {
        logError('/api/car-bookings', 'check_vehicle_availability', err, { vehicleId: vehicleIdNum });
        return res.status(500).json({ error: 'Failed to check vehicle availability. Please try again.' });
      }
      if (!vehicle) {
        return res.status(400).json({ error: 'Selected vehicle is not available in this time range' });
      }
      createBooking(vehicle);
    });
  } else {
    // Auto-assign first available vehicle
    findAvailableVehicle((err, vehicle) => {
      if (err) {
        logError('/api/car-bookings', 'find_available_vehicle', err);
        return res.status(500).json({ error: 'Failed to find available vehicle. Please try again.' });
    }
    if (!vehicle) {
      return res.status(400).json({ error: 'No vehicles available in this time range' });
      }
      createBooking(vehicle);
    });
    }

  // Function to create the booking
  function createBooking(vehicle) {
    const title = `Car booking to ${destination || 'N/A'}`;
    const description = reason;
    const employeeId = req.user.id;

    // Validate employee_id is not null
    if (!employeeId) {
      logError('/api/car-bookings', 'validate_employee_id', new Error('Employee ID is null'), { userId: req.user });
      return res.status(500).json({ error: 'Invalid user session. Please log in again.' });
    }

    // Use immediate transaction mode to avoid locking issues
    db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
      if (beginErr) {
        logError('/api/car-bookings', 'begin_transaction', beginErr);
        return res.status(500).json(formatErrorResponse(
          beginErr,
          'Failed to start transaction. Please try again.'
        ));
      }

      const workflow = getWorkflow('CAR_BOOKING');
      const workflowStatus = 'AUTO_BOOKED'; // Auto-assigned vehicle
      const currentStep = 'AUTO_BOOKED';
      const assignedRole = workflow?.assignedRole || 'FLEET_ADMIN';
      // Status should match the workflow step - AUTO_BOOKED step uses BOOKED status
      const status = getStatusFromWorkflowStep('CAR_BOOKING', currentStep);

      db.run(
        `
          INSERT INTO requests (type, title, description, requester_name, department, status, employee_id, 
                                 assigned_role, workflow_status, current_step)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ['CAR_BOOKING', title, description, req.user.fullName, req.user.department || '', status, employeeId, 
         assignedRole, workflowStatus, currentStep],
        function (err2) {
          if (err2) {
            db.run('ROLLBACK', () => {}); // Ignore rollback errors
            logError('/api/car-bookings', 'insert_request', err2, {
              type: 'CAR_BOOKING',
              employeeId,
              requesterName: requesterName?.substring(0, 20) // Truncate for logging
            });
            return res.status(500).json(formatErrorResponse(
              err2,
              'Failed to create request record. Please try again.'
            ));
          }
          const requestId = this.lastID;

          db.run(
            `
              INSERT INTO car_bookings
              (request_id, vehicle_id, start_datetime, end_datetime, destination, reason, passengers, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              requestId,
              vehicle.id,
              startIso,
              endIso,
              destination || '',
              reason,
              passengers || null,
              status
            ],
            function (err3) {
              if (err3) {
                db.run('ROLLBACK', () => {}); // Ignore rollback errors
                logError('/api/car-bookings', 'insert_car_booking', err3, {
                  requestId,
                  vehicleId: vehicle.id
                });
                return res.status(500).json(formatErrorResponse(
                  err3,
                  'Failed to create car booking details. Request was created but booking failed.'
                ));
              }

              // Commit transaction
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  logError('/api/car-bookings', 'commit_transaction', commitErr);
                  return res.status(500).json(formatErrorResponse(
                    commitErr,
                    'Failed to commit transaction. Please try again.'
                  ));
                }

                // Log action for audit trail (non-blocking - don't fail request creation if logging fails)
                logRequestAction(requestId, 'CREATE', null, workflowStatus, employeeId, 
                  `Car booking created: ${vehicle?.name || 'Auto-assigned'}`, (logErr) => {
                    if (logErr) {
                      console.warn('[AUDIT] Failed to log car booking action (non-critical):', logErr);
                      // Don't fail the request creation - logging is non-critical
                    }
                  });

              return res.json({
                  id: requestId,
                requestId,
                vehicle,
                startDatetime: startIso,
                endDatetime: endIso,
                destination,
                reason,
                passengers,
                status
                });
              });
            }
          );
        }
      );
    });
  }
});

// ---------------- IT Requests ----------------

app.post('/api/it-requests', authRequired, (req, res) => {
  const {
    requesterName,
    department,
    title,
    description,
    category,
    systemName,
    systemKey, // New: system key for routing
    impact,
    urgency,
    assetTag
  } = req.body;

  // Validation
  const requiredCheck = validateRequired(req.body, ['requesterName', 'title', 'category', 'description'], '/api/it-requests');
  if (!requiredCheck.valid) {
    return res.status(400).json({ error: requiredCheck.error });
  }

  // Validate category is one of the allowed values
  const validCategories = ['Support / Incident', 'Devices & Materials', 'Access & Permissions', 'Software / License'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
  }

  const employeeId = req.user.id;
  
  // Determine assigned role based on category and system
  const assignedRole = getITAssignedRole(category, systemKey);

  // Use immediate transaction mode to avoid locking issues
  // IMMEDIATE mode allows reads but requires exclusive lock for writes
  db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
    if (beginErr) {
      logError('/api/it-requests', 'begin_transaction', beginErr);
      return res.status(500).json(formatErrorResponse(
        beginErr,
        'Failed to start transaction. Please try again.'
      ));
    }

    const workflow = getWorkflow('IT');
    const workflowStatus = 'SUBMITTED';
    const currentStep = 'SUBMITTED';
    // Status should match the workflow step - SUBMITTED step uses PENDING status
    const status = getStatusFromWorkflowStep('IT', currentStep);

    db.run(
      `
        INSERT INTO requests (type, title, description, requester_name, department, status, employee_id, 
                               assigned_role, workflow_status, current_step, system_key, request_scope)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ['IT', title, description || '', req.user.fullName, req.user.department || '', status, employeeId, 
       assignedRole, workflowStatus, currentStep, systemKey || null, 'IT'],
      function (err2) {
        if (err2) {
          db.run('ROLLBACK', () => {}); // Ignore rollback errors
          logError('/api/it-requests', 'insert_request', err2, {
            type: 'IT',
            employeeId,
            title: title?.substring(0, 30)
          });
          return res.status(500).json(formatErrorResponse(
            err2,
            'Failed to create request record. Please try again.'
          ));
        }
        const requestId = this.lastID;

        db.run(
          `
            INSERT INTO it_requests
            (request_id, category, system_name, impact, urgency, asset_tag)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            requestId,
            category,
            systemName || '',
            impact || 'Normal',
            urgency || 'Normal',
            assetTag || ''
          ],
          function (err3) {
            if (err3) {
              db.run('ROLLBACK', () => {}); // Ignore rollback errors
              logError('/api/it-requests', 'insert_it_details', err3, {
                requestId,
                category
              });
              return res.status(500).json(formatErrorResponse(
                err3,
                'Failed to create IT request details. Request was created but details failed.'
              ));
            }
            
            // Commit transaction
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                logError('/api/it-requests', 'commit_transaction', commitErr);
                return res.status(500).json(formatErrorResponse(
                  commitErr,
                  'Failed to commit transaction. Please try again.'
                ));
              }
              
              // Log action (non-blocking - don't fail request creation if logging fails)
              logRequestAction(requestId, 'CREATE', null, workflowStatus, employeeId, 
                `IT request created: ${category}`, (logErr) => {
                  if (logErr) {
                    console.warn('[AUDIT] Failed to log IT request action (non-critical):', logErr);
                    // Don't fail the request creation - logging is non-critical
                  }
                });

            res.json({
                id: requestId,
              requestId,
              type: 'IT',
              title,
              description,
              requesterName,
              department,
              category,
              systemName,
              impact,
              urgency,
              assetTag,
                status,
                workflowStatus,
                currentStep
              });
            });
          }
        );
      }
    );
  });
});

// ---------------- Onboarding Requests ----------------

app.post('/api/onboarding', authRequired, requireRole('SUPER_ADMIN', 'HR_ADMIN'), (req, res) => {
  const {
    requesterName, // manager
    department,
    employeeName,
    position,
    location,
    startDate,
    deviceType, // Keep for backward compatibility
    vpnRequired,
    notes,
    // New fields for child requests
    emailNeeded,
    deviceNeeded,
    systemsRequested // Array of system keys
  } = req.body;

  // Validation
  const requiredCheck = validateRequired(req.body, ['requesterName', 'employeeName', 'position', 'startDate'], '/api/onboarding');
  if (!requiredCheck.valid) {
    return res.status(400).json({ error: requiredCheck.error });
  }

  // Validate startDate format
  try {
    const startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid start date format' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid start date' });
  }

  // Normalize requirements (support both old and new format)
  const needsEmail = emailNeeded !== undefined ? !!emailNeeded : false;
  const needsDevice = deviceNeeded !== undefined ? !!deviceNeeded : (deviceType && deviceType.trim() ? true : false);
  const systems = Array.isArray(systemsRequested) ? systemsRequested : [];

  const title = `Onboarding for ${employeeName}`;
  const description = `Position: ${position} - Start: ${startDate}`;
  const employeeId = req.user.id;

  // Validate employee_id is not null
  if (!employeeId) {
    logError('/api/onboarding', 'validate_employee_id', new Error('Employee ID is null'), { userId: req.user });
    return res.status(500).json({ error: 'Invalid user session. Please log in again.' });
  }

  // Use transactions for atomicity
  db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
    if (beginErr) {
      logError('/api/onboarding', 'begin_transaction', beginErr);
      return res.status(500).json(formatErrorResponse(
        beginErr,
        'Failed to start transaction. Please try again.'
      ));
    }

    const workflow = getWorkflow('ONBOARDING');
    const workflowStatus = 'HR_SUBMITTED';
    const currentStep = 'HR_SUBMITTED';
    // Parent onboarding starts with HR_SUBMITTED, then moves to IT_IN_PROGRESS
    const assignedRole = 'IT_ADMIN'; // Parent assigned to IT_ADMIN for coordination
    const status = getStatusFromWorkflowStep('ONBOARDING', currentStep);

    // Create parent onboarding request
    db.run(
      `
        INSERT INTO requests (type, title, description, requester_name, department, status, employee_id, 
                               assigned_role, workflow_status, current_step, request_scope)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ['ONBOARDING', title, description, req.user.fullName, req.user.department || '', status, employeeId, 
       assignedRole, workflowStatus, currentStep, 'ONBOARDING'],
      function (err2) {
        if (err2) {
          db.run('ROLLBACK', () => {});
          logError('/api/onboarding', 'insert_request', err2, {
            type: 'ONBOARDING',
            employeeId,
            employeeName: employeeName?.substring(0, 20)
          });
          return res.status(500).json(formatErrorResponse(
            err2,
            'Failed to create request record. Please try again.'
          ));
        }
        const parentRequestId = this.lastID;

        // Store onboarding details with requirements
        db.run(
          `
            INSERT INTO onboarding_requests
            (request_id, employee_name, position, department, location, start_date, device_type, vpn_required, notes,
             email_needed, device_needed, systems_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            parentRequestId,
            employeeName,
            position,
            department || '',
            location || '',
            startDate,
            deviceType || '',
            vpnRequired ? 1 : 0,
            notes || '',
            needsEmail ? 1 : 0,
            needsDevice ? 1 : 0,
            JSON.stringify(systems)
          ],
          function (err3) {
            if (err3) {
              db.run('ROLLBACK', () => {});
              logError('/api/onboarding', 'insert_onboarding_details', err3, {
                parentRequestId,
                employeeName: employeeName?.substring(0, 20)
              });
              return res.status(500).json(formatErrorResponse(
                err3,
                'Failed to create onboarding details. Request was created but details failed.'
              ));
            }
            
            // Calculate expected child count
            const expectedChildCount = (needsEmail ? 1 : 0) + (needsDevice ? 1 : 0) + systems.length;
            
            // Create child requests (all within transaction)
            let childCount = 0;
            let hasError = false;
            
            // Email child request
            if (needsEmail) {
              const emailTitle = `Email Setup: ${employeeName}`;
              const emailDesc = `Email account setup for ${employeeName} (${position})`;
              const emailStatus = getStatusFromWorkflowStep('IT', 'SUBMITTED');
              
              db.run(
                `INSERT INTO requests (type, title, description, requester_name, department, status, employee_id,
                                       assigned_role, workflow_status, current_step, parent_request_id, request_scope)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['ONBOARDING_EMAIL', emailTitle, emailDesc, req.user.fullName, req.user.department || '', emailStatus,
                 employeeId, 'IT_DEVICES_EMAIL_ADMIN', 'SUBMITTED', 'SUBMITTED', parentRequestId, 'ONBOARDING'],
                function(err4) {
                  if (err4) {
                    hasError = true;
                    console.warn('[ONBOARDING] Failed to create email child:', err4);
                  } else {
                    childCount++;
                  }
                }
              );
            }
            
            // Device child request
            if (needsDevice) {
              const deviceTitle = `Device Setup: ${deviceType || 'Device'} for ${employeeName}`;
              const deviceDesc = `Device setup for ${employeeName} (${position})\nDevice: ${deviceType || 'Device'}\nVPN: ${vpnRequired ? 'Yes' : 'No'}`;
              const deviceStatus = getStatusFromWorkflowStep('IT', 'SUBMITTED');
              
              db.run(
                `INSERT INTO requests (type, title, description, requester_name, department, status, employee_id,
                                       assigned_role, workflow_status, current_step, parent_request_id, request_scope)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['ONBOARDING_DEVICE', deviceTitle, deviceDesc, req.user.fullName, req.user.department || '', deviceStatus,
                 employeeId, 'IT_DEVICES_EMAIL_ADMIN', 'SUBMITTED', 'SUBMITTED', parentRequestId, 'ONBOARDING'],
                function(err5) {
                  if (err5) {
                    hasError = true;
                    console.warn('[ONBOARDING] Failed to create device child:', err5);
                  } else {
                    childCount++;
                  }
                }
              );
            }
            
            // System access child requests (one per system)
            systems.forEach((systemKey) => {
              const systemRole = SYSTEM_TO_ROLE[systemKey] || 'IT_ADMIN';
              const systemName = {
                'M365': 'Microsoft 365',
                'POWER_BI': 'Power BI Pro',
                'ACONEX': 'Aconex',
                'AUTODESK': 'Autodesk',
                'P6': 'Primavera P6',
                'RISK': 'RiskHive'
              }[systemKey] || systemKey;
              
              const systemTitle = `System Access: ${systemName} for ${employeeName}`;
              const systemDesc = `System access request for ${employeeName} (${position})\nSystem: ${systemName}`;
              const systemStatus = getStatusFromWorkflowStep('IT', 'SUBMITTED');
              
              db.run(
                `INSERT INTO requests (type, title, description, requester_name, department, status, employee_id,
                                       assigned_role, workflow_status, current_step, parent_request_id, system_key, request_scope)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['ONBOARDING_SYSTEM', systemTitle, systemDesc, req.user.fullName, req.user.department || '', systemStatus,
                 employeeId, systemRole, 'SUBMITTED', 'SUBMITTED', parentRequestId, systemKey, 'ONBOARDING'],
                function(err6) {
                  if (err6) {
                    hasError = true;
                    console.warn(`[ONBOARDING] Failed to create system child for ${systemKey}:`, err6);
                  } else {
                    childCount++;
                  }
                }
              );
            });
            
            // Update parent workflow to IT_IN_PROGRESS if we have children
            if (expectedChildCount > 0) {
              db.run(
                `UPDATE requests SET workflow_status = ?, current_step = ?, status = ? WHERE id = ?`,
                ['IT_IN_PROGRESS', 'IT_IN_PROGRESS', 'IN_PROGRESS', parentRequestId],
                (err7) => {
                  if (err7) {
                    console.warn('[ONBOARDING] Failed to update parent workflow status:', err7);
                  }
                }
              );
            }
            
            // Commit transaction
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                logError('/api/onboarding', 'commit_transaction', commitErr);
                return res.status(500).json(formatErrorResponse(
                  commitErr,
                  'Failed to commit transaction. Please try again.'
                ));
              }
              
              // Log action (non-blocking)
              const childCountMsg = hasError ? `${childCount}/${expectedChildCount}` : `${expectedChildCount}`;
              logRequestAction(parentRequestId, 'CREATE', null, workflowStatus, employeeId, 
                `Onboarding request created for ${employeeName} with ${childCountMsg} child request(s)`, (logErr) => {
                  if (logErr) {
                    console.warn('[AUDIT] Failed to log onboarding request action (non-critical):', logErr);
                  }
                });

              return res.json({
                id: parentRequestId,
                requestId: parentRequestId,
                type: 'ONBOARDING',
                title,
                requesterName,
                employeeName,
                position,
                location,
                startDate,
                deviceType: deviceType || '',
                vpnRequired: !!vpnRequired,
                status: 'IN_PROGRESS',
                workflowStatus: 'IT_IN_PROGRESS',
                currentStep: 'IT_IN_PROGRESS',
                emailNeeded: needsEmail,
                deviceNeeded: needsDevice,
                systemsRequested: systems,
                childRequestsCount: expectedChildCount,
                message: hasError 
                  ? `Onboarding created. Note: Some child requests may have failed (${childCount}/${expectedChildCount} created).`
                  : `Onboarding created with ${expectedChildCount} child request(s)`
              });
            });
          }
        );
      }
    );
  });
});

// ---------------- Requests List (for "My Requests") ----------------

app.get('/api/requests', authRequired, (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;
  
  let query = `
    SELECT id, type, title, description, requester_name AS requesterName,
           department, status, employee_id AS employeeId, 
           assigned_role AS assignedRole, assigned_to_employee_id AS assignedToEmployeeId,
           workflow_status AS workflowStatus, current_step AS currentStep,
           parent_request_id AS parentRequestId, system_key AS systemKey, request_scope AS requestScope,
           created_at AS createdAt, updated_at AS updatedAt
    FROM requests
  `;
  
  const params = [];
  const conditions = [];
  
  // Role-based filtering:
  // IMPORTANT: All requests (IT, ONBOARDING, CAR_BOOKING) are stored in the SAME 'requests' table.
  // The 'type' column distinguishes between request types. All admins see ALL requests of their type,
  // regardless of who created them (employee_id is not filtered for admins).
  // - Normal employee: only their own requests (filtered by employee_id)
  // - IT_ADMIN: ALL IT-related requests (IT + onboarding parent + onboarding children)
  // - System Admins (IT_M365_ADMIN, etc.): Only requests assigned to their role (assigned_role = their role)
  // - IT_DEVICES_EMAIL_ADMIN: Only requests assigned to IT_DEVICES_EMAIL_ADMIN
  // - HR_ADMIN: Onboarding parent requests (type = 'ONBOARDING')
  // - FLEET_ADMIN: ALL CAR_BOOKING requests (type = 'CAR_BOOKING')
  // - SUPER_ADMIN: all requests (no filter)
  if (userRole === 'SUPER_ADMIN') {
    // SUPER_ADMIN sees all - no filter needed unless query params specify
    const { type, status: statusFilter } = req.query;
    if (type) {
      conditions.push(`type = ?`);
      params.push(type);
    }
    if (statusFilter) {
      conditions.push(`status = ?`);
      params.push(statusFilter);
    }
  } else if (userRole === 'IT_ADMIN') {
    // IT_ADMIN sees: All IT requests + onboarding parent + onboarding children
    conditions.push(`(
      type = ? OR 
      (type = ? AND parent_request_id IS NULL) OR
      (type IN ('ONBOARDING_EMAIL', 'ONBOARDING_DEVICE', 'ONBOARDING_SYSTEM'))
    )`);
    params.push('IT', 'ONBOARDING');
  } else if (userRole.startsWith('IT_') && userRole !== 'IT_ADMIN') {
    // System admins and devices/email admin: only requests assigned to their role
    conditions.push(`assigned_role = ?`);
    params.push(userRole);
  } else if (userRole === 'HR_ADMIN') {
    // HR_ADMIN sees onboarding parent requests
    conditions.push(`(type = ? AND parent_request_id IS NULL)`);
    params.push('ONBOARDING');
  } else if (userRole === 'FLEET_ADMIN') {
    conditions.push(`type = ?`);
    params.push('CAR_BOOKING');
  } else {
    // Normal employee: only their own requests
    conditions.push(`employee_id = ?`);
    params.push(userId);
  }
  
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  
  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      logError('/api/requests', 'select_requests', err, { userRole, userId });
      return res.status(500).json({ error: 'Failed to load requests. Please try again.' });
    }
    // Normalize statuses to match workflow steps
    const normalizedRows = rows.map(row => normalizeRequestStatus(row));
    res.json(normalizedRows);
  });
});

// ---------------- Get Request Details ----------------

app.get('/api/requests/:id', authRequired, (req, res) => {
  const requestId = req.params.id;
  const userRole = req.user.role;
  const userId = req.user.id;

  db.get(
    `
      SELECT id, type, title, description, requester_name AS requesterName,
             department, status, employee_id AS employeeId, 
             assigned_role AS assignedRole, assigned_to_employee_id AS assignedToEmployeeId,
             workflow_status AS workflowStatus, current_step AS currentStep,
             parent_request_id AS parentRequestId, system_key AS systemKey, request_scope AS requestScope,
             created_at AS createdAt, updated_at AS updatedAt
      FROM requests
      WHERE id = ?
    `,
    [requestId],
    (err, request) => {
      if (err) {
        logError('/api/requests/:id', 'select_request', err, { requestId, userRole, userId });
        return res.status(500).json({ error: 'Failed to load request. Please try again.' });
      }
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      // Normalize status to match workflow step
      normalizeRequestStatus(request);
      
      // Check permissions based on role:
      // - SUPER_ADMIN: can access any request
      // - IT_ADMIN: can access all IT-related requests (IT + onboarding parent + children)
      // - System admins: can access requests assigned to their role
      // - HR_ADMIN: can access ONBOARDING parent requests
      // - FLEET_ADMIN: can only access CAR_BOOKING requests
      // - Normal employee: can only access their own requests
      let hasAccess = false;
      
      if (userRole === 'SUPER_ADMIN') {
        hasAccess = true;
      } else if (userRole === 'IT_ADMIN') {
        // IT_ADMIN can see all IT-related requests
        if (request.type === 'IT' || request.type === 'ONBOARDING' || 
            request.type === 'ONBOARDING_EMAIL' || request.type === 'ONBOARDING_DEVICE' || 
            request.type === 'ONBOARDING_SYSTEM') {
          hasAccess = true;
        }
      } else if (userRole.startsWith('IT_') && userRole !== 'IT_ADMIN') {
        // System admins can see requests assigned to their role
        if (request.assignedRole === userRole) {
          hasAccess = true;
        }
      } else if (userRole === 'HR_ADMIN') {
        // HR_ADMIN can see onboarding parent requests
        if (request.type === 'ONBOARDING' && !request.parentRequestId) {
          hasAccess = true;
        }
      } else if (userRole === 'FLEET_ADMIN' && request.type === 'CAR_BOOKING') {
        hasAccess = true;
      } else if (request.employeeId === userId) {
        hasAccess = true;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. You do not have permission to view this request.' });
      }

      // Fetch additional details based on request type
      if (request.type === 'CAR_BOOKING') {
        db.get(
          `
            SELECT cb.*, v.name as vehicle_name, v.plate_number, v.plate_code, v.type as vehicle_type
            FROM car_bookings cb
            JOIN vehicles v ON cb.vehicle_id = v.id
            WHERE cb.request_id = ?
          `,
          [requestId],
          (err2, carBooking) => {
            if (err2) {
              logError('/api/requests/:id', 'select_car_booking', err2, { requestId });
              return res.status(500).json({ error: 'Failed to load car booking details. Please try again.' });
            }
            res.json({
              ...request,
              carBooking: carBooking ? {
                vehicleId: carBooking.vehicle_id,
                startDatetime: carBooking.start_datetime,
                endDatetime: carBooking.end_datetime,
                destination: carBooking.destination,
                reason: carBooking.reason,
                passengers: carBooking.passengers,
                status: carBooking.status,
                vehicle: {
                  name: carBooking.vehicle_name,
                  plateNumber: carBooking.plate_number,
                  plateCode: carBooking.plate_code || '',
                  type: carBooking.vehicle_type
                }
              } : null
            });
          }
        );
      } else if (request.type === 'IT') {
        db.get(
          `SELECT * FROM it_requests WHERE request_id = ?`,
          [requestId],
          (err2, itRequest) => {
            if (err2) {
              logError('/api/requests/:id', 'select_it_request', err2, { requestId });
              return res.status(500).json({ error: 'Failed to load IT request details. Please try again.' });
            }
            res.json({
              ...request,
              itRequest: itRequest || null
            });
          }
        );
      } else if (request.type === 'ONBOARDING') {
        // Fetch onboarding details and children
        db.get(
          `SELECT * FROM onboarding_requests WHERE request_id = ?`,
          [requestId],
          (err2, onboarding) => {
            if (err2) {
              logError('/api/requests/:id', 'select_onboarding', err2, { requestId });
              return res.status(500).json({ error: 'Failed to load onboarding details. Please try again.' });
            }
            
            // Fetch children if this is a parent request
            db.all(
              `SELECT id, type, title, status, workflow_status, current_step, assigned_role, system_key, created_at
               FROM requests WHERE parent_request_id = ? ORDER BY created_at ASC`,
              [requestId],
              (err3, children) => {
                if (err3) {
                  console.warn('[ONBOARDING] Failed to load children:', err3);
                }
                
                res.json({
                  ...request,
                  onboarding: onboarding ? {
                    ...onboarding,
                    vpnRequired: !!onboarding.vpn_required,
                    emailNeeded: !!onboarding.email_needed,
                    deviceNeeded: !!onboarding.device_needed,
                    systemsRequested: onboarding.systems_json ? JSON.parse(onboarding.systems_json) : []
                  } : null,
                  children: children || []
                });
              }
            );
          }
        );
      } else if (request.type === 'ONBOARDING_EMAIL' || request.type === 'ONBOARDING_DEVICE' || request.type === 'ONBOARDING_SYSTEM') {
        // Fetch parent request for child requests
        db.get(
          `SELECT id, type, title, status, workflow_status, current_step, employee_id, requester_name, department
           FROM requests WHERE id = ?`,
          [request.parentRequestId],
          (err2, parent) => {
            if (err2) {
              console.warn('[ONBOARDING] Failed to load parent:', err2);
            }
            
            res.json({
              ...request,
              parent: parent || null
            });
          }
        );
      } else {
        res.json(request);
      }
    }
  );
});

// ---------------- Update Request Status ----------------

app.patch('/api/requests/:id/status', authRequired, (req, res) => {
  const requestId = req.params.id;
  const { status, workflowStatus, currentStep, note } = req.body;
  const userRole = req.user.role;
  const userId = req.user.id;

  // Get current request to check type, current status, and ownership
  db.get('SELECT type, status AS currentStatus, workflow_status AS currentWorkflowStatus, current_step AS currentStep, assigned_role AS assignedRole, employee_id AS employeeId, parent_request_id AS parentRequestId FROM requests WHERE id = ?', 
    [requestId], 
    (err, request) => {
      if (err) {
        logError('/api/requests/:id/status', 'select_request', err, { requestId });
        return res.status(500).json({ error: 'Failed to load request. Please try again.' });
      }
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Special handling for car booking cancellation: allow employees to cancel their own bookings
      if (request.type === 'CAR_BOOKING' && status === 'CANCELLED') {
        // Prevent canceling already cancelled or completed bookings
        if (request.currentStatus === 'CANCELLED' || request.currentStatus === 'COMPLETED') {
          return res.status(400).json({ error: 'Cannot cancel a booking that is already cancelled or completed' });
        }
        
        // Require a note/reason for cancellation
        if (!note || !note.trim()) {
          return res.status(400).json({ error: 'A cancellation reason is required' });
        }
        
        // Check permissions: Fleet Admin can cancel any booking, employees can only cancel their own
        if (userRole === 'FLEET_ADMIN' || userRole === 'SUPER_ADMIN') {
          // Fleet Admin can cancel any booking - allow through
        } else if (userRole === 'EMPLOYEE' && request.employeeId === userId) {
          // Employee can cancel their own booking - allow through
        } else {
          return res.status(403).json({ error: 'You can only cancel your own bookings' });
        }
      }

      // Role-based workflow validation for non-cancellation updates
      if (userRole !== 'SUPER_ADMIN') {
        if (request.type === 'ONBOARDING') {
          // ONBOARDING parent: Only IT_ADMIN can update (HR can only view)
          if (userRole === 'HR_ADMIN') {
            return res.status(403).json({ error: 'HR Admin can view but not edit onboarding requests. Only IT Admin can update.' });
          } else if (userRole === 'IT_ADMIN') {
            // IT_ADMIN can update onboarding parent requests
          } else {
            return res.status(403).json({ error: 'You do not have permission to update this onboarding request' });
          }
        } else if (request.type === 'ONBOARDING_EMAIL' || request.type === 'ONBOARDING_DEVICE' || request.type === 'ONBOARDING_SYSTEM') {
          // Child requests: ONLY assigned role can update (system admins control their data)
          if (request.assignedRole !== userRole) {
            return res.status(403).json({ error: 'You can only update requests assigned to your role' });
          }
        } else if (request.type === 'IT') {
          // IT requests: IT_ADMIN (super admin) OR assigned system admin can update
          // HR_ADMIN cannot update IT requests
          if (userRole === 'HR_ADMIN') {
            return res.status(403).json({ error: 'HR Admin can view but not edit IT requests. Only IT Admin or assigned admin can update.' });
          } else if (userRole !== 'IT_ADMIN' && request.assignedRole !== userRole) {
            return res.status(403).json({ error: 'Only IT Admin or assigned admin can update this IT request' });
          }
        } else if (request.type === 'CAR_BOOKING') {
          // Car bookings: FLEET_ADMIN can update (but cancellation is handled above)
          if (status !== 'CANCELLED' && userRole !== 'FLEET_ADMIN' && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only Fleet Admin can update car booking requests' });
          }
        }
      }

      const validStatuses = ['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'BOOKED', 'CANCELLED'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ') });
      }

      const updateFields = [];
      const updateValues = [];
      
      // Special handling for onboarding: when moving to IT_SETUP, change assigned_role
      if (request.type === 'ONBOARDING' && (currentStep === 'IT_SETUP' || workflowStatus === 'IT_SETUP')) {
        if (userRole === 'HR_ADMIN' || userRole === 'SUPER_ADMIN') {
          updateFields.push('assigned_role = ?');
          updateValues.push('IT_ADMIN');
          // Status will be auto-updated below based on workflow step
        }
      }
      
      // Auto-update status based on workflow step for all request types
      // This ensures status matches the workflow step consistently
      if ((currentStep || workflowStatus) && (request.type === 'ONBOARDING' || request.type === 'IT' || request.type === 'CAR_BOOKING')) {
        const step = currentStep || workflowStatus || request.currentStep || request.workflowStatus;
        const workflow = getWorkflow(request.type);
        if (workflow) {
          const stepDef = workflow.steps.find(s => s.id === step);
          if (stepDef) {
            // Map workflow step status to request status using helper function
            const mappedStatus = mapWorkflowStatusToRequestStatus(stepDef.status);
            
            // Auto-update status when workflow step changes, unless status was explicitly provided
            const stepChanged = (currentStep && currentStep !== request.currentStep) || 
                               (workflowStatus && workflowStatus !== request.workflowStatus);
            if (!status || stepChanged) {
              updateFields.push('status = ?');
              updateValues.push(mappedStatus);
            }
          }
        }
      }
      
      // Explicit status update (only if not auto-updated above)
      if (status && !((request.type === 'ONBOARDING' || request.type === 'IT' || request.type === 'CAR_BOOKING') && (currentStep || workflowStatus))) {
        updateFields.push('status = ?');
        updateValues.push(status);
      }
      
      // Special handling for car booking cancellation
      if (request.type === 'CAR_BOOKING' && status === 'CANCELLED') {
        // When canceling, also update workflow status
        if (!workflowStatus) {
          updateFields.push('workflow_status = ?');
          updateValues.push('CANCELLED');
        }
        if (!currentStep) {
          updateFields.push('current_step = ?');
          updateValues.push('CANCELLED');
        }
      }
      if (workflowStatus) {
        updateFields.push('workflow_status = ?');
        updateValues.push(workflowStatus);
      }
      if (currentStep) {
        updateFields.push('current_step = ?');
        updateValues.push(currentStep);
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(requestId);

      db.run(
        `UPDATE requests SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
        function (err2) {
          if (err2) {
            logError('/api/requests/:id/status', 'update_status', err2, { requestId, status, workflowStatus });
            return res.status(500).json({ error: 'Failed to update request status. Please try again.' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Request not found' });
          }
          
          // Log action
          logRequestAction(requestId, 'STATUS_UPDATE', request.currentStatus, status || request.currentStatus, 
            req.user.id, note || `Status updated to ${status || request.currentStatus}`, (logErr) => {
              if (logErr) {
                console.error('[AUDIT] Failed to log status update action:', logErr);
              }
            });
          
          // Auto-complete parent onboarding when all children are completed
          // Check if this is a child request that was just updated
          if ((request.type === 'ONBOARDING_EMAIL' || request.type === 'ONBOARDING_DEVICE' || request.type === 'ONBOARDING_SYSTEM') &&
              (status === 'COMPLETED' || (status && status !== request.currentStatus))) {
            // Get parent request ID
            db.get('SELECT parent_request_id FROM requests WHERE id = ?', [requestId], (err3, child) => {
              if (!err3 && child && child.parent_request_id) {
                const parentId = child.parent_request_id;
                
                // Check if all children are completed
                db.all(
                  `SELECT id, status FROM requests WHERE parent_request_id = ?`,
                  [parentId],
                  (err4, children) => {
                    if (!err4 && children && children.length > 0) {
                      const allCompleted = children.every(c => c.status === 'COMPLETED');
                      
                      if (allCompleted) {
                        // Update parent to COMPLETED
                        db.run(
                          `UPDATE requests SET status = ?, workflow_status = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                          ['COMPLETED', 'COMPLETED', 'COMPLETED', parentId],
                          (err5) => {
                            if (err5) {
                              console.warn('[ONBOARDING] Failed to auto-complete parent:', err5);
                            } else {
                              console.log(`[ONBOARDING] Auto-completed parent onboarding #${parentId} - all children completed`);
                              logRequestAction(parentId, 'AUTO_COMPLETE', 'IN_PROGRESS', 'COMPLETED', 
                                req.user.id, 'All child requests completed', () => {});
                            }
                          }
                        );
                      }
                    }
                  }
                );
              }
            });
          }
          
          // Return updated request with parent status if applicable
          const finalStatus = status || request.currentStatus;
          const responseData = {
            id: requestId,
            status: finalStatus,
            workflowStatus: workflowStatus || request.currentWorkflowStatus,
            currentStep: currentStep || request.currentStep,
            message: 'Status updated successfully'
          };
          
          // If this was a child request update, include parent status info
          if ((request.type === 'ONBOARDING_EMAIL' || request.type === 'ONBOARDING_DEVICE' || request.type === 'ONBOARDING_SYSTEM') && request.parentRequestId) {
            db.get('SELECT id, status, workflow_status, current_step FROM requests WHERE id = ?', 
              [request.parentRequestId],
              (err6, parent) => {
                if (!err6 && parent) {
                  responseData.parentStatus = parent.status;
                  responseData.parentWorkflowStatus = parent.workflow_status;
                  if (parent.status === 'COMPLETED') {
                    responseData.message = 'Status updated successfully. Parent onboarding request has been auto-completed.';
                  }
                }
                res.json(responseData);
              }
            );
          } else {
            res.json(responseData);
          }
          
          // Note: Response is already sent above for child requests
          // For non-child requests, response is sent above
          // Old auto-IT creation code removed - IT requests created immediately when onboarding is submitted
          if (false) {
            // Get onboarding details
            db.get(
              `SELECT employee_name, device_type, vpn_required, position, department, location, start_date
               FROM onboarding_requests 
               WHERE request_id = ?`,
              [requestId],
              (err3, onboarding) => {
                let responseSent = false;
                
                if (!err3 && onboarding && onboarding.device_type && onboarding.device_type.trim()) {
                  // Auto-create IT request for device setup
                  const itTitle = `Device Setup: ${onboarding.device_type} for ${onboarding.employee_name}`;
                  const itDescription = `Automatic IT request generated from completed onboarding request #${requestId}.\n\n` +
                    `Employee: ${onboarding.employee_name}\n` +
                    `Position: ${onboarding.position}\n` +
                    `Department: ${onboarding.department || 'N/A'}\n` +
                    `Location: ${onboarding.location || 'N/A'}\n` +
                    `Start Date: ${onboarding.start_date}\n` +
                    `Device Type: ${onboarding.device_type}\n` +
                    `VPN Required: ${onboarding.vpn_required ? 'Yes' : 'No'}`;
                  
                  const itStatus = 'IN_PROGRESS';
                  const itWorkflow = getWorkflow('IT');
                  const itWorkflowStatus = 'SUBMITTED';
                  const itCurrentStep = 'SUBMITTED';
                  const itAssignedRole = itWorkflow?.assignedRole || 'IT_ADMIN';
                  
                  db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr2) => {
                    if (beginErr2) {
                      console.error('[AUTO-IT] Failed to start transaction for auto IT request:', beginErr2);
                      if (!responseSent) {
                        responseSent = true;
                        return res.json({ 
                          id: requestId, 
                          status: status || request.currentStatus,
                          workflowStatus: workflowStatus || request.currentWorkflowStatus,
                          currentStep: currentStep || null,
                          message: 'Status updated successfully. Note: Auto IT request creation failed.',
                          autoITRequestCreated: false
                        });
                      }
                      return;
                    }
                    
                    db.run(
                      `INSERT INTO requests (type, title, description, requester_name, department, status, employee_id, 
                                           assigned_role, workflow_status, current_step)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      ['IT', itTitle, itDescription, req.user.fullName, req.user.department || '', itStatus, req.user.id,
                       itAssignedRole, itWorkflowStatus, itCurrentStep],
                      function (err4) {
                        if (err4) {
                          db.run('ROLLBACK', () => {});
                          console.error('[AUTO-IT] Failed to create IT request:', err4);
                          if (!responseSent) {
                            responseSent = true;
                            return res.json({ 
                              id: requestId, 
                              status: status || request.currentStatus,
                              workflowStatus: workflowStatus || request.currentWorkflowStatus,
                              currentStep: currentStep || null,
                              message: 'Status updated successfully. Note: Auto IT request creation failed.',
                              autoITRequestCreated: false
                            });
                          }
                          return;
                        }
                        
                        const itRequestId = this.lastID;
                        
                        db.run(
                          `INSERT INTO it_requests (request_id, category, system_name, impact, urgency, asset_tag)
                           VALUES (?, ?, ?, ?, ?, ?)`,
                          [itRequestId, 'Devices & Materials', onboarding.device_type, 'High', 'High', `ONBOARDING-${requestId}`],
                          function (err5) {
                            if (err5) {
                              db.run('ROLLBACK', () => {});
                              console.error('[AUTO-IT] Failed to create IT request details:', err5);
                              if (!responseSent) {
                                responseSent = true;
                                return res.json({ 
                                  id: requestId, 
                                  status: status || request.currentStatus,
                                  workflowStatus: workflowStatus || request.currentWorkflowStatus,
                                  currentStep: currentStep || null,
                                  message: 'Status updated successfully. Note: Auto IT request creation failed.',
                                  autoITRequestCreated: false
                                });
                              }
                              return;
                            }
                            
                            db.run('COMMIT', (commitErr2) => {
                              if (commitErr2) {
                                console.error('[AUTO-IT] Failed to commit IT request:', commitErr2);
                              } else {
                                console.log(`[AUTO-IT] Successfully created IT request #${itRequestId} for onboarding #${requestId}`);
                                logRequestAction(itRequestId, 'CREATE', null, itWorkflowStatus, req.user.id,
                                  `Auto-generated from completed onboarding request #${requestId}`, () => {});
                              }
                              
                              if (!responseSent) {
                                responseSent = true;
                                return res.json({ 
                                  id: requestId, 
                                  status: status || request.currentStatus,
                                  workflowStatus: workflowStatus || request.currentWorkflowStatus,
                                  currentStep: currentStep || null,
                                  message: 'Status updated successfully. IT request auto-created for device setup.',
                                  autoITRequestCreated: true,
                                  autoITRequestId: itRequestId
                                });
                              }
                            });
                          }
                        );
                      }
                    );
                  });
                } else {
                  // No device or error fetching onboarding details - just return success
                  if (!responseSent) {
                    responseSent = true;
                    return res.json({ 
                      id: requestId, 
                      status: status || request.currentStatus,
                      workflowStatus: workflowStatus || request.currentWorkflowStatus,
                      currentStep: currentStep || null,
                      message: 'Status updated successfully'
                    });
                  }
                }
              }
            );
          }
        }
      );
    }
  );
});

// ---------------- Fleet Override for Car Bookings ----------------

app.patch('/api/car-bookings/:requestId/override', authRequired, requireRole('SUPER_ADMIN', 'FLEET_ADMIN'), (req, res) => {
  const requestId = req.params.requestId;
  const { vehicleId, startDatetime, endDatetime, status, workflowStatus, currentStep, overrideReason } = req.body;

  // Get current booking
  db.get(
    `SELECT r.type, r.status, cb.vehicle_id, cb.start_datetime, cb.end_datetime 
     FROM requests r 
     JOIN car_bookings cb ON r.id = cb.request_id 
     WHERE r.id = ? AND r.type = 'CAR_BOOKING'`,
    [requestId],
    (err, booking) => {
      if (err) {
        logError('/api/car-bookings/:requestId/override', 'select_booking', err, { requestId });
        return res.status(500).json({ error: 'Failed to load booking. Please try again.' });
      }
      if (!booking) {
        return res.status(404).json({ error: 'Car booking not found' });
      }

      // If vehicle or time is changing, validate availability
      const vehicleChanged = vehicleId && vehicleId !== booking.vehicle_id;
      const timeChanged = (startDatetime && startDatetime !== booking.start_datetime) || 
                          (endDatetime && endDatetime !== booking.end_datetime);
      
      if (vehicleChanged || timeChanged) {
        const checkVehicleId = vehicleId || booking.vehicle_id;
        const checkStart = startDatetime || booking.start_datetime;
        const checkEnd = endDatetime || booking.end_datetime;

        // Check if vehicle is available (excluding current booking and cancelled bookings)
        db.get(
          `SELECT v.* FROM vehicles v
           WHERE v.id = ? AND v.status = 'ACTIVE'
           AND NOT EXISTS (
             SELECT 1 FROM car_bookings b
             INNER JOIN requests r ON b.request_id = r.id
             WHERE b.vehicle_id = v.id
             AND b.request_id != ?
             AND r.status != 'CANCELLED'
             AND NOT (b.end_datetime <= ? OR b.start_datetime >= ?)
           )`,
          [checkVehicleId, requestId, checkStart, checkEnd],
          (err2, vehicle) => {
            if (err2) {
              logError('/api/car-bookings/:requestId/override', 'check_availability', err2, { requestId });
              return res.status(500).json({ error: 'Failed to check vehicle availability. Please try again.' });
            }
            if (!vehicle) {
              return res.status(400).json({ error: 'Selected vehicle is not available in this time range' });
            }
            performOverride(vehicle);
          }
        );
      } else {
        performOverride(null);
      }

      function performOverride(vehicle) {
        db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
          if (beginErr) {
            logError('/api/car-bookings/:requestId/override', 'begin_transaction', beginErr);
            return res.status(500).json({ error: 'Failed to start transaction. Please try again.' });
          }

          const updateFields = [];
          const updateValues = [];
          
          if (vehicleId) {
            updateFields.push('vehicle_id = ?');
            updateValues.push(vehicleId);
          }
          if (startDatetime) {
            updateFields.push('start_datetime = ?');
            updateValues.push(startDatetime);
          }
          if (endDatetime) {
            updateFields.push('end_datetime = ?');
            updateValues.push(endDatetime);
          }
          if (status) {
            updateFields.push('status = ?');
            updateValues.push(status);
          }
          updateValues.push(requestId);

          // Update car_bookings
          if (updateFields.length > 0) {
            db.run(
              `UPDATE car_bookings SET ${updateFields.join(', ')} WHERE request_id = ?`,
              updateValues,
              (err3) => {
                if (err3) {
                  db.run('ROLLBACK', () => {});
                  logError('/api/car-bookings/:requestId/override', 'update_booking', err3, { requestId });
                  return res.status(500).json({ error: 'Failed to update booking. Please try again.' });
                }
                updateRequest();
              }
            );
          } else {
            updateRequest();
          }

          function updateRequest() {
            const reqFields = [];
            const reqValues = [];
            
            if (status) {
              reqFields.push('status = ?');
              reqValues.push(status);
            }
            if (workflowStatus) {
              reqFields.push('workflow_status = ?');
              reqValues.push(workflowStatus);
            }
            if (currentStep) {
              reqFields.push('current_step = ?');
              reqValues.push(currentStep);
            }
            reqFields.push('updated_at = CURRENT_TIMESTAMP');
            reqValues.push(requestId);

            db.run(
              `UPDATE requests SET ${reqFields.join(', ')} WHERE id = ?`,
              reqValues,
              (err4) => {
                if (err4) {
                  db.run('ROLLBACK', () => {});
                  logError('/api/car-bookings/:requestId/override', 'update_request', err4, { requestId });
                  return res.status(500).json({ error: 'Failed to update request. Please try again.' });
                }

                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    logError('/api/car-bookings/:requestId/override', 'commit_transaction', commitErr);
                    return res.status(500).json({ error: 'Failed to commit transaction. Please try again.' });
                  }

                  // Log action
                  logRequestAction(requestId, 'FLEET_OVERRIDE', booking.status, status || booking.status, 
                    req.user.id, overrideReason || 'Fleet admin override', (logErr) => {
                      if (logErr) {
                        console.error('[AUDIT] Failed to log fleet override action:', logErr);
                      }
                    });

                  res.json({
                    id: requestId,
                    vehicleId: vehicleId || booking.vehicle_id,
                    startDatetime: startDatetime || booking.start_datetime,
                    endDatetime: endDatetime || booking.end_datetime,
                    status: status || booking.status,
                    workflowStatus: workflowStatus || null,
                    currentStep: currentStep || null,
                    message: 'Booking override applied successfully'
                  });
                });
              }
            );
          }
        });
      }
    }
  );
});

// ---------------- Fleet Schedule ----------------

app.get('/api/fleet/schedule', authRequired, requireRole('SUPER_ADMIN', 'FLEET_ADMIN'), (req, res) => {
  const { from, to, vehicleId } = req.query;
  
  let query = `
    SELECT 
      r.id AS requestId,
      r.title,
      r.status,
      r.workflow_status AS workflowStatus,
      r.current_step AS currentStep,
      r.requester_name AS requesterName,
      r.department,
      r.created_at AS createdAt,
      cb.start_datetime AS startDatetime,
      cb.end_datetime AS endDatetime,
      cb.destination,
      cb.reason,
      cb.passengers,
      v.id AS vehicleId,
      v.name AS vehicleName,
      v.plate_number AS vehiclePlateNumber,
      v.plate_code AS vehiclePlateCode,
      v.type AS vehicleType,
      v.status AS vehicleStatus
    FROM requests r
    INNER JOIN car_bookings cb ON r.id = cb.request_id
    LEFT JOIN vehicles v ON cb.vehicle_id = v.id
    WHERE r.type = 'CAR_BOOKING'
  `;
  
  const params = [];
  const conditions = [];
  
  if (from) {
    conditions.push(`cb.start_datetime >= ?`);
    params.push(from);
  }
  if (to) {
    conditions.push(`cb.end_datetime <= ?`);
    params.push(to);
  }
  if (vehicleId) {
    conditions.push(`cb.vehicle_id = ?`);
    params.push(vehicleId);
  }
  
  if (conditions.length > 0) {
    query += ` AND ${conditions.join(' AND ')}`;
  }
  
  query += ` ORDER BY cb.start_datetime ASC, v.name ASC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logError('/api/fleet/schedule', 'select_schedule', err, { from, to, vehicleId });
      return res.status(500).json(formatErrorResponse(
        err,
        'Failed to load fleet schedule. Please try again.'
      ));
    }
    res.json(rows);
  });
});

// ---------------- Admin Endpoints ----------------

// Employee Management (SUPER_ADMIN, HR_ADMIN)
app.get('/api/admin/employees', authRequired, requireRole('SUPER_ADMIN', 'HR_ADMIN'), (req, res) => {
  db.all(
    `SELECT id, email, full_name AS fullName, department, role, is_active AS isActive, 
            is_lead AS isLead, job_level AS jobLevel, created_at AS createdAt
     FROM employees
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

app.post('/api/admin/employees', authRequired, requireRole('SUPER_ADMIN', 'HR_ADMIN'), (req, res) => {
  const { email, password, fullName, department, role, isLead, jobLevel } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  const passwordHash = hashPassword(password);

  db.run(
    `INSERT INTO employees (email, password_hash, full_name, department, role, is_active, is_lead, job_level)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
     [email, passwordHash, fullName, department || '', role || 'EMPLOYEE', isLead ? 1 : 0, jobLevel || null],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({
        id: this.lastID,
        email,
        fullName,
        department: department || '',
        role: role || 'EMPLOYEE',
        isActive: true,
        isLead: !!isLead,
        jobLevel: jobLevel || null
      });
    }
  );
});

app.patch('/api/admin/employees/:id', authRequired, requireRole('SUPER_ADMIN', 'HR_ADMIN'), (req, res) => {
  const employeeId = req.params.id;
  const { email, fullName, department, role, isLead, jobLevel } = req.body;

  const updates = [];
  const values = [];

  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email);
  }
  if (fullName !== undefined) {
    updates.push('full_name = ?');
    values.push(fullName);
  }
  if (department !== undefined) {
    updates.push('department = ?');
    values.push(department);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    values.push(role);
  }
  if (isLead !== undefined) {
    updates.push('is_lead = ?');
    values.push(isLead ? 1 : 0);
  }
  if (jobLevel !== undefined) {
    updates.push('job_level = ?');
    values.push(jobLevel);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(employeeId);

  db.run(
    `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json({ id: employeeId, message: 'Employee updated successfully' });
    }
  );
});

app.patch('/api/admin/employees/:id/activate', authRequired, requireRole('SUPER_ADMIN', 'HR_ADMIN'), (req, res) => {
  const employeeId = req.params.id;

  db.run(
    `UPDATE employees SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [employeeId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json({ id: employeeId, message: 'Employee activated successfully' });
    }
  );
});

// Vehicle Management (SUPER_ADMIN, FLEET_ADMIN)
app.get('/api/admin/vehicles', authRequired, requireRole('SUPER_ADMIN', 'FLEET_ADMIN'), (req, res) => {
  db.all(
    `SELECT id, name, plate_number, plate_code, type, status
     FROM vehicles
     ORDER BY name`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

app.post('/api/admin/vehicles', authRequired, requireRole('SUPER_ADMIN', 'FLEET_ADMIN'), (req, res) => {
  const { name, plateNumber, plateCode, type } = req.body;

  if (!name || !plateNumber) {
    return res.status(400).json({ error: 'Name and plate number are required' });
  }

  // Plate code is optional, default to empty string if not provided
  const code = plateCode || '';

  db.run(
    `INSERT INTO vehicles (name, plate_number, plate_code, type, status)
     VALUES (?, ?, ?, ?, 'ACTIVE')`,
    [name, plateNumber, code, type || ''],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({
        id: this.lastID,
        name,
        plate_number: plateNumber,
        plate_code: code,
        type: type || '',
        status: 'ACTIVE'
      });
    }
  );
});

app.patch('/api/admin/vehicles/:id', authRequired, requireRole('SUPER_ADMIN', 'FLEET_ADMIN'), (req, res) => {
  const vehicleId = req.params.id;
  const { name, plateNumber, type } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (plateNumber !== undefined) {
    updates.push('plate_number = ?');
    values.push(plateNumber);
  }
  if (type !== undefined) {
    updates.push('type = ?');
    values.push(type);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(vehicleId);

  db.run(
    `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      res.json({ id: vehicleId, message: 'Vehicle updated successfully' });
    }
  );
});

app.patch('/api/admin/vehicles/:id/status', authRequired, requireRole('SUPER_ADMIN', 'FLEET_ADMIN'), (req, res) => {
  const vehicleId = req.params.id;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
  }

  db.run(
    `UPDATE vehicles SET status = ? WHERE id = ?`,
    [status, vehicleId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      res.json({ id: vehicleId, status, message: 'Vehicle status updated successfully' });
    }
  );
});

// Helper function to check if port is available
const checkPortAvailable = (port, callback) => {
  const net = require('net');
  const server = net.createServer();
  
  server.listen(port, () => {
    server.once('close', () => {
      callback(null, true);
    });
    server.close();
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      callback(null, false);
    } else {
      callback(err, false);
    }
  });
};

// Start server - wait for database to be ready
waitForDb((dbErr) => {
  if (dbErr) {
    console.error('[SERVER] Database initialization failed:', dbErr);
    console.error('[SERVER] Server will not start. Please check database configuration.');
    process.exit(1);
  }
  
  // Check if port is available before starting
  checkPortAvailable(PORT, (err, isAvailable) => {
    if (err) {
      console.error('[SERVER] Error checking port:', err);
      process.exit(1);
    }
    
    if (!isAvailable) {
      console.error(`[SERVER] ❌ Port ${PORT} is already in use!`);
      console.error(`[SERVER] Please either:`);
      console.error(`[SERVER]   1. Stop the other process using port ${PORT}`);
      console.error(`[SERVER]   2. Or change PORT in server.js to a different port`);
      console.error(`[SERVER] To find the process: netstat -ano | findstr :${PORT}`);
      console.error(`[SERVER] To kill all Node processes: Get-Process node | Stop-Process -Force`);
      process.exit(1);
    }
    
    const server = app.listen(PORT, () => {
      console.log(`[SERVER] ✅ Backend running on http://localhost:${PORT}`);
      console.log('[SERVER] Ready to accept requests');
      console.log('[SERVER] Test login endpoint: POST http://localhost:4000/api/auth/login');
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[SERVER] ❌ Port ${PORT} is already in use!`);
        console.error(`[SERVER] Please either:`);
        console.error(`[SERVER]   1. Stop the other process using port ${PORT}`);
        console.error(`[SERVER]   2. Or change PORT in server.js to a different port`);
        console.error(`[SERVER] To find the process: netstat -ano | findstr :${PORT}`);
        console.error(`[SERVER] To kill it: taskkill /F /PID <process_id>`);
      } else {
        console.error('[SERVER] ❌ Server error:', err);
      }
      process.exit(1);
    });
  });
});

