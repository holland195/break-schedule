// ═══════════════════════════════════════════════
//  PAVE — Google Apps Script
//  Merged: Attendance Sync + Schedule Sync + Logbook Sync
//  Trigger: Daily (e.g. 6AM–7AM)
// ═══════════════════════════════════════════════
const SPREADSHEET_ID          = '19YqrS2ls7V74bJMQNjWavXTYEeRiMZDptbA_vKK2aPs';
const LOGBOOK_SPREADSHEET_ID  = '1-OKeOsCVKO208UwWcjAtLqYOVMdNuFDR6fxxTHQi0ao';
const FIREBASE_URL            = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json';
const FIREBASE_SECRET         = 'W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK';
const ATTENDANCE_SHEET        = 'Attendance-May-2026'; // update each month
const SCHEDULE_SHEET          = 'Schedule May_26';     // update each month
const NOTIFY_EMAIL            = Session.getActiveUser().getEmail();

// ═══════════════════════════════════════════════
//  MASTER ENTRY POINT — set trigger on this only
// ═══════════════════════════════════════════════
function dailySync() {
  const startTime = new Date();
  const log = [];

  function addLog(msg) {
    Logger.log(msg);
    log.push(msg);
  }

  try {
    addLog('=== PAVE Daily Sync Start: ' + startTime.toISOString() + ' ===');

    // ── 1. Pull current Firebase state once ──
    addLog('[Firebase] Fetching current data…');
    const raw     = firebaseGet();
    const current = raw ? JSON.parse(raw) : {};
    addLog('[Firebase] Fetch OK. Keys: ' + Object.keys(current).join(', '));

    // ── 2. Sync attendance ──
    const attResult = syncAttendance(current, addLog);

    // ── 3. Sync schedule ──
    const schedResult = syncSchedule(current, addLog);

    // ── 4. Sync logbook (Start/End clock-in/out → attendance records) ──
    const logbookResult = syncLogbook(current, addLog);

    // ── 5. Push back to Firebase ──
    addLog('[Firebase] Pushing updated data…');
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
    addLog('[Firebase] Push OK.');

    // ── 6. Summary ──
    const duration = ((new Date() - startTime) / 1000).toFixed(1);
    addLog('=== Sync Complete in ' + duration + 's ===');
    addLog('  Attendance: ' + attResult.imported + ' matched, ' + attResult.skipped + ' skipped, ' + attResult.dateCols + ' date cols');
    addLog('  Schedule:   ' + schedResult.updated + ' users updated, ' + schedResult.dateCols + ' date cols');
    addLog('  Logbook:    ' + logbookResult.imported + ' matched, ' + logbookResult.skipped + ' skipped, ' + logbookResult.dateCols + ' day cols');

  } catch (e) {
    const errMsg = '✗ PAVE Sync FAILED: ' + e.message + '\n\nStack: ' + e.stack;
    Logger.log(errMsg);
    log.push(errMsg);

    try {
      MailApp.sendEmail({
        to:      NOTIFY_EMAIL,
        subject: '⚠ PAVE Sync Failed — ' + Utilities.formatDate(startTime, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'),
        body:    'The PAVE daily sync failed with the following error:\n\n'
               + e.message + '\n\n'
               + 'Full log:\n' + log.join('\n')
               + '\n\nCheck GAS → Executions for details.'
      });
    } catch (mailErr) {
      Logger.log('Failed to send email: ' + mailErr.message);
    }

    throw e;
  }
}

// ═══════════════════════════════════════════════
//  ATTENDANCE SYNC
// ═══════════════════════════════════════════════
function syncAttendance(current, log) {
  const result = { imported: 0, skipped: 0, dateCols: 0 };
  let ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    log('[Attendance] ✗ Cannot open spreadsheet: ' + e.message);
    log('[Attendance] Check SPREADSHEET_ID and grant permissions by running manually once.');
    return result;
  }
  if (!ss) {
    log('[Attendance] ✗ Spreadsheet not found. Check SPREADSHEET_ID.');
    return result;
  }
  const sheet = ss.getSheetByName(ATTENDANCE_SHEET);

  const rows      = sheet.getDataRange().getValues();
  const headerRow = rows[0]; // Row 1 = date headers

  // Build date columns (skip cols 0–3: No/EmpNo/Name/Position)
  const dateCols = [];
  headerRow.forEach(function(h, i) {
    if (i < 4) return;
    const dk = parseDateHeader(h);
    if (dk) dateCols.push({ index: i, dateKey: dk });
  });

  result.dateCols = dateCols.length;

  if (dateCols.length === 0) {
    log('[Attendance] ⚠ No date columns found in header row. First 6 cells: '
      + headerRow.slice(0, 6).map(function(h) { return typeof h + ':' + h; }).join(' | '));
    return result;
  }

  // Detect working month from first date column
  const firstDk    = dateCols[0].dateKey;
  const firstDay   = parseInt(firstDk.split('/')[0]);
  const firstMonth = parseInt(firstDk.split('/')[1]);
  var year  = new Date().getFullYear();
  var month = firstDay >= 25 ? firstMonth + 1 : firstMonth;
  if (month > 12) { month = 1; year++; }
  const monthKey = year + '-' + String(month).padStart(2, '0');

  log('[Attendance] Working month: ' + monthKey + ' | ' + dateCols.length + ' date columns');

  if (!current.monthlyAttendance) current.monthlyAttendance = {};

  // Data starts row 4 (index 3)
  for (var ri = 3; ri < rows.length; ri++) {
    const row     = rows[ri];
    const nameVal = String(row[2] || '').trim();
    const empNo   = String(row[1] || '').trim();
    if (!nameVal && !empNo) continue;

    const username = findUsername(current, nameVal, empNo);
    if (!username) {
      result.skipped++;
      if (result.skipped <= 5) log('[Attendance] No match: "' + nameVal + '" / empNo:"' + empNo + '"');
      continue;
    }

    if (!current.monthlyAttendance[username])           current.monthlyAttendance[username] = {};
    if (!current.monthlyAttendance[username][monthKey]) current.monthlyAttendance[username][monthKey] = {};

    dateCols.forEach(function(col) {
      const raw = row[col.index];
      if (raw === null || raw === undefined || raw === '') return;
      var rawStr;
      if (typeof raw === 'number') {
        rawStr = String(Math.round(raw));
      } else {
        rawStr = String(raw).trim().toUpperCase();
      }
      if (!rawStr) return;
      current.monthlyAttendance[username][monthKey][col.dateKey] = rawStr;
    });

    result.imported++;
  }

  if (result.skipped > 5) {
    log('[Attendance] ... and ' + (result.skipped - 5) + ' more unmatched rows');
  }
  log('[Attendance] Done: ' + result.imported + ' matched, ' + result.skipped + ' skipped');
  return result;
}

