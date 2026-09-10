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
  await sql`DROP TABLE IF EXISTS users CASCADE`;
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

  // 7. Seed Timeline Events for SR-2609-118245
  console.log('🌱 Seeding timeline events...');
  await sql`
    INSERT INTO parcel_events (tracking_number, kind, title, station_name, time_str, note, seq_order) VALUES
    ('SR-2609-118245', 'done', 'Picked up', 'Bangkok Central Depot', '09 Sep, 14:32', 'Your parcel is with SwiftRoute.', 1),
    ('SR-2609-118245', 'done', 'Left the depot', 'Bangkok Central Depot', '09 Sep, 16:10', '', 2),
    ('SR-2609-118245', 'done', 'Arrived at station', 'Wang Noi Sorting Center', '09 Sep, 17:25', '', 3),
    ('SR-2609-118245', 'done', 'Left the station', 'Wang Noi Sorting Center', '09 Sep, 21:40', 'On truck TK-19 heading to Nakhon Sawan.', 4),
    ('SR-2609-118245', 'done', 'Arrived at station', 'Nakhon Sawan Hub', '10 Sep, 02:15', '', 5),
    ('SR-2609-118245', 'exception', 'Held at station', 'Nakhon Sawan Hub', '10 Sep, 08:02', 'Flooding has closed Highway 1 to Lampang. We will move your parcel as soon as it reopens.', 6),
    ('SR-2609-118245', 'pending', 'Arrived at station', 'Lampang Hub', 'Upcoming', '', 7),
    ('SR-2609-118245', 'pending', 'Arrived at station', 'Chiang Mai Delivery Station', 'Upcoming', '', 8),
    ('SR-2609-118245', 'pending', 'Out for delivery', 'Nimman, Mueang Chiang Mai', 'Upcoming', '', 9),
    ('SR-2609-118245', 'pending', 'Delivered', 'Nimman, Mueang Chiang Mai', 'Upcoming', '', 10)
  `;

  // 8. Seed Users (Staff & Drivers)
  console.log('🌱 Seeding users (staff & drivers)...');
  await sql`
    INSERT INTO users (username, password, role, name, phone, truck_id, station_code) VALUES
    -- Staff Accounts (Password authentication)
    ('k.okoro', 'secret', 'staff', 'K. Okoro', '081-234-5678', NULL, 'BKK'),
    ('somchai.p', 'pass1234', 'staff', 'Somchai Prasert', '089-111-2233', NULL, 'BKK'),
    ('anan.s', 'pass1234', 'staff', 'Anan Suksomboon', '082-333-4455', NULL, 'NSN'),
    ('admin', 'admin1234', 'staff', 'System Administrator', '080-000-9999', NULL, 'BKK'),

    -- Driver Accounts (PIN authentication)
    ('DR-0419', '123456', 'driver', 'Anan Suksomboon', '086-777-8899', 'TK-19', 'NSN'),
    ('DR-0702', '123456', 'driver', 'Prasert M.', '085-555-6677', 'TK-07', 'WNI'),
    ('DR-0022', '123456', 'driver', 'Chaiwat S.', '084-444-5566', 'TK-22', 'BKK'),
    ('DR-0011', '123456', 'driver', 'Narong T.', '083-222-1100', 'TK-11', 'CNX'),
    ('DR-0003', '123456', 'driver', 'Wichai K.', '081-999-0011', 'TK-03', 'BKK')
  `;

  console.log('\n🎉 Database successfully seeded on Neon PostgreSQL!\n');
}

seed().catch(err => {
  console.error('\n❌ Seeding failed:', err);
  process.exit(1);
});
