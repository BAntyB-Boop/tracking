import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getSql();

  // -------------------------------------------------------------
  // 1. GET /api/drivers (List all drivers)
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    if (sql) {
      try {
        const drivers = await sql`
          SELECT 
            u.id,
            u.username as driver_id,
            u.name,
            u.phone,
            u.truck_id,
            u.station_code,
            s.name as station_name,
            t.leg as truck_leg,
            t.status as truck_status
          FROM users u
          LEFT JOIN stations s ON u.station_code = s.code
          LEFT JOIN trucks t ON u.truck_id = t.id
          WHERE u.role = 'driver'
          ORDER BY u.id ASC
        `;
        return res.status(200).json({ drivers, source: 'neon-postgresql' });
      } catch (err) {
        console.warn('Neon drivers GET error, using fallback:', err.message);
      }
    }

    // Fallback response
    return res.status(200).json({
      drivers: [
        { id: 1, driver_id: 'DR-0419', name: 'Anan Suksomboon', phone: '086-777-8899', truck_id: 'TK-19', station_code: 'NSN', station_name: 'Nakhon Sawan Hub' },
        { id: 2, driver_id: 'DR-0702', name: 'Prasert M.', phone: '085-555-6677', truck_id: 'TK-07', station_code: 'WNI', station_name: 'Wang Noi Sorting Center' },
        { id: 3, driver_id: 'DR-0022', name: 'Chaiwat S.', phone: '084-444-5566', truck_id: 'TK-22', station_code: 'BKK', station_name: 'Bangkok Central Depot' },
        { id: 4, driver_id: 'DR-0011', name: 'Narong T.', phone: '083-222-1100', truck_id: 'TK-11', station_code: 'CNX', station_name: 'Chiang Mai Station' }
      ],
      source: 'fallback-demo'
    });
  }

  // -------------------------------------------------------------
  // 2. POST /api/drivers (Create new Driver Account)
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const {
      driverId,
      pin = '123456',
      name,
      phone = '',
      truckId = null,
      stationCode = 'BKK'
    } = body || {};

    const cleanDriverId = String(driverId || '').trim().toUpperCase();
    const cleanPin = String(pin || '').trim();
    const cleanName = String(name || '').trim();

    if (!cleanDriverId || !cleanName) {
      return res.status(400).json({ error: 'Driver ID and Full Name are required.' });
    }

    if (cleanPin.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
    }

    if (sql) {
      try {
        const rows = await sql`
          INSERT INTO users (username, password, role, name, phone, truck_id, station_code)
          VALUES (
            ${cleanDriverId},
            ${cleanPin},
            'driver',
            ${cleanName},
            ${phone},
            ${truckId || null},
            ${stationCode || null}
          )
          RETURNING id, username as driver_id, name, phone, truck_id, station_code, role, created_at
        `;

        // If a truck is assigned, update that truck's driver name
        if (truckId) {
          await sql`
            UPDATE trucks
            SET driver_name = ${cleanName},
                updated_at = NOW()
            WHERE id = ${truckId}
          `;
        }

        return res.status(201).json({
          success: true,
          driver: rows[0],
          message: `Driver ${cleanDriverId} created in Neon PostgreSQL. Ready to login!`,
          source: 'neon-postgresql'
        });
      } catch (err) {
        if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
          return res.status(409).json({ error: `Driver ID '${cleanDriverId}' already exists.` });
        }
        console.warn('Neon drivers POST error, using fallback:', err.message);
      }
    }

    // Fallback response
    return res.status(201).json({
      success: true,
      driver: {
        id: Date.now(),
        driver_id: cleanDriverId,
        name: cleanName,
        phone,
        truck_id: truckId,
        station_code: stationCode,
        role: 'driver'
      },
      message: `Driver ${cleanDriverId} created (fallback)`,
      source: 'fallback-demo'
    });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
