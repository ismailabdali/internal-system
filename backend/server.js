// server.js
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

// Helpers
function toIsoString(localDateTime) {
  // expects "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
  return new Date(localDateTime).toISOString();
}

// ---------------- Vehicles ----------------

app.get('/api/vehicles', (req, res) => {
  db.all(
    `SELECT * FROM vehicles WHERE status = 'ACTIVE'`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'DB error' });
      }
      res.json(rows);
    }
  );
});

// ---------------- Car Booking ----------------

app.post('/api/car-bookings', (req, res) => {
  const {
    requesterName,
    department,
    startDatetime,
    endDatetime,
    pickupLocation,
    destination,
    reason,
    passengers,
    preferredType
  } = req.body;

  if (!requesterName || !startDatetime || !endDatetime || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const startIso = toIsoString(startDatetime);
  const endIso = toIsoString(endDatetime);

  // Find first available ACTIVE vehicle (respecting preferredType if provided)
  const params = preferredType ? ['ACTIVE', preferredType, startIso, endIso] : ['ACTIVE', startIso, endIso];

  const queryPreferred = preferredType
    ? `
      SELECT v.*
      FROM vehicles v
      WHERE v.status = ?
      AND v.type = ?
      AND NOT EXISTS (
        SELECT 1 FROM car_bookings b
        WHERE b.vehicle_id = v.id
        AND NOT (b.end_datetime <= ? OR b.start_datetime >= ?)
      )
      LIMIT 1
    `
    : `
      SELECT v.*
      FROM vehicles v
      WHERE v.status = ?
      AND NOT EXISTS (
        SELECT 1 FROM car_bookings b
        WHERE b.vehicle_id = v.id
        AND NOT (b.end_datetime <= ? OR b.start_datetime >= ?)
      )
      LIMIT 1
    `;

  db.get(queryPreferred, params, (err, vehicle) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error checking availability' });
    }
    if (!vehicle) {
      return res.status(400).json({ error: 'No vehicles available in this time range' });
    }

    const title = `Car booking to ${destination || 'N/A'}`;
    const description = reason;
    const status = 'BOOKED';

    db.serialize(() => {
      db.run(
        `
          INSERT INTO requests (type, title, description, requester_name, department, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        ['CAR_BOOKING', title, description, requesterName, department || '', status],
        function (err2) {
          if (err2) {
            console.error(err2);
            return res.status(500).json({ error: 'Error creating request' });
          }
          const requestId = this.lastID;

          db.run(
            `
              INSERT INTO car_bookings
              (request_id, vehicle_id, start_datetime, end_datetime, pickup_location, destination, reason, passengers, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              requestId,
              vehicle.id,
              startIso,
              endIso,
              pickupLocation || '',
              destination || '',
              reason,
              passengers || null,
              status
            ],
            function (err3) {
              if (err3) {
                console.error(err3);
                return res.status(500).json({ error: 'Error creating car booking' });
              }

              return res.json({
                id: this.lastID,
                requestId,
                vehicle,
                startDatetime: startIso,
                endDatetime: endIso,
                pickupLocation,
                destination,
                reason,
                passengers,
                status
              });
            }
          );
        }
      );
    });
  });
});

// ---------------- IT Requests ----------------