// ═══════════════════════════════════════════════
//  SCHEDULE SYNC
// ═══════════════════════════════════════════════
function syncSchedule(current, log) {
  const result = { updated: 0, dateCols: 0 };
  let ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    log('[Schedule] ✗ Cannot open spreadsheet: ' + e.message);
    return result;
  }
  if (!ss) {
    log('[Schedule] ✗ Spreadsheet not found. Check SPREADSHEET_ID.');
    return result;
  }
  const sheet = ss.getSheetByName(SCHEDULE_SHEET);

  const lastCol   = sheet.getLastColumn();
  const lastRow   = sheet.getLastRow();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]; // Row 1 = dates
  const dataRows  = sheet.getRange(4, 1, Math.max(1, lastRow - 3), lastCol).getValues(); // Row 4+

  // Build date columns — columns G onward (index 6+)
  const dateCols = [];
  for (var c = 6; c < headerRow.length; c++) {
    const dk = parseDateHeader(headerRow[c]);
    if (dk) dateCols.push({ colIndex: c, dateKey: dk });
  }

  result.dateCols = dateCols.length;

  if (dateCols.length === 0) {
    log('[Schedule] ⚠ No date columns found in row 1. Cols 6–9: '
      + headerRow.slice(6, 10).map(function(h) { return typeof h + ':' + h; }).join(' | '));
    return result;
  }

  log('[Schedule] ' + dateCols.length + ' date columns | ' + dataRows.length + ' staff rows');

  if (!current.users) current.users = [];

  var notFound = [];

  dataRows.forEach(function(row) {
    const username = String(row[4] || '').trim().toLowerCase(); // Col E = index 4
    if (!username) return;

    const userIdx = current.users.findIndex(function(u) {
      return (u.username || '').toLowerCase() === username;
    });

    if (userIdx === -1) {
      notFound.push(username);
      return;
    }

    if (!current.users[userIdx].schedule) current.users[userIdx].schedule = {};

    dateCols.forEach(function(col) {
      const raw   = String(row[col.colIndex] || '').trim().toUpperCase();
      const value = (!raw || raw === '0' || raw === 'OFF' || raw === '') ? '0' : raw;
      current.users[userIdx].schedule[col.dateKey] = value;
    });

    result.updated++;
  });

  if (notFound.length > 0) {
    log('[Schedule] ⚠ ' + notFound.length + ' usernames not found in Firebase users: '
      + notFound.slice(0, 5).join(', ') + (notFound.length > 5 ? '…' : ''));
  }

  // Stamp timestamp — app detects this and triggers auto-assign
  current._usersUpdatedAt = Date.now();

  log('[Schedule] Done: ' + result.updated + ' users updated');
  return result;
}

