import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const filter = req.query?.filter || 'All';
  const query = (req.query?.q || '').toLowerCase().trim();
  const sql = getSql();

  // Thai to English search keywords mapping
  const THAI_MAP = {
    'กรุงเทพ': 'bangkok',
    'กทม': 'bangkok',
    'วังน้อย': 'wang noi',
    'นครสวรรค์': 'nakhon sawan',
    'ลำปาง': 'lampang',
    'เชียงใหม่': 'chiang mai',
    'นิมมาน': 'nimman',
    'สมชาย': 'somchai',
    'อนันต์': 'anan',
    'กัญญารัตน์': 'kanyarat',
    'ณัฐยา': 'nattaya',
    'ศรัณย์': 'saran',
    'อรัญญา': 'aranya',
    'ธนากร': 'thanakorn',
    'ปรีชา': 'preecha',
    'กำลังจัดส่ง': 'in-transit',
    'กำลังส่ง': 'in-transit',
    'ขนส่ง': 'in-transit',
    'จัดส่งสำเร็จ': 'delivered',
    'สำเร็จ': 'delivered',
    'ส่งแล้ว': 'delivered',
    'มีปัญหา': 'exception',
    'ตกค้าง': 'exception',
    'ล่าช้า': 'exception',
    'รอดำเนินการ': 'pending'
  };

  // Expand search query with Thai mappings
  const searchTerms = [query];
  if (query) {
    for (const [th, en] of Object.entries(THAI_MAP)) {
      if (query.includes(th) || th.includes(query)) {
        searchTerms.push(en);
      }
    }
  }

  function matchesSearch(p) {
    if (!query) return true;
    const targets = [
      p.tracking_number || '',
      p.route || '',
      p.current_station_name || '',
      p.current_station_code || '',
      p.truck_id || '',
      p.recipient_name || '',
      p.status || ''
    ].map(s => String(s).toLowerCase());

    return searchTerms.some(term => targets.some(target => target.includes(term)));
  }

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
        parcels = parcels.filter(matchesSearch);
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
    { tracking_number: 'SR-2609-118245', route: 'Bangkok → Chiang Mai', current_station_name: 'Nakhon Sawan', truck_id: 'TK-19', status: 'exception', eta: '12 Sep, 18:00', recipient_name: 'Somchai P.' },
    { tracking_number: 'SR-2609-118251', route: 'Bangkok → Chiang Mai', current_station_name: 'Nakhon Sawan', truck_id: 'TK-19', status: 'exception', eta: '12 Sep, 18:00', recipient_name: 'Kanyarat S.' },
    { tracking_number: 'SR-2609-117890', route: 'Bangkok → Nakhon Sawan', current_station_name: 'Wang Noi', truck_id: 'TK-07', status: 'in-transit', eta: '10 Sep, 14:00', recipient_name: 'Boonsong K.' },
    { tracking_number: 'SR-2609-118102', route: 'Bangkok → Chiang Mai', current_station_name: 'Chiang Mai', truck_id: '—', status: 'exception', eta: 'On hold', recipient_name: 'Nattaya M.' },
    { tracking_number: 'SR-2609-116455', route: 'Chiang Mai → Bangkok', current_station_name: 'Chiang Mai', truck_id: 'TK-11', status: 'in-transit', eta: '11 Sep, 18:00', recipient_name: 'Saran P.' },
    { tracking_number: 'SR-2609-116301', route: 'Bangkok → Wang Noi', current_station_name: 'Wang Noi', truck_id: '—', status: 'delivered', eta: '10 Sep, 08:12', recipient_name: 'Aranya D.' },
    { tracking_number: 'SR-2609-118404', route: 'Bangkok → Chiang Mai', current_station_name: 'Bangkok', truck_id: 'TK-03', status: 'pending', eta: '12 Sep, 18:00', recipient_name: 'Thanakorn W.' },
    { tracking_number: 'SR-2609-115977', route: 'Wang Noi → Chiang Mai', current_station_name: 'Chiang Mai', truck_id: '—', status: 'delivered', eta: '09 Sep, 16:40', recipient_name: 'Preecha T.' },
  ];

  let filtered = mockParcels;
  if (filter !== 'All') {
    filtered = filtered.filter(p => p.status.toLowerCase() === filter.toLowerCase());
  }
  if (query) {
    filtered = filtered.filter(matchesSearch);
  }

  return res.status(200).json({
    total: 312,
    count: filtered.length,
    parcels: filtered,
    source: 'fallback-demo'
  });
}
