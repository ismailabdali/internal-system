// db.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./internal_system.db');

db.serialize(() => {
  // Requests (common for all types)
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
  `);

  // IT request details
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
  `);

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
      pickup_location TEXT,
      destination TEXT,
      reason TEXT,
      passengers INTEGER,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

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
});

module.exports = db;
