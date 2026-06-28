// ═══════════════════════════════════════════════
//  PAVE — Google Apps Script
//  Merged: Attendance Sync + Schedule Sync + Logbook Sync
//  Trigger: Daily (e.g. 6AM–7AM)
// ═══════════════════════════════════════════════
const SPREADSHEET_ID          = '19YqrS2ls7V74bJMQNjWavXTYEeRiMZDptbA_vKK2aPs';
const SLACK_WEBHOOK_A         = ''; // paste shift-a-15h-00h webhook URL here
const SLACK_WEBHOOK_D         = ''; // paste shift-d-00h-09h webhook URL here
const SLACK_WEBHOOK_E         = ''; // paste shift-e-09h-18h webhook URL here
const SLACK_BOT_TOKEN         = 'xoxb-...'; // xoxb-... bot token (OAuth, files:write + chat:write scope)
const SLACK_CHANNEL_A         = ''; // channel ID for shift-a-15h-00h  (right-click channel → Copy link → last segment)
const SLACK_CHANNEL_D         = ''; // channel ID for shift-d-00h-09h
const SLACK_CHANNEL_E         = ''; // channel ID for shift-e-09h-18h
const LOGBOOK_SPREADSHEET_ID  = '1-OKeOsCVKO208UwWcjAtLqYOVMdNuFDR6fxxTHQi0ao';
const FIREBASE_URL            = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json';
const FIREBASE_SECRET         = 'W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK';
const ATTENDANCE_SHEET        = 'Attendance-June-2026'; // update each month
const SCHEDULE_SHEET          = 'Schedule Jul_26';     // update each month
const WORKING_TIME_SHEET      = 'Working Time-June-26'; // update each month (format: 'Working Time-Mon-YY')
const NOTIFY_EMAIL            = Session.getActiveUser().getEmail();
const POLICY_SPREADSHEET_ID = '1W1cVlJmq_JomZRhROHudWiFQsX_B66-OornRVBx-3RQ';
const POLICY_SHEET_NAME     = 'Policy compliance-2026'; // adjust if your sheet is named differently

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

    // ── 4b. Sync working time (Late/Early/Training/Others in minutes) ──
    const wtResult = syncWorkingTime(current, addLog);

    // ── 5. Push back to Firebase ──
    addLog('[Backup] Saving full daily JSON backup to Google Drive…');
    saveDriveBackup(current, addLog);

    addLog('[Purge] Purging historical active state data older than 90 days…');
    purgeActiveState(current, addLog);

    addLog('[Firebase] Pushing updated data…');
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
    addLog('[Firebase] Push OK.');

    // ── 6. Summary ──
    const duration = ((new Date() - startTime) / 1000).toFixed(1);
    addLog('=== Sync Complete in ' + duration + 's ===');
    addLog('  Attendance:    ' + attResult.imported + ' matched, ' + attResult.skipped + ' skipped, ' + attResult.dateCols + ' date cols');
    addLog('  Schedule:      ' + schedResult.updated + ' users updated, ' + schedResult.dateCols + ' date cols');
    addLog('  Logbook:       ' + logbookResult.imported + ' matched, ' + logbookResult.skipped + ' skipped, ' + logbookResult.dateCols + ' day cols');
    addLog('  Working Time:  ' + wtResult.updated + ' users updated, ' + wtResult.dateCols + ' date cols');

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
  if (current.gasConfig && current.gasConfig.syncAttendance === false) {
    log('[Attendance] Skipped (disabled via GAS Function Controls in web app).');
    return result;
  }
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
  if (typeof log !== 'function') log = function(m) { console.log(m); };
  const result = { updated: 0, dateCols: 0 };
  if (current.gasConfig && current.gasConfig.syncSchedule === false) {
    log('[Schedule] Skipped (disabled via GAS Function Controls in web app).');
    return result;
  }
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
  if (!sheet) {
    log('[Schedule] ✗ Sheet "' + SCHEDULE_SHEET + '" not found. Available: '
      + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
    return result;
  }

  const lastCol   = sheet.getLastColumn();
  const lastRow   = sheet.getLastRow();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]; // Row 1 = dates
  const row2      = sheet.getRange(2, 1, 1, lastCol).getValues()[0]; // Row 2 = subheaders
  let dataRows    = sheet.getRange(4, 1, Math.max(1, lastRow - 3), lastCol).getValues(); // Row 4+

  // Detect sheet layout by looking at Row 2 subheaders
  var isJulyLayout = false;
  if (row2 && row2.length > 3) {
    var valB = String(row2[1] || '').trim().toUpperCase();
    var valC = String(row2[2] || '').trim().toUpperCase();
    var valD = String(row2[3] || '').trim().toUpperCase();
    if (valB === 'NEW' || valC === 'OLD' || valD.indexOf('NAME') >= 0) {
      isJulyLayout = true;
    }
  }

  // Shifts start column: index 8 (Col I) for July layout, index 7 (Col H) for June layout
  const shiftStartCol = isJulyLayout ? 8 : 7;
  const dateCols = [];
  for (var c = shiftStartCol; c < headerRow.length; c++) {
    const dk = parseDateHeader(headerRow[c]);
    if (dk) dateCols.push({ colIndex: c, dateKey: dk });
  }

  result.dateCols = dateCols.length;

  if (dateCols.length === 0) {
    log('[Schedule] ⚠ No date columns found in row 1. Start index: ' + shiftStartCol);
    return result;
  }

  log('[Schedule] ' + dateCols.length + ' date columns | ' + dataRows.length + ' staff rows | July layout: ' + isJulyLayout);

  var _usersRaw = current.users;
  log('[Schedule] users debug: typeof=' + typeof _usersRaw + ' isArray=' + Array.isArray(_usersRaw));
  if (!Array.isArray(_usersRaw)) {
    current.users = [];
    if (_usersRaw && typeof _usersRaw === 'object') {
      var _keys = Object.keys(_usersRaw);
      for (var _ki = 0; _ki < _keys.length; _ki++) {
        var _u = _usersRaw[_keys[_ki]];
        if (_u) current.users.push(_u);
      }
    }
    log('[Schedule] users normalized: ' + current.users.length + ' entries');
  }

  // ── Sync approved dayoff-swaps BACK to the Google Sheet ──
  if (current.requests && Array.isArray(current.requests)) {
    var unsynced = current.requests.filter(function(r) {
      return r.type === 'dayoff-swap' && r.status === 'approved' && !r.syncedToSheet;
    });

    if (unsynced.length > 0) {
      log('[Schedule] Found ' + unsynced.length + ' approved day-off swaps to sync back to GSheet.');
      
      var userRowMap = {}; // username -> sheet row number (1-indexed)
      dataRows.forEach(function(row, idx) {
        var usernameCol = isJulyLayout ? 4 : 3;
        var username = String(row[usernameCol] || '').trim().toLowerCase();
        if (username) userRowMap[username] = idx + 4;
      });

      var dateColMap = {}; // dateKey -> sheet column number (1-indexed)
      dateCols.forEach(function(col) {
        dateColMap[col.dateKey] = col.colIndex + 1;
      });

      unsynced.forEach(function(r) {
        var rowRequester = userRowMap[r.username.toLowerCase()];
        var rowTarget = userRowMap[r.targetUsername.toLowerCase()];
        var colMyDate = dateColMap[r.myDate];
        var colTheirDate = dateColMap[r.theirDate];

        if (!rowRequester) { log('[Schedule] ✗ Requester row not found in sheet for: ' + r.username); return; }
        if (!rowTarget) { log('[Schedule] ✗ Target row not found in sheet for: ' + r.targetUsername); return; }
        if (!colMyDate) { log('[Schedule] ✗ Column not found in sheet for date: ' + r.myDate); return; }
        if (!colTheirDate) { log('[Schedule] ✗ Column not found in sheet for date: ' + r.theirDate); return; }

        // Determine shifts by checking most frequent shift value in the row
        var getShiftFromRow = function(rowNum) {
          var rowValues = sheet.getRange(rowNum, shiftStartCol + 1, 1, lastCol - shiftStartCol).getValues()[0];
          var counts = {};
          rowValues.forEach(function(val) {
            var v = String(val || '').trim().toUpperCase();
            if (v && v !== '0' && v !== 'OFF') counts[v] = (counts[v] || 0) + 1;
          });
          var best = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; })[0];
          return best || 'A';
        };

        var shiftRequester = getShiftFromRow(rowRequester);
        var shiftTarget = getShiftFromRow(rowTarget);

        // Update GSheet cells
        sheet.getRange(rowRequester, colMyDate).setValue(shiftRequester);
        sheet.getRange(rowRequester, colTheirDate).setValue('0');

        sheet.getRange(rowTarget, colTheirDate).setValue(shiftTarget);
        sheet.getRange(rowTarget, colMyDate).setValue('0');

        r.syncedToSheet = true;
        log('[Schedule] ✓ Synced day-off swap to GSheet for ' + r.username + ' ↔ ' + r.targetUsername);
      });
      
      // Re-read dataRows from GSheet
      dataRows = sheet.getRange(4, 1, Math.max(1, lastRow - 3), lastCol).getValues();
    }
  }

  var notFound = [];

  dataRows.forEach(function(row) {
    var usernameCol = isJulyLayout ? 4 : 3; // Col E (index 4) for July, Col D (index 3) for June
    var _rawUn = row[usernameCol];
    if (_rawUn instanceof Date || typeof _rawUn === 'number') return; // date-formatted cell — skip
    var username = String(_rawUn || '').trim().toLowerCase();
    if (!username) return;

    var userIdx = current.users.findIndex(function(u) {
      return (u.username || '').toLowerCase() === username;
    });

    if (userIdx === -1) {
      var nameCol = isJulyLayout ? 3 : 2; // Col D (index 3) for July, Col C (index 2) for June
      var roleCol = isJulyLayout ? 6 : 5; // Col G (index 6) for July, Col F (index 5) for June
      var teamCol = 1; // Col B (index 1) is team in both layouts
      
      var newName = String(row[nameCol] || '').trim();
      if (!newName) { notFound.push(username); return; }
      var newRole = String(row[roleCol] || '').trim();
      var newTeam = String(row[teamCol] || '').trim();
      var h = 0;
      for (var ci = 0; ci < username.length; ci++) {
        h = ((h << 5) - h) + username.charCodeAt(ci); h |= 0;
      }
      current.users.push({
        id: Math.abs(h), username: username,
        name: newName, role: newRole, team: newTeam
      });
      userIdx = current.users.length - 1;
      result.created = (result.created || 0) + 1;
    } else {
      var teamCol = 1;
      var roleCol = isJulyLayout ? 6 : 5;
      var updTeam = String(row[teamCol] || '').trim();
      var updRole = String(row[roleCol] || '').trim();
      if (updTeam) current.users[userIdx].team = updTeam;
      if (updRole) current.users[userIdx].role = updRole;
    }

    if (!current.staffSchedule) current.staffSchedule = {};
    if (!current.staffSchedule[username]) current.staffSchedule[username] = {};

    dateCols.forEach(function(col) {
      const raw   = String(row[col.colIndex] || '').trim().toUpperCase();
      const value = (!raw || raw === '0' || raw === 'OFF' || raw === '') ? '0' : raw;
      current.staffSchedule[username][col.dateKey] = value;
    });

    result.updated++;
  });

  if (notFound.length > 0) {
    log('[Schedule] ⚠ ' + notFound.length + ' usernames not found in Firebase users: '
      + notFound.slice(0, 5).join(', ') + (notFound.length > 5 ? '…' : ''));
  }

  // Stamp timestamp — app detects this and triggers auto-assign
  current._usersUpdatedAt = Date.now();

  log('[Schedule] Done: ' + result.updated + ' users updated'
    + (result.created ? ', ' + result.created + ' created' : ''));
  return result;
}

