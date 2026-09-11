-- ==========================================================
-- SwiftRoute Terminal System - PostgreSQL Schema for Neon
-- ==========================================================

-- 1. STATIONS TABLE
CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,      -- BKK, WNI, NSN, LPG, CNX
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',     -- 'open', 'busy', 'closed'
    on_hand_parcels INT DEFAULT 0,
    bays_in_use VARCHAR(20) DEFAULT '2 / 4',
    next_departure VARCHAR(100),
    supervisor VARCHAR(100),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRUCKS TABLE
CREATE TABLE IF NOT EXISTS trucks (
    id VARCHAR(20) PRIMARY KEY,            -- TK-19, TK-07, TK-22, etc.
    leg VARCHAR(100) NOT NULL,
    progress_pct INT DEFAULT 0,
    parcels_count INT DEFAULT 0,
    next_checkin VARCHAR(100),
    status VARCHAR(20) DEFAULT 'in-transit', -- 'in-transit', 'hold', 'pending', 'done'
    current_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
    driver_name VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXCEPTIONS FEED TABLE
CREATE TABLE IF NOT EXISTS exceptions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,      -- EX-2031, etc.
    time_str VARCHAR(50),
    title VARCHAR(200) NOT NULL,
    detail TEXT,
    status VARCHAR(20) DEFAULT 'open',     -- 'open', 'resolved'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PARCELS TABLE
CREATE TABLE IF NOT EXISTS parcels (
    tracking_number VARCHAR(30) PRIMARY KEY, -- SR-2609-118245
    route VARCHAR(100) NOT NULL,
    current_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
    truck_id VARCHAR(20) REFERENCES trucks(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'in-transit', -- 'in-transit', 'exception', 'delivered', 'pending'
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
);

-- 5. PARCEL TIMELINE EVENTS
CREATE TABLE IF NOT EXISTS parcel_events (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(30) REFERENCES parcels(tracking_number) ON DELETE CASCADE,
    kind VARCHAR(20) DEFAULT 'done',         -- 'done', 'active', 'exception', 'pending'
    title VARCHAR(100) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    time_str VARCHAR(50) NOT NULL,
    note TEXT,
    seq_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.1 PARCEL STATUS AUDIT LOGS (ประวัติการอัปเดตและเปลี่ยนสถานะพัสดุแต่ละชิ้น)
CREATE TABLE IF NOT EXISTS parcel_status_logs (
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
);

-- 6. USERS TABLE (Authentication for Staff & Drivers)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,    -- 'k.okoro', 'DR-0419', etc.
    password VARCHAR(255) NOT NULL,          -- Password or Driver 6-digit PIN
    role VARCHAR(20) NOT NULL,               -- 'staff', 'driver'
    name VARCHAR(100) NOT NULL,              -- Full name
    phone VARCHAR(20),
    truck_id VARCHAR(20) REFERENCES trucks(id) ON DELETE SET NULL,
    station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MANIFESTS TABLE (Shipping manifests created by station staff)
CREATE TABLE IF NOT EXISTS manifests (
    id SERIAL PRIMARY KEY,
    manifest_number VARCHAR(30) UNIQUE NOT NULL, -- e.g. 'MF-2609-19'
    truck_id VARCHAR(20) REFERENCES trucks(id) ON DELETE SET NULL,
    origin_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
    destination_station_code VARCHAR(10) REFERENCES stations(code) ON DELETE SET NULL,
    driver_name VARCHAR(100),
    departure_time VARCHAR(100),
    parcels_count INT DEFAULT 0,
    total_weight_kg NUMERIC(8, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'scheduled',       -- 'scheduled', 'loading', 'in-transit', 'completed'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES for lightning fast queries on Neon
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_truck ON parcels(truck_id);
CREATE INDEX IF NOT EXISTS idx_parcel_events_tn ON parcel_events(tracking_number, seq_order);
CREATE INDEX IF NOT EXISTS idx_users_username_role ON users(username, role);
CREATE INDEX IF NOT EXISTS idx_manifests_number ON manifests(manifest_number);
CREATE INDEX IF NOT EXISTS idx_manifests_truck ON manifests(truck_id);
CREATE INDEX IF NOT EXISTS idx_parcel_status_logs_tn ON parcel_status_logs(tracking_number, created_at DESC);


