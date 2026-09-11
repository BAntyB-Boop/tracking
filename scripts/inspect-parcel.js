import { getSql } from '../api/db.js';

async function runAudit() {
  const sql = getSql();
  if (!sql) return;

  await sql`DELETE FROM parcel_events WHERE tracking_number = 'SR-2609-118251' AND title = 'Arrived at station'`;
  await sql`DELETE FROM parcel_status_logs WHERE tracking_number = 'SR-2609-118251' AND action = 'DRIVER_CHECKIN'`;

  console.log('🔍 AUDITING ALL PARCELS IN DATABASE...\n');

  const parcels = await sql`SELECT tracking_number, route, status, current_station_code, truck_id, recipient_name FROM parcels ORDER BY tracking_number`;
  console.log(`Total parcels in 'parcels' table: ${parcels.length}`);

  // Check event counts and duplicate detection
  const eventStats = await sql`
    SELECT 
      p.tracking_number,
      p.status,
      COUNT(e.id) AS total_events,
      COUNT(DISTINCT CONCAT(e.title, '::', e.station_name, '::', e.time_str)) AS unique_events,
      COUNT(e.id) - COUNT(DISTINCT CONCAT(e.title, '::', e.station_name, '::', e.time_str)) AS duplicate_events
    FROM parcels p
    LEFT JOIN parcel_events e ON p.tracking_number = e.tracking_number
    GROUP BY p.tracking_number, p.status
    ORDER BY p.tracking_number ASC
  `;

  console.log('\n📦 Parcel Events Audit:');
  eventStats.forEach(s => console.log(` • ${s.tracking_number} | status: ${s.status.padEnd(11)} | events: ${s.total_events} (unique: ${s.unique_events}, dup: ${s.duplicate_events})`));

  // Check status logs
  const logStats = await sql`
    SELECT 
      p.tracking_number,
      p.status,
      COUNT(l.id) AS total_logs
    FROM parcels p
    LEFT JOIN parcel_status_logs l ON p.tracking_number = l.tracking_number
    GROUP BY p.tracking_number, p.status
    ORDER BY p.tracking_number ASC
  `;

  console.log('\n📋 Parcel Status Logs Audit:');
  console.table(logStats);

  console.log('\n--- OFFICIAL STATIONS ---');
  const stations = await sql`SELECT code, name, status, on_hand_parcels, bays_in_use, supervisor FROM stations ORDER BY code`;
  console.table(stations);

  console.log('\n--- OFFICIAL TRUCKS ---');
  const trucks = await sql`SELECT id, leg, progress_pct, parcels_count, status, current_station_code, driver_name FROM trucks ORDER BY id`;
  console.table(trucks);

  console.log('\n--- TESTING GET /api/track FOR ALL 8 PARCELS ---');
  const trackMod = await import('../api/track.js');
  for (const p of parcels) {
    let result = null;
    await trackMod.default({ query: { tn: p.tracking_number } }, {
      setHeader: () => {},
      status: () => ({ json: (d) => { result = d; } })
    });
    console.log(` • [${p.tracking_number}] status: ${result.parcel.status.padEnd(11)} | events: ${result.events.length} | current: ${result.parcel.current_station_name || result.parcel.current_station_code}`);
  }
}

runAudit().catch(console.error);