app.post('/api/it-requests', (req, res) => {
  const {
    requesterName,
    department,
    title,
    description,
    category,
    systemName,
    impact,
    urgency,
    assetTag
  } = req.body;

  if (!requesterName || !title || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const status = 'IN_PROGRESS';

  db.serialize(() => {
    db.run(
      `
        INSERT INTO requests (type, title, description, requester_name, department, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      ['IT', title, description || '', requesterName, department || '', status],
      function (err2) {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: 'Error creating request' });
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
              console.error(err3);
              return res.status(500).json({ error: 'Error creating IT details' });
            }
            res.json({
              id: this.lastID,
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
              status
            });
          }
        );
      }
    );
  });
});

// ---------------- Onboarding Requests ----------------

app.post('/api/onboarding', (req, res) => {
  const {
    requesterName, // manager
    department,
    employeeName,
    position,
    location,
    startDate,
    deviceType,
    vpnRequired,
    notes
  } = req.body;

  if (!requesterName || !employeeName || !position || !startDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const status = 'IN_PROGRESS';
  const title = `Onboarding for ${employeeName}`;
  const description = `Position: ${position} - Start: ${startDate}`;

  db.serialize(() => {
    db.run(
      `
        INSERT INTO requests (type, title, description, requester_name, department, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      ['ONBOARDING', title, description, requesterName, department || '', status],
      function (err2) {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: 'Error creating request' });
        }
        const requestId = this.lastID;

        db.run(
          `
            INSERT INTO onboarding_requests
            (request_id, employee_name, position, department, location, start_date, device_type, vpn_required, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            requestId,
            employeeName,
            position,
            department || '',
            location || '',
            startDate,
            deviceType || '',
            vpnRequired ? 1 : 0,
            notes || ''
          ],
          function (err3) {
            if (err3) {
              console.error(err3);
              return res.status(500).json({ error: 'Error creating onboarding details' });
            }
            res.json({
              id: this.lastID,
              requestId,
              type: 'ONBOARDING',
              title,
              requesterName,
              employeeName,
              position,
              location,
              startDate,
              deviceType,
              vpnRequired: !!vpnRequired,
              status
            });
          }
        );
      }
    );
  });
});

// ---------------- Requests List (for "My Requests") ----------------

app.get('/api/requests', (req, res) => {
  db.all(
    `
      SELECT id, type, title, description, requester_name AS requesterName,
             department, status, created_at AS createdAt
      FROM requests
      ORDER BY created_at DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'DB error' });
      }
      res.json(rows);
    }
  );
});

// ---------------- Get Request Details ----------------

app.get('/api/requests/:id', (req, res) => {
  const requestId = req.params.id;

  db.get(
    `
      SELECT id, type, title, description, requester_name AS requesterName,
             department, status, created_at AS createdAt, updated_at AS updatedAt
      FROM requests
      WHERE id = ?
    `,
    [requestId],
    (err, request) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'DB error' });
      }
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Fetch additional details based on request type
      if (request.type === 'CAR_BOOKING') {
        db.get(
          `
            SELECT cb.*, v.name as vehicle_name, v.plate_number, v.type as vehicle_type
            FROM car_bookings cb
            JOIN vehicles v ON cb.vehicle_id = v.id
            WHERE cb.request_id = ?
          `,
          [requestId],
          (err2, carBooking) => {
            if (err2) {
              console.error(err2);
              return res.status(500).json({ error: 'Error fetching car booking details' });
            }
            res.json({
              ...request,
              carBooking: carBooking ? {
                ...carBooking,
                vehicle: {
                  name: carBooking.vehicle_name,
                  plateNumber: carBooking.plate_number,
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
              console.error(err2);
              return res.status(500).json({ error: 'Error fetching IT request details' });
            }
            res.json({
              ...request,
              itRequest: itRequest || null
            });
          }
        );
      } else if (request.type === 'ONBOARDING') {
        db.get(
          `SELECT * FROM onboarding_requests WHERE request_id = ?`,
          [requestId],
          (err2, onboarding) => {
            if (err2) {
              console.error(err2);
              return res.status(500).json({ error: 'Error fetching onboarding details' });
            }
            res.json({
              ...request,
              onboarding: onboarding ? {
                ...onboarding,
                vpnRequired: !!onboarding.vpn_required
              } : null
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

app.patch('/api/requests/:id/status', (req, res) => {
  const requestId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'BOOKED'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ') });
  }

  db.run(
    `
      UPDATE requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, requestId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error updating request status' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }
      res.json({ 
        id: requestId, 
        status,
        message: 'Status updated successfully'
      });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
