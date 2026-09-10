import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests.push(testName);
    console.log(`  ❌ [FAIL] ${testName}`);
  }
}

console.log('\n=============================================================');
console.log('🧪 RUNNING FULL SYSTEM VERIFICATION & AUDIT');
console.log('=============================================================\n');

// -------------------------------------------------------------
// 1. FILE EXISTENCE & CLEANLINESS TEST
// -------------------------------------------------------------
console.log('📦 SECTION 1: File Structure & Cleanliness');
const filesToCheck = [
  'index.html',
  'tracking.html',
  'login.html',
  'admin.html',
  'package.json',
  'vercel.json',
  'schema.sql',
  'server.js',
  'api/db.js',
  'api/track.js',
  'api/parcels.js',
  'api/dashboard.js',
  'api/stations.js',
  'api/checkin.js',
  'api/login.js',
  'api/manifests.js',
  'api/drivers.js'
];

filesToCheck.forEach(f => {
  assert(fs.existsSync(path.join(rootDir, f)), `File exists: ${f}`);
});

// Check that deprecated files are NOT present
const deprecatedFiles = [
  '.thumbnail',
  'support.js',
  'SwiftRoute Admin.dc.html',
  'SwiftRoute Login.dc.html',
  'SwiftRoute Tracking.dc.html',
  'uploads'
];

deprecatedFiles.forEach(f => {
  assert(!fs.existsSync(path.join(rootDir, f)), `Deprecated file properly removed: ${f}`);
});

// -------------------------------------------------------------
// 2. HTML CONTENT & LINK INTEGRITY TEST
// -------------------------------------------------------------
console.log('\n🌐 SECTION 2: HTML Content & DOM ID Integrity');

function checkHtmlFile(filename, requiredIds, forbiddenWords = []) {
  const content = fs.readFileSync(path.join(rootDir, filename), 'utf-8');
  assert(content.includes('<!DOCTYPE html>'), `${filename} has valid DOCTYPE`);
  
  forbiddenWords.forEach(word => {
    assert(!content.includes(word), `${filename} does not contain legacy tag: ${word}`);
  });

  requiredIds.forEach(id => {
    const hasId = content.includes(`id="${id}"`) || content.includes(`id='${id}'`);
    assert(hasId, `${filename} contains element with id="${id}"`);
  });
}

// Check index.html
checkHtmlFile('index.html', [
  'searchSection', 'trackingSection', 'trackAnotherLink', 'tn', 'trackBtn',
  'displayTrackingNo', 'copyLinkBtn', 'sourceBadge', 'statusBadge',
  'etaLabel', 'etaValue', 'currentStationName', 'timelineContainer'
], ['<x-dc>', '<sc-for>', '<sc-if>', 'support.js', '.dc.html']);

// Check login.html
checkHtmlFile('login.html', [
  'roleStaffBtn', 'roleDriverBtn', 'idLabel', 'pwLabel', 'uid', 'pw',
  'idBox', 'pwBox', 'togglePwBtn', 'errorBox', 'errorMessage', 'submitBtn', 'loginForm'
], ['<x-dc>', '<sc-for>', '<sc-if>', 'support.js', '.dc.html']);

// Check admin.html
checkHtmlFile('admin.html', [
  'adminHeader', 'adminMain', 'tabDashboard', 'tabParcels', 'tabStations', 'viewCheckin',
  'kpiInTransit', 'kpiDelivered', 'kpiExceptions', 'kpiOnTime',
  'trucksTableBody', 'exceptionsFeedContainer', 'parcelsTableBody', 'parcelSearch',
  'stationsCardsContainer', 'swipeTrack', 'swipeThumb', 'swipeLabel', 'swipeHint', 'toastNotification'
], ['<x-dc>', '<sc-for>', '<sc-if>', 'support.js', '.dc.html']);

