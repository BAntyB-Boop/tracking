import { getSql } from '../api/db.js';

async function cleanAndResetParcel() {
  const sql = getSql();
  if (!sql) {
    console.error('No database connection');
    process.exit(1);
  }

  const tn = 'SR-2609-118245';
  console.log(`🧹 Cleaning up and re-seeding realistic data for ${tn}...`);

  // 1. Delete all duplicate events for this parcel
  await sql`DELETE FROM parcel_events WHERE tracking_number = ${tn}`;
  console.log('✅ Cleared duplicate parcel_events');

  // 2. Delete all duplicate status logs for this parcel
  await sql`DELETE FROM parcel_status_logs WHERE tracking_number = ${tn}`;
  console.log('✅ Cleared duplicate parcel_status_logs');

  // 3. Reset parcel attributes in parcels table
  await sql`
    UPDATE parcels
    SET
      route = 'Bangkok → Chiang Mai',
      current_station_code = 'NSN',
      truck_id = 'TK-19',
      status = 'exception',
      eta = 'Fri 12 Sep, by 18:00',
      recipient_name = 'Somchai P.',
      service_type = 'Road, 2 days',
      weight_kg = 4.20,
      signature_required = TRUE,
      signature_info = 'Required on delivery',
      delay_title = 'การจัดส่งล่าช้ากว่ากำหนดประมาณ 1 วัน (Delayed ~1 Day)',
      delay_body = 'ทางหลวงหมายเลข 1 ช่วงนครสวรรค์-ลำปาง น้ำท่วมทางสัญจร พัสดุของคุณถูกเก็บรักษาอย่างปลอดภัย ณ ศูนย์ฮับนครสวรรค์ และจะออกเดินทางในเที่ยวรถแรกทันทีที่เปิดเส้นทาง',
      updated_at = NOW()
    WHERE tracking_number = ${tn}
  `;
  console.log('✅ Reset parcel table row for ' + tn);

  // 4. Insert clean, realistic 10-step tracking timeline (6 completed + 4 pending)
  await sql`
    INSERT INTO parcel_events (tracking_number, kind, title, station_name, time_str, note, seq_order) VALUES
    (${tn}, 'done', 'เข้ารับพัสดุเรียบร้อย (Picked up)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 14:32', 'พัสดุเข้าสู่ระบบ devdo Express เรียบร้อยแล้ว', 1),
    (${tn}, 'done', 'พัสดุออกจากคลังสินค้า (Left the depot)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 16:10', 'ส่งต่อไปยังศูนย์คัดแยกวังน้อยเพื่อรวมเที่ยวขนส่ง', 2),
    (${tn}, 'done', 'ถึงศูนย์คัดแยก (Arrived at sorting center)', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 17:25', 'ผ่านการชั่งน้ำหนัก ตรวจสอบขนาดกล่อง และคัดแยกสายเหนือ', 3),
    (${tn}, 'done', 'ออกจากศูนย์คัดแยก (Left sorting center)', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 21:40', 'ขึ้นรถบรรทุกสายเหนือ TK-19 มุ่งหน้าสู่ศูนย์ฮับนครสวรรค์', 4),
    (${tn}, 'done', 'ถึงศูนย์ฮับนครสวรรค์ (Arrived at Hub)', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '10 ก.ย., 02:15', 'รถขนส่ง TK-19 เข้าเทียบช่องจอด Bay 4 ประจำศูนย์ฮับนครสวรรค์', 5),
    (${tn}, 'exception', 'พักสินค้าชั่วคราว (Held at station)', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '10 ก.ย., 08:02', 'ทางหลวงหมายเลข 1 ปิดการจราจรเนื่องจากน้ำท่วม พักสินค้าในคลังศูนย์ฮับเพื่อความปลอดภัย', 6),
    (${tn}, 'pending', 'ศูนย์ฮับลำปาง (Arrive at Lampang Hub)', 'ศูนย์ฮับลำปาง (LPG Hub)', 'กำหนดการถัดไป', 'ออกเดินทางต่อทันทีที่ระดับน้ำลดและเปิดเส้นทาง', 7),
    (${tn}, 'pending', 'ศูนย์กระจายสินค้าเชียงใหม่', 'สถานีปลายทางเชียงใหม่ (CNX)', 'กำหนดการถัดไป', 'คัดแยกเตรียมส่งมอบให้พนักงานกระจายสินค้าในพื้นที่', 8),
    (${tn}, 'pending', 'พนักงานกำลังนำจ่าย (Out for delivery)', 'ตำบลสุเทพ / นิมมานเหมินท์ เชียงใหม่', 'กำหนดการถัดไป', 'พนักงานจะโทรติดต่อผู้รับก่อนเข้าส่งมอบพัสดุ', 9),
    (${tn}, 'pending', 'นำจ่ายสำเร็จ (Delivered)', 'ตำบลสุเทพ / นิมมานเหมินท์ เชียงใหม่', 'กำหนดการถัดไป', 'ลงลายมือชื่อผู้รับพัสดุ Somchai P.', 10)
  `;
  console.log('✅ Inserted 10 clean, realistic milestone events into parcel_events');

  // 5. Insert clean, realistic status audit logs (3 logs representing the real-world history)
  await sql`
    INSERT INTO parcel_status_logs (tracking_number, old_status, new_status, station_code, station_name, updated_by, action, note, created_at) VALUES
    (${tn}, NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'รับพัสดุเข้าระบบ ออกรหัสบาร์โค้ด และพิมพ์ใบนำส่งสินค้า', NOW() - INTERVAL '44 hours'),
    (${tn}, 'pending', 'in-transit', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Wichai (WNI Staff)', 'STATUS_UPDATE', 'คัดแยกเสร็จสิ้น โหลดขึ้นรถขนส่งสายเหนือ (TK-19)', NOW() - INTERVAL '38 hours'),
    (${tn}, 'in-transit', 'exception', 'NSN', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', 'Somchai (NSN Staff)', 'EXCEPTION_FLAG', 'ทางหลวงหมายเลข 1 น้ำท่วม พักพัสดุไว้ในคลังศูนย์ฮับชั่วคราวเพื่อความปลอดภัย', NOW() - INTERVAL '26 hours')
  `;
  console.log('✅ Inserted 3 clean, realistic status logs into parcel_status_logs');

  // Verify
  const verifyEvents = await sql`SELECT count(*) FROM parcel_events WHERE tracking_number = ${tn}`;
  const verifyLogs = await sql`SELECT count(*) FROM parcel_status_logs WHERE tracking_number = ${tn}`;
  console.log(`\n🎉 Verification complete! ${tn} now has ${verifyEvents[0].count} events and ${verifyLogs[0].count} status logs.`);
}

cleanAndResetParcel().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
