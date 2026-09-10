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
              stationCode: user.station_code || null
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
  if ((isDriver && cleanUid === 'DR-0419' && cleanPw === '123456') ||
      (!isDriver && cleanUid.toLowerCase() === 'k.okoro' && cleanPw === 'secret')) {
    return res.status(200).json({
      success: true,
      user: {
        id: cleanUid,
        role: isDriver ? 'driver' : 'staff',
        name: isDriver ? 'Anan Suksomboon' : 'Somchai P.',
        truckId: isDriver ? 'TK-19' : null
      },
      redirectUrl: isDriver ? 'admin.html?screen=checkin' : 'admin.html',
      source: 'fallback-demo'
    });
  }

  return res.status(401).json({
    error: role === 'driver' ? 'Invalid Driver ID or PIN.' : 'Invalid SwiftRoute ID or password.'
  });
}
