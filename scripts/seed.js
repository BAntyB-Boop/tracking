import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('\n❌ ERROR: DATABASE_URL environment variable is missing!');
  console.log('Please set DATABASE_URL in your .env file or environment.');
  console.log('Example: DATABASE_URL="postgresql://user:pass@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"\n');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function seed() {
  console.log('🚀 Connecting to Neon PostgreSQL and creating schema...');

  // 1. Drop existing tables if re-seeding
  await sql`DROP TABLE IF EXISTS manifests CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  await sql`DROP TABLE IF EXISTS parcel_status_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS parcel_events CASCADE`;
  await sql`DROP TABLE IF EXISTS parcels CASCADE`;
  await sql`DROP TABLE IF EXISTS exceptions CASCADE`;
  await sql`DROP TABLE IF EXISTS trucks CASCADE`;
  await sql`DROP TABLE IF EXISTS stations CASCADE`;

  // 2. Create tables
  await sql`
    CREATE TABLE stations (
      id SERIAL PRIMARY KEY,
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      on_hand_parcels INT DEFAULT 0,
      bays_in_use VARCHAR(20) DEFAULT '2 / 4',
      next_departure VARCHAR(100),
      supervisor VARCHAR(100),
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE trucks (
      id VARCHAR(20) PRIMARY KEY,
      leg VARCHAR(100) NOT NULL,
      progress_pct INT DEFAULT 0,
      parcels_count INT DEFAULT 0,
      next_checkin VARCHAR(100),
      status VARCHAR(20) DEFAULT 'in-transit',
      current_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
      driver_name VARCHAR(100),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE exceptions (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      time_str VARCHAR(50),
      title VARCHAR(200) NOT NULL,
      detail TEXT,
      status VARCHAR(20) DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE parcels (
      tracking_number VARCHAR(30) PRIMARY KEY,
      route VARCHAR(100) NOT NULL,
      current_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
      truck_id VARCHAR(20) REFERENCES trucks(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'in-transit',
      eta VARCHAR(100),
      recipient_name VARCHAR(100),
      service_type VARCHAR(50) DEFAULT 'Road, 2 days',
      weight_kg NUMERIC(6, 2) DEFAULT 4.20,
      signature_required BOOLEAN DEFAULT TRUE,
      signature_info VARCHAR(100) DEFAULT 'Required on delivery',
      delay_title VARCHAR(200),
      delay_body TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE parcel_events (
      id SERIAL PRIMARY KEY,
      tracking_number VARCHAR(30) REFERENCES parcels(tracking_number) ON DELETE CASCADE,
      kind VARCHAR(20) DEFAULT 'done',
      title VARCHAR(100) NOT NULL,
      station_name VARCHAR(100) NOT NULL,
      time_str VARCHAR(50) NOT NULL,
      note TEXT,
      seq_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE parcel_status_logs (
      id SERIAL PRIMARY KEY,
      tracking_number VARCHAR(30) REFERENCES parcels(tracking_number) ON DELETE CASCADE,
      old_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      station_code VARCHAR(10),
      station_name VARCHAR(100),
      updated_by VARCHAR(100) DEFAULT 'System',
      action VARCHAR(50) DEFAULT 'STATUS_CHANGE',
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      truck_id VARCHAR(20) REFERENCES trucks(id) ON DELETE SET NULL,
      station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE manifests (
      id SERIAL PRIMARY KEY,
      manifest_number VARCHAR(30) UNIQUE NOT NULL,
      truck_id VARCHAR(20) REFERENCES trucks(id) ON DELETE SET NULL,
      origin_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
      destination_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
      driver_name VARCHAR(100),
      departure_time VARCHAR(100),
      parcels_count INT DEFAULT 0,
      total_weight_kg NUMERIC(8, 2) DEFAULT 0.00,
      status VARCHAR(20) DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('✅ Tables created.');

  // 3. Seed Stations
  console.log('🌱 Seeding stations...');
  await sql`
    INSERT INTO stations (code, name, status, on_hand_parcels, bays_in_use, next_departure, supervisor, note) VALUES
    ('BKK', 'Bangkok Central Depot', 'busy', 118, '6 / 8', 'TK-03 · 10:00', 'Somchai P.', 'Loading TK-03 for Chiang Mai'),
    ('WNI', 'Wang Noi Sorting Center', 'open', 64, '3 / 6', 'TK-22 arr. 10:20', 'Nattapong R.', 'Normal operations'),
    ('NSN', 'Nakhon Sawan Hub', 'closed', 89, '4 / 4', 'Held · road closed', 'Anan Suksomboon', '42 parcels waiting on TK-19'),
    ('LPG', 'Lampang Hub', 'open', 37, '2 / 4', 'TK-11 arr. 09:55', 'Kanya W.', 'Normal operations'),
    ('CNX', 'Chiang Mai Delivery Station', 'open', 41, '2 / 5', 'TK-11 · 13:00', 'Pimchanok S.', '12 out for delivery')
  `;

  // 4. Seed Trucks
  console.log('🌱 Seeding trucks...');
  await sql`
    INSERT INTO trucks (id, leg, progress_pct, parcels_count, next_checkin, status, current_station_code, driver_name) VALUES
    ('TK-19', 'Nakhon Sawan → Lampang', 0, 42, 'Nakhon Sawan, 09:30', 'hold', 'NSN', 'Anan Suksomboon'),
    ('TK-07', 'Wang Noi → Nakhon Sawan', 64, 38, 'Nakhon Sawan, 11:10', 'in-transit', 'WNI', 'Prasert M.'),
    ('TK-22', 'Bangkok → Wang Noi', 31, 55, 'Wang Noi, 10:20', 'in-transit', 'BKK', 'Chaiwat S.'),
    ('TK-11', 'Chiang Mai → Lampang', 88, 27, 'Lampang, 09:55', 'in-transit', 'CNX', 'Narong T.'),
    ('TK-03', 'Bangkok Central Depot', 100, 61, 'Departs 10:00', 'pending', 'BKK', 'Wichai K.')
  `;

  // 5. Seed Exceptions
  console.log('🌱 Seeding exceptions...');
  await sql`
    INSERT INTO exceptions (code, time_str, title, detail, status) VALUES
    ('EX-2031', '08:02', 'Highway 1 closed, Nakhon Sawan – Lampang', 'TK-19 held at Nakhon Sawan Bay 4. 42 parcels affected.', 'open'),
    ('EX-2030', '07:15', 'Address revision needed', 'SR-2609-118102 · recipient unreachable in Nimman.', 'open'),
    ('EX-2029', '09 Sep, 22:40', 'Weather detour, Wang Noi', 'TK-07 rerouted via Route 32, +45 min.', 'open')
  `;

  // 6. Seed Parcels
  console.log('🌱 Seeding parcels...');
  await sql`
    INSERT INTO parcels (tracking_number, route, current_station_code, truck_id, status, eta, recipient_name, delay_title, delay_body) VALUES
    ('SR-2609-118245', 'Bangkok → Chiang Mai', 'NSN', 'TK-19', 'exception', 'Fri 12 Sep, by 18:00', 'Somchai P.', 'Your delivery is delayed by about a day', 'Flooding has closed Highway 1 between Nakhon Sawan and Lampang. Your parcel is safe at Nakhon Sawan Hub and will leave on the first truck once the road reopens.'),
    ('SR-2609-118251', 'Bangkok → Chiang Mai', 'NSN', 'TK-19', 'exception', '12 Sep, 18:00', 'Kanyarat S.', 'Highway 1 closed', 'Delayed at Nakhon Sawan Hub.'),
    ('SR-2609-117890', 'Bangkok → Nakhon Sawan', 'WNI', 'TK-07', 'in-transit', '10 Sep, 14:00', 'Boonsong K.', NULL, NULL),
    ('SR-2609-118102', 'Bangkok → Chiang Mai', 'CNX', NULL, 'exception', 'On hold', 'Nattaya M.', 'Address verification', 'Recipient unreachable in Nimman.'),
    ('SR-2609-116455', 'Chiang Mai → Bangkok', 'CNX', 'TK-11', 'in-transit', '11 Sep, 18:00', 'Saran P.', NULL, NULL),
    ('SR-2609-116301', 'Bangkok → Wang Noi', 'WNI', NULL, 'delivered', '10 Sep, 08:12', 'Aranya D.', NULL, NULL),
    ('SR-2609-118404', 'Bangkok → Chiang Mai', 'BKK', 'TK-03', 'pending', '12 Sep, 18:00', 'Thanakorn W.', NULL, NULL),
    ('SR-2609-115977', 'Wang Noi → Chiang Mai', 'CNX', NULL, 'delivered', '09 Sep, 16:40', 'Preecha T.', NULL, NULL)
  `;

  // 7. Seed Timeline Events for all parcels
  console.log('🌱 Seeding timeline events for all parcels...');
  await sql`
    INSERT INTO parcel_events (tracking_number, kind, title, station_name, time_str, note, seq_order) VALUES
    -- 1. SR-2609-118245
    ('SR-2609-118245', 'done', 'เข้ารับพัสดุเรียบร้อย (Picked up)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 14:32', 'พัสดุเข้าสู่ระบบ devdo Express เรียบร้อยแล้ว', 1),
    ('SR-2609-118245', 'done', 'พัสดุออกจากคลังสินค้า (Left the depot)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 16:10', 'ส่งต่อไปยังศูนย์คัดแยกวังน้อยเพื่อรวมเที่ยวขนส่ง', 2),
    ('SR-2609-118245', 'done', 'ถึงศูนย์คัดแยก (Arrived at sorting center)', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 17:25', 'ผ่านการชั่งน้ำหนัก ตรวจสอบขนาดกล่อง และคัดแยกสายเหนือ', 3),
    ('SR-2609-118245', 'done', 'ออกจากศูนย์คัดแยก (Left sorting center)', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 21:40', 'ขึ้นรถบรรทุกสายเหนือ TK-19 มุ่งหน้าสู่ศูนย์ฮับนครสวรรค์', 4),
    ('SR-2609-118245', 'done', 'ถึงศูนย์ฮับนครสวรรค์ (Arrived at Hub)', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '10 ก.ย., 02:15', 'รถขนส่ง TK-19 เข้าเทียบช่องจอด Bay 4 ประจำศูนย์ฮับนครสวรรค์', 5),
    ('SR-2609-118245', 'exception', 'พักสินค้าชั่วคราว (Held at station)', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '10 ก.ย., 08:02', 'ทางหลวงหมายเลข 1 ปิดการจราจรเนื่องจากน้ำท่วม พักสินค้าในคลังศูนย์ฮับเพื่อความปลอดภัย', 6),
    ('SR-2609-118245', 'pending', 'ศูนย์ฮับลำปาง (Arrive at Lampang Hub)', 'ศูนย์ฮับลำปาง (LPG Hub)', 'กำหนดการถัดไป', 'ออกเดินทางต่อทันทีที่ระดับน้ำลดและเปิดเส้นทาง', 7),
    ('SR-2609-118245', 'pending', 'ศูนย์กระจายสินค้าเชียงใหม่', 'สถานีปลายทางเชียงใหม่ (CNX)', 'กำหนดการถัดไป', 'คัดแยกเตรียมส่งมอบให้พนักงานกระจายสินค้าในพื้นที่', 8),
    ('SR-2609-118245', 'pending', 'พนักงานกำลังนำจ่าย (Out for delivery)', 'ตำบลสุเทพ / นิมมานเหมินท์ เชียงใหม่', 'กำหนดการถัดไป', 'พนักงานจะโทรติดต่อผู้รับก่อนเข้าส่งมอบพัสดุ', 9),
    ('SR-2609-118245', 'pending', 'นำจ่ายสำเร็จ (Delivered)', 'ตำบลสุเทพ / นิมมานเหมินท์ เชียงใหม่', 'กำหนดการถัดไป', 'ลงลายมือชื่อผู้รับพัสดุ Somchai P.', 10),

    -- 2. SR-2609-118251
    ('SR-2609-118251', 'done', 'เข้ารับพัสดุเรียบร้อย (Picked up)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 15:00', 'พัสดุเข้าสู่ระบบ devdo Express', 1),
    ('SR-2609-118251', 'done', 'พัสดุออกจากคลังสินค้า (Left depot)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 16:30', 'ส่งต่อไปยังศูนย์คัดแยกวังน้อย', 2),
    ('SR-2609-118251', 'done', 'ถึงศูนย์คัดแยก (Arrived at sorting)', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 18:00', 'คัดแยกสายเหนือเรียบร้อย', 3),
    ('SR-2609-118251', 'done', 'ออกจากศูนย์คัดแยก (Left sorting)', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 21:40', 'ขึ้นรถขนส่งสายเหนือ TK-19', 4),
    ('SR-2609-118251', 'done', 'ถึงศูนย์ฮับนครสวรรค์ (Arrived at Hub)', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '10 ก.ย., 02:15', 'เข้าเทียบช่องจอด Bay 4', 5),
    ('SR-2609-118251', 'exception', 'พักสินค้าชั่วคราว (Held at station)', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '10 ก.ย., 08:02', 'ทางหลวงหมายเลข 1 น้ำท่วม พักสินค้าในคลังศูนย์ฮับ', 6),
    ('SR-2609-118251', 'pending', 'ศูนย์ฮับลำปาง', 'ศูนย์ฮับลำปาง (LPG Hub)', 'กำหนดการถัดไป', 'รอเปิดเส้นทางจราจร', 7),
    ('SR-2609-118251', 'pending', 'ศูนย์กระจายสินค้าเชียงใหม่', 'สถานีปลายทางเชียงใหม่ (CNX)', 'กำหนดการถัดไป', 'เตรียมส่งมอบพนักงานนำจ่าย', 8),
    ('SR-2609-118251', 'pending', 'พนักงานกำลังนำจ่าย', 'เชียงใหม่', 'กำหนดการถัดไป', 'โทรนัดหมายผู้รับล่วงหน้า', 9),
    ('SR-2609-118251', 'pending', 'นำจ่ายสำเร็จ', 'เชียงใหม่', 'กำหนดการถัดไป', 'ผู้รับ Kanyarat S. ลงชื่อรับมอบ', 10),

    -- 3. SR-2609-117890
    ('SR-2609-117890', 'done', 'เข้ารับพัสดุเรียบร้อย (Picked up)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '10 ก.ย., 09:15', 'พัสดุเข้าสู่ระบบ devdo Express', 1),
    ('SR-2609-117890', 'done', 'ออกจากคลังสินค้าหลัก (Left depot)', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '10 ก.ย., 11:30', 'มุ่งหน้าสู่ศูนย์คัดแยกวังน้อย', 2),
    ('SR-2609-117890', 'done', 'ถึงศูนย์คัดแยกวังน้อย (Arrived WNI)', 'ศูนย์คัดแยกวังน้อย (WNI)', '10 ก.ย., 13:20', 'คัดแยกและโหลดขึ้นรถขนส่งสาย TK-07', 3),
    ('SR-2609-117890', 'pending', 'ถึงศูนย์ฮับนครสวรรค์', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', 'กำหนดการถัดไป (14:00)', 'คาดการณ์ถึงปลายทางตามเวลา', 4),
    ('SR-2609-117890', 'pending', 'นำจ่ายสำเร็จ', 'นครสวรรค์', 'กำหนดการถัดไป', 'ผู้รับ Boonsong K. ลงชื่อรับมอบ', 5),

    -- 4. SR-2609-118102
    ('SR-2609-118102', 'done', 'เข้ารับพัสดุเรียบร้อย', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '08 ก.ย., 10:00', 'รับพัสดุเข้าระบบ', 1),
    ('SR-2609-118102', 'done', 'ผ่านศูนย์คัดแยกวังน้อย', 'ศูนย์คัดแยกวังน้อย (WNI)', '08 ก.ย., 14:00', 'คัดแยกส่งต่อสายเหนือ', 2),
    ('SR-2609-118102', 'done', 'ผ่านศูนย์ฮับลำปาง', 'ศูนย์ฮับลำปาง (LPG Hub)', '09 ก.ย., 04:00', 'ผ่านจุดตรวจเที่ยวรถสายเหนือ', 3),
    ('SR-2609-118102', 'done', 'ถึงสถานีปลายทางเชียงใหม่', 'สถานีปลายทางเชียงใหม่ (CNX)', '09 ก.ย., 11:30', 'เตรียมจัดส่งในพื้นที่นิมมาน', 4),
    ('SR-2609-118102', 'done', 'พนักงานนำพัสดุออกส่ง', 'นิมมานเหมินท์ เชียงใหม่', '10 ก.ย., 08:30', 'พนักงานออกนำจ่ายรอบเช้า', 5),
    ('SR-2609-118102', 'exception', 'นำจ่ายไม่สำเร็จ (รอตรวจสอบที่อยู่)', 'นิมมานเหมินท์ เชียงใหม่', '10 ก.ย., 11:15', 'เบอร์โทรผู้รับไม่สามารถติดต่อได้ เจ้าหน้าที่กำลังประสานงานผู้ส่ง', 6),
    ('SR-2609-118102', 'pending', 'นำจ่ายซ้ำรอบถัดไป', 'นิมมานเหมินท์ เชียงใหม่', 'รอยืนยันที่อยู่', 'จะออกนำจ่ายทันทีหลังติดต่อผู้รับได้', 7),

    -- 5. SR-2609-116455
    ('SR-2609-116455', 'done', 'เข้ารับพัสดุเรียบร้อย', 'สถานีต้นทางเชียงใหม่ (CNX)', '11 ก.ย., 08:30', 'รับพัสดุเข้าสู่ระบบ', 1),
    ('SR-2609-116455', 'done', 'พัสดุโหลดขึ้นรถขนส่งสายใต้ TK-11', 'สถานีต้นทางเชียงใหม่ (CNX)', '11 ก.ย., 10:45', 'ออกเดินทางมุ่งหน้าศูนย์ฮับลำปาง', 2),
    ('SR-2609-116455', 'pending', 'ถึงศูนย์ฮับลำปาง', 'ศูนย์ฮับลำปาง (LPG Hub)', 'กำหนดการถัดไป', 'จุดแวะพักและตรวจสอบเที่ยวรถ', 3),
    ('SR-2609-116455', 'pending', 'ถึงศูนย์กระจายสินค้ากลาง กรุงเทพฯ', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'กำหนดการถัดไป', 'คัดแยกปลายทางกรุงเทพฯ และปริมณฑล', 4),
    ('SR-2609-116455', 'pending', 'นำจ่ายสำเร็จ', 'กรุงเทพมหานคร', 'กำหนดการถัดไป', 'ผู้รับ Saran P. ลงชื่อรับมอบ', 5),

    -- 6. SR-2609-116301
    ('SR-2609-116301', 'done', 'เข้ารับพัสดุเรียบร้อย', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 13:00', 'รับพัสดุเข้าสู่ระบบ', 1),
    ('SR-2609-116301', 'done', 'พัสดุออกจากคลังสินค้าหลัก', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '09 ก.ย., 15:15', 'ส่งต่อไปศูนย์คัดแยกวังน้อย', 2),
    ('SR-2609-116301', 'done', 'ถึงศูนย์คัดแยกวังน้อย', 'ศูนย์คัดแยกวังน้อย (WNI)', '09 ก.ย., 16:30', 'เตรียมกระจายสินค้าในพื้นที่', 3),
    ('SR-2609-116301', 'done', 'พนักงานนำพัสดุออกส่ง', 'อำเภอวังน้อย พระนครศรีอยุธยา', '10 ก.ย., 08:15', 'พนักงานออกนำจ่าย', 4),
    ('SR-2609-116301', 'done', 'นำจ่ายสำเร็จ (Delivered)', 'อำเภอวังน้อย พระนครศรีอยุธยา', '10 ก.ย., 10:42', 'ผู้รับ Aranya D. ลงชื่อรับพัสดุเรียบร้อย', 5),

    -- 7. SR-2609-118404
    ('SR-2609-118404', 'done', 'รับพัสดุเข้าระบบเรียบร้อย', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', '11 ก.ย., 14:00', 'ออกใบนำส่งสินค้า พัสดุรอนำขึ้นรถเที่ยวถัดไป', 1),
    ('SR-2609-118404', 'pending', 'ขึ้นรถขนส่ง TK-03', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'กำหนดการถัดไป', 'รอรอบเวลาออกเดินทาง', 2),
    ('SR-2609-118404', 'pending', 'ถึงศูนย์คัดแยกวังน้อย', 'ศูนย์คัดแยกวังน้อย (WNI)', 'กำหนดการถัดไป', 'คัดแยกสายเหนือ', 3),
    ('SR-2609-118404', 'pending', 'ถึงสถานีปลายทางเชียงใหม่', 'สถานีปลายทางเชียงใหม่ (CNX)', 'กำหนดการถัดไป', 'เตรียมส่งมอบพนักงานนำจ่าย', 4),
    ('SR-2609-118404', 'pending', 'นำจ่ายสำเร็จ', 'เชียงใหม่', 'กำหนดการถัดไป', 'ผู้รับ Thanakorn W. ลงชื่อรับมอบ', 5),

    -- 8. SR-2609-115977
    ('SR-2609-115977', 'done', 'เข้ารับพัสดุเรียบร้อย', 'ศูนย์คัดแยกวังน้อย (WNI)', '08 ก.ย., 11:20', 'รับพัสดุเข้าสู่ระบบ devdo Express', 1),
    ('SR-2609-115977', 'done', 'ผ่านศูนย์ฮับนครสวรรค์', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', '08 ก.ย., 20:00', 'ผ่านจุดตรวจเส้นทางสายเหนือ', 2),
    ('SR-2609-115977', 'done', 'ผ่านศูนย์ฮับลำปาง', 'ศูนย์ฮับลำปาง (LPG Hub)', '09 ก.ย., 06:15', 'ตรวจรับและส่งต่อเชียงใหม่', 3),
    ('SR-2609-115977', 'done', 'ถึงสถานีปลายทางเชียงใหม่', 'สถานีปลายทางเชียงใหม่ (CNX)', '09 ก.ย., 11:30', 'ส่งมอบพนักงานสาขาช้างเผือก', 4),
    ('SR-2609-115977', 'done', 'นำจ่ายสำเร็จ (Delivered)', 'ตำบลช้างเผือก เชียงใหม่', '09 ก.ย., 16:40', 'ผู้รับ Preecha T. ลงชื่อรับพัสดุเรียบร้อย', 5)
  `;

  // 7.1 Seed Status Audit Logs for all parcels
  console.log('🌱 Seeding parcel status audit logs for all parcels...');
  await sql`
    INSERT INTO parcel_status_logs (tracking_number, old_status, new_status, station_code, station_name, updated_by, action, note, created_at) VALUES
    -- 118245
    ('SR-2609-118245', NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'รับพัสดุเข้าระบบ ออกรหัสบาร์โค้ด และพิมพ์ใบนำส่งสินค้า', NOW() - INTERVAL '44 hours'),
    ('SR-2609-118245', 'pending', 'in-transit', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Wichai (WNI Staff)', 'STATUS_UPDATE', 'คัดแยกเสร็จสิ้น โหลดขึ้นรถขนส่งสายเหนือ (TK-19)', NOW() - INTERVAL '38 hours'),
    ('SR-2609-118245', 'in-transit', 'exception', 'NSN', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', 'Somchai (NSN Staff)', 'EXCEPTION_FLAG', 'ทางหลวงหมายเลข 1 น้ำท่วม พักพัสดุไว้ในคลังศูนย์ฮับชั่วคราวเพื่อความปลอดภัย', NOW() - INTERVAL '26 hours'),

    -- 118251
    ('SR-2609-118251', NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'รับพัสดุเข้าระบบ ออกรหัสบาร์โค้ด และพิมพ์ใบนำส่งสินค้า', NOW() - INTERVAL '44 hours'),
    ('SR-2609-118251', 'pending', 'in-transit', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Wichai (WNI Staff)', 'STATUS_UPDATE', 'คัดแยกเสร็จสิ้น โหลดขึ้นรถขนส่งสายเหนือ (TK-19)', NOW() - INTERVAL '38 hours'),
    ('SR-2609-118251', 'in-transit', 'exception', 'NSN', 'ศูนย์ฮับนครสวรรค์ (NSN Hub)', 'Somchai (NSN Staff)', 'EXCEPTION_FLAG', 'ทางหลวงหมายเลข 1 น้ำท่วม พักพัสดุไว้ในคลังศูนย์ฮับชั่วคราว', NOW() - INTERVAL '26 hours'),

    -- 117890
    ('SR-2609-117890', NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'รับพัสดุเข้าระบบและออกใบนำส่ง', NOW() - INTERVAL '28 hours'),
    ('SR-2609-117890', 'pending', 'in-transit', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Wichai (WNI Staff)', 'STATUS_UPDATE', 'คัดแยกเสร็จสิ้น โหลดขึ้นรถ TK-07 มุ่งหน้านครสวรรค์', NOW() - INTERVAL '22 hours'),

    -- 118102
    ('SR-2609-118102', NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'รับพัสดุเข้าระบบ', NOW() - INTERVAL '72 hours'),
    ('SR-2609-118102', 'pending', 'in-transit', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'System Route', 'STATUS_UPDATE', 'ส่งต่อไปศูนย์คัดแยกวังน้อย', NOW() - INTERVAL '68 hours'),
    ('SR-2609-118102', 'in-transit', 'exception', 'CNX', 'สถานีปลายทางเชียงใหม่ (CNX)', 'Narong (CNX Staff)', 'EXCEPTION_FLAG', 'ผู้รับไม่สามารถติดต่อได้ เบอร์โทรศัพท์ไม่ถูกต้อง รอประสานงานผู้ส่ง', NOW() - INTERVAL '24 hours'),

    -- 116455
    ('SR-2609-116455', NULL, 'pending', 'CNX', 'สถานีต้นทางเชียงใหม่ (CNX)', 'Intake Desk CNX', 'INTAKE', 'รับพัสดุเข้าระบบต้นทางเชียงใหม่', NOW() - INTERVAL '12 hours'),
    ('SR-2609-116455', 'pending', 'in-transit', 'CNX', 'สถานีต้นทางเชียงใหม่ (CNX)', 'Narong (CNX Staff)', 'STATUS_UPDATE', 'โหลดขึ้นรถขนส่งสายใต้ TK-11 มุ่งหน้าลำปาง-กรุงเทพฯ', NOW() - INTERVAL '8 hours'),

    -- 116301
    ('SR-2609-116301', NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'รับพัสดุเข้าระบบ', NOW() - INTERVAL '48 hours'),
    ('SR-2609-116301', 'pending', 'in-transit', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Wichai (WNI Staff)', 'STATUS_UPDATE', 'พัสดุถึงศูนย์วังน้อย เตรียมกระจายส่งในพื้นที่', NOW() - INTERVAL '42 hours'),
    ('SR-2609-116301', 'in-transit', 'delivered', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Delivery Driver', 'DELIVERY_CONFIRM', 'ส่งมอบพัสดุและรับลายมือชื่อผู้รับ Aranya D. เรียบร้อย', NOW() - INTERVAL '28 hours'),

    -- 118404
    ('SR-2609-118404', NULL, 'pending', 'BKK', 'ศูนย์กระจายสินค้ากลาง กรุงเทพฯ (BKK)', 'Intake Desk BKK', 'INTAKE', 'สร้างใบนำส่งและรับพัสดุเข้าระบบ รอนำขึ้นรถขนส่ง TK-03', NOW() - INTERVAL '5 hours'),

    -- 115977
    ('SR-2609-115977', NULL, 'pending', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Intake Desk WNI', 'INTAKE', 'รับพัสดุเข้าระบบสาขาวังน้อย', NOW() - INTERVAL '70 hours'),
    ('SR-2609-115977', 'pending', 'in-transit', 'WNI', 'ศูนย์คัดแยกวังน้อย (WNI)', 'Wichai (WNI Staff)', 'STATUS_UPDATE', 'ส่งต่อรถขนส่งสายเหนือมุ่งหน้าเชียงใหม่', NOW() - INTERVAL '64 hours'),
    ('SR-2609-115977', 'in-transit', 'delivered', 'CNX', 'สถานีปลายทางเชียงใหม่ (CNX)', 'Delivery Driver', 'DELIVERY_CONFIRM', 'ส่งมอบพัสดุและรับลายมือชื่อผู้รับ Preecha T. เรียบร้อย', NOW() - INTERVAL '40 hours')
  `;

  // 8. Seed Users (Staff & Drivers)
  console.log('🌱 Seeding users (staff & drivers)...');
  await sql`
    INSERT INTO users (username, password, role, name, phone, truck_id, station_code) VALUES
    -- Headquarters & Central Staff
    ('k.okoro', 'secret', 'staff', 'K. Okoro', '081-234-5678', NULL, 'BKK'),
    ('somchai.p', 'pass1234', 'staff', 'Somchai Prasert', '089-111-2233', NULL, 'BKK'),
    ('anan.s', 'pass1234', 'staff', 'Anan Suksomboon', '082-333-4455', NULL, 'NSN'),
    ('admin', 'admin1234', 'staff', 'System Administrator', '080-000-9999', NULL, 'BKK'),
    
    -- Dedicated Hub Station Staff (One per Hub)
    ('staff.wni', '123456', 'staff', 'Wichai Wang Noi', '082-111-2233', NULL, 'WNI'),
    ('staff.nsn', '123456', 'staff', 'Somchai Nakhon Sawan', '082-222-3344', NULL, 'NSN'),
    ('staff.lpg', '123456', 'staff', 'Kamonwan Lampang', '082-333-4455', NULL, 'LPG'),
    ('staff.cnx', '123456', 'staff', 'Narong Chiang Mai', '082-444-5566', NULL, 'CNX'),

    -- Driver Accounts (PIN authentication)
    ('DR-0419', '123456', 'driver', 'Anan Suksomboon', '086-777-8899', 'TK-19', 'NSN'),
    ('DR-0702', '123456', 'driver', 'Prasert M.', '085-555-6677', 'TK-07', 'WNI'),
    ('DR-0022', '123456', 'driver', 'Chaiwat S.', '084-444-5566', 'TK-22', 'BKK'),
    ('DR-0011', '123456', 'driver', 'Narong T.', '083-222-1100', 'TK-11', 'CNX'),
    ('DR-0003', '123456', 'driver', 'Wichai K.', '081-999-0011', 'TK-03', 'BKK'),
    ('DR-0888', '123456', 'driver', 'Sompong Rattana', '089-888-7766', 'TK-07', 'WNI')
  `;

  // 9. Seed Manifests
  console.log('🌱 Seeding shipping manifests...');
  await sql`
    INSERT INTO manifests (manifest_number, truck_id, origin_station_code, destination_station_code, driver_name, departure_time, parcels_count, total_weight_kg, status, notes) VALUES
    ('MF-2609-19', 'TK-19', 'NSN', 'LPG', 'Anan Suksomboon', '09:30', 42, 178.50, 'loading', 'Highway 1 flood detour standby'),
    ('MF-2609-07', 'TK-07', 'WNI', 'NSN', 'Prasert M.', '11:10', 38, 145.20, 'in-transit', 'En route via Route 32'),
    ('MF-2609-22', 'TK-22', 'BKK', 'WNI', 'Chaiwat S.', '10:20', 55, 230.00, 'in-transit', 'Morning corridor express dispatch'),
    ('MF-2609-11', 'TK-11', 'CNX', 'LPG', 'Narong T.', '09:55', 27, 98.40, 'in-transit', 'Southern bound return leg'),
    ('MF-2609-03', 'TK-03', 'BKK', 'CNX', 'Wichai K.', '10:00', 61, 280.00, 'scheduled', 'Full corridor long-haul direct')
  `;

  console.log('\n🎉 Database successfully seeded on Neon PostgreSQL!\n');
}

seed().catch(err => {
  console.error('\n❌ Seeding failed:', err);
  process.exit(1);
});
