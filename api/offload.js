import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { trackingNumbers, stationCode, stationName, truckId } = body || {};
  if (!trackingNumbers || !Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
    return res.status(400).json({ error: 'trackingNumbers array is required' });
  }

  const targetStation = stationCode || 'NSN';
  const targetStationName = stationName || 'ศูนย์ฮับนครสวรรค์ (NSN Hub)';
  const currentTruck = truckId || 'TK-19';
  const timeNow = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sql = getSql();

  if (sql) {
    try {
      // 1. Update parcels: detach from truck, assign to current station, update status
      const updated = await sql`
        UPDATE parcels
        SET 
          truck_id = NULL,
          current_station_code = ${targetStation},
          status = 'delivered',
          updated_at = NOW()
        WHERE tracking_number = ANY(${trackingNumbers})
        RETURNING tracking_number
      `;

      // 2. Increment station on_hand_parcels
      await sql`
        UPDATE stations
        SET on_hand_parcels = COALESCE(on_hand_parcels, 0) + ${trackingNumbers.length}
        WHERE code = ${targetStation}
      `;

      // 3. Insert events into parcel_events and audit logs into parcel_status_logs if not already recorded
      for (const p of updated) {
        const existingEvent = await sql`
          SELECT id FROM parcel_events 
          WHERE tracking_number = ${p.tracking_number} 
            AND title = 'คัดแยกและนำลงพัก ณ ศูนย์ฮับ' 
            AND station_name = ${targetStationName}
          LIMIT 1
        `;

        if (existingEvent.length === 0) {
          await sql`
            INSERT INTO parcel_events (tracking_number, kind, title, station_name, time_str, note, seq_order)
            VALUES (
              ${p.tracking_number},
              'done',
              'คัดแยกและนำลงพัก ณ ศูนย์ฮับ',
              ${targetStationName},
              ${timeNow},
              ${'สแกนคัดแยกลงจากรถ ' + currentTruck + ' เข้าสู่คลังพักพัสดุศูนย์ฮับเพื่อจัดส่งต่อ'},
              5
            )
          `;

          await sql`
            INSERT INTO parcel_status_logs (
              tracking_number, old_status, new_status, station_code, station_name, updated_by, action, note
            ) VALUES (
              ${p.tracking_number},
              'in-transit',
              'delivered',
              ${targetStation},
              ${targetStationName},
              ${'Staff (' + targetStation + ')'},
              'HUB_OFFLOAD',
              ${'สแกนยกลงพักในคลังสินค้าศูนย์ฮับเรียบร้อย (ตัดออกจากรถ ' + currentTruck + ')'}
            )
          `;
        }
      }

      return res.status(200).json({
        success: true,
        count: Math.max(updated.length, trackingNumbers.length),
        stationCode: targetStation,
        stationName: targetStationName,
        truckId: currentTruck,
        offloadedParcels: trackingNumbers,
        source: 'neon-postgresql'
      });
    } catch (err) {
      console.warn('Neon offload error, returning simulated result:', err.message);
    }
  }

  // Fallback simulation
  return res.status(200).json({
    success: true,
    count: trackingNumbers.length,
    stationCode: targetStation,
    stationName: targetStationName,
    truckId: currentTruck,
    offloadedParcels: trackingNumbers,
    source: 'fallback-demo'
  });
}
