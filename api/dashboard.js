import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getSql();

  if (sql) {
    try {
      const trucks = await sql`SELECT * FROM trucks ORDER BY id ASC`;
      const exceptions = await sql`SELECT * FROM exceptions WHERE status = 'open' ORDER BY id DESC`;

      return res.status(200).json({
        kpis: [
          { label: 'In transit', value: '312', note: '18 trucks on the corridor', color: '#0b1c30' },
          { label: 'Delivered today', value: '47', note: 'Of 96 due · 49%', color: '#16A34A' },
          { label: 'Exceptions', value: exceptions.length.toString(), note: '2 weather, 1 address', color: '#E11D48' },
          { label: 'On-time rate', value: '96.2%', note: 'Last 7 days', color: '#0b1c30' },
        ],
        trucks: trucks,
        exceptions: exceptions,
        source: 'neon-postgresql'
      });
    } catch (err) {
      console.warn('Neon query error, using fallback:', err.message);
    }
  }

  // Fallback
  return res.status(200).json({
    kpis: [
      { label: 'In transit', value: '312', note: '18 trucks on the corridor', color: '#0b1c30' },
      { label: 'Delivered today', value: '47', note: 'Of 96 due · 49%', color: '#16A34A' },
      { label: 'Exceptions', value: '3', note: '2 weather, 1 address', color: '#E11D48' },
      { label: 'On-time rate', value: '96.2%', note: 'Last 7 days', color: '#0b1c30' },
    ],
    trucks: [
      { id: 'TK-19', leg: 'Nakhon Sawan → Lampang', progress_pct: 0, parcels_count: 42, next_checkin: 'Nakhon Sawan, 09:30', status: 'hold' },
      { id: 'TK-07', leg: 'Wang Noi → Nakhon Sawan', progress_pct: 64, parcels_count: 38, next_checkin: 'Nakhon Sawan, 11:10', status: 'in-transit' },
      { id: 'TK-22', leg: 'Bangkok → Wang Noi', progress_pct: 31, parcels_count: 55, next_checkin: 'Wang Noi, 10:20', status: 'in-transit' },
      { id: 'TK-11', leg: 'Chiang Mai → Lampang', progress_pct: 88, parcels_count: 27, next_checkin: 'Lampang, 09:55', status: 'in-transit' },
      { id: 'TK-03', leg: 'Bangkok Central Depot', progress_pct: 100, parcels_count: 61, next_checkin: 'Departs 10:00', status: 'pending' },
    ],
    exceptions: [
      { code: 'EX-2031', time_str: '08:02', title: 'Highway 1 closed, Nakhon Sawan – Lampang', detail: 'TK-19 held at Nakhon Sawan Bay 4. 42 parcels affected.' },
      { code: 'EX-2030', time_str: '07:15', title: 'Address revision needed', detail: 'SR-2609-118102 · recipient unreachable in Nimman.' },
      { code: 'EX-2029', time_str: '09 Sep, 22:40', title: 'Weather detour, Wang Noi', detail: 'TK-07 rerouted via Route 32, +45 min.' },
    ],
    source: 'fallback-demo'
  });
}
