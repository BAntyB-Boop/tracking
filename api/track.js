import { getSql } from './db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const trackingNo = (req.query?.tn || req.query?.tracking || 'SR-2609-118245').trim().toUpperCase();
  const sql = getSql();

  if (sql) {
    try {
      const parcels = await sql`
        SELECT p.*, s.name as current_station_name, s.note as current_station_note
        FROM parcels p
        LEFT JOIN stations s ON p.current_station_code = s.code
        WHERE p.tracking_number = ${trackingNo}
      `;

      if (parcels.length > 0) {
        const events = await sql`
          SELECT * FROM parcel_events
          WHERE tracking_number = ${trackingNo}
          ORDER BY seq_order ASC, id ASC
        `;

        return res.status(200).json({
          parcel: parcels[0],
          events: events,
          source: 'neon-postgresql'
        });
      }
    } catch (err) {
      console.warn('Neon query error, falling back to mock:', err.message);
    }
  }

  // Fallback / Mock Data if database is not seeded yet or tracking number is demo
  const isDelivered = trackingNo.includes('DELIVER') || trackingNo.includes('DONE');
  const isException = trackingNo.includes('HOLD') || trackingNo.includes('EX') || trackingNo === 'SR-2609-118245';

  const baseEvents = [
    { kind: 'done', title: 'Picked up', station_name: 'Bangkok Central Depot', time_str: '09 Sep, 14:32', note: 'Your parcel is with SwiftRoute.' },
    { kind: 'done', title: 'Left the depot', station_name: 'Bangkok Central Depot', time_str: '09 Sep, 16:10', note: '' },
    { kind: 'done', title: 'Arrived at station', station_name: 'Wang Noi Sorting Center', time_str: '09 Sep, 17:25', note: '' },
    { kind: 'done', title: 'Left the station', station_name: 'Wang Noi Sorting Center', time_str: '09 Sep, 21:40', note: 'On truck TK-19 heading to Nakhon Sawan.' },
  ];

  let status = 'in-transit';
  let eta = 'Thu 11 Sep, by 18:00';
  let currentStation = 'Nakhon Sawan Hub';
  let events = [];
  let alert = null;

  if (isDelivered) {
    status = 'delivered';
    eta = '11 Sep, 12:47';
    currentStation = 'Nimman, Mueang Chiang Mai';
    events = [
      ...baseEvents,
      { kind: 'done', title: 'Arrived at station', station_name: 'Nakhon Sawan Hub', time_str: '10 Sep, 02:15', note: '' },
      { kind: 'done', title: 'Left the station', station_name: 'Nakhon Sawan Hub', time_str: '10 Sep, 06:30', note: '' },
      { kind: 'done', title: 'Arrived at station', station_name: 'Lampang Hub', time_str: '10 Sep, 11:05', note: '' },
      { kind: 'done', title: 'Arrived at station', station_name: 'Chiang Mai Delivery Station', time_str: '10 Sep, 15:20', note: '' },
      { kind: 'done', title: 'Out for delivery', station_name: 'Nimman, Mueang Chiang Mai', time_str: '11 Sep, 08:30', note: '' },
      { kind: 'done', title: 'Delivered', station_name: 'Nimman, Mueang Chiang Mai', time_str: '11 Sep, 12:47', note: 'Signed for by Somchai P. at the front desk.' },
    ];
  } else if (isException) {
    status = 'exception';
    eta = 'Fri 12 Sep, by 18:00';
    currentStation = 'Nakhon Sawan Hub';
    alert = {
      title: 'Your delivery is delayed by about a day',
      body: 'Flooding has closed Highway 1 between Nakhon Sawan and Lampang. Your parcel is safe at Nakhon Sawan Hub and will leave on the first truck once the road reopens.'
    };
    events = [
      ...baseEvents,
      { kind: 'done', title: 'Arrived at station', station_name: 'Nakhon Sawan Hub', time_str: '10 Sep, 02:15', note: '' },
      { kind: 'exception', title: 'Held at station', station_name: 'Nakhon Sawan Hub', time_str: '10 Sep, 08:02', note: 'Flooding has closed Highway 1 to Lampang. We will move your parcel as soon as it reopens.' },
      { kind: 'pending', title: 'Arrived at station', station_name: 'Lampang Hub', time_str: 'Upcoming', note: '' },
      { kind: 'pending', title: 'Arrived at station', station_name: 'Chiang Mai Delivery Station', time_str: 'Upcoming', note: '' },
      { kind: 'pending', title: 'Out for delivery', station_name: 'Nimman, Mueang Chiang Mai', time_str: 'Upcoming', note: '' },
      { kind: 'pending', title: 'Delivered', station_name: 'Nimman, Mueang Chiang Mai', time_str: 'Upcoming', note: '' },
    ];
  } else {
    events = [
      ...baseEvents,
      { kind: 'active', title: 'Arrived at station', station_name: 'Nakhon Sawan Hub', time_str: '10 Sep, 02:15', note: 'Sorting for the next truck to Lampang.' },
      { kind: 'pending', title: 'Arrived at station', station_name: 'Lampang Hub', time_str: 'Upcoming', note: '' },
      { kind: 'pending', title: 'Arrived at station', station_name: 'Chiang Mai Delivery Station', time_str: 'Upcoming', note: '' },
      { kind: 'pending', title: 'Out for delivery', station_name: 'Nimman, Mueang Chiang Mai', time_str: 'Upcoming', note: '' },
      { kind: 'pending', title: 'Delivered', station_name: 'Nimman, Mueang Chiang Mai', time_str: 'Upcoming', note: '' },
    ];
  }

  return res.status(200).json({
    parcel: {
      tracking_number: trackingNo,
      route: 'Bangkok → Chiang Mai',
      current_station_code: 'NSN',
      current_station_name: currentStation,
      status: status,
      eta: eta,
      recipient_name: 'Somchai P.',
      service_type: 'Road, 2 days',
      weight_kg: 4.20,
      signature_info: status === 'delivered' ? 'Received, Somchai P.' : 'Required on delivery',
      delay_title: alert?.title || null,
      delay_body: alert?.body || null
    },
    events: events,
    source: 'fallback-demo'
  });
}