// Run this directly from the GAS editor to test schedule sync
function runSyncSchedule() {
  var current = firebaseGet(FIREBASE_URL, FIREBASE_SECRET) || {};
  syncSchedule(current, function(m) { console.log(m); });
  firebaseSet(FIREBASE_URL, FIREBASE_SECRET, current);
}

// ═══════════════════════════════════════════════
//  WORKING TIME SYNC
//  Reads the 'Working Time-June-26' sheet.
//  Expected layout (WIDE format, one value per date column):
//    Row 1 (or 2): date headers — one column per date
//    Row 2 (or 3): sub-headers — Username/Name/No + one column per date (day name optional)
//    Row 3+: one row per staff; each date column contains the total working-time deviation (minutes)
//
//  The LATE / EARLY / TRAINING / OTHER columns are SUMMARY totals and are SKIPPED.
//  Only columns whose header parses as a date are imported.
//  Result stored as: current.workingTime[username][monthKey][dateKey] = { total: <minutes> }
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  WORKING TIME HELPER
//  Parses cell values like "L050", "E060", "T120", "50" into minutes (integer 50, 60, 120).
// ═══════════════════════════════════════════════
function parseWorkingTimeValue(val) {
  if (val === null || val === undefined) return null;
  var str = String(val).trim().toUpperCase();
  if (str === '') return null;
  
  // Strip any non-digit character and parse the rest as integer
  var numStr = str.replace(/[^0-9]/g, '');
  if (numStr === '') return null;
  
  var parsed = parseInt(numStr, 10);
  return isNaN(parsed) ? null : parsed;
}

