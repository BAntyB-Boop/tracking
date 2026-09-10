import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const filter = req.query?.filter || 'All';
  const query = (req.query?.q || '').toLowerCase().trim();
  const sql = getSql();

  if (sql) {
    try {
      let parcels = await sql`
        SELECT p.*, s.name as current_station_name
        FROM parcels p
        LEFT JOIN stations s ON p.current_station_code = s.code
        ORDER BY p.updated_at DESC
      `;

      if (filter !== 'All') {
        parcels = parcels.filter(p => p.status.toLowerCase() === filter.toLowerCase());
      }

      if (query) {
        parcels = parcels.filter(p => 
          p.tracking_number.toLowerCase().includes(query) ||
          p.route.toLowerCase().includes(query) ||
          (p.current_station_name && p.current_station_name.toLowerCase().includes(query)) ||
          (p.truck_id && p.truck_id.toLowerCase().includes(query))
        );
      }

      return res.status(200).json({
        total: 312,
        count: parcels.length,
        parcels: parcels,
        source: 'neon-postgresql'
      });
    } catch (err) {
      console.warn('Neon query error, using fallback:', err.message);
    }
  }

  // Fallback / Mock parcels
  const mockParcels = [
    { tracking_number: 'SR-2609-118245', route: 'Bangkok → Chiang Mai', current_station_name: 'Nakhon Sawan', truck_id: 'TK-19', status: 'exception', eta: '12 Sep, 18:00' },
    { tracking_number: 'SR-2609-118251', route: 'Bangkok → Chiang Mai', current_station_name: 'Nakhon Sawan', truck_id: 'TK-19', status: 'exception', eta: '12 Sep, 18:00' },
    { tracking_number: 'SR-2609-117890', route: 'Bangkok → Nakhon Sawan', current_station_name: 'Wang Noi', truck_id: 'TK-07', status: 'in-transit', eta: '10 Sep, 14:00' },
    { tracking_number: 'SR-2609-118102', route: 'Bangkok → Chiang Mai', current_station_name: 'Chiang Mai', truck_id: '—', status: 'exception', eta: 'On hold' },
    { tracking_number: 'SR-2609-116455', route: 'Chiang Mai → Bangkok', current_station_name: 'Chiang Mai', truck_id: 'TK-11', status: 'in-transit', eta: '11 Sep, 18:00' },
    { tracking_number: 'SR-2609-116301', route: 'Bangkok → Wang Noi', current_station_name: 'Wang Noi', truck_id: '—', status: 'delivered', eta: '10 Sep, 08:12' },
    { tracking_number: 'SR-2609-118404', route: 'Bangkok → Chiang Mai', current_station_name: 'Bangkok', truck_id: 'TK-03', status: 'pending', eta: '12 Sep, 18:00' },
    { tracking_number: 'SR-2609-115977', route: 'Wang Noi → Chiang Mai', current_station_name: 'Chiang Mai', truck_id: '—', status: 'delivered', eta: '09 Sep, 16:40' },
  ];

  let filtered = mockParcels;
  if (filter !== 'All') {
    filtered = filtered.filter(p => p.status.toLowerCase() === filter.toLowerCase());
  }
  if (query) {
    filtered = filtered.filter(p =>
      p.tracking_number.toLowerCase().includes(query) ||
      p.route.toLowerCase().includes(query) ||
      p.current_station_name.toLowerCase().includes(query) ||
      p.truck_id.toLowerCase().includes(query)
    );
  }

  return res.status(200).json({
    total: 312,
    count: filtered.length,
    parcels: filtered,
    source: 'fallback-demo'
  });
}