// -------------------------------------------------------------
// 3. API ENDPOINTS FUNCTIONAL UNIT TESTS
// -------------------------------------------------------------
console.log('\n⚙️ SECTION 3: API Functional Unit Tests');

async function testApiModules() {
  // Test 1: api/dashboard.js
  try {
    const dashboardMod = await import('../api/dashboard.js');
    let dashData = null;
    await dashboardMod.default({ method: 'GET', query: {} }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { dashData = d; }
      })
    });
    assert(dashData && dashData.kpis && dashData.kpis.length === 4, 'api/dashboard returns 4 KPIs');
    assert(dashData && dashData.trucks && dashData.trucks.length >= 5, 'api/dashboard returns trucks list');
    assert(dashData && dashData.exceptions && dashData.exceptions.length >= 3, 'api/dashboard returns exceptions list');
  } catch (err) {
    assert(false, `api/dashboard execution error: ${err.message}`);
  }

  // Test 2: api/track.js
  try {
    const trackMod = await import('../api/track.js');
    let trackData = null;
    await trackMod.default({ method: 'GET', query: { tn: 'SR-2609-118245' } }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { trackData = d; }
      })
    });
    assert(trackData && trackData.parcel && trackData.parcel.tracking_number === 'SR-2609-118245', 'api/track finds parcel SR-2609-118245');
    assert(trackData && trackData.events && trackData.events.length >= 5, 'api/track returns events timeline');
    assert(trackData.parcel.current_station_name !== undefined, 'api/track includes current station info');
  } catch (err) {
    assert(false, `api/track execution error: ${err.message}`);
  }

  // Test 3: api/parcels.js
  try {
    const parcelsMod = await import('../api/parcels.js');
    let allData = null;
    await parcelsMod.default({ method: 'GET', query: { filter: 'All' } }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { allData = d; }
      })
    });
    assert(allData && allData.parcels && allData.parcels.length >= 8, 'api/parcels returns parcel list');

    let filterData = null;
    await parcelsMod.default({ method: 'GET', query: { filter: 'Exception' } }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { filterData = d; }
      })
    });
    assert(filterData && filterData.parcels.every(p => p.status.toLowerCase() === 'exception'), 'api/parcels filters by status Exception');

    let searchData = null;
    await parcelsMod.default({ method: 'GET', query: { q: 'Chiang' } }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { searchData = d; }
      })
    });
    assert(searchData && searchData.parcels.length > 0, 'api/parcels search query filtering works');
  } catch (err) {
    assert(false, `api/parcels execution error: ${err.message}`);
  }

  // Test 4: api/stations.js
  try {
    const stationsMod = await import('../api/stations.js');
    let stationsData = null;
    await stationsMod.default({ method: 'GET', query: {} }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { stationsData = d; }
      })
    });
    assert(stationsData && stationsData.stations && stationsData.stations.length >= 5, 'api/stations returns corridor stations');
  } catch (err) {
    assert(false, `api/stations execution error: ${err.message}`);
  }

  // Test 5: api/checkin.js
  try {
    const checkinMod = await import('../api/checkin.js');
    let checkinData = null;
    await checkinMod.default({
      method: 'POST',
      body: { truckId: 'TK-19', stationCode: 'NSN', stationName: 'Nakhon Sawan Hub' }
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { checkinData = d; }
      })
    });
    assert(checkinData && checkinData.success === true, 'api/checkin confirms driver arrival');
    assert(checkinData && checkinData.parcelsUpdated >= 42, 'api/checkin bulk-updates 42 parcels');
  } catch (err) {
    assert(false, `api/checkin execution error: ${err.message}`);
  }

  // Test 6: api/login.js
  try {
    const loginMod = await import('../api/login.js');
    let staffLogin = null;
    await loginMod.default({
      method: 'POST',
      body: { role: 'staff', uid: 'k.okoro', pw: 'secret' }
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { staffLogin = d; }
      })
    });
    assert(staffLogin && staffLogin.success && staffLogin.redirectUrl === 'admin.html', 'api/login authenticates staff to admin.html');

    let driverLogin = null;
    await loginMod.default({
      method: 'POST',
      body: { role: 'driver', uid: 'DR-0419', pw: '123456' }
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { driverLogin = d; }
      })
    });
    assert(driverLogin && driverLogin.success && driverLogin.redirectUrl === 'admin.html?screen=checkin', 'api/login authenticates driver to checkin screen');

    let failLogin = null;
    await loginMod.default({
      method: 'POST',
      body: { role: 'staff', uid: '', pw: '' }
    }, {
      setHeader: () => {},
      status: (code) => ({
        json: (d) => { failLogin = { code, ...d }; }
      })
    });
    assert(failLogin && failLogin.code === 400 && failLogin.error, 'api/login validates required credentials');
  } catch (err) {
    assert(false, `api/login execution error: ${err.message}`);
  }

  // Test 7: api/manifests.js
  try {
    const manifestMod = await import('../api/manifests.js');
    let getResult = null;
    await manifestMod.default({
      method: 'GET'
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { getResult = d; }
      })
    });
    assert(getResult && Array.isArray(getResult.manifests) && getResult.manifests.length > 0, 'api/manifests returns shipping manifests');

    let postResult = null;
    await manifestMod.default({
      method: 'POST',
      body: {
        truckId: 'TK-03',
        originStationCode: 'BKK',
        destinationStationCode: 'CNX',
        driverName: 'Wichai K.',
        departureTime: '15:00',
        parcelsCount: 50,
        totalWeightKg: 210.0
      }
    }, {
      setHeader: () => {},
      status: (code) => ({
        json: (d) => { postResult = { code, ...d }; }
      })
    });
    assert(postResult && postResult.success && postResult.manifest, 'api/manifests creates new shipping manifest');
  } catch (err) {
    assert(false, `api/manifests execution error: ${err.message}`);
  }

  // Test 8: api/stations.js POST
  try {
    const stationsMod = await import('../api/stations.js');
    let addStationRes = null;
    await stationsMod.default({
      method: 'POST',
      body: {
        code: 'TEST' + Math.floor(10 + Math.random() * 89),
        name: 'Test Logistics Station',
        supervisor: 'Test Supervisor',
        status: 'open'
      }
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { addStationRes = d; }
      })
    });
    assert(addStationRes && addStationRes.success && addStationRes.station, 'api/stations creates new station');
  } catch (err) {
    assert(false, `api/stations POST execution error: ${err.message}`);
  }

  // Test 9: api/drivers.js
  try {
    const driversMod = await import('../api/drivers.js');
    let getDriversRes = null;
    await driversMod.default({
      method: 'GET'
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { getDriversRes = d; }
      })
    });
    assert(getDriversRes && Array.isArray(getDriversRes.drivers) && getDriversRes.drivers.length > 0, 'api/drivers returns driver list');

    let addDriverRes = null;
    await driversMod.default({
      method: 'POST',
      body: {
        driverId: 'DR-TEST' + Math.floor(10 + Math.random() * 89),
        pin: '123456',
        name: 'Test Driver',
        phone: '081-000-1111',
        stationCode: 'BKK'
      }
    }, {
      setHeader: () => {},
      status: () => ({
        json: (d) => { addDriverRes = d; }
      })
    });
    assert(addDriverRes && addDriverRes.success && addDriverRes.driver, 'api/drivers registers new driver');
  } catch (err) {
    assert(false, `api/drivers execution error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  if (failedTests.length === 0) {
    console.log('🎉 ALL TESTS PASSED! Project is 100% verified and ready for Vercel deployment.');
  } else {
    console.log('❌ Failed tests:');
    failedTests.forEach(f => console.log(`  - ${f}`));
  }
  console.log('=============================================================\n');

  if (failedTests.length > 0) {
    process.exit(1);
  }
}

testApiModules();