// ═══════════════════════════════════════════════
//  WORKING TIME SYNC
//  Reads the 'Working Time-June-26' sheet.
//  Expected layout (WIDE format, one value per date column):
//    Row 1 (or 2): date headers — one column per date
//    Row 2 (or 3): sub-headers — Username/Name/No + one column per date (day name optional)
//    Row 3+: one row per staff; each date column contains the total working-time deviation (minutes)
//
//  The LATE / EARLY / TRAINING / OTHER columns are SUMMARY totals and are SKIPPED.
//  Only columns whose header parses as a date are imported.
//  Result stored as: current.workingTime[username][monthKey][dateKey] = { total: <minutes> }
// ═══════════════════════════════════════════════
function syncWorkingTime(current, log) {
  if (typeof log !== 'function') log = function(m) { Logger.log(m); };
  var _selfFetched = false;
  if (!current || (!current.users && !current.staffInfo)) {
    log('[WorkingTime] current.users missing — fetching from Firebase…');
    var _raw = firebaseGet();
    current = _raw ? JSON.parse(_raw) : (current || {});
    log('[WorkingTime] Firebase keys after fetch: ' + Object.keys(current).join(', '));
    _selfFetched = true;
  }
  var result = { updated: 0, dateCols: 0 };
  if (current.gasConfig && current.gasConfig.syncWorkingTime === false) {
    log('[WorkingTime] Skipped (disabled via GAS Function Controls in web app).');
    return result;
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    log('[WorkingTime] ✗ Cannot open spreadsheet: ' + e.message);
    return result;
  }

  var sheet = ss.getSheetByName(WORKING_TIME_SHEET);
  if (!sheet) {
    log('[WorkingTime] ✗ Sheet "' + WORKING_TIME_SHEET + '" not found. Available: '
      + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
    return result;
  }

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow < 3 || lastCol < 4) {
    log('[WorkingTime] ⚠ Sheet appears empty (lastRow=' + lastRow + ', lastCol=' + lastCol + ').');
    return result;
  }

  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // ── Step 1: find the date header row (most parseable date cells in first 5 rows) ──
  var dateRowIdx = -1, bestCnt = 0;
  for (var ri = 0; ri < Math.min(5, allData.length); ri++) {
    var cnt = 0;
    for (var c = 0; c < allData[ri].length; c++) { if (parseDateHeader(allData[ri][c])) cnt++; }
    if (cnt > bestCnt) { bestCnt = cnt; dateRowIdx = ri; }
  }
  if (dateRowIdx < 0 || bestCnt < 1) {
    log('[WorkingTime] ⚠ No date header row found in first 5 rows.');
    return result;
  }

  // ── Step 2: Detect employee number and name columns ──
  var empNoColIdx = 1; // default Col B
  var nameColIdx = 2;  // default Col C
  for (var r = 0; r < Math.min(3, allData.length); r++) {
    var row = allData[r];
    for (var c = 0; c < row.length; c++) {
      var val = String(row[c] || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (val.indexOf('employee number') !== -1 || val.indexOf('emp no') !== -1 || val === 'id' || val === 'no.') {
        if (val !== 'no.') { // avoid matching 'no.' sequence column
          empNoColIdx = c;
        }
      } else if (val === 'name' || val === 'full name') {
        nameColIdx = c;
      }
    }
  }

  // ── Step 3: Find where data rows actually start ──
  var dataStartRowIdx = -1;
  for (var r = dateRowIdx + 1; r < allData.length; r++) {
    var empVal = String(allData[r][empNoColIdx] || '').trim();
    var nameVal = String(allData[r][nameColIdx] || '').trim();
    if (empVal && empVal !== 'Employee Number' && empVal !== 'Employee\nNumber' && empVal !== 'Emp No.' && !empVal.startsWith('=')) {
      if (empVal.toUpperCase().indexOf('AG') === 0 || nameVal !== '') {
        dataStartRowIdx = r;
        break;
      }
    }
  }
  if (dataStartRowIdx < 0) dataStartRowIdx = dateRowIdx + 1; // fallback

  log('[WorkingTime] dateRow=' + (dateRowIdx+1) + ' empNoCol=' + (empNoColIdx+1) + ' nameCol=' + (nameColIdx+1) + ' dataStart=' + (dataStartRowIdx+1));

  // ── Step 4: build list of date columns — only columns that have a parseable date in dateRowIdx ──
  //           Skip any column whose sub-header/header label matches LATE/EARLY/TRAINING/OTHER/TOTAL
  var SKIP_LABELS = ['late','early','training','other','others','total'];
  var dateHdrRow = allData[dateRowIdx];
  var dateCols = []; // { colIndex, dateKey }
  for (var c = 0; c < lastCol; c++) {
    var dk = parseDateHeader(dateHdrRow[c]);
    if (!dk) continue;
    
    // Check header or cell value for SKIP_LABELS
    var cellVal = String(dateHdrRow[c] || '').trim().toLowerCase();
    if (SKIP_LABELS.indexOf(cellVal) !== -1) continue;
    
    // Also check any cells below in header area (like row 2) for skip labels
    var isSkip = false;
    for (var r = dateRowIdx + 1; r < dataStartRowIdx; r++) {
      var subVal = String(allData[r][c] || '').trim().toLowerCase();
      if (SKIP_LABELS.indexOf(subVal) !== -1) { isSkip = true; break; }
    }
    if (isSkip) continue;
    
    dateCols.push({ colIndex: c, dateKey: dk });
  }

  result.dateCols = dateCols.length;
  log('[WorkingTime] ' + dateCols.length + ' date columns to import (LATE/EARLY/TRAINING/OTHER skipped).');

  if (dateCols.length === 0) {
    log('[WorkingTime] ⚠ No importable date columns found.');
    return result;
  }

  // ── Step 5: determine monthKey from first date ──
  var firstDk = dateCols[0].dateKey;
  var fdParts = firstDk.split('/');
  var fdDay   = parseInt(fdParts[0]);
  var fdMon   = parseInt(fdParts[1]);
  var fdYear  = new Date().getFullYear();
  var fdMonth = fdDay >= 25 ? fdMon + 1 : fdMon;
  if (fdMonth > 12) { fdMonth = 1; fdYear++; }
  var monthKey = fdYear + '-' + String(fdMonth).padStart(2, '0');
  log('[WorkingTime] Working month key: ' + monthKey);

  if (!current.workingTime) current.workingTime = {};

  // ── Step 6: parse data rows ──
  for (var ri = dataStartRowIdx; ri < allData.length; ri++) {
    var row = allData[ri];
    var empVal = String(row[empNoColIdx] || '').trim();
    var nameVal = String(row[nameColIdx] || '').trim();
    if (!empVal && !nameVal) continue;

    var username = findUsername(current, nameVal, empVal);
    if (!username) {
      // Fallback: match by employee number directly if username not found
      if (empVal && empVal.toUpperCase().indexOf('AG') === 0) {
        username = empVal.toLowerCase();
      } else {
        continue;
      }
    }

    if (!current.workingTime[username]) current.workingTime[username] = {};
    if (!current.workingTime[username][monthKey]) current.workingTime[username][monthKey] = {};

    var hasAny = false;
    dateCols.forEach(function(col) {
      var rawVal = row[col.colIndex];
      var mins = parseWorkingTimeValue(rawVal);
      if (mins === null || mins <= 0) return;
      
      var existing = current.workingTime[username][monthKey][col.dateKey] || {};
      existing.total = mins;
      current.workingTime[username][monthKey][col.dateKey] = existing;
      hasAny = true;
    });

    if (hasAny) result.updated++;
  }

  log('[WorkingTime] Done: ' + result.updated + ' users synced for ' + monthKey);
  if (_selfFetched) {
    log('[WorkingTime] Saving updated state back to Firebase…');
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
  }
  return result;
}

// ═══════════════════════════════════════════════
//  LOGBOOK SYNC
//  Reads clock-in (Start) and clock-out (End) per employee per day.
//  Writes to state.logbook[uid_dateKey] so the web app can
//  auto-calculate Late / Early. Row/col layout is FULLY DYNAMIC.
// ═══════════════════════════════════════════════
function syncLogbook(current, log, monthOverride) {
  if (typeof log !== 'function') log = function(msg) { Logger.log(msg); };
  // Self-fetch if called without populated state (e.g. syncLogbook() from GAS editor)
  var _selfFetched = false;
  if (!current || (!current.users && !current.staffInfo)) {
    log('[Logbook] current.users missing — fetching from Firebase…');
    var _raw = firebaseGet();
    current = _raw ? JSON.parse(_raw) : (current || {});
    log('[Logbook] Firebase keys after fetch: ' + Object.keys(current).join(', '));
    _selfFetched = true;
  }
  var result = { imported: 0, skipped: 0, dateCols: 0 };
  if (current.gasConfig && current.gasConfig.syncLogbook === false) {
    log('[Logbook] Skipped (disabled via GAS Function Controls in web app).');
    return result;
  }

  var MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
  // monthOverride: 0-based month index (0=Jan … 11=Dec); defaults to current month
  var _month = (typeof monthOverride === 'number' && monthOverride >= 0 && monthOverride <= 11)
             ? monthOverride : new Date().getMonth();
  var sheetName = MONTH_NAMES[_month];

  var ss;
  try { ss = SpreadsheetApp.openById(LOGBOOK_SPREADSHEET_ID); }
  catch(e) {
    log('[Logbook] ✗ Cannot open logbook spreadsheet: ' + e.message);
    return result;
  }

  var sheet = getOrCreateMonthlyLogbookSheet(ss, sheetName, log);
  if (!sheet) {
    log('[Logbook] ✗ Monthly sheet "' + sheetName + '" could not be found or created.');
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
    // Detect End column: scan forward up to 5 cols for 'end' in sub-header row
    var endColIdx = c + 2; // fallback
    for (var ec = c + 1; ec <= c + 5; ec++) {
      if (String(row3[ec]||'').trim().toLowerCase() === 'end') { endColIdx = ec; break; }
    }
    dateCols.push({ dateKey: dk, startColIdx: c, endColIdx: endColIdx });
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

  if (!current.logbook) current.logbook = {};
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

    // Exclude leaders, supervisors, and training roles from logbook import
    var resolvedUser = newUser || oldUser || '';
    var _userRole = '';
    if (resolvedUser && current.staffInfo && current.staffInfo[resolvedUser]) {
      _userRole = String(current.staffInfo[resolvedUser].role || '').toLowerCase();
    }
    if (!_userRole) {
      var _mu2 = (Array.isArray(current.users) ? current.users : Object.values(current.users||{}))
                   .find(function(u){ return u && u.id === uid; });
      if (_mu2) _userRole = String(_mu2.role || '').toLowerCase();
    }
    // Exclude leadership roles only — 'analyst supervisor' = DA Supervisor (level 2 leader),
    // NOT 'supervisor' which would also catch regular Data Supervisor (analyst-tier, level 0).
    if (_userRole.indexOf('leader') >= 0 || _userRole.indexOf('analyst supervisor') >= 0 ||
        _userRole.indexOf('training') >= 0 || _userRole.indexOf('manager') >= 0 ||
        _userRole.indexOf('admin') >= 0) {
      if (resolvedUser === 'hai.cao') log('[Logbook][debug hai.cao] role-filtered: role="' + _userRole + '"');
      result.skipped++;
      continue;
    }
    if (resolvedUser === 'hai.cao') log('[Logbook][debug hai.cao] UID=' + uid + ' role="' + _userRole + '" — processing…');

    var wroteAny = false;
    const debugAnhDao = resolvedUser === 'anh.dao';
    const debugHaoCao = resolvedUser === 'hai.cao';

    dateCols.forEach(function(col) {
      const startStr = _fmtTimeCell(displayRow[col.startColIdx]) || _fmtTimeCell(row[col.startColIdx]);
      const endStr   = _fmtTimeCell(displayRow[col.endColIdx])   || _fmtTimeCell(row[col.endColIdx]);

      if (debugHaoCao) {
        log('[Logbook][debug hai.cao] ' + col.dateKey + ' start=' + (startStr || '-') + ' end=' + (endStr || '-'));
      }

      if (!startStr && !endStr) return;

      if (debugAnhDao) {
        log('[Logbook][debug anh.dao] ' + col.dateKey + ' start=' + (startStr || '-') + ' end=' + (endStr || '-'));
      }

      const key = uid + '_' + col.dateKey;
      // Only write if no manual record exists (note !== 'auto'), preserving leader overrides.
      // Exception: if a manual record exists but has no end time and the sheet now has one,
      // patch just the end time (leaders often fill start only; GAS fills end later).
      const existing = current.logbook[key];

      if (debugHaoCao && col.dateKey === '05/06') {
        log('[Logbook][debug hai.cao] 05/06 existing=' + JSON.stringify(existing));
      }

      if (existing && existing.note !== 'auto') {
        if (endStr && !existing.end) {
          existing.end = endStr;
          existing.at  = now;
          wroteAny = true;
        } else if (debugHaoCao && col.dateKey === '05/06') {
          log('[Logbook][debug hai.cao] 05/06 skip patch: endStr=' + (endStr||'empty') + ' existing.end=' + (existing.end||'empty'));
        }
        return;
      }

      current.logbook[key] = {
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
  // Push back to Firebase if we self-fetched (called directly, not via dailySync)
  if (_selfFetched && result.imported > 0) {
    log('[Logbook] Pushing ' + result.imported + ' records to Firebase…');
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
    log('[Logbook] Push OK.');
  }
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
  const nameLower = (nameVal || '').toLowerCase().trim();
  const empTrim   = (empNo  || '').trim();

  // 1. Match by empNo in staffInfo (most reliable)
  if (empTrim && data.staffInfo) {
    const keys = Object.keys(data.staffInfo);
    for (var i = 0; i < keys.length; i++) {
      if ((data.staffInfo[keys[i]].empNo || '') === empTrim) return keys[i];
    }
  }

  // 2. Match by empNo in users[] (covers leaders/supervisors whose empNo
  //    is stored in users[] from schedule import but not yet in staffInfo)
  if (empTrim && data.users) {
    var _ul = Array.isArray(data.users) ? data.users : Object.values(data.users);
    for (var i2 = 0; i2 < _ul.length; i2++) {
      if (_ul[i2] && String(_ul[i2].empNo || '').trim() === empTrim) return _ul[i2].username;
    }
  }

  // 3. Exact name match in staffInfo (case-insensitive)
  if (nameLower && data.staffInfo) {
    const keys2 = Object.keys(data.staffInfo);
    for (var j = 0; j < keys2.length; j++) {
      if ((data.staffInfo[keys2[j]].name || '').toLowerCase() === nameLower) return keys2[j];
    }
  }

  // 4. Exact name match in users[] (catches anyone not in staffInfo)
  if (nameLower && data.users) {
    var _ul2 = Array.isArray(data.users) ? data.users : Object.values(data.users);
    for (var k = 0; k < _ul2.length; k++) {
      if (_ul2[k] && (_ul2[k].name || '').toLowerCase() === nameLower) return _ul2[k].username;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════
//  FIREBASE REST
// ═══════════════════════════════════════════════

function firebaseGet() {
  const isFirebase = FIREBASE_URL.indexOf('firebasedatabase.app') >= 0 || FIREBASE_URL.indexOf('firebaseio.com') >= 0;
  
  let url = FIREBASE_URL;
  let headers = {};
  
  if (isFirebase) {
    url = FIREBASE_URL + '?auth=' + FIREBASE_SECRET;
  } else {
    headers["X-API-Key"] = FIREBASE_SECRET;
  }

  const res = UrlFetchApp.fetch(url, {
    method:             'GET',
    headers:            headers,
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error('Database auth failed (HTTP ' + code + '). Check credentials.');
  }
  if (code !== 200) {
    throw new Error('Database GET failed (HTTP ' + code + '): ' + res.getContentText().substring(0, 200));
  }

  const wrapper = JSON.parse(res.getContentText());
  if (!wrapper || !wrapper.data) return null;

  const rawData = wrapper.data;
  if (rawData.indexOf('{') === 0) {
    return rawData; // backwards compatibility during transition
  } else {
    return LZString.decompressFromUTF16(rawData);
  }
}

function firebasePut(jsonStr) {
  var wrapper = JSON.parse(jsonStr);
  if (wrapper && wrapper.data) {
    wrapper.data = LZString.compressToUTF16(wrapper.data);
  }

  const isFirebase = FIREBASE_URL.indexOf('firebasedatabase.app') >= 0 || FIREBASE_URL.indexOf('firebaseio.com') >= 0;
  
  let url = FIREBASE_URL;
  let headers = { 'Content-Type': 'application/json' };
  
  if (isFirebase) {
    url = FIREBASE_URL + '?auth=' + FIREBASE_SECRET;
  } else {
    headers["X-API-Key"] = FIREBASE_SECRET;
  }

  const res = UrlFetchApp.fetch(url, {
    method:             'PUT',
    contentType:        'application/json',
    headers:            headers,
    payload:            JSON.stringify(wrapper),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error('Database auth failed on PUT (HTTP ' + code + '). Check credentials.');
  }
  if (code !== 200) {
    throw new Error('Database PUT failed (HTTP ' + code + '): ' + res.getContentText().substring(0, 200));
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
  if (current.gasConfig && current.gasConfig.syncPolicy === false) {
    log('[Policy] Skipped (disabled via GAS Function Controls in web app).');
    return result;
  }

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
    Logger.log('  Logbook records: ' + Object.keys(parsed.logbook || {}).length);
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

// One-time migration: copies old 'attendance' node to 'logbook', then deletes 'attendance'.
// Run once from the GAS editor after deploying the attendance→logbook rename.
function migrateAttendanceToLogbook() {
  var raw = firebaseGet();
  var current = raw ? JSON.parse(raw) : {};

  var oldData = current.attendance;
  if (!oldData || Object.keys(oldData).length === 0) {
    Logger.log('[Migrate] No data in "attendance" node — nothing to migrate.');
    return;
  }

  var count = Object.keys(oldData).length;
  Logger.log('[Migrate] Copying ' + count + ' records from "attendance" → "logbook".');

  if (!current.logbook) current.logbook = {};
  Object.keys(oldData).forEach(function(k) {
    if (!current.logbook[k]) current.logbook[k] = oldData[k]; // don't overwrite newer records
  });

  delete current.attendance;

  firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
  Logger.log('[Migrate] Done. "attendance" node removed. ' + count + ' records now in "logbook".');
}

// Removes the entire 'logbook' node from Firebase (for a clean reset).
// GAS syncLogbook will repopulate it on the next run.
function deleteLogbookNode() {
  var raw = firebaseGet();
  var current = raw ? JSON.parse(raw) : {};

  if (!current.logbook) {
    Logger.log('[DeleteLogbook] "logbook" node does not exist — nothing to remove.');
    return;
  }

  var count = Object.keys(current.logbook).length;
  delete current.logbook;

  firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
  Logger.log('[DeleteLogbook] Removed "logbook" node (' + count + ' records deleted).');
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

// Run from GAS editor to back-fill a specific month's logbook.
// monthIndex: 0=January … 11=December  (e.g. 4 = May, 5 = June)
function runSyncLogbookMonth(monthIndex) {
  var raw     = firebaseGet();
  var current = raw ? JSON.parse(raw) : {};
  Logger.log('[runSyncLogbookMonth] Syncing month index ' + monthIndex);
  var result  = syncLogbook(current, function(m){ Logger.log(m); }, monthIndex);
  if (result.imported > 0 || result.dateCols > 0) {
    firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
    Logger.log('[runSyncLogbookMonth] Pushed to Firebase.');
  }
  Logger.log('[runSyncLogbookMonth] Done: ' + result.imported + ' imported, ' + result.skipped + ' skipped, ' + result.dateCols + ' day cols');
}

// Convenience wrapper — run from GAS editor to sync May logbook
function runSyncLogbookMay() { runSyncLogbookMonth(4); }

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

// ═══════════════════════════════════════════════
//  SLACK AUTO-POST
//  Three entry points — one per shift.
//  Run createSlackTriggers() once to install time-based triggers.
//  Webhook URLs: set SLACK_WEBHOOK_A/D/E constants above.
//  On/off toggle: stored in Firebase slackAutoPost[shift].enabled
// ═══════════════════════════════════════════════

// Entry points — one trigger per shift
function dailySlackShiftA() { _postShiftBreaks('A', SLACK_WEBHOOK_A, SLACK_CHANNEL_A, [0, 1, 2, 6]); }
function dailySlackShiftD() { _postShiftBreaks('D', SLACK_WEBHOOK_D, SLACK_CHANNEL_D, [0, 1, 2, 6]); }
function dailySlackShiftE() { _postShiftBreaks('E', SLACK_WEBHOOK_E, SLACK_CHANNEL_E, [0, 1, 6]);    }
// Day indices: 0=Sun, 1=Mon, 2=Tue, 6=Sat

function _postShiftBreaks(shift, webhook, channelId, allowedDays) {
  var now = new Date();
  // Use Vietnam time for day-of-week check
  var vnNow = new Date(Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss"));
  var dow = vnNow.getDay();

  if (allowedDays.indexOf(dow) < 0) {
    Logger.log('[Slack ' + shift + '] Skipped — not a scheduled day (dow=' + dow + ')');
    return;
  }
  if (!webhook) {
    Logger.log('[Slack ' + shift + '] No webhook URL configured. Set SLACK_WEBHOOK_' + shift + '.');
    return;
  }

  var raw = firebaseGet();
  var current = raw ? JSON.parse(raw) : {};

  // Check enabled flag in Firebase
  var cfg = (current.slackAutoPost || {})[shift];
  if (!cfg || !cfg.enabled) {
    Logger.log('[Slack ' + shift + '] Auto-post disabled for this shift.');
    return;
  }

  // Today's dateKey DD/MM in Vietnam time
  var dk = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'dd/MM');
  var monthKey = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyy-MM');

  // Mirror of data.js BREAK_SLOTS — update both together when shift times change.
  // The web app now uses Firebase shiftConfig for date-versioned overrides;
  // GAS reads this hardcoded map for Slack post legends only.
  var BREAK_SLOTS_MAP = {
    A: ['18:00–19:30', '19:30–21:00'],
    D: ['04:00–05:30', '05:30–07:00'],
    E: ['09:30–11:00', '11:00–12:30']
  };
  var slots = BREAK_SLOTS_MAP[shift] || [];
  var WEEK_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var dn = WEEK_DAYS[dow];
  var OFF_CODES = ['A','H','U','S','L','0'];
  var VALID_ROLES = ['Data Analyst','Sr Data Analyst','Data Supervisor','Sr Data Supervisor'];
  var ROLE_ABBR = {'Data Analyst':'D.A','Sr Data Analyst':'Sr D.A','Data Supervisor':'D.S','Sr Data Supervisor':'Sr D.S'};
  var ROLE_ORDER = ['Sr Data Supervisor','Data Supervisor','Sr Data Analyst','Data Analyst'];

  var users = Array.isArray(current.users) ? current.users : Object.values(current.users || {});

  // On single-day posts (Mon/Sat/Sun) exclude absent staff — only show on Tuesday multi-day post
  var isTuesdayPost = (dow === 2);
  var staffRows = [];
  users.forEach(function(u) {
    var _usc = (current.staffSchedule || {})[u.username] || (u.schedule || {});
    var sched = (_usc[dk] || _usc[dn] || '').toUpperCase();
    var _rawRole = u.role || ((current.staffInfo || {})[u.username] || {}).role || '';
    var resolvedRole = _resolveRoleGas(_rawRole);
    if (sched !== shift) return;
    if (VALID_ROLES.indexOf(resolvedRole) < 0) return;
    var attCode = String(((current.monthlyAttendance || {})[u.username] || {})[monthKey]
      ? (current.monthlyAttendance[u.username][monthKey][dk] || '') : '').replace(/\.0$/, '').toUpperCase();
    var isOff = OFF_CODES.indexOf(attCode) >= 0;
    if (isOff && !isTuesdayPost) return; // exclude absent on single-day posts
    var br = (current.breaks || {})[u.id + '_' + dk];
    var slotIdx = -1;
    if (br) { slotIdx = slots.indexOf(br.slot); if (slotIdx < 0) { if (br.slot === shift+'1') slotIdx = 0; else if (br.slot === shift+'2') slotIdx = 1; } }
    var slotCode = slotIdx >= 0 ? (shift + (slotIdx + 1)) : (isOff ? attCode : '—');
    staffRows.push({
      id: u.id,
      team: u.team || '',
      name: u.name || '',
      role: resolvedRole,
      roleOrder: ROLE_ORDER.indexOf(resolvedRole),
      slotCode: slotCode,
      isOff: isOff
    });
  });

  // Sort: team asc, then role tier (Sr D.S → D.S → Sr D.A → D.A), then name
  staffRows.sort(function(a, b) {
    var tc = a.team.localeCompare(b.team, undefined, { numeric: true });
    if (tc !== 0) return tc;
    var ra = a.roleOrder < 0 ? 99 : a.roleOrder;
    var rb = b.roleOrder < 0 ? 99 : b.roleOrder;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  // Vietnamese day name
  var vnDays = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  var vnDay = vnDays[dow];
  var shortDate = dk.slice(0, 5); // "02/06"

  // Tuesday: collect Wed/Thu/Fri as extra date columns (landscape). Other days: portrait single column.
  var dateCols = [dk];
  if (isTuesdayPost) {
    // Add Wed(+1), Thu(+2), Fri(+3) relative to today
    for (var di = 1; di <= 3; di++) {
      var xd = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate() + di);
      dateCols.push(
        String(xd.getDate()).padStart(2,'0') + '/' + String(xd.getMonth()+1).padStart(2,'0')
      );
    }
  }

  // For multi-day: re-collect staffRows per date (staffRows currently only has today's breaks)
  // Build a map: dateKey → {userId → slotCode}
  var breaksByDate = {};
  dateCols.forEach(function(dki) {
    breaksByDate[dki] = {};
    var dkiParts = dki.split('/');
    var dni2 = WEEK_DAYS[new Date(vnNow.getFullYear(), parseInt(dkiParts[1])-1, parseInt(dkiParts[0])).getDay()];
    users.forEach(function(u) {
      var _usc2 = (current.staffSchedule || {})[u.username] || (u.schedule || {});
      var sched2 = (_usc2[dki] || _usc2[dni2] || '').toUpperCase();
      if (sched2 !== shift) return;
      var _rawRole2 = u.role || ((current.staffInfo || {})[u.username] || {}).role || '';
      if (VALID_ROLES.indexOf(_resolveRoleGas(_rawRole2)) < 0) return;
      var br2 = (current.breaks || {})[u.id + '_' + dki];
      var attCode2 = String(((current.monthlyAttendance || {})[u.username] || {})[monthKey]
        ? (current.monthlyAttendance[u.username][monthKey][dki] || '') : '').replace(/\.0$/, '').toUpperCase();
      var isOff2 = OFF_CODES.indexOf(attCode2) >= 0;
      var si2 = -1;
      if (br2) { si2 = slots.indexOf(br2.slot); if (si2 < 0) { if (br2.slot === shift+'1') si2 = 0; else if (br2.slot === shift+'2') si2 = 1; } }
      breaksByDate[dki][u.id] = isOff2 ? attCode2 : (si2 >= 0 ? (shift + (si2+1)) : '—');
    });
  });

  var caption = isTuesdayPost
    ? 'Mọi người check lịch break tuần này (' + vnDay + '–Thứ Sáu) nha.'
    : 'Mọi người check lịch break ' + vnDay + ' (' + shortDate + ') nha.';

  // Build PDF table and upload, or fall back to webhook monospace
  var pdfBlob = _buildBreakTablePdf(shift, staffRows, slots, dateCols, breaksByDate, caption, ROLE_ABBR, isTuesdayPost);

  if (SLACK_BOT_TOKEN && channelId && pdfBlob) {
    _slackUploadImage(pdfBlob, caption, channelId, shift, dk);
  } else {
    // Webhook fallback: monospace preformatted table
    Logger.log('[Slack ' + shift + '] Using webhook path (no bot token configured).');
    var COL_TEAM = 6, COL_NAME = 24, COL_ROLE = 7;
    function padC(s, n) { var t = String(s); while (t.length < n) t = t + ' '; return t.slice(0, n); }
    var sep = '+' + padC('', COL_TEAM+2) + '+' + padC('', COL_NAME+2) + '+' + padC('', COL_ROLE+2) + '+------+';
    var hdr = '| ' + padC('Team', COL_TEAM) + ' | ' + padC('Name', COL_NAME) + ' | ' + padC('Role', COL_ROLE) + ' | Slot |';
    var tableLines = [sep, hdr, sep];
    staffRows.forEach(function(r) {
      var abbr = ROLE_ABBR[r.role] || r.role;
      tableLines.push('| ' + padC(r.team, COL_TEAM) + ' | ' + padC(r.name, COL_NAME) + ' | ' + padC(abbr, COL_ROLE) + ' | ' + padC(r.slotCode, 4) + ' |');
    });
    tableLines.push(sep);
    slots.forEach(function(s, i) { tableLines.push(shift + (i+1) + ': ' + s); });
    var blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: ':calendar: *' + caption + '*' } },
      { type: 'rich_text', elements: [{ type: 'rich_text_preformatted', elements: [{ type: 'text', text: tableLines.join('\n') }] }] }
    ];
    var wResp = UrlFetchApp.fetch(webhook, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ blocks: blocks }),
      muteHttpExceptions: true
    });
    Logger.log('[Slack ' + shift + '] Webhook response: ' + wResp.getResponseCode());
  }

  // Stamp lastPostedAt back to Firebase
  if (!current.slackAutoPost) current.slackAutoPost = {};
  if (!current.slackAutoPost[shift]) current.slackAutoPost[shift] = {};
  current.slackAutoPost[shift].lastPostedAt = now.getTime();
  firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
  Logger.log('[Slack ' + shift + '] Posted for ' + dk + ' and stamped lastPostedAt.');
}

// Builds a PDF of the break table using a temporary Google Sheet.
// Single day → portrait. Tuesday (isTuesday=true) → landscape with Wed/Thu/Fri columns.
// Legend column placed next to each date column.
// Returns a Blob, or null on failure.
function _buildBreakTablePdf(shift, staffRows, slots, dateCols, breaksByDate, caption, roleAbbr, isTuesday) {
  var ss = SpreadsheetApp.create('_pave_slack_tmp_' + shift);
  try {
    var sheet = ss.getActiveSheet();

    var ACCENT    = '#1f66f1';
    var SLOT1_BG  = '#dbeafe';
    var SLOT2_BG  = '#dcfce7';
    var OFF_BG    = { A:'#fef9c3', H:'#fee2e2', '0':'#dcfce7', U:'#ffe4e6', S:'#ffedd5', L:'#cffafe' };
    var OFF_FG    = { A:'#92680a', H:'#b91c1c', '0':'#15803d', U:'#be123c', S:'#c2410c', L:'#0e7490' };
    var HEADER_FG = '#ffffff';
    var TEXT_DARK = '#1e293b';
    var BORDER    = '#cbd5e1';
    var DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

    // Column layout: TEAM(1) | NAME(2) | ROLE(3) | date1 | date2 | ... | legend
    // Fixed cols = 3, then 1 col per date, then 1 shared legend col at the end
    var FIXED = 3;
    var numCols = FIXED + dateCols.length + 1;
    var numDataRows = staffRows.length;

    // ── Row 1: column headers (no caption row — caption is sent as Slack message text) ──
    var fixedHeaders = ['TEAM', 'NAME', 'ROLE'];
    fixedHeaders.forEach(function(h, c) {
      sheet.getRange(1, c+1)
        .setValue(h).setBackground(ACCENT).setFontColor(HEADER_FG)
        .setFontWeight('bold').setFontSize(9)
        .setHorizontalAlignment('left').setVerticalAlignment('middle');
    });
    dateCols.forEach(function(dki, di) {
      var parts = dki.split('/');
      var dow2 = new Date(new Date().getFullYear(), parseInt(parts[1])-1, parseInt(parts[0])).getDay();
      var dateLabel = dki.slice(0,5) + '\n(' + DAY_NAMES[dow2] + ')';
      var slotCol = FIXED + di + 1;
      sheet.getRange(1, slotCol)
        .setValue(dateLabel).setBackground(ACCENT).setFontColor(HEADER_FG)
        .setFontWeight('bold').setFontSize(9)
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    });
    // Single legend column at the end
    var legendLabel = slots.map(function(s, si) { return shift+(si+1)+': '+s; }).join('\n');
    sheet.getRange(1, numCols)
      .setValue(legendLabel).setBackground(ACCENT).setFontColor(HEADER_FG)
      .setFontSize(8).setHorizontalAlignment('left').setVerticalAlignment('middle').setWrap(true);

    // ── Data rows starting at row 2 ──
    staffRows.forEach(function(r, i) {
      var row = i + 2;
      var abbr = roleAbbr[r.role] || r.role;
      var rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      sheet.getRange(row, 1).setValue(r.team).setBackground(rowBg).setFontColor(TEXT_DARK).setFontSize(9).setHorizontalAlignment('left');
      sheet.getRange(row, 2).setValue(r.name).setBackground(rowBg).setFontColor(TEXT_DARK).setFontSize(9).setHorizontalAlignment('left');
      sheet.getRange(row, 3).setValue(abbr).setBackground(rowBg).setFontColor(TEXT_DARK).setFontSize(9).setHorizontalAlignment('left');
      dateCols.forEach(function(dki, di) {
        var slotCode = (breaksByDate[dki] || {})[r.id] || '—';
        var isOffCell = slotCode.length <= 2 && ['A','H','U','S','L','0'].indexOf(slotCode) >= 0;
        var si = slotCode === shift+'1' ? 0 : slotCode === shift+'2' ? 1 : -1;
        var cellBg = isOffCell ? (OFF_BG[slotCode] || '#f1f5f9') : si === 0 ? SLOT1_BG : si === 1 ? SLOT2_BG : rowBg;
        var cellFg = isOffCell ? (OFF_FG[slotCode] || TEXT_DARK) : TEXT_DARK;
        sheet.getRange(row, FIXED + di + 1)
          .setValue(slotCode).setBackground(cellBg).setFontColor(cellFg)
          .setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
      });
      sheet.getRange(row, numCols).setBackground(rowBg);
    });

    // ── Column widths ──
    sheet.setColumnWidth(1, 55);   // Team
    sheet.setColumnWidth(2, 190);  // Name
    sheet.setColumnWidth(3, 65);   // Role
    dateCols.forEach(function(_, di) {
      sheet.setColumnWidth(FIXED + di + 1, 70);  // date/slot
    });
    sheet.setColumnWidth(numCols, 90);  // legend (single, at end)

    // ── Row heights ──
    sheet.setRowHeight(1, isTuesday ? 32 : 42);
    for (var ri = 2; ri <= numDataRows + 1; ri++) sheet.setRowHeight(ri, 21);

    // ── Borders on table ──
    sheet.getRange(1, 1, numDataRows + 1, numCols)
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);

    // ── Hide unused rows/cols ──
    var lastRow = numDataRows + 1;
    var maxRows = sheet.getMaxRows();
    var maxCols = sheet.getMaxColumns();
    if (maxRows > lastRow) sheet.hideRows(lastRow + 1, maxRows - lastRow);
    if (maxCols > numCols) sheet.hideColumns(numCols + 1, maxCols - numCols);

    SpreadsheetApp.flush();
    Utilities.sleep(1500);

    var ssId    = ss.getId();
    var sheetId = sheet.getSheetId();
    var orientation = isTuesday ? 'false' : 'true'; // portrait=true for single day, landscape for Tuesday
    var exportUrl = 'https://docs.google.com/spreadsheets/d/' + ssId
      + '/export?format=pdf&gid=' + sheetId
      + '&size=statement&portrait=' + orientation
      + '&fitw=true&fith=true&gridlines=false&printtitle=false&sheetnames=false&pagenumbers=false'
      + '&top_margin=0.1&bottom_margin=0.1&left_margin=0.1&right_margin=0.1&attachment=false';

    var token = ScriptApp.getOAuthToken();
    var resp = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      Logger.log('[Slack PDF] Export failed: ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200));
      return null;
    }
    return resp.getBlob()
      .setName('break_' + shift + '_' + dateCols[0].replace('/', '-') + '.pdf')
      .setContentType('application/pdf');

  } catch (e) {
    Logger.log('[Slack PNG] Error: ' + e.message);
    return null;
  } finally {
    DriveApp.getFileById(ss.getId()).setTrashed(true);
  }
}

// Uploads a PNG blob to a Slack channel via the bot token file upload API.
function _slackUploadImage(blob, caption, channelId, shift, dk) {
  try {
    var bytes = blob.getBytes();
    var filename = blob.getName();

    // Step 1: get upload URL
    var urlResp = UrlFetchApp.fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'post',
      headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN },
      payload: { filename: filename, length: String(bytes.length) },
      muteHttpExceptions: true
    });
    var urlData = JSON.parse(urlResp.getContentText());
    if (!urlData.ok) { Logger.log('[Slack upload] getUploadURL failed: ' + urlResp.getContentText()); return; }

    // Step 2: upload bytes
    UrlFetchApp.fetch(urlData.upload_url, {
      method: 'post',
      payload: blob.getBytes(),
      headers: { 'Content-Type': blob.getContentType() },
      muteHttpExceptions: true
    });

    // Step 3: complete upload and post to channel
    var completeResp = UrlFetchApp.fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'post',
      headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN, 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        files: [{ id: urlData.file_id }],
        channel_id: channelId,
        initial_comment: ':calendar: *' + caption + '*'
      }),
      muteHttpExceptions: true
    });
    var completeData = JSON.parse(completeResp.getContentText());
    if (!completeData.ok) { Logger.log('[Slack upload] complete failed: ' + completeResp.getContentText()); return; }

    Logger.log('[Slack ' + shift + '] PNG uploaded for ' + dk);
  } catch (e) {
    Logger.log('[Slack upload] Error: ' + e.message);
  }
}

