import { getSql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getSql();

  // ==========================================
  // GET: Fetch status audit logs for a parcel
  // ==========================================
  if (req.method === 'GET') {
    const trackingNo = (req.query?.tn || req.query?.tracking || 'SR-2609-118245').trim().toUpperCase();

    if (sql) {
      try {
        const parcels = await sql`
          SELECT p.*, s.name as current_station_name
          FROM parcels p
          LEFT JOIN stations s ON p.current_station_code = s.code
          WHERE p.tracking_number = ${trackingNo}
          LIMIT 1
        `;

        const logs = await sql`
          SELECT * FROM parcel_status_logs
          WHERE tracking_number = ${trackingNo}
          ORDER BY created_at DESC, id DESC
        `;

        return res.status(200).json({
          success: true,
          trackingNumber: trackingNo,
          parcel: parcels[0] || null,
          logs: logs,
          count: logs.length,
          source: 'neon-postgresql'
        });
      } catch (err) {
        console.warn('Neon query error in parcel-logs GET, using fallback:', err.message);
      }
    }

    // Fallback Mock Data
    const fallbackLogs = [
      {
        id: 3,
        tracking_number: trackingNo,
        old_status: 'in-transit',
        new_status: trackingNo.includes('HOLD') || trackingNo === 'SR-2609-118245' ? 'exception' : 'delivered',
        station_code: 'NSN',
        station_name: 'ศูนย์ฮับนครสวรรค์ (NSN Hub)',
        updated_by: 'Somchai (NSN Staff)',
        action: trackingNo.includes('HOLD') || trackingNo === 'SR-2609-118245' ? 'EXCEPTION_FLAG' : 'HUB_OFFLOAD',
        note: trackingNo.includes('HOLD') || trackingNo === 'SR-2609-118245' 
          ? 'เส้นทางสายเหนือได้รับผลกระทบจากน้ำท่วม พักพัสดุไว้ชั่วคราวเพื่อความปลอดภัย'
          : 'สแกนยกลงพักในคลังสินค้าศูนย์ฮับเรียบร้อย พร้อมจัดส่งขั้นตอนสุดท้าย',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 2,
        tracking_number: trackingNo,
        old_status: 'pending',
        new_status: 'in-transit',
        station_code: 'WNI',
        station_name: 'ศูนย์คัดแยกวังน้อย (WNI)',
        updated_by: 'Wichai (WNI Staff)',
        action: 'STATUS_UPDATE',
        note: 'คัดแยกเสร็จสิ้น โหลดขึ้นรถขนส่งสายเหนือ (TK-19)',
        created_at: new Date(Date.now() - 14400000).toISOString()
      },
      {
        id: 1,
        tracking_number: trackingNo,
        old_status: null,
        new_status: 'pending',
        station_code: 'BKK',
        station_name: 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)',
        updated_by: 'System Intake',
        action: 'INTAKE',
        note: 'รับพัสดุเข้าสู่ระบบ devdo Express เรียบร้อย พิมพ์ใบนำส่ง',
        created_at: new Date(Date.now() - 28800000).toISOString()
      }
    ];

    return res.status(200).json({
      success: true,
      trackingNumber: trackingNo,
      parcel: {
        tracking_number: trackingNo,
        status: trackingNo.includes('HOLD') || trackingNo === 'SR-2609-118245' ? 'exception' : 'in-transit',
        route: 'BKK → CNX',
        current_station_code: 'NSN'
      },
      logs: fallbackLogs,
      count: fallbackLogs.length,
      source: 'fallback-demo'
    });
  }

  // ==========================================
  // POST: Update parcel status & record audit log
  // ==========================================
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const {
      trackingNumber,
      newStatus,
      stationCode = 'NSN',
      stationName = 'ศูนย์ฮับนครสวรรค์ (NSN Hub)',
      updatedBy = 'Staff',
      action = 'STATUS_UPDATE',
      note = ''
    } = body || {};

    if (!trackingNumber || !newStatus) {
      return res.status(400).json({ error: 'trackingNumber and newStatus are required.' });
    }

    const cleanTn = String(trackingNumber).trim().toUpperCase();
    const cleanStatus = String(newStatus).trim().toLowerCase();

    if (sql) {
      try {
        // 1. Get current parcel info
        const existing = await sql`
          SELECT * FROM parcels WHERE tracking_number = ${cleanTn} LIMIT 1
        `;

        const oldStatus = existing.length > 0 ? existing[0].status : 'unknown';

        // 2. Update parcel status & station
        await sql`
          UPDATE parcels
          SET 
            status = ${cleanStatus},
            current_station_code = ${stationCode},
            updated_at = NOW()
          WHERE tracking_number = ${cleanTn}
        `;

        // 3. Insert audit log into parcel_status_logs
        const logResult = await sql`
          INSERT INTO parcel_status_logs (
            tracking_number, old_status, new_status, station_code, station_name, updated_by, action, note
          ) VALUES (
            ${cleanTn}, ${oldStatus}, ${cleanStatus}, ${stationCode}, ${stationName}, ${updatedBy}, ${action}, ${note}
          )
          RETURNING *
        `;

        // 4. Also insert into parcel_events for customer tracking visibility
        const timeNow = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const dateNow = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const timeStr = `${dateNow}, ${timeNow}`;
        
        let eventKind = 'done';
        let eventTitle = 'อัปเดตสถานะพัสดุ';

        if (cleanStatus === 'delivered') {
          eventKind = 'done';
          eventTitle = 'นำจ่ายพัสดุสำเร็จ / Delivered';
        } else if (cleanStatus === 'exception') {
          eventKind = 'exception';
          eventTitle = 'พัสดุพบปัญหา / Exception Hold';
        } else if (cleanStatus === 'in-transit') {
          eventKind = 'active';
          eventTitle = 'อยู่ระหว่างขนส่ง / In Transit';
        } else if (cleanStatus === 'pending') {
          eventKind = 'pending';
          eventTitle = 'รอดำเนินการ / Staged';
        }

        await sql`
          INSERT INTO parcel_events (
            tracking_number, kind, title, station_name, time_str, note, seq_order
          ) VALUES (
            ${cleanTn}, ${eventKind}, ${eventTitle}, ${stationName}, ${timeStr}, ${note || 'ปรับปรุงสถานะโดยเจ้าหน้าที่'}, 8
          )
        `;

        return res.status(200).json({
          success: true,
          trackingNumber: cleanTn,
          oldStatus,
          newStatus: cleanStatus,
          log: logResult[0],
          message: `Parcel ${cleanTn} status updated to ${cleanStatus}`,
          source: 'neon-postgresql'
        });
      } catch (err) {
        console.warn('Neon status update error, returning fallback:', err.message);
      }
    }

    // Fallback response if DB is offline
    return res.status(200).json({
      success: true,
      trackingNumber: cleanTn,
      oldStatus: 'in-transit',
      newStatus: cleanStatus,
      log: {
        id: Date.now(),
        tracking_number: cleanTn,
        old_status: 'in-transit',
        new_status: cleanStatus,
        station_code: stationCode,
        station_name: stationName,
        updated_by: updatedBy,
        action,
        note,
        created_at: new Date().toISOString()
      },
      message: `Parcel ${cleanTn} status updated to ${cleanStatus}`,
      source: 'fallback-demo'
    });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
