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

  // Build date columns — columns H onward (index 7+)
  const dateCols = [];
  for (var c = 7; c < headerRow.length; c++) {
    const dk = parseDateHeader(headerRow[c]);
    if (dk) dateCols.push({ colIndex: c, dateKey: dk });
  }

  result.dateCols = dateCols.length;

  if (dateCols.length === 0) {
    log('[Schedule] ⚠ No date columns found in row 1. Cols 7–10: '
      + headerRow.slice(7, 11).map(function(h) { return typeof h + ':' + h; }).join(' | '));
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
  if (typeof log !== 'function') log = function(msg) { Logger.log(msg); };
  if (!current) current = {};
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
  var allData    = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var allDisplay = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

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

  // Auto-detect sub-header row: first row after dateRow that has BOTH "start" and
  // at least one of "end"/"early"/"late" — uniquely identifies Early|Start|Late|End.
  // A plain day-name row ("Fri","Sat"…) can never satisfy both conditions.
  var subHdrRow = -1;
  for (var ri = dateRow+1; ri < Math.min(dateRow+8, allData.length); ri++) {
    var _hasStart = false, _hasOther = false;
    for (var c = 0; c < allData[ri].length; c++) {
      var _sv = String(allData[ri][c]).trim().toLowerCase();
      if (_sv === 'start') _hasStart = true;
      if (_sv === 'end' || _sv === 'early' || _sv === 'late') _hasOther = true;
    }
    if (_hasStart && _hasOther) { subHdrRow = ri; break; }
  }
  if (subHdrRow < 0) {
    log('[Logbook] ⚠ Could not find Start/Late/End/Early sub-header row after row ' + (dateRow+1));
    return result;
  }

  // Shift column is col G (index 6); date columns begin at col H (index 7)
  var shiftColIdx  = 6;
  var dataStartRow = subHdrRow + 1;

  // Build date columns: scan from shiftColIdx+1 for Start sub-headers aligned with dates
  var row1 = allData[dateRow], row3 = allData[subHdrRow], dateCols = [];
  for (var c = shiftColIdx+1; c < row1.length; c++) {
    if (String(row3[c]||'').trim().toLowerCase() !== 'start') continue;
    // Look back up to 3 cols to handle merged date header cells where the date
    // value lives in the "Early" column (c-1) rather than the "Start" column (c).
    var dk = null;
    for (var back = 0; back <= 3 && !dk; back++) {
      if (c - back > shiftColIdx) dk = parseDateHeader(row1[c - back]);
    }
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

  // uid lookup map — handle both array and numeric-keyed object (JSON sparse-array quirk)
  var usernameToUid = {};
  var _usersList = Array.isArray(current.users) ? current.users
                 : (current.users ? Object.values(current.users) : []);
  log('[Logbook] Users loaded: ' + _usersList.length);
  _usersList.forEach(function(u) {
    if (u && u.username && u.id != null) usernameToUid[String(u.username).toLowerCase()] = u.id;
  });
  // Also map from staffInfo (username → empNo hash used as uid fallback)
  if (Object.keys(usernameToUid).length === 0 && current.staffInfo) {
    log('[Logbook] ⚠ No users array — falling back to staffInfo for UID lookup');
    Object.keys(current.staffInfo).forEach(function(uname) {
      var si = current.staffInfo[uname];
      if (si && si.id != null) usernameToUid[uname.toLowerCase()] = si.id;
      else if (uname) {
        var h = 0;
        for (var ci = 0; ci < uname.length; ci++) h = (Math.imul(31, h) + uname.charCodeAt(ci)) | 0;
        usernameToUid[uname.toLowerCase()] = Math.abs(h);
      }
    });
    log('[Logbook] staffInfo fallback: ' + Object.keys(usernameToUid).length + ' entries');
  }

  if (!current.attendance) current.attendance = {};
  const now = Date.now();

  for (var ri = dataStartRow; ri < allData.length; ri++) {
    const row      = allData[ri];
    const displayRow = allDisplay[ri];
    const empNo    = String(row[1] || '').trim();
    const name     = String(row[2] || '').trim();
    const newUser  = String(row[4] || '').trim().toLowerCase(); // col E
    const oldUser  = String(row[3] || '').trim().toLowerCase(); // col D (fallback)
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
    const resolvedUser = newUser || oldUser || '';
    const debugAnhDao = resolvedUser === 'anh.dao';

    dateCols.forEach(function(col) {
      const startStr = _fmtTimeCell(displayRow[col.startColIdx]) || _fmtTimeCell(row[col.startColIdx]);
      const endStr   = _fmtTimeCell(displayRow[col.endColIdx])   || _fmtTimeCell(row[col.endColIdx]);
      if (!startStr && !endStr) return;

      if (debugAnhDao) {
        log('[Logbook][debug anh.dao] ' + col.dateKey + ' start=' + (startStr || '-') + ' end=' + (endStr || '-'));
      }

      const key = uid + '_' + col.dateKey;
      // Only write if no manual record exists (note !== 'auto'), preserving leader overrides
      const existing = current.attendance[key];
      if (existing && existing.note !== 'auto') return;

      current.attendance[key] = {
        start: startStr || '',
        end:   endStr   || '',
        note:  'auto',
        by:    null,
        at:    now,
      };
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
    // IMPORTANT: use UTC fields for time-only cells.
    // Sheets stores time as a serial anchored to 1899-12-30. Converting via local
    // timezone can apply historical offsets (e.g. odd +00:24/+00:42 mins), causing
    // all imported check-ins to look late. UTC avoids that skew.
    const h = val.getUTCHours(), m = val.getUTCMinutes(), s = val.getUTCSeconds();
    if (h === 0 && m === 0 && s === 0) return ''; // blank cell often returns midnight
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  // Fractional day 0..1 stored as raw number
  if (typeof val === 'number' && val >= 0 && val < 1) {
    if (val === 0) return '00:00:00'; // midnight valid for Shift D
    var ts = Math.round(val * 86400);
    var h = Math.floor(ts/3600), m = Math.floor((ts%3600)/60), s = ts%60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  // Plain string — strip blanks/dashes
  const str = String(val).trim();
  if (!str || str === '—' || str === '-' || str === '0') return '';

  // 12-hour format from display values, e.g. "2:58:39 PM" or "2:58 PM"
  const m12 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (m12) {
    var h = parseInt(m12[1], 10) % 12;
    const mm = parseInt(m12[2], 10);
    const ss = parseInt(m12[3] || '0', 10);
    const ap = m12[4].toUpperCase();
    if (ap === 'PM') h += 12;
    return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  }

  // 24-hour string with optional seconds
  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const hh = parseInt(m24[1], 10);
    const mm = parseInt(m24[2], 10);
    const ss = parseInt(m24[3] || '0', 10);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60 && ss >= 0 && ss < 60) {
      return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
    }
  }

  return str;
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
  // Time-only cells are anchored to the 1899-12-30 epoch — reject them to prevent
  // attendance time values from being mistaken for date headers.
  if (h instanceof Date) {
    if (h.getFullYear() < 1970) return null;
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
//  POLICY SYNC
//  Standalone entry point — set its own 12AM–1AM trigger.
//  Reads policy violation records from the policy spreadsheet
//  and merges them into state.policyCompliance in Firebase.
//
//  Spreadsheet ID: 1W1cVlJmq_JomZRhROHudWiFQsX_B66-OornRVBx-3RQ
//  Sheet: "All records" (or first sheet if not found)
//  Expected columns (detected by header row, case-insensitive):
//    date, name, emp no / empno, username, role, shift,
//    event, leader, status, note / notes
//
//  Run createPolicyTrigger() once to install the 12AM–1AM daily trigger.
// ═══════════════════════════════════════════════

const POLICY_SPREADSHEET_ID = '1W1cVlJmq_JomZRhROHudWiFQsX_B66-OornRVBx-3RQ';
const POLICY_SHEET_NAME     = 'All records'; // adjust if your sheet is named differently

function dailySyncPolicy() {
  var startTime = new Date();
  var log = [];
  function addLog(msg) { Logger.log(msg); log.push(msg); }

  try {
    addLog('=== Policy Sync Start: ' + startTime.toISOString() + ' ===');

    addLog('[Firebase] Fetching current data…');
    var raw     = firebaseGet();
    var current = raw ? JSON.parse(raw) : {};
    addLog('[Firebase] Fetch OK.');

    var result = syncPolicy(current, addLog);

    addLog('[Firebase] Pushing updated data…');
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
    addLog('[Firebase] Push OK.');

    var duration = ((new Date() - startTime) / 1000).toFixed(1);
    addLog('=== Policy Sync Complete in ' + duration + 's: '
      + result.written + ' written, ' + result.skipped + ' skipped, '
      + result.total + ' total records ===');

  } catch(e) {
    var errMsg = '✗ Policy Sync FAILED: ' + e.message + '\n\nStack: ' + e.stack;
    Logger.log(errMsg);
    try {
      MailApp.sendEmail({
        to:      NOTIFY_EMAIL,
        subject: '⚠ PAVE Policy Sync Failed — ' + Utilities.formatDate(startTime, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'),
        body:    'Policy sync failed:\n\n' + e.message + '\n\nLog:\n' + log.join('\n'),
      });
    } catch(mailErr) { Logger.log('Mail failed: ' + mailErr.message); }
    throw e;
  }
}

function syncPolicy(current, log) {
  var result = { written: 0, skipped: 0, total: 0 };

  var ss;
  try { ss = SpreadsheetApp.openById(POLICY_SPREADSHEET_ID); }
  catch(e) {
    log('[Policy] ✗ Cannot open spreadsheet: ' + e.message);
    return result;
  }

  // Find the target sheet
  var sheet = ss.getSheetByName(POLICY_SHEET_NAME);
  if (!sheet) {
    // Fall back to the first sheet
    var sheets = ss.getSheets();
    if (sheets.length === 0) { log('[Policy] ✗ No sheets found.'); return result; }
    sheet = sheets[0];
    log('[Policy] ⚠ Sheet "' + POLICY_SHEET_NAME + '" not found, using "' + sheet.getName() + '"');
  } else {
    log('[Policy] Sheet "' + sheet.getName() + '" found.');
  }

  var lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 3) {
    log('[Policy] ⚠ Sheet appears empty (lastRow=' + lastRow + ', lastCol=' + lastCol + ')');
    return result;
  }

  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var header  = allData[0].map(function(h) { return String(h||'').trim().toLowerCase(); });

  // Map header names → column indices (exact match, then contains-match fallback)
  function col(names) {
    for (var i = 0; i < names.length; i++) {
      var idx = header.indexOf(names[i]);
      if (idx >= 0) return idx;
    }
    // Fallback: find first header that contains any of the name strings
    for (var i = 0; i < names.length; i++) {
      for (var j = 0; j < header.length; j++) {
        if (header[j].indexOf(names[i]) >= 0) return j;
      }
    }
    return -1;
  }

  var C = {
    date:    col(['date','violation date','date of violation']),
    name:    col(['name','full name','employee name']),
    empNo:   col(['emp no','empno','emp. no','employee no','employee number','emp #']),
    username:col(['user name','username','user','login']),
    role:    col(['role','position']),
    shift:   col(['shift']),
    event:   col(['event','event code','violation','violation code','code']),
    leader:   col(['leader','sub-admin','team leader','direct leader','tl']),
    status:   col(['status']),
    note:     col(['description','note','notes','remarks','remark','details']),
    duration: col(['duration','duration (minutes)','duration(minutes)','time','minutes']),
    imageLink:col(['image link','imagelink','image','link','drive link','screenshot']),
    agentFb:  col(['agent feedback','agentfeedback','feedback','agent fb']),
  };

  log('[Policy] Column map: date=' + C.date + ' name=' + C.name + ' username=' + C.username
    + ' event=' + C.event + ' leader=' + C.leader + ' status=' + C.status
    + (C.leader >= 0 ? ' (leader header: "' + header[C.leader] + '")' : ' ← LEADER NOT FOUND'));

  if (C.date < 0 || C.event < 0) {
    log('[Policy] ✗ Required columns "date" and "event" not found. Header: ' + header.join(' | '));
    return result;
  }

  if (!current.policyCompliance) current.policyCompliance = [];
  var existing = current.policyCompliance;

  // Build index map: deKey → array index (for in-place updates of GAS records)
  var existingIdx = {};
  existing.forEach(function(r, i) {
    var k = (r.date||'') + '|' + (r.username||r.name||'') + '|' + (r.event||'');
    existingIdx[k] = i;
  });

  // Track max `no` so new records get sequential numbers
  var maxNo = existing.reduce(function(m, r) { return Math.max(m, r.no || 0); }, 0);

  for (var ri = 1; ri < allData.length; ri++) {
    var row = allData[ri];

    // Skip blank rows
    var dateRaw = C.date >= 0 ? row[C.date] : '';
    if (dateRaw === null || dateRaw === undefined || dateRaw === '') continue;

    // Parse date → YYYY-MM-DD
    var dateStr = _parsePolicyDate(dateRaw);
    if (!dateStr) { result.skipped++; continue; }

    var eventCode = C.event >= 0 ? String(row[C.event]||'').trim() : '';
    if (!eventCode) { result.skipped++; continue; }

    var name        = C.name     >= 0 ? String(row[C.name]    ||'').trim() : '';
    var empNo       = C.empNo    >= 0 ? String(row[C.empNo]   ||'').trim() : '';
    var username    = C.username >= 0 ? String(row[C.username]||'').trim().toLowerCase() : '';
    var role        = C.role     >= 0 ? String(row[C.role]    ||'').trim() : '';
    var shift       = C.shift    >= 0 ? String(row[C.shift]   ||'').trim().toUpperCase() : '';
    var leader      = C.leader   >= 0 ? String(row[C.leader]  ||'').trim().toLowerCase() : '';
    var status      = C.status   >= 0 ? String(row[C.status]  ||'').trim() : 'Need Review';
    var description = C.note     >= 0 ? String(row[C.note]    ||'').trim() : '';
    var duration    = C.duration >= 0 ? String(row[C.duration]||'').trim() : '';
    var imageLink   = C.imageLink>= 0 ? String(row[C.imageLink]||'').trim() : '';
    var agentFb     = C.agentFb  >= 0 ? String(row[C.agentFb] ||'').trim() : '';

    // Normalise status
    var statusMap = {
      'resolved':'Resolved', 'done':'Resolved', 'closed':'Resolved',
      'processing':'Processing', 'in progress':'Processing',
      'need review':'Need Review', 'pending':'Need Review', 'new':'Need Review',
      'need resolve':'Need Resolve', 'cancelled':'Cancelled', 'cancel':'Cancelled',
      'to be reviewed':'Cancelled',
    };
    status = statusMap[status.toLowerCase()] || status || 'Need Review';

    result.total++;

    var deKey = dateStr + '|' + (username||name) + '|' + eventCode;

    // If record already exists AND was synced by GAS, update it in place (fixes empty leader etc.)
    if (deKey in existingIdx) {
      var ex = existing[existingIdx[deKey]];
      if (ex.by === 'gs_sync') {
        ex.leader      = leader      || ex.leader;
        ex.name        = name        || ex.name;
        ex.empNo       = empNo       || ex.empNo;
        ex.role        = role        || ex.role;
        ex.shift       = shift       || ex.shift;
        ex.description = description || ex.description || '';
        ex.duration    = duration    || ex.duration    || '';
        ex.imageLink   = imageLink   || ex.imageLink   || '';
        ex.agentFeedback = agentFb  || ex.agentFeedback || '';
        ex.status      = status;
        ex.at          = Date.now();
        // Ensure default fields are present
        if (ex.leaderConfirm      === undefined) ex.leaderConfirm      = '';
        if (ex.feedbackReadByLeader === undefined) ex.feedbackReadByLeader = false;
        if (ex.mailCheck          === undefined) ex.mailCheck          = false;
        if (ex.warningMailDate    === undefined) ex.warningMailDate    = '';
        if (!ex.no) ex.no = ++maxNo;
        result.written++;
      } else {
        result.skipped++; // manually-edited record — never overwrite
      }
      continue;
    }
    existingIdx[deKey] = existing.length;

    // Generate a stable id
    var id = 'gs_' + Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      dateStr + '|' + (username||name) + '|' + eventCode
    ).map(function(b){ return ('0'+(b<0?b+256:b).toString(16)).slice(-2); }).join('').slice(0,12);

    existing.push({
      id:                 id,
      no:                 ++maxNo,
      date:               dateStr,
      name:               name,
      empNo:              empNo,
      username:           username,
      role:               role,
      shift:              shift,
      event:              eventCode,
      leader:             leader,
      status:             status,
      description:        description,
      duration:           duration,
      imageLink:          imageLink,
      agentFeedback:      agentFb,
      leaderConfirm:      '',
      feedbackReadByLeader: false,
      mailCheck:          false,
      warningMailDate:    '',
      by:                 'gs_sync',
      at:                 Date.now(),
    });
    result.written++;
  }

  log('[Policy] Done: ' + result.written + ' new records written, '
    + result.skipped + ' skipped (duplicate/invalid), '
    + result.total + ' rows processed');
  return result;
}

// Parse a date value from the spreadsheet → 'YYYY-MM-DD' or null
function _parsePolicyDate(val) {
  if (!val && val !== 0) return null;

  // GAS Date object
  if (val instanceof Date) {
    var y = val.getFullYear(), mo = val.getMonth()+1, d = val.getDate();
    if (y < 2020 || y > 2099) return null;
    return y + '-' + String(mo).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  }

  // Excel serial (GAS sometimes gives raw numbers for date cells)
  if (typeof val === 'number') {
    if (val < 40000 || val > 60000) return null;
    var ms  = new Date(Date.UTC(1899,11,30)).getTime() + Math.round(val) * 86400000;
    var dt  = new Date(ms);
    return dt.getUTCFullYear() + '-'
      + String(dt.getUTCMonth()+1).padStart(2,'0') + '-'
      + String(dt.getUTCDate()).padStart(2,'0');
  }

  // String formats
  var s = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // DD/MM/YYYY or D/M/YYYY
  var m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return m1[3] + '-' + m1[2].padStart(2,'0') + '-' + m1[1].padStart(2,'0');
  // MM/DD/YYYY (US)
  var m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return m2[3] + '-' + m2[1].padStart(2,'0') + '-' + m2[2].padStart(2,'0');
  // DD/MM/YY
  var m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m3) return '20'+m3[3] + '-' + m3[2].padStart(2,'0') + '-' + m3[1].padStart(2,'0');

  return null;
}

// Run once in GAS to install the 12AM–1AM daily trigger for policy sync.
function createPolicyTrigger() {
  // Remove any existing policy triggers first to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'dailySyncPolicy') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySyncPolicy')
    .timeBased()
    .atHour(0)        // midnight local time
    .nearMinute(30)   // ~12:30AM for spread
    .everyDays(1)
    .create();
  Logger.log('✓ Policy sync trigger created: dailySyncPolicy runs daily 12AM–1AM');
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
function runSyncLogbook() {
  const raw     = firebaseGet();
  const current = raw ? JSON.parse(raw) : {};
  const usersRaw = current.users;
  const usersArr = Array.isArray(usersRaw) ? usersRaw : (usersRaw ? Object.values(usersRaw) : []);
  Logger.log('[runSyncLogbook] Firebase keys: ' + Object.keys(current).join(', '));
  Logger.log('[runSyncLogbook] Users type: ' + (Array.isArray(usersRaw) ? 'array' : typeof usersRaw) + ', count: ' + usersArr.length);
  if (usersArr.length > 0) Logger.log('[runSyncLogbook] Sample user: ' + JSON.stringify(usersArr[0]).substring(0, 120));
  const result  = syncLogbook(current);
  if (result.imported > 0 || result.dateCols > 0) {
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
    Logger.log('[runSyncLogbook] Pushed to Firebase.');
  }
  Logger.log('[runSyncLogbook] Done: ' + result.imported + ' imported, ' + result.skipped + ' skipped, ' + result.dateCols + ' day cols');
}

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