// Minimal role resolver matching the web app's _resolveRole()
function _resolveRoleGas(role) {
  var aliases = {
    'Agent': 'Data Analyst', 'Sr Agent': 'Sr Data Analyst',
    'QA': 'Data Supervisor', 'Sr QA': 'Sr Data Supervisor',
    'Senior Data Analyst': 'Sr Data Analyst',
    'Senior Data Supervisor': 'Sr Data Supervisor',
    'Leader': 'Data Analyst Leader',
    'Supervisor': 'Data Analyst Supervisor',
    'Agent Leader': 'Data Analyst Leader',
    'Agent Supervisor': 'Data Analyst Supervisor'
  };
  return aliases[role] || role || '';
}

// Run once in GAS editor to install the 3 time-based triggers.
function createSlackTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'dailySlackShiftA' || fn === 'dailySlackShiftD' || fn === 'dailySlackShiftE') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Shift A fires at 15h (day-of-week check inside the function)
  ScriptApp.newTrigger('dailySlackShiftA').timeBased().atHour(15).nearMinute(15).everyDays(1).create();
  // Shift D fires at 0h
  ScriptApp.newTrigger('dailySlackShiftD').timeBased().atHour(0).nearMinute(15).everyDays(1).create();
  // Shift E fires at 6h
  ScriptApp.newTrigger('dailySlackShiftE').timeBased().atHour(6).nearMinute(15).everyDays(1).create();
  Logger.log('✓ Slack triggers created: ShiftA@15h, ShiftD@0h, ShiftE@6h (all daily, day filter inside function)');
}

