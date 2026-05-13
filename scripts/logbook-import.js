#!/usr/bin/env node
// ═══════════════════════════════════════════════
//  LOGBOOK AUTO-IMPORT
//
//  Reads the monthly Excel logbook file, parses Start/End clock-in/out
//  times per employee per day, writes to Firebase RTDB so the web app
//  can calculate Late / Early automatically.
//
//  Schedule: run daily at 12:30 AM via cron
//    30 0 * * * node /path/to/scripts/logbook-import.js >> /var/log/logbook-import.log 2>&1
//
//  Dependencies (npm install):
//    xlsx          — Excel parsing
//    node-fetch    — Firebase REST API calls
//    node-cron     — Optional: built-in scheduler (alternative to system cron)
//
//  Configuration:
//    Set env vars or edit CONFIG below.
//    FIREBASE_DB_URL  — e.g. https://your-project.firebaseio.com
//    FIREBASE_SECRET  — Database secret (from Project Settings → Service Accounts)
//    LOGBOOK_PATH     — Absolute path to the Excel logbook file
//    LOGBOOK_YEAR     — Year of the logbook (default: current year)
// ═══════════════════════════════════════════════

'use strict';

const path = require('path');

// ── Configuration ──
const CONFIG = {
  dbUrl:       process.env.FIREBASE_DB_URL   || 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app',
  dbSecret:    process.env.FIREBASE_SECRET   || '',
  logbookPath: process.env.LOGBOOK_PATH      || path.join(__dirname, '../logbook.xlsx'),
  year:        parseInt(process.env.LOGBOOK_YEAR || new Date().getFullYear()),
  dryRun:      process.env.DRY_RUN === 'true',
};

// ── Column layout constants ──
// Excel structure (1-indexed):
//   Col A(1)=No, B(2)=EmpNo, C(3)=Name, D(4)=OldUser, E(5)=NewUser, F(6)=Position, G(7)=Shift
//   Data starts row 5.
//   Day columns start at col H (8-indexed).
//   Each day = 4 cols: Start | Late | End | Early
//   "Shift" separator columns are inserted weekly (after every 7 days in the source data).
//
// Dynamic column detection: scan row 1 for date headers, build day→col map.

const EMPLOYEE_COL = {
  no:       0, // A (0-indexed)
  empNo:    1, // B
  name:     2, // C
  oldUser:  3, // D
  newUser:  4, // E
  position: 5, // F
  shift:    6, // G
};

const DATA_START_ROW = 4; // 0-indexed (row 5 in Excel = index 4)

// Shift schedule defaults — must match SHIFT_DEFAULTS in the web app
const SHIFT_DEFAULTS = {
  A: { start: '15:00', end: '00:00' },
  D: { start: '00:00', end: '09:00' },
  E: { start: '06:00', end: '15:00' },
};

// ── Helpers ──

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

function parseTimeStr(str) {
  if (!str) return null;
  const s = String(str).trim();
  // HH:MM:SS AM/PM
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]), m = parseInt(ampm[2]);
    const p = ampm[4].toUpperCase();
    if (p === 'AM' && h === 12) h = 0;
    if (p === 'PM' && h !== 12) h += 12;
    const sec = ampm[3] ? parseInt(ampm[3]) : 0;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  // HH:MM or HH:MM:SS (24h)
  const h24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (h24) {
    const sec = h24[3] ? parseInt(h24[3]) : 0;
    return `${String(parseInt(h24[1])).padStart(2,'0')}:${h24[2]}:${String(sec).padStart(2,'0')}`;
  }
  // Excel serial time (fraction of day)
  if (!isNaN(str) && str > 0 && str < 1) {
    const totalSec = Math.round(str * 86400);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }
  return null;
}

// Format a DD/MM date key
function fmtDateKey(d, m) {
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
}

// ── Excel parsing ──

function parseLogbook(filePath, year) {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch (e) {
    throw new Error('xlsx package not found. Run: npm install xlsx');
  }

  const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });

  // Detect the sheet for the current month
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const curMonth = new Date().getMonth(); // 0-indexed
  const sheetName = wb.SheetNames.find(n => n.toLowerCase() === monthNames[curMonth].toLowerCase())
    || wb.SheetNames[0];

  log(`Parsing sheet: ${sheetName}`);
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  if (data.length < 4) throw new Error('Sheet has fewer than 4 rows');

  const row1 = data[0]; // date headers
  const row3 = data[2]; // sub-headers (Start/Late/End/Early)

  // Build day → { startCol, endCol } map from row 1 headers
  // Row 1: date headers are Excel date serials or Date objects in columns >= 7
  const dayColMap = {}; // 'DD/MM' → startColIdx (0-indexed)

  for (let c = 7; c < row1.length; c++) {
    const cell = row1[c];
    if (!cell && cell !== 0) continue;

    let dt = null;
    if (typeof cell === 'number' && cell > 40000) {
      // Excel date serial → JS date
      let XLSX2 = require('xlsx');
      dt = XLSX2.SSF.parse_date_code(cell);
    } else if (cell instanceof Date) {
      dt = { d: cell.getDate(), m: cell.getMonth() + 1 };
    } else {
      // Skip non-date cells (e.g. "Shift" separators)
      continue;
    }

    if (!dt) continue;
    const dk = fmtDateKey(dt.d, dt.m);

    // Verify sub-header at row3[c] is 'Start' (or similar)
    const subHdr = String(row3[c] || '').trim().toLowerCase();
    if (subHdr === 'start' || subHdr === 'in' || subHdr === 'clock in') {
      dayColMap[dk] = { startCol: c, endCol: c + 2 }; // Start=c, Late=c+1, End=c+2
    }
  }

  log(`Found ${Object.keys(dayColMap).length} day columns: ${Object.keys(dayColMap).sort().join(', ')}`);

  // Parse employees (from row 5 onwards)
  const employees = [];
  for (let r = DATA_START_ROW; r < data.length; r++) {
    const row = data[r];
    const empNo = row[EMPLOYEE_COL.empNo];
    const name  = row[EMPLOYEE_COL.name];
    if (!empNo && !name) continue; // skip empty rows

    const username = String(row[EMPLOYEE_COL.newUser] || row[EMPLOYEE_COL.oldUser] || '').trim();
    const shift    = String(row[EMPLOYEE_COL.shift] || '').trim().toUpperCase();
    if (!username) continue;

    const attendance = {};
    for (const [dk, cols] of Object.entries(dayColMap)) {
      const startRaw = row[cols.startCol];
      const endRaw   = row[cols.endCol];
      const startStr = parseTimeStr(startRaw);
      const endStr   = parseTimeStr(endRaw);
      if (startStr || endStr) {
        attendance[dk] = { start: startStr || '', end: endStr || '' };
      }
    }

    employees.push({ username, name: String(name || '').trim(), shift, attendance });
  }

  log(`Parsed ${employees.length} employees`);
  return employees;
}