// ═══════════════════════════════════════════════
//  LOGBOOK SYNC
//  Reads clock-in (Start) and clock-out (End) per employee per day.
//  Writes to state.attendance[uid_dateKey] so the web app can
//  auto-calculate Late / Early. Row/col layout is FULLY DYNAMIC.
// ═══════════════════════════════════════════════
function syncLogbook(current, log) {
  var result = { imported: 0, skipped: 0, dateCols: 0 };

  var MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
  var sheetName = MONTH_NAMES[new Date().getMonth()];

  var ss;
  try { ss = SpreadsheetApp.openById(LOGBOOK_SPREADSHEET_ID); }
  catch(e) {
    log('[Logbook] ✗ Cannot open logbook spreadsheet: ' + e.message);
    return result;
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    log('[Logbook] ✗ Sheet "' + sheetName + '" not found. Available: '
      + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
    return result;
  }

  var lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
  if (lastRow < 3 || lastCol < 5) {
    log('[Logbook] ⚠ Sheet appears empty (lastRow=' + lastRow + ')'); return result;
  }
  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // Auto-detect date header row: row (first 10) with most parseable date cells
  var dateRow = -1, bestCnt = 0;
  for (var ri = 0; ri < Math.min(10, allData.length); ri++) {
    var cnt = 0;
    for (var c = 4; c < allData[ri].length; c++) { if (parseDateHeader(allData[ri][c])) cnt++; }
    if (cnt > bestCnt) { bestCnt = cnt; dateRow = ri; }
  }
  if (dateRow < 0 || bestCnt < 2) {
    log('[Logbook] ⚠ No date header row found (best: ' + bestCnt + ' date cols). Ensure row 1 has Date cells.');
    return result;
  }

  // Auto-detect sub-header row: first row after dateRow containing "start"
  var subHdrRow = -1;
  for (var ri = dateRow+1; ri < Math.min(dateRow+6, allData.length); ri++) {
    for (var c = 0; c < allData[ri].length; c++) {
      if (String(allData[ri][c]).trim().toLowerCase() === 'start') { subHdrRow = ri; break; }
    }
    if (subHdrRow >= 0) break;
  }
  if (subHdrRow < 0) {
    log('[Logbook] ⚠ Could not find Start/Late/End/Early sub-header row after row ' + (dateRow+1));
    return result;
  }

  // Auto-detect data start row: first row after subHdrRow with non-empty employee cols
  var dataStartRow = subHdrRow + 1;
  while (dataStartRow < allData.length) {
    if (allData[dataStartRow].slice(0,8).some(function(c){ return c!==''&&c!==null&&c!==undefined; })) break;
    dataStartRow++;
  }
  log('[Logbook] Layout: dateRow=' + (dateRow+1) + ', subHdrRow=' + (subHdrRow+1) + ', dataStart=' + (dataStartRow+1));

  // Auto-detect Shift column (header rows up to dateRow, cols 0-11)
  var shiftColIdx = -1;
  for (var ri = 0; ri <= dateRow && shiftColIdx < 0; ri++) {
    for (var c = 0; c < 12; c++) {
      if (String(allData[ri][c]||'').trim().toLowerCase() === 'shift') { shiftColIdx = c; break; }
    }
  }
  if (shiftColIdx < 0) shiftColIdx = 6; // fallback col G (7-col layout A-G)
  log('[Logbook] Shift col=' + shiftColIdx);

  // Employee cols relative to shiftColIdx: ..EmpNo|Name|OldUser|NewUser|Pos|Shift
  var empNoColIdx   = Math.max(0, shiftColIdx - 5);
  var nameColIdx    = Math.max(0, shiftColIdx - 4);
  var oldUserColIdx = Math.max(0, shiftColIdx - 3);
  var newUserColIdx = Math.max(0, shiftColIdx - 2);

  // Build date columns: scan from shiftColIdx+1 for Start sub-headers aligned with dates
  var row1 = allData[dateRow], row3 = allData[subHdrRow], dateCols = [];
  for (var c = shiftColIdx+1; c < row1.length; c++) {
    if (String(row3[c]||'').trim().toLowerCase() !== 'start') continue;
    var dk = parseDateHeader(row1[c]);
    if (!dk) continue;
    dateCols.push({ dateKey: dk, startColIdx: c, endColIdx: c + 2 });
  }
  result.dateCols = dateCols.length;

  if (dateCols.length === 0) {
    log('[Logbook] ⚠ No day cols found after col ' + shiftColIdx);
    log('[Logbook]   dateRow  : ' + row1.slice(shiftColIdx, shiftColIdx+8).map(function(v){ return typeof v+':'+String(v).substr(0,10); }).join(' | '));
    log('[Logbook]   subHdrRow: ' + row3.slice(shiftColIdx, shiftColIdx+8).map(function(v){ return String(v); }).join(' | '));
    return result;
  }
  log('[Logbook] ' + dateCols.length + ' day cols | ' + (lastRow-dataStartRow) + ' employee rows');

  // uid lookup map
  var usernameToUid = {};
  (current.users||[]).forEach(function(u) {
    if (u && u.username && u.id != null) usernameToUid[String(u.username).toLowerCase()] = u.id;
  });

  if (!current.attendance) current.attendance = {};
  var now = Date.now();

  for (var ri = dataStartRow; ri < allData.length; ri++) {
    var row     = allData[ri];
    var empNo   = String(row[empNoColIdx]   || '').trim();
    var name    = String(row[nameColIdx]    || '').trim();
    var newUser = String(row[newUserColIdx] || '').trim().toLowerCase();
    var oldUser = String(row[oldUserColIdx] || '').trim().toLowerCase();
    var shiftCd = String(row[shiftColIdx]   || '').trim().toUpperCase();
    if (!name && !empNo && !newUser) continue;

    var uid = newUser ? usernameToUid[newUser] : undefined;
    if (uid == null && oldUser) uid = usernameToUid[oldUser];
    if (uid == null && name) {
      var nl = name.toLowerCase();
      var mu = (current.users||[]).find(function(u){ return (u.name||'').toLowerCase()===nl; });
      if (mu) uid = mu.id;
    }
    if (uid == null) {
      result.skipped++;
      if (result.skipped <= 5) log('[Logbook] No match: "' + name + '" / "' + (newUser||oldUser) + '"');
      continue;
    }

    var wroteAny = false;
    dateCols.forEach(function(col) {
      var startStr = _fmtTimeCell(row[col.startColIdx], shiftCd, 'start');
      var endStr   = _fmtTimeCell(row[col.endColIdx],   shiftCd, 'end');
      if (!startStr && !endStr) return;
      var key = uid + '_' + col.dateKey;
      var existing = current.attendance[key];
      if (existing && existing.note !== 'auto') return; // keep manual overrides
      current.attendance[key] = { start: startStr||'', end: endStr||'', note: 'auto', by: null, at: now };
      wroteAny = true;
    });
    if (wroteAny) result.imported++;
  }

  if (result.skipped > 5) log('[Logbook] ... and ' + (result.skipped-5) + ' more unmatched');
  log('[Logbook] Done: ' + result.imported + ' matched, ' + result.skipped + ' skipped');
  return result;
}

// Convert GAS time cell value → "HH:MM:SS" (24h), or '' if blank.
// shiftCode + role resolve 12h display ambiguity (Sheets shows 15:00 as "3:00" without AM/PM).
function _fmtTimeCell(val, shiftCode, role) {
  if (val === null || val === undefined || val === '') return '';

  // GAS Date object: blank cells return '' not Date, so any Date is a real value
  if (val instanceof Date) {
    var h = val.getHours(), m = val.getMinutes(), s = val.getSeconds();
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  // Fractional day 0..1 stored as raw number
  if (typeof val === 'number' && val >= 0 && val < 1) {
    if (val === 0) return '00:00:00'; // midnight valid for Shift D
    var ts = Math.round(val * 86400);
    var h = Math.floor(ts/3600), m = Math.floor((ts%3600)/60), s = ts%60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  // String / formula output: extract "H:MM[:SS]" prefix (e.g. "3:00:40 F..." → 3,0,40)
  var str = String(val).trim();
  if (!str || str === '—' || str === '-') return '';
  var match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  var h = parseInt(match[1]), m = parseInt(match[2]), s = match[3] ? parseInt(match[3]) : 0;

  // Resolve 12h → 24h using shift context:
  //   Shift A (start 15, end  0): display "3:xx" start → 15:xx; "12:xx" end → 00:xx
  //   Shift D (start  0, end  9): display "12:xx" start → 00:xx
  //   Shift E (start  6, end 15): no ambiguity
  var SHIFT_REF = { A:{start:15,end:0}, B:{start:7,end:15}, C:{start:11,end:19}, D:{start:0,end:9}, E:{start:6,end:15} };
  var ref = (shiftCode && SHIFT_REF[shiftCode]) ? SHIFT_REF[shiftCode][role||'start'] : undefined;
  if (ref !== undefined) {
    if (ref >= 12 && h > 0 && h < 12) h += 12; // e.g. "3:xx" → "15:xx" for Shift A
    if (ref === 0  && h === 12)        h  = 0;  // e.g. "12:xx" → "00:xx" for midnight
  }
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

// ═══════════════════════════════════════════════
//  SHARED HELPERS
// ═══════════════════════════════════════════════

function parseDateHeader(h) {
  if (h === null || h === undefined || h === '') return null;

  // Excel serial number (most common when sheet uses date cells)
  if (typeof h === 'number') {
    if (h < 40000 || h > 60000) return null;
    const ms = new Date(Date.UTC(1899, 11, 30)).getTime() + Math.round(h) * 86400000;
    const dt = new Date(ms);
    return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0');
  }

  // Date object (Apps Script returns these for date-formatted cells)
  if (h instanceof Date) {
    return String(h.getDate()).padStart(2, '0') + '/' + String(h.getMonth() + 1).padStart(2, '0');
  }

  // String formats
  if (typeof h === 'string') {
    const s = h.trim();

    // DD/MM
    if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
      const parts = s.split('/');
      return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0');
    }

    // DD/MM/YYYY or M/D/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
      const parts = s.split('/');
      return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0');
    }

    // ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const parts = s.split('-');
      return parts[2].substring(0, 2) + '/' + parts[1];
    }
  }

  return null;
}

function findUsername(data, nameVal, empNo) {
  if (!data.staffInfo) return null;
  const nameLower = (nameVal || '').toLowerCase().trim();
  const keys      = Object.keys(data.staffInfo);

  // 1. Match by empNo (most reliable — unique identifier)
  if (empNo && empNo.trim()) {
    const empTrim = empNo.trim();
    for (var i = 0; i < keys.length; i++) {
      if ((data.staffInfo[keys[i]].empNo || '') === empTrim) return keys[i];
    }
  }

  // 2. Exact name match (case-insensitive)
  if (nameLower) {
    for (var j = 0; j < keys.length; j++) {
      if ((data.staffInfo[keys[j]].name || '').toLowerCase() === nameLower) return keys[j];
    }
  }

  // 3. Try matching against users array by name (fallback)
  if (nameLower && data.users) {
    for (var k = 0; k < data.users.length; k++) {
      if ((data.users[k].name || '').toLowerCase() === nameLower) return data.users[k].username;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════
//  FIREBASE REST
// ═══════════════════════════════════════════════

function firebaseGet() {
  const url = FIREBASE_URL + '?auth=' + FIREBASE_SECRET;
  const res = UrlFetchApp.fetch(url, {
    method:             'GET',
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error('Firebase auth failed (HTTP ' + code + '). Check FIREBASE_SECRET.');
  }
  if (code !== 200) {
    throw new Error('Firebase GET failed (HTTP ' + code + '): ' + res.getContentText().substring(0, 200));
  }

  const wrapper = JSON.parse(res.getContentText());
  return (wrapper && wrapper.data) ? wrapper.data : null;
}

function firebasePut(jsonStr) {
  const url = FIREBASE_URL + '?auth=' + FIREBASE_SECRET;
  const res = UrlFetchApp.fetch(url, {
    method:             'PUT',
    contentType:        'application/json',
    payload:            jsonStr,
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error('Firebase auth failed on PUT (HTTP ' + code + '). Check FIREBASE_SECRET.');
  }
  if (code !== 200) {
    throw new Error('Firebase PUT failed (HTTP ' + code + '): ' + res.getContentText().substring(0, 200));
  }
}

// ═══════════════════════════════════════════════
//  MANUAL TEST HELPERS
//  Run these individually in GAS to test
// ═══════════════════════════════════════════════

// Test Firebase connection only
function testFirebaseConnection() {
  try {
    const data = firebaseGet();
    Logger.log('✓ Firebase connected. Data size: ' + (data ? data.length : 0) + ' chars');
    const parsed = data ? JSON.parse(data) : {};
    Logger.log('  Keys: ' + Object.keys(parsed).join(', '));
    Logger.log('  Users: ' + (parsed.users ? parsed.users.length : 0));
    Logger.log('  StaffInfo entries: ' + Object.keys(parsed.staffInfo || {}).length);
    Logger.log('  Attendance records: ' + Object.keys(parsed.attendance || {}).length);
  } catch (e) {
    Logger.log('✗ Connection failed: ' + e.message);
  }
}

// Test sheet detection only
function testSheetDetection() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const attSheet = ss.getSheetByName(ATTENDANCE_SHEET);
  Logger.log('Attendance sheet "' + ATTENDANCE_SHEET + '": ' + (attSheet ? '✓ found' : '✗ NOT FOUND'));
  if (attSheet) {
    const h = attSheet.getRange(1, 1, 1, 8).getValues()[0];
    Logger.log('  Header row 1 (cols A–H): ' + h.map(function(v) { return typeof v + ':' + v; }).join(' | '));
  }

  const schedSheet = ss.getSheetByName(SCHEDULE_SHEET);
  Logger.log('Schedule sheet "' + SCHEDULE_SHEET + '": ' + (schedSheet ? '✓ found' : '✗ NOT FOUND'));
  if (schedSheet) {
    const h = schedSheet.getRange(1, 1, 1, 12).getValues()[0];
    Logger.log('  Header row 1 (cols A–L): ' + h.map(function(v) { return typeof v + ':' + v; }).join(' | '));
  }
}

// Test logbook sheet detection and column mapping
function testLogbookDetection() {
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const sheetName = MONTH_NAMES[new Date().getMonth()];

  try {
    const ss = SpreadsheetApp.openById(LOGBOOK_SPREADSHEET_ID);
    Logger.log('✓ Logbook spreadsheet opened.');
    Logger.log('  Available sheets: ' + ss.getSheets().map(function(s) { return s.getName(); }).join(', '));

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('✗ Sheet "' + sheetName + '" not found.');
      return;
    }
    Logger.log('✓ Sheet "' + sheetName + '" found.');

    const row1 = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row3 = sheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0];

    Logger.log('  Row 1 [H..O] (date headers):');
    row1.slice(7, 15).forEach(function(v, i) {
      Logger.log('    col ' + (i+8) + ': ' + typeof v + ' → ' + v + ' → parsed: ' + (parseDateHeader(v) || 'null'));
    });
    Logger.log('  Row 3 [H..O] (sub-headers):');
    row3.slice(7, 15).forEach(function(v, i) {
      Logger.log('    col ' + (i+8) + ': "' + v + '"');
    });

    // Count detected day columns
    var dayCols = 0;
    for (var c = 7; c < row1.length; c++) {
      if (String(row3[c]||'').trim().toLowerCase() === 'start' && parseDateHeader(row1[c])) dayCols++;
    }
    Logger.log('  Detected day columns: ' + dayCols);

    // Show first 2 data rows
    if (sheet.getLastRow() >= 5) {
      const sampleRows = sheet.getRange(5, 1, Math.min(2, sheet.getLastRow()-4), sheet.getLastColumn()).getValues();
      sampleRows.forEach(function(row, ri) {
        Logger.log('  Data row ' + (ri+5) + ': name="' + row[2] + '" | user="' + row[4] + '" | shift="' + row[6] + '"');
      });
    }
  } catch(e) {
    Logger.log('✗ Error: ' + e.message);
  }
}