// ═══════════════════════════════════════════════
//  ATTENDANCE WRITEBACK
//  Reads manual attendance edits from Firebase and writes them back to the
//  logbook Google Sheet. Runs 3× daily, 30 min after each shift starts.
//  Call createWritebackTriggers() once from the GAS editor to install.
// ═══════════════════════════════════════════════

function syncAttendanceWriteback() {
  var startTime = new Date();
  var log = [];
  function addLog(msg) { Logger.log(msg); log.push(msg); }

  try {
    addLog('=== Attendance Writeback Start: ' + startTime.toISOString() + ' ===');

    var raw = firebaseGet();
    var current = raw ? JSON.parse(raw) : {};
    var logbook = current.logbook || {};

    // Only process today's manual edits (note !== 'auto', not deleted)
    var _today = new Date();
    var todayDk = String(_today.getDate()).padStart(2,'0') + '/' + String(_today.getMonth()+1).padStart(2,'0');
    var manualKeys = Object.keys(logbook).filter(function(key) {
      var rec = logbook[key];
      if (!rec || rec._deleted || rec.note === 'auto' || rec.by == null) return false;
      return key.substring(key.lastIndexOf('_') + 1) === todayDk;
    });

    if (manualKeys.length === 0) {
      addLog('[Writeback] No manual edits found. Done.');
      return;
    }
    addLog('[Writeback] ' + manualKeys.length + ' manual edit(s) to write back.');

    var ss;
    try { ss = SpreadsheetApp.openById(LOGBOOK_SPREADSHEET_ID); }
    catch(e) {
      addLog('[Writeback] ✗ Cannot open logbook spreadsheet: ' + e.message);
      throw e;
    }

    var MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

    // Build uid list for name-fallback lookup
    var _usersList = Array.isArray(current.users) ? current.users
                   : (current.users ? Object.values(current.users) : []);
    var usernameToUid = {};
    _usersList.forEach(function(u) {
      if (u && u.username && u.id != null) usernameToUid[String(u.username).toLowerCase()] = u.id;
    });

    // Group manual-edit keys by month sheet name
    var keysByMonth = {};
    manualKeys.forEach(function(key) {
      var sep = key.lastIndexOf('_');
      var dateKey = key.substring(sep + 1); // DD/MM
      var dateParts = dateKey.split('/');
      if (dateParts.length < 2) return;
      var mIdx = parseInt(dateParts[1], 10) - 1;
      if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return;
      var mName = MONTH_NAMES[mIdx];
      if (!keysByMonth[mName]) keysByMonth[mName] = [];
      keysByMonth[mName].push(key);
    });

    var totalWritten = 0, totalSkipped = 0;

    Object.keys(keysByMonth).forEach(function(monthName) {
      var sheet = getOrCreateMonthlyLogbookSheet(ss, monthName, addLog);
      if (!sheet) {
        addLog('[Writeback] ✗ Sheet "' + monthName + '" could not be found or created — skipping ' + keysByMonth[monthName].length + ' record(s).');
        totalSkipped += keysByMonth[monthName].length;
        return;
      }

      var lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
      if (lastRow < 3 || lastCol < 5) {
        addLog('[Writeback] ⚠ Sheet "' + monthName + '" appears empty.');
        totalSkipped += keysByMonth[monthName].length;
        return;
      }
      var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

      // Detect date header row
      var dateRow = -1, bestCnt = 0;
      for (var ri = 0; ri < Math.min(10, allData.length); ri++) {
        var cnt = 0;
        for (var c = 4; c < allData[ri].length; c++) { if (parseDateHeader(allData[ri][c])) cnt++; }
        if (cnt > bestCnt) { bestCnt = cnt; dateRow = ri; }
      }
      if (dateRow < 0 || bestCnt < 2) {
        addLog('[Writeback] ✗ No date header row found in "' + monthName + '".');
        totalSkipped += keysByMonth[monthName].length;
        return;
      }

      // Detect sub-header row (contains "start" + one of "end"/"early"/"late")
      var subHdrRow = -1;
      for (var ri = dateRow+1; ri < Math.min(dateRow+8, allData.length); ri++) {
        var _hs = false, _ho = false;
        for (var c = 0; c < allData[ri].length; c++) {
          var _sv = String(allData[ri][c]).trim().toLowerCase();
          if (_sv === 'start') _hs = true;
          if (_sv === 'end' || _sv === 'early' || _sv === 'late') _ho = true;
        }
        if (_hs && _ho) { subHdrRow = ri; break; }
      }
      if (subHdrRow < 0) {
        addLog('[Writeback] ✗ No Start/End sub-header row in "' + monthName + '".');
        totalSkipped += keysByMonth[monthName].length;
        return;
      }

      var shiftColIdx = 6;
      var dataStartRow = subHdrRow + 1;
      var row1 = allData[dateRow], row3 = allData[subHdrRow];

      // Build dateKey → { startColIdx, endColIdx } (0-based array index)
      var dateColMap = {};
      for (var c = shiftColIdx+1; c < row1.length; c++) {
        if (String(row3[c]||'').trim().toLowerCase() !== 'start') continue;
        var dk = null;
        for (var back = 0; back <= 3 && !dk; back++) {
          if (c - back > shiftColIdx) dk = parseDateHeader(row1[c - back]);
        }
        if (!dk) continue;
        dateColMap[dk] = { startColIdx: c, endColIdx: c + 2 };
      }

      // Build uid → sheet row (1-based) map
      var uidToSheetRow = {};
      for (var ri = dataStartRow; ri < allData.length; ri++) {
        var row = allData[ri];
        var name    = String(row[2] || '').trim();
        var newUser = String(row[4] || '').trim().toLowerCase();
        var oldUser = String(row[3] || '').trim().toLowerCase();
        if (!name && !newUser) continue;
        var uid = newUser ? usernameToUid[newUser] : undefined;
        if (uid == null && oldUser) uid = usernameToUid[oldUser];
        if (uid == null && name) {
          var nl = name.toLowerCase();
          var mu = _usersList.filter(function(u){ return (u.name||'').toLowerCase()===nl; })[0];
          if (mu) uid = mu.id;
        }
        if (uid != null) uidToSheetRow[uid] = ri + 1; // convert to 1-based
      }

      addLog('[Writeback] "' + monthName + '": ' + Object.keys(dateColMap).length + ' date cols, '
        + Object.keys(uidToSheetRow).length + ' employee rows mapped.');

      // Write each manual edit
      keysByMonth[monthName].forEach(function(key) {
        var rec = logbook[key];
        var sep = key.lastIndexOf('_');
        var uid = parseInt(key.substring(0, sep), 10);
        var dateKey = key.substring(sep + 1);

        var sheetRow = uidToSheetRow[uid];
        var colInfo  = dateColMap[dateKey];

        if (!sheetRow || !colInfo) {
          addLog('[Writeback] ✗ No mapping: uid=' + uid + ' dk=' + dateKey);
          totalSkipped++;
          return;
        }

        // Write start (col is 0-based index, getRange needs 1-based)
        if (rec.start) sheet.getRange(sheetRow, colInfo.startColIdx + 1).setValue(_timeStrToFraction(rec.start));
        if (rec.end)   sheet.getRange(sheetRow, colInfo.endColIdx   + 1).setValue(_timeStrToFraction(rec.end));

        addLog('[Writeback] ✓ ' + key
          + ' start=' + (rec.start||'-') + ' end=' + (rec.end||'-')
          + ' by=' + (rec.byName || rec.by || '?'));
        totalWritten++;
      });
    });

    var duration = ((new Date() - startTime) / 1000).toFixed(1);
    addLog('=== Writeback Complete in ' + duration + 's: '
      + totalWritten + ' written, ' + totalSkipped + ' skipped ===');

  } catch(e) {
    Logger.log('✗ Attendance Writeback FAILED: ' + e.message + '\n' + e.stack);
    try {
      MailApp.sendEmail({
        to:      NOTIFY_EMAIL,
        subject: '⚠ PAVE Attendance Writeback Failed — ' + Utilities.formatDate(startTime, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'),
        body:    'Error: ' + e.message + '\n\nStack:\n' + e.stack + '\n\nLog:\n' + log.join('\n'),
      });
    } catch(mailErr) { Logger.log('Mail failed: ' + mailErr.message); }
    throw e;
  }
}

// Converts "HH:MM" or "HH:MM:SS" string → fractional day (0..1) for Sheets time cells.
// Sheets stores times as fractional days; writing this value preserves native time formatting
// (e.g. the column's "h:mm:ss AM/PM" format) instead of writing a plain text string.
function _timeStrToFraction(str) {
  if (!str) return null;
  var p = String(str).split(':');
  var h = parseInt(p[0], 10) || 0;
  var m = parseInt(p[1], 10) || 0;
  var s = parseInt(p[2], 10) || 0;
  return (h * 3600 + m * 60 + s) / 86400;
}

// ═══════════════════════════════════════════════
//  MONTHLY ATTENDANCE WRITEBACK
//  Writes Firebase monthlyAttendance codes back to the Attendance Google Sheet.
//  Runs after the logbook writeback via the same 3 daily triggers.
// ═══════════════════════════════════════════════
function syncMonthlyAttWriteback() {
  Logger.log('[MonthlyWriteback] Start: ' + new Date().toISOString());

  var raw, current;
  try {
    raw = firebaseGet();
    current = raw ? JSON.parse(raw) : {};
  } catch(e) {
    Logger.log('[MonthlyWriteback] Firebase fetch error: ' + e.message);
    return;
  }

  var monthlyAtt = current.monthlyAttendance || {};
  if (Object.keys(monthlyAtt).length === 0) {
    Logger.log('[MonthlyWriteback] No monthlyAttendance data. Done.');
    return;
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    Logger.log('[MonthlyWriteback] Cannot open spreadsheet: ' + e.message);
    return;
  }

  var sheet = ss.getSheetByName(ATTENDANCE_SHEET);
  if (!sheet) {
    Logger.log('[MonthlyWriteback] Sheet not found: ' + ATTENDANCE_SHEET);
    return;
  }

  var rows = sheet.getDataRange().getValues();
  var headerRow = rows[0];

  // Build date columns — same logic as syncAttendance()
  var dateCols = [];
  headerRow.forEach(function(h, i) {
    if (i < 4) return;
    var dk = parseDateHeader(h);
    if (dk) dateCols.push({ index: i, dateKey: dk });
  });

  if (dateCols.length === 0) {
    Logger.log('[MonthlyWriteback] No date columns found in header row.');
    return;
  }

  // Detect working monthKey from first date column
  var firstDk    = dateCols[0].dateKey;
  var firstDay   = parseInt(firstDk.split('/')[0]);
  var firstMonth = parseInt(firstDk.split('/')[1]);
  var year  = new Date().getFullYear();
  var month = firstDay >= 25 ? firstMonth + 1 : firstMonth;
  if (month > 12) { month = 1; year++; }
  var monthKey = year + '-' + String(month).padStart(2, '0');

  Logger.log('[MonthlyWriteback] Working month: ' + monthKey + ' | ' + dateCols.length + ' date columns');

  // Only write today's column — do not overwrite historical data already in the sheet
  var _now = new Date();
  var todayDk = String(_now.getDate()).padStart(2, '0') + '/' + String(_now.getMonth() + 1).padStart(2, '0');
  var todayCols = dateCols.filter(function(col) { return col.dateKey === todayDk; });
  if (todayCols.length === 0) {
    Logger.log('[MonthlyWriteback] Today (' + todayDk + ') not in sheet columns — nothing to write.');
    return;
  }
  Logger.log('[MonthlyWriteback] Writing today only: ' + todayDk);

  // Build username → 1-based row map (data starts row 4 = index 3)
  var usernameToRow = {};
  for (var ri = 3; ri < rows.length; ri++) {
    var row = rows[ri];
    var nameVal = String(row[2] || '').trim();
    var empNo   = String(row[1] || '').trim();
    if (!nameVal && !empNo) continue;
    var username = findUsername(current, nameVal, empNo);
    if (username) usernameToRow[username] = ri + 1; // 1-based for getRange
  }

  // Write codes from Firebase to sheet cells
  var written = 0;
  Object.keys(monthlyAtt).forEach(function(username) {
    var userMonths = monthlyAtt[username];
    if (!userMonths || !userMonths[monthKey]) return;
    var monthData = userMonths[monthKey];

    var sheetRow = usernameToRow[username];
    if (!sheetRow) return;

    todayCols.forEach(function(col) {
      var code = monthData[col.dateKey];
      if (!code) return;
      sheet.getRange(sheetRow, col.index + 1).setValue(code);
      written++;
    });
  });

  Logger.log('[MonthlyWriteback] Done: ' + written + ' cells written to ' + ATTENDANCE_SHEET + '.');
}

// Thin wrappers required because GAS time triggers must target named top-level functions.
// Each wrapper checks its per-shift toggle from Firebase before running.
function syncAttendanceWriteback_1530() {
  var raw = firebaseGet(); var cfg = (raw ? JSON.parse(raw) : {}).gasConfig || {};
  if (cfg.writebackShiftA === false) { Logger.log('[Writeback] Shift A skipped (disabled).'); return; }
  syncMonthlyAttWriteback();
}
function syncAttendanceWriteback_0030() {
  var raw = firebaseGet(); var cfg = (raw ? JSON.parse(raw) : {}).gasConfig || {};
  if (cfg.writebackShiftD === false) { Logger.log('[Writeback] Shift D skipped (disabled).'); return; }
  syncMonthlyAttWriteback();
}
function syncAttendanceWriteback_0630() {
  var raw = firebaseGet(); var cfg = (raw ? JSON.parse(raw) : {}).gasConfig || {};
  if (cfg.writebackShiftE === false) { Logger.log('[Writeback] Shift E skipped (disabled).'); return; }
  syncMonthlyAttWriteback();
}

// Logbook wrapper that runs monthly
function syncLogbookMonthly() {
  syncAttendanceWriteback();
}

// Run once from the GAS editor to install the 3 daily writeback triggers + 1 monthly trigger.
function createWritebackTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'syncAttendanceWriteback_1530' ||
        fn === 'syncAttendanceWriteback_0030' ||
        fn === 'syncAttendanceWriteback_0630' ||
        fn === 'syncLogbookMonthly') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Staff attendance: Shift A: 15:30 | Shift D: 00:30 | Shift E: 06:30 (daily)
  ScriptApp.newTrigger('syncAttendanceWriteback_1530').timeBased().atHour(15).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('syncAttendanceWriteback_0030').timeBased().atHour(0) .nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('syncAttendanceWriteback_0630').timeBased().atHour(6) .nearMinute(30).everyDays(1).create();
  
  // Logbook: 1st of every month at 1:00 AM
  ScriptApp.newTrigger('syncLogbookMonthly').timeBased().onMonthDay(1).atHour(1).create();
  
  Logger.log('✓ Triggers created: Daily Staff Attendance (A@15:30, D@00:30, E@06:30), Monthly Logbook (1st of month @ 1:00 AM)');
}

