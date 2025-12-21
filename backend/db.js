// db.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = './internal_system.db';

// Helper to check and clean up stale lock files
const checkStaleLocks = () => {
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  
  // Check if database file exists but has stale WAL files
  if (fs.existsSync(dbPath)) {
    // If WAL file exists but is very old (more than 1 hour), it might be stale
    if (fs.existsSync(walPath)) {
      try {
        const walStats = fs.statSync(walPath);
        const now = Date.now();
        const walAge = now - walStats.mtimeMs;
        
        // If WAL file is older than 1 hour, it might be stale
        // But we won't delete it automatically - SQLite will handle it
        if (walAge > 3600000) {
          console.log('[DB] WAL file exists and is older than 1 hour - SQLite will handle cleanup');
        }
      } catch (e) {
        // Ignore stat errors
      }
    }
  }
};

// Check for stale locks before opening
checkStaleLocks();

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('[DB] Error opening database:', err);
    if (err.code === 'SQLITE_BUSY') {
      console.error('[DB] Database is locked. Please ensure no other process is using it.');
      console.error('[DB] If the server crashed, you may need to delete .db-wal and .db-shm files');
    }
    process.exit(1);
  }
  
  console.log('[DB] Database connection opened successfully');
  
  // Configure SQLite for better concurrency
  // MUST be done sequentially with callbacks to ensure proper order
  // First, set busy timeout - this is critical and must be first
  db.run('PRAGMA busy_timeout = 30000', (err) => {
    if (err) {
      console.error('[DB] Error setting busy timeout:', err);
      // Continue anyway - the default timeout might still work
    } else {
      console.log('[DB] Busy timeout set to 30000ms');
    }
    
    // After busy timeout is set, try to enable WAL mode
    // WAL mode allows multiple readers and one writer simultaneously
    // Use a small delay to ensure busy_timeout is applied
    setTimeout(() => {
      db.run('PRAGMA journal_mode = WAL', (err) => {
        if (err) {
          if (err.code === 'SQLITE_BUSY') {
            console.warn('[DB] Warning: Database is busy, could not enable WAL mode');
            console.warn('[DB] This usually means another process has the database locked');
            console.warn('[DB] Continuing with default journal mode - operations may be slower');
          } else {
            console.warn('[DB] Warning: Could not enable WAL mode:', err.message);
            console.log('[DB] Continuing with default journal mode');
          }
        } else {
          console.log('[DB] WAL mode enabled for better concurrency');
        }
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            console.error('[DB] Error enabling foreign keys:', err);
          } else {
            console.log('[DB] Foreign keys enabled');
          }
          
          // Set synchronous mode to NORMAL for better performance with WAL
          db.run('PRAGMA synchronous = NORMAL', (err) => {
            if (err) {
              console.error('[DB] Error setting synchronous mode:', err);
            }
            
            // Now that all PRAGMA commands are done, create tables
            initializeTables();
          });
        });
      });
    }, 100); // Small delay to ensure busy_timeout is fully applied
  });
});

