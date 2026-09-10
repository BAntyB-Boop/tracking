# SwiftRoute Logistics Terminal 🚚

ระบบติดตามพัสดุและแดชบอร์ดบริหารจัดการโลจิสติกส์ (Corridor Bangkok → Chiang Mai)
ออกแบบสำหรับรันหน้าบ้านบน **Vercel** และเชื่อมต่อหลังบ้านกับ **Neon (Serverless PostgreSQL Database)**

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
├── index.html          # หน้าหลัก: ระบบค้นหาและติดตามพัสดุสำหรับลูกค้า (Public Tracking)
├── tracking.html       # หน้าติดตามพัสดุ (เชื่อมโยงกับ index.html)
├── login.html          # หน้าเข้าสู่ระบบ (สลับโหมด Station Staff / Driver)
├── admin.html          # แดชบอร์ดจัดการระบบ, รายการพัสดุ, สถานี, และ Driver Check-in (Swipe Slider)
│
├── api/                # Vercel Serverless API Functions
│   ├── db.js           # Helper เชื่อมต่อ Neon Database (@neondatabase/serverless)
│   ├── track.js        # GET /api/track?tn=SR-xxx
│   ├── parcels.js      # GET /api/parcels
│   ├── dashboard.js    # GET /api/dashboard
│   ├── stations.js     # GET /api/stations
│   ├── checkin.js      # POST /api/checkin (Driver Swipe Arrival Confirmation)
│   └── login.js        # POST /api/login
│
├── schema.sql          # สคริปต์ SQL สร้างตาราง (Tables & Indexes) สำหรับ Neon
├── scripts/
│   └── seed.js         # สคริปต์ Auto-seed ข้อมูลลง Neon PostgreSQL
├── server.js           # Local Dev Server สำหรับรันเทสบนเครื่อง
├── vercel.json         # การตั้งค่าสำหรับ Vercel Deployment
├── package.json        # Node.js Dependencies (@neondatabase/serverless, dotenv)
└── .env.example        # ตัวอย่างไฟล์ Environment Variables
```

---

## ⚡ เริ่มต้นใช้งาน (Quick Start)

### 1. ติดตั้ง Dependencies
เปิด Terminal ในโฟลเดอร์นี้แล้วรัน:
```bash
npm install
```

### 2. รันทดสอบความถูกต้องทั้งหมด (Automated Test Suite)
ก่อนนำขึ้นเซิร์ฟเวอร์จริง สามารถรันตรวจสอบความถูกต้องของฟังก์ชันทั้งหมด 100 จุดได้ด้วยคำสั่ง:
```bash
npm test
```

### 3. รันเซิร์ฟเวอร์ทดสอบในเครื่องทันที
คุณสามารถรันระบบทดสอบได้ทันที (ระบบมี Mock Fallback ในตัวแม้ยังไม่เชื่อมต่อฐานข้อมูล):
```bash
npm start
```
เปิดเบราว์เซอร์ไปที่:
- **หน้าติดตามพัสดุ (ลูกค้า)**: [http://localhost:3000/](http://localhost:3000/)
- **หน้าเข้าสู่ระบบ**: [http://localhost:3000/login.html](http://localhost:3000/login.html)
- **หน้าแดชบอร์ด Admin**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
- **หน้าเช็คอินคนขับ (มือถือ)**: [http://localhost:3000/admin.html?screen=checkin](http://localhost:3000/admin.html?screen=checkin)

---

## 🐘 การเชื่อมต่อกับ Neon Database (PostgreSQL)

### ขั้นตอนที่ 1: รับ Connection String จาก Neon
1. สมัครใช้งานฟรีที่ [https://neon.tech](https://neon.tech)
2. สร้างโปรเจกต์ใหม่ (เลือก Region ใกล้เคียง เช่น `ap-southeast-1` Singapore หรือที่ต้องการ)
3. คัดลอก **Connection String** เช่น:
   ```text
   postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### ขั้นตอนที่ 2: ตั้งค่า `.env`
สร้างไฟล์ `.env` ในโฟลเดอร์โปรเจกต์ (หรือก็อปปี้จาก `.env.example`):
```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
PORT=3000
```

### ขั้นตอนที่ 3: รันคำสั่ง Seed ข้อมูล
รันคำสั่งเพียงบรรทัดเดียว ระบบจะสร้างตารางและใส่ข้อมูลจำลองลง Neon ให้อัตโนมัติ:
```bash
npm run seed
```
*(หากต้องการรันคำสั่ง SQL เอง สามารถเปิดไฟล์ `schema.sql` แล้วนำไปรันใน Neon SQL Editor ได้เช่นกัน)*

---

## 🔑 บัญชีทดสอบระบบ (Test Accounts ใน Neon DB)

ระบบมีตาราง `users` พร้อมข้อมูลจำลองสำหรับทดสอบ Login ทั้ง Staff และ Driver:

| Role | Username / ID | Password / PIN | ชื่อ-นามสกุล | ตำแหน่ง / สถานี | การเปลี่ยนหน้า |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Staff** | `k.okoro` | `secret` | K. Okoro | Station Supervisor (BKK) | ไปที่ `admin.html` |
| **Staff** | `somchai.p` | `pass1234` | Somchai Prasert | Depot Manager (BKK) | ไปที่ `admin.html` |
| **Staff** | `anan.s` | `pass1234` | Anan Suksomboon | Hub Supervisor (NSN) | ไปที่ `admin.html` |
| **Staff** | `admin` | `admin1234` | System Administrator | IT Admin | ไปที่ `admin.html` |
| **Driver** | `DR-0419` | `123456` | Anan Suksomboon | คนขับรถสาย TK-19 (NSN) | ไปที่ `admin.html?screen=checkin` |
| **Driver** | `DR-0702` | `123456` | Prasert M. | คนขับรถสาย TK-07 (WNI) | ไปที่ `admin.html?screen=checkin` |
| **Driver** | `DR-0022` | `123456` | Chaiwat S. | คนขับรถสาย TK-22 (BKK) | ไปที่ `admin.html?screen=checkin` |
| **Driver** | `DR-0011` | `123456` | Narong T. | คนขับรถสาย TK-11 (CNX) | ไปที่ `admin.html?screen=checkin` |

---

## 🚀 การนำขึ้น Vercel (Deployment)

### วิธีที่ 1: Deploy ผ่าน Vercel CLI (ง่ายที่สุด)
```bash
npx vercel
```
เมื่อ Deploy เสร็จ ให้เพิ่ม Environment Variable บน Vercel:
```bash
npx vercel env add DATABASE_URL
```

### วิธีที่ 2: Deploy ผ่าน GitHub
1. อัปโหลดโปรเจกต์นี้ขึ้น GitHub Repository ของคุณ
2. เข้าสู่ระบบ [Vercel Dashboard](https://vercel.com) แล้วกด **Add New Project**
3. เลือก Repository ที่เพิ่งอัปโหลด
4. ในส่วน **Environment Variables** ให้เพิ่ม:
   - Key: `DATABASE_URL`
   - Value: Connection String ของ Neon ของคุณ
5. กด **Deploy**

🎉 **เสร็จสิ้น! เว็บไซต์จะออนไลน์พร้อมระบบฐานข้อมูล PostgreSQL จริงทันที**