// ═══════════════════════════════════════════════
//  MONTHLY SHEET RETRIEVAL & AUTO-CREATION
// ═══════════════════════════════════════════════
function getOrCreateMonthlyLogbookSheet(ss, sheetName, logFn) {
  var log = typeof logFn === 'function' ? logFn : Logger.log;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    var template = ss.getSheetByName('Template') || ss.getSheets()[0];
    if (template) {
      sheet = template.copyTo(ss).setName(sheetName);
      log('[Logbook] Auto-created monthly sheet "' + sheetName + '" by duplicating "' + template.getName() + '"');
      
      // Move to first position for visibility
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(1);
    } else {
      log('[Logbook] ✗ No sheet available in spreadsheet to use as a template.');
    }
  }
  return sheet;
}

// ═══════════════════════════════════════════════
//  DAILY DATABASE BACKUP TO GOOGLE DRIVE
// ═══════════════════════════════════════════════
function saveDriveBackup(current, logFn) {
  var log = typeof logFn === 'function' ? logFn : Logger.log;
  try {
    var folderName = 'PAVE_Database_Backups';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    var timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd_HH-mm-ss');
    var filename = 'backup_' + timestamp + '.json';
    var fileContent = JSON.stringify(current);
    folder.createFile(filename, fileContent, MimeType.PLAIN_TEXT);
    log('[Backup] ✓ Saved daily backup to Drive: ' + folderName + '/' + filename);
  } catch (e) {
    log('[Backup] ✗ Failed to save backup to Drive: ' + e.message);
  }
}