// Retry helper for SQLITE_BUSY errors
const retryWithBackoff = (operation, maxRetries = 3, baseDelay = 100) => {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    
    const tryOperation = () => {
      attempt++;
      operation((err, result) => {
        if (err && err.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[DB] SQLITE_BUSY on attempt ${attempt}, retrying in ${delay}ms...`);
          setTimeout(tryOperation, delay);
        } else if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    };
    
    tryOperation();
  });
};

// Wrapper for db.run with retry
const dbRunWithRetry = (sql, params, callback, maxRetries = 3) => {
  const operation = (cb) => {
    db.run(sql, params, function(err) {
      if (err && err.code === 'SQLITE_BUSY' && maxRetries > 0) {
        // Retry with reduced retries
        setTimeout(() => {
          dbRunWithRetry(sql, params, callback, maxRetries - 1);
        }, 100 * (4 - maxRetries));
      } else {
        cb(err, this);
      }
    });
  };
  
  if (callback) {
    operation(callback);
  } else {
    return new Promise((resolve, reject) => {
      operation((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
};

// Safe migration helper: Add column if it doesn't exist
const addColumnIfMissing = (tableName, columnName, columnDef, callback) => {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) {
      console.error(`Error checking table info for ${tableName}:`, err);
      if (callback) callback(err);
      return;
    }
    
    const hasColumn = columns.some(col => col.name === columnName);
    
    if (!hasColumn) {
      console.log(`[MIGRATION] ${tableName}: adding ${columnName} column...`);
      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (err) => {
        if (err) {
          console.error(`[MIGRATION ERROR] Failed to add ${columnName} to ${tableName}:`, err);
          if (callback) callback(err);
          return;
        }
        console.log(`[MIGRATION] Successfully added ${columnName} to ${tableName}`);
        if (callback) callback(null);
      });
    } else {
      if (callback) callback(null);
    }
  });
};

// Comprehensive migration function to ensure all required columns exist
const ensureTableSchema = (tableName, requiredColumns, callback) => {
  db.all(`PRAGMA table_info(${tableName})`, (err, existingColumns) => {
    if (err) {
      console.error(`Error checking table schema for ${tableName}:`, err);
      if (callback) callback(err);
      return;
    }
    
    const existingColumnNames = existingColumns.map(col => col.name);
    const missingColumns = requiredColumns.filter(col => !existingColumnNames.includes(col.name));
    
    if (missingColumns.length === 0) {
      if (callback) callback(null);
      return;
    }
    
    console.log(`[MIGRATION] ${tableName}: found ${missingColumns.length} missing column(s)`);
    let completed = 0;
    let hasError = false;
    
    missingColumns.forEach((col, index) => {
      addColumnIfMissing(tableName, col.name, col.definition, (err) => {
        if (err) {
          hasError = true;
          if (callback) callback(err);
          return;
        }
        completed++;
        if (completed === missingColumns.length && !hasError) {
          console.log(`[MIGRATION] ${tableName}: all columns verified`);
          if (callback) callback(null);
        }
      });
    });
  });
};

// Track database readiness
let dbReady = false;
const dbReadyCallbacks = [];
let dbInitStartTime = Date.now();

const markDbReady = () => {
  dbReady = true;
  const initTime = ((Date.now() - dbInitStartTime) / 1000).toFixed(2);
  console.log(`[DB] Database initialization complete - ready to accept connections (took ${initTime}s)`);
  dbReadyCallbacks.forEach(callback => callback(null));
  dbReadyCallbacks.length = 0;
};

// Helper to wait for database to be ready (with timeout)
const waitForDb = (callback, timeout = 10000) => {
  if (dbReady) {
    callback(null);
    return;
  }
  
  // Add timeout to prevent infinite waiting
  const timeoutId = setTimeout(() => {
    const index = dbReadyCallbacks.indexOf(callback);
    if (index > -1) {
      dbReadyCallbacks.splice(index, 1);
      console.error('[DB] Timeout waiting for database to be ready');
      callback(new Error('Database initialization timeout'));
    }
  }, timeout);
  
  const wrappedCallback = (...args) => {
    clearTimeout(timeoutId);
    callback(...args);
  };
  
  dbReadyCallbacks.push(wrappedCallback);
};

// Initialize all tables after database configuration is complete
function initializeTables() {
  db.serialize(() => {
    // Requests (common for all types)
    // Required columns: id, type, title, description, requester_name, department, status, employee_id, 
    // assigned_role, assigned_to_employee_id, workflow_status, current_step, created_at, updated_at
    db.run(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT,
        description TEXT,
        requester_name TEXT,
        department TEXT,
        status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating requests table:', err);
        return;
      }
      
      // Ensure all required columns exist (migration for existing databases)
      ensureTableSchema('requests', [
        { name: 'employee_id', definition: 'INTEGER' },
        { name: 'assigned_role', definition: 'TEXT' },
        { name: 'assigned_to_employee_id', definition: 'INTEGER' },
        { name: 'workflow_status', definition: 'TEXT DEFAULT "SUBMITTED"' },
        { name: 'current_step', definition: 'TEXT' }
      ], (err) => {
        if (err) {
          console.error('[MIGRATION] Failed to ensure requests table schema:', err);
        } else {
          console.log('[MIGRATION] requests table schema verified');
        }
      });
    });

    // Request actions audit trail
    db.run(`
      CREATE TABLE IF NOT EXISTS request_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        actor_employee_id INTEGER,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id),
        FOREIGN KEY (actor_employee_id) REFERENCES employees(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating request_actions table:', err);
      } else {
        console.log('[MIGRATION] request_actions table schema verified');
      }
    });

    // IT request details
    // Required columns: id, request_id, category, system_name, impact, urgency, asset_tag
    db.run(`
      CREATE TABLE IF NOT EXISTS it_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        category TEXT,
        system_name TEXT,
        impact TEXT,
        urgency TEXT,
        asset_tag TEXT,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating it_requests table:', err);
        return;
      }
      console.log('[MIGRATION] it_requests table schema verified');
    });

    // Onboarding request details
    db.run(`
      CREATE TABLE IF NOT EXISTS onboarding_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        employee_name TEXT,
        position TEXT,
        department TEXT,
        location TEXT,
        start_date TEXT,
        device_type TEXT,
        vpn_required INTEGER,
        notes TEXT,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )
    `);

    // Vehicles
    db.run(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        plate_number TEXT NOT NULL,
        type TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
      )
    `);

    // Car bookings
    db.run(`
      CREATE TABLE IF NOT EXISTS car_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        vehicle_id INTEGER,
        start_datetime TEXT,
        end_datetime TEXT,
        destination TEXT,
        reason TEXT,
        passengers INTEGER,
        status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating car_bookings table:', err);
      }
    });

    // Employees table
    db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        department TEXT,
        role TEXT DEFAULT 'EMPLOYEE',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating employees table:', err);
        return;
      }
      
      // Ensure all required columns exist (migration for existing databases)
      ensureTableSchema('employees', [
        { name: 'is_lead', definition: 'INTEGER DEFAULT 0' },
        { name: 'job_level', definition: 'TEXT' }
      ], (err) => {
        if (err) {
          console.error('[MIGRATION] Failed to ensure employees table schema:', err);
        } else {
          console.log('[MIGRATION] employees table schema verified');
        }
      });
    });

    // Seed a few vehicles if none exist
    db.get(`SELECT COUNT(*) AS count FROM vehicles`, (err, row) => {
      if (err) {
        console.error('Error counting vehicles', err);
        return;
      }
      if (row.count === 0) {
        const stmt = db.prepare(
          `INSERT INTO vehicles (name, plate_number, type, status) VALUES (?, ?, ?, 'ACTIVE')`
        );
        stmt.run('Prado White', 'M-1234', 'SUV');
        stmt.run('Corolla Grey', 'M-5678', 'Sedan');
        stmt.run('Hilux Pickup', 'M-9012', 'Pickup');
        stmt.finalize();
        console.log('Seeded vehicles table');
      }
    });

    // Seed / ensure required employees exist (insert missing only)
db.get(`SELECT COUNT(*) AS count FROM employees`, (err, row) => {
  if (err) {
    console.error('Error counting employees', err);
    markDbReady();
    return;
  }

  const crypto = require('crypto');
  const hashPassword = (password) =>
    crypto.createHash('sha256').update(password).digest('hex');

  // ✅ Always ensure these exist (won’t duplicate because email is UNIQUE)
  const requiredEmployees = [
    // email, password_hash, full_name, department, role, is_active, is_lead
    ['admin@housing.gov.om', hashPassword('password123'), 'Super Admin', 'Administration', 'SUPER_ADMIN', 1, 1],
    ['it@housing.gov.om', hashPassword('password123'), 'IT Admin', 'IT', 'IT_ADMIN', 1, 0],
    ['hr@housing.gov.om', hashPassword('password123'), 'HR Admin', 'HR', 'HR_ADMIN', 1, 1],
    ['fleet@housing.gov.om', hashPassword('password123'), 'Fleet Admin', 'Fleet', 'FLEET_ADMIN', 1, 0],
    ['ismail@housing.gov.om', hashPassword('password123'), 'Ismail Al Abdali', 'Programmer', 'EMPLOYEE', 1, 0],
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO employees
    (email, password_hash, full_name, department, role, is_active, is_lead)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  requiredEmployees.forEach((e) => stmt.run(e));

  stmt.finalize((finalizeErr) => {
    if (finalizeErr) {
      console.error('Error finalizing employee ensure statement:', finalizeErr);
    } else {
      console.log('[DB] Ensured required employee accounts exist (inserted missing only).');
      console.log('Demo login credentials (password: password123):');
      console.log('  - admin@housing.gov.om (SUPER_ADMIN)');
      console.log('  - it@housing.gov.om (IT_ADMIN)');
      console.log('  - hr@housing.gov.om (HR_ADMIN)');
      console.log('  - fleet@housing.gov.om (FLEET_ADMIN)');
      console.log('  - ismail@housing.gov.om (EMPLOYEE)');
    }
    markDbReady();
  });
});
  }); // Close db.serialize(() => { ... })
}

module.exports = db;
module.exports.waitForDb = waitForDb;
module.exports.isReady = () => dbReady;
module.exports.dbRunWithRetry = dbRunWithRetry;
