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

  const { role = 'staff', uid = '', pw = '' } = body || {};
  const cleanUid = String(uid).trim();
  const cleanPw = String(pw).trim();

  if (!cleanUid || !cleanPw) {
    return res.status(400).json({
      error: role === 'driver' ? 'Enter your driver ID and PIN.' : 'Enter your SwiftRoute ID and password.'
    });
  }

  const sql = getSql();
  if (sql) {
    try {
      const users = await sql`
        SELECT * FROM users
        WHERE LOWER(username) = LOWER(${cleanUid})
          AND role = ${role}
        LIMIT 1
      `;

      if (users.length > 0) {
        const user = users[0];
        if (user.password === cleanPw) {
          const isDriver = user.role === 'driver';
          return res.status(200).json({
            success: true,
            user: {
              id: user.username,
              role: user.role,
              name: user.name,
              phone: user.phone || null,
              truckId: user.truck_id || (isDriver ? 'TK-19' : null),
              stationCode: user.station_code || null,
              isAdmin: (user.username && user.username.toLowerCase() === 'admin') || user.station_code === 'ALL' || user.role === 'admin'
            },
            redirectUrl: isDriver ? 'admin.html?screen=checkin' : 'admin.html',
            source: 'neon-postgresql'
          });
        }
      }

      // If user not found or password mismatched in DB
      return res.status(401).json({
        error: role === 'driver' ? 'Invalid Driver ID or PIN.' : 'Invalid SwiftRoute ID or password.'
      });
    } catch (err) {
      console.warn('Neon login error, trying fallback:', err.message);
    }
  }

  // Fallback authentication if DB is unreachable
  const isDriver = role === 'driver';
  const FALLBACK_USERS = {
    'dr-0419': { name: 'Anan Suksomboon', role: 'driver', pw: '123456', truckId: 'TK-19', stationCode: 'NSN' },
    'k.okoro': { name: 'K. Okoro', role: 'staff', pw: 'secret', stationCode: 'BKK' },
    'somchai.p': { name: 'Somchai Prasert', role: 'staff', pw: 'pass1234', stationCode: 'BKK' },
    'anan.s': { name: 'Anan Suksomboon', role: 'staff', pw: 'pass1234', stationCode: 'NSN' },
    'staff.nsn': { name: 'Somchai Nakhon Sawan', role: 'staff', pw: 'pass1234', stationCode: 'NSN' },
    'staff.wni': { name: 'Wichai Wang Noi', role: 'staff', pw: 'pass1234', stationCode: 'WNI' },
    'staff.lpg': { name: 'Kamonwan Lampang', role: 'staff', pw: 'pass1234', stationCode: 'LPG' },
    'staff.cnx': { name: 'Narong Chiang Mai', role: 'staff', pw: 'pass1234', stationCode: 'CNX' },
    'admin': { name: 'System Administrator', role: 'staff', pw: 'admin1234', stationCode: 'ALL', isAdmin: true }
  };

  const matched = FALLBACK_USERS[cleanUid.toLowerCase()];
  if (matched && matched.role === role && matched.pw === cleanPw) {
    return res.status(200).json({
      success: true,
      user: {
        id: cleanUid,
        role: matched.role,
        name: matched.name,
        truckId: matched.truckId || null,
        stationCode: matched.stationCode || 'NSN',
        isAdmin: !!matched.isAdmin
      },
      redirectUrl: isDriver ? 'admin.html?screen=checkin' : 'admin.html',
      source: 'fallback-demo'
    });
  }

  return res.status(401).json({
    error: role === 'driver' ? 'Invalid Driver ID or PIN.' : 'Invalid SwiftRoute ID or password.'
  });
}