// ═══════════════════════════════════════════════
//  90-DAY DATA RETENTION PURGE
// ═══════════════════════════════════════════════
function purgeActiveState(current, logFn) {
  var log = typeof logFn === 'function' ? logFn : Logger.log;
  var now = new Date();
  var ninetyDaysMs = 90 * 24 * 3600 * 1000;
  var purgedBreaksCount = 0;
  var purgedLogbookCount = 0;
  var purgedSchedCount = 0;
  var purgedAttCount = 0;

  function isDateOld(dateStr) {
    var dt = parseDayMonthToDate(dateStr);
    if (!dt) return false;
    return (now - dt) > ninetyDaysMs;
  }

  // 1. Purge breaks (format: "uid_dateStr")
  if (current.breaks) {
    Object.keys(current.breaks).forEach(function(key) {
      var parts = key.split('_');
      var dateStr = parts[parts.length - 1];
      if (isDateOld(dateStr)) {
        delete current.breaks[key];
        purgedBreaksCount++;
      }
    });
  }

  // 2. Purge logbook (format: "uid_dateStr")
  if (current.logbook) {
    Object.keys(current.logbook).forEach(function(key) {
      var parts = key.split('_');
      var dateStr = parts[parts.length - 1];
      if (isDateOld(dateStr)) {
        delete current.logbook[key];
        purgedLogbookCount++;
      }
    });
  }

  // 3. Purge staffSchedule (format: username -> dateStr -> value)
  if (current.staffSchedule) {
    Object.keys(current.staffSchedule).forEach(function(uname) {
      var userSched = current.staffSchedule[uname];
      if (userSched) {
        Object.keys(userSched).forEach(function(dateStr) {
          if (isDateOld(dateStr)) {
            delete userSched[dateStr];
            purgedSchedCount++;
          }
        });
      }
    });
  }

  // 4. Purge monthlyAttendance (format: username -> monthKey "YYYY-MM" -> dateStr -> value)
  if (current.monthlyAttendance) {
    Object.keys(current.monthlyAttendance).forEach(function(uname) {
      var userAtt = current.monthlyAttendance[uname];
      if (userAtt) {
        Object.keys(userAtt).forEach(function(monthKey) {
          if (isMonthKeyOld(monthKey)) {
            delete userAtt[monthKey];
            purgedAttCount++;
          }
        });
      }
    });
  }

  log('[Purge] Active state cleanup complete: ' 
      + purgedBreaksCount + ' breaks, ' 
      + purgedLogbookCount + ' logbook entries, ' 
      + purgedSchedCount + ' schedule entries, ' 
      + purgedAttCount + ' attendance months purged.');
}

// ═══════════════════════════════════════════════
//  DATE RETENTION HELPERS
// ═══════════════════════════════════════════════
function parseDayMonthToDate(dateStr) {
  var parts = dateStr.split('/');
  if (parts.length < 2) return null;
  var d = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1; // 0-based month
  
  var now = new Date();
  var year = now.getFullYear();
  var parsedDate = new Date(year, m, d);
  
  // Heuristic: If parsed date is > 180 days in the future, it belongs to the previous year
  if (parsedDate - now > 180 * 24 * 3600 * 1000) {
    parsedDate.setFullYear(year - 1);
  }
  return parsedDate;
}

function isMonthKeyOld(monthKey) {
  var parts = monthKey.split('-');
  if (parts.length < 2) return false;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var firstOfNextMonth = new Date(y, m + 1, 1);
  var now = new Date();
  var diffMs = now - firstOfNextMonth;
  var ninetyDaysMs = 90 * 24 * 3600 * 1000;
  return diffMs > ninetyDaysMs;
}

// ═══════════════════════════════════════════════
//  LZ-STRING COMPRESSION LIBRARY (INLINED)
// ═══════════════════════════════════════════════
var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}();