// ── Firebase REST API ──

async function fetchJSON(url) {
  let fetch;
  try { fetch = require('node-fetch'); } catch(e) {
    // Node 18+ has built-in fetch
    fetch = globalThis.fetch;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function putJSON(url, body) {
  let fetch;
  try { fetch = require('node-fetch'); } catch(e) { fetch = globalThis.fetch; }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} PUT failed`);
  return res.json();
}

async function patchJSON(url, body) {
  let fetch;
  try { fetch = require('node-fetch'); } catch(e) { fetch = globalThis.fetch; }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} PATCH failed`);
  return res.json();
}

function fbUrl(path) {
  return `${CONFIG.dbUrl.replace(/\/$/, '')}/${path}.json?auth=${CONFIG.dbSecret}`;
}

// ── Main logic ──

async function run() {
  log('=== Logbook import started ===');
  log(`Logbook: ${CONFIG.logbookPath}`);
  log(`Firebase: ${CONFIG.dbUrl}`);
  log(`Dry run: ${CONFIG.dryRun}`);

  if (!CONFIG.dbSecret && !CONFIG.dryRun) {
    throw new Error('FIREBASE_SECRET not set. Export env var or edit CONFIG.dbSecret.');
  }

  // 1. Parse Excel file
  const employees = parseLogbook(CONFIG.logbookPath, CONFIG.year);
  if (employees.length === 0) {
    log('No employees found. Exiting.');
    return;
  }

  // 2. Fetch current state from Firebase to match usernames → IDs
  log('Fetching user list from Firebase...');
  let users = [];
  if (!CONFIG.dryRun) {
    try {
      const stateData = await fetchJSON(fbUrl('state/users'));
      users = Array.isArray(stateData) ? stateData : Object.values(stateData || {});
    } catch (e) {
      log('WARN: Could not fetch users from Firebase:', e.message);
    }
  }

  // Build username → user ID map
  const usernameToId = {};
  users.forEach(u => {
    if (u && u.username && u.id != null) usernameToId[u.username.toLowerCase()] = u.id;
  });

  // 3. Build attendance patch payload
  const now = Date.now();
  const attendancePatch = {};
  let written = 0, skipped = 0;

  for (const emp of employees) {
    const uid = usernameToId[emp.username.toLowerCase()];
    if (uid == null) {
      log(`SKIP: username "${emp.username}" not found in Firebase users`);
      skipped++;
      continue;
    }

    for (const [dk, rec] of Object.entries(emp.attendance)) {
      const key = `${uid}_${dk}`;
      attendancePatch[key] = {
        start: rec.start,
        end:   rec.end,
        note:  'auto-import',
        by:    null,
        at:    now,
      };
      written++;
    }
  }

  log(`Records to write: ${written}, skipped employees: ${skipped}`);

  // 4. Write to Firebase
  if (CONFIG.dryRun) {
    log('DRY RUN — sample output:');
    const sample = Object.entries(attendancePatch).slice(0, 5);
    sample.forEach(([k, v]) => log(` ${k}:`, JSON.stringify(v)));
    log(`...and ${Math.max(0, written - 5)} more`);
  } else {
    log('Writing to Firebase...');
    await patchJSON(fbUrl('state/attendance'), attendancePatch);
    log(`Wrote ${written} attendance records to Firebase.`);
  }

  log('=== Logbook import complete ===');
}

// ── Entry point ──
// Run immediately when invoked directly.
// To run on a schedule, use system cron (see comment at top) or uncomment the node-cron block below.

run().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});

/*
// ── Optional: built-in cron scheduler ──
// Uncomment to run this file as a long-lived process instead of using system cron.
// npm install node-cron
//
// const cron = require('node-cron');
// log('Scheduler started — will run daily at 00:30');
// cron.schedule('30 0 * * *', () => {
//   run().catch(err => console.error('[ERROR]', err.message));
// });
*/
