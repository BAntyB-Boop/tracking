import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getSql();

  // -----------------------------------------------------------
  // GET: List all manifests
  // -----------------------------------------------------------
  if (req.method === 'GET') {
    if (sql) {
      try {
        const manifests = await sql`
          SELECT 
            m.*,
            s1.name as origin_station_name,
            s2.name as destination_station_name
          FROM manifests m
          LEFT JOIN stations s1 ON m.origin_station_code = s1.code
          LEFT JOIN stations s2 ON m.destination_station_code = s2.code
          ORDER BY m.id DESC
        `;
        return res.status(200).json({ manifests, source: 'neon-postgresql' });
      } catch (err) {
        console.warn('Neon manifests GET error, using fallback:', err.message);
      }
    }

    // Mock fallback
    return res.status(200).json({
      manifests: [
        {
          id: 1,
          manifest_number: 'MF-2609-19',
          truck_id: 'TK-19',
          origin_station_code: 'NSN',
          destination_station_code: 'LPG',
          driver_name: 'Anan Suksomboon',
          departure_time: '09:30',
          parcels_count: 42,
          total_weight_kg: 178.50,
          status: 'loading',
          notes: 'Highway 1 flood detour standby',
          origin_station_name: 'Nakhon Sawan Hub',
          destination_station_name: 'Lampang Hub'
        },
        {
          id: 2,
          manifest_number: 'MF-2609-07',
          truck_id: 'TK-07',
          origin_station_code: 'WNI',
          destination_station_code: 'NSN',
          driver_name: 'Prasert M.',
          departure_time: '11:10',
          parcels_count: 38,
          total_weight_kg: 145.20,
          status: 'in-transit',
          notes: 'En route via Route 32',
          origin_station_name: 'Wang Noi Sorting Center',
          destination_station_name: 'Nakhon Sawan Hub'
        }
      ],
      source: 'fallback-demo'
    });
  }

  // -----------------------------------------------------------
  // POST: Create a new manifest
  // -----------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const {
      truckId = 'TK-03',
      originStationCode = 'BKK',
      destinationStationCode = 'CNX',
      driverName = 'Somchai P.',
      departureTime = '12:00',
      parcelsCount = 30,
      totalWeightKg = 120.0,
      notes = ''
    } = body || {};

    // Auto-generate manifest number if not provided (MF-YYMM-RANDOM)
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const manifestNumber = body?.manifestNumber || `MF-${yy}${mm}-${rnd}`;

    if (sql) {
      try {
        const rows = await sql`
          INSERT INTO manifests (
            manifest_number, truck_id, origin_station_code, destination_station_code,
            driver_name, departure_time, parcels_count, total_weight_kg, status, notes
          ) VALUES (
            ${manifestNumber}, ${truckId}, ${originStationCode}, ${destinationStationCode},
            ${driverName}, ${departureTime}, ${Number(parcelsCount) || 0}, ${Number(totalWeightKg) || 0},
            'scheduled', ${notes}
          )
          RETURNING *
        `;

        // Update truck's status and manifest association
        await sql`
          UPDATE trucks
          SET current_station_code = ${originStationCode},
              driver_name = ${driverName},
              parcels_count = ${Number(parcelsCount) || 0},
              next_checkin = ${departureTime},
              status = 'in-transit',
              updated_at = NOW()
          WHERE id = ${truckId}
        `;

        return res.status(201).json({
          success: true,
          manifest: rows[0],
          message: `Manifest ${manifestNumber} created successfully`,
          source: 'neon-postgresql'
        });
      } catch (err) {
        console.warn('Neon manifests POST error, using fallback:', err.message);
      }
    }

    // Fallback response if DB offline
    return res.status(201).json({
      success: true,
      manifest: {
        id: Date.now(),
        manifest_number: manifestNumber,
        truck_id: truckId,
        origin_station_code: originStationCode,
        destination_station_code: destinationStationCode,
        driver_name: driverName,
        departure_time: departureTime,
        parcels_count: Number(parcelsCount) || 0,
        total_weight_kg: Number(totalWeightKg) || 0,
        status: 'scheduled',
        notes: notes,
        created_at: new Date().toISOString()
      },
      message: `Manifest ${manifestNumber} created (fallback)`,
      source: 'fallback-demo'
    });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
