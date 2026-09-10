import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getSql();

  // -------------------------------------------------------------
  // 1. GET /api/stations
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    if (sql) {
      try {
        const stations = await sql`SELECT * FROM stations ORDER BY id ASC`;
        return res.status(200).json({ stations, source: 'neon-postgresql' });
      } catch (err) {
        console.warn('Neon query error, using fallback:', err.message);
      }
    }

    // Fallback stations
    return res.status(200).json({
      stations: [
        { code: 'BKK', name: 'Bangkok Central Depot', status: 'busy', on_hand_parcels: 118, bays_in_use: '6 / 8', next_departure: 'TK-03 · 10:00', supervisor: 'Somchai P.', note: 'Loading TK-03 for Chiang Mai' },
        { code: 'WNI', name: 'Wang Noi Sorting Center', status: 'open', on_hand_parcels: 64, bays_in_use: '3 / 6', next_departure: 'TK-22 arr. 10:20', supervisor: 'Nattapong R.', note: 'Normal operations' },
        { code: 'NSN', name: 'Nakhon Sawan Hub', status: 'closed', on_hand_parcels: 89, bays_in_use: '4 / 4', next_departure: 'Held · road closed', supervisor: 'Anan Suksomboon', note: '42 parcels waiting on TK-19' },
        { code: 'LPG', name: 'Lampang Hub', status: 'open', on_hand_parcels: 37, bays_in_use: '2 / 4', next_departure: 'TK-11 arr. 09:55', supervisor: 'Kanya W.', note: 'Normal operations' },
        { code: 'CNX', name: 'Chiang Mai Delivery Station', status: 'open', on_hand_parcels: 41, bays_in_use: '2 / 5', next_departure: 'TK-11 · 13:00', supervisor: 'Pimchanok S.', note: '12 out for delivery' },
      ],
      source: 'fallback-demo'
    });
  }

  // -------------------------------------------------------------
  // 2. POST /api/stations (Create New Station)
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const {
      code,
      name,
      status = 'open',
      onHandParcels = 0,
      baysInUse = '2 / 4',
      nextDeparture = 'Standby',
      supervisor = 'Station Lead',
      note = ''
    } = body || {};

    const cleanCode = String(code || '').trim().toUpperCase();
    const cleanName = String(name || '').trim();

    if (!cleanCode || !cleanName) {
      return res.status(400).json({ error: 'Station code and name are required.' });
    }

    if (sql) {
      try {
        const rows = await sql`
          INSERT INTO stations (code, name, status, on_hand_parcels, bays_in_use, next_departure, supervisor, note)
          VALUES (
            ${cleanCode},
            ${cleanName},
            ${status},
            ${Number(onHandParcels) || 0},
            ${baysInUse},
            ${nextDeparture},
            ${supervisor},
            ${note}
          )
          RETURNING *
        `;

        return res.status(201).json({
          success: true,
          station: rows[0],
          message: `Station ${cleanCode} added to Neon PostgreSQL`,
          source: 'neon-postgresql'
        });
      } catch (err) {
        if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
          return res.status(409).json({ error: `Station code '${cleanCode}' already exists.` });
        }
        console.warn('Neon stations POST error, using fallback:', err.message);
      }
    }

    // Fallback response
    return res.status(201).json({
      success: true,
      station: {
        id: Date.now(),
        code: cleanCode,
        name: cleanName,
        status,
        on_hand_parcels: Number(onHandParcels) || 0,
        bays_in_use: baysInUse,
        next_departure: nextDeparture,
        supervisor,
        note
      },
      message: `Station ${cleanCode} added (fallback)`,
      source: 'fallback-demo'
    });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
