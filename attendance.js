// ═══════════════════════════════════════════════
//  ATTENDANCE — Late / Early tracking
//  Leader/Supervisor fills actual Start/End times
//  per shift per day. App auto-calculates late/early
//  by comparing vs SHIFT_DEFAULTS.
// ═══════════════════════════════════════════════

// ── Helpers ──

// Parse many time formats → minutes since midnight
// Accepts: "12:00:03 AM", "12:00 AM", "00:15", "0:15", "15:00:03"
function _parseTime(str) {
  if (!str) return null;
  const s = str.trim();
  // Try 12-hour format with AM/PM (e.g. "12:00:03 AM", "1:30 PM")
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]), m = parseInt(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  // Try 24-hour format (e.g. "00:15", "15:00", "15:00:03")
  const h24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24) {
    return parseInt(h24[1]) * 60 + parseInt(h24[2]);
  }
  return null;
}

// Normalize any time string → "HH:MM" for storage
function _normalizeTime(str) {
  if (!str) return '';
  const s = str.trim();
  // Preserve the full original string — keep seconds and AM/PM as entered
  // Only normalize: remove extra whitespace, ensure consistent spacing
  // e.g. "12:00:04AM" → "12:00:04 AM"
  //      "12:00:04 am" → "12:00:04 AM"
  //      "0:00:04"  → keep as-is (24h format with seconds)
  const ampm = s.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)$/i);
  if (ampm) {
    return `${ampm[1]} ${ampm[2].toUpperCase()}`;
  }
  return s; // return as-is for 24h format or anything else
}

// Format minute diff → "+HH:MM" string
// Format minute diff → "HH:MM:SS" string
// If actualStr and defStr are provided, computes exact seconds
// Otherwise falls back to minute precision with :00 seconds
function _fmtDiffFull(approxMins, actualStr, defStr) {
  function parseSeconds(str) {
    if (!str) return null;
    const s = str.trim();
    // HH:MM:SS AM/PM
    const ampm = s.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      let h = parseInt(ampm[1]), m = parseInt(ampm[2]), sec = parseInt(ampm[3]);
      const p = ampm[4].toUpperCase();
      if (p === 'AM' && h === 12) h = 0;
      if (p === 'PM' && h !== 12) h += 12;
      return h * 3600 + m * 60 + sec;
    }
    // HH:MM:SS (24h)
    const h24s = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (h24s) return parseInt(h24s[1]) * 3600 + parseInt(h24s[2]) * 60 + parseInt(h24s[3]);
    // HH:MM AM/PM
    const ampm2 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm2) {
      let h = parseInt(ampm2[1]), m = parseInt(ampm2[2]);
      const p = ampm2[3].toUpperCase();
      if (p === 'AM' && h === 12) h = 0;
      if (p === 'PM' && h !== 12) h += 12;
      return h * 3600 + m * 60;
    }
    // HH:MM (24h)
    const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) return parseInt(h24[1]) * 3600 + parseInt(h24[2]) * 60;
    return null;
  }

  let totalSec;
  if (actualStr && defStr) {
    const a = parseSeconds(actualStr);
    const d = parseSeconds(defStr);
    if (a !== null && d !== null) {
      totalSec = Math.abs(a - d);
      if (totalSec > 43200) totalSec = 86400 - totalSec; // overnight wrap
    }
  }
  if (totalSec === undefined) {
    totalSec = Math.abs(approxMins) * 60;
  }

  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

// Keep _fmtDiff as a simple wrapper for backward compatibility
// (used in report.js and other places that only have minutes)
function _fmtDiff(mins) {
  return _fmtDiffFull(mins, null, null);
}

// Get shift code for a user on a specific date
// Uses schedule[dateKey] first, falls back to schedule[dayName]
function _getUserShiftOnDate(u, dateKey) {
  if (!u) return null;
  var s = _getSched(u.username, dateKey);
  return s && s !== '0' ? s : null;
}

// Calculate late/early for a given attendance record
// Returns { late: null|string, early: null|string, lateMin: 0, earlyMin: 0 }
function calcLateEarly(uid, dateKey) {
  const rec = DB.getAttendance(uid, dateKey);
  if (!rec) return { late: null, early: null, lateMin: 0, earlyMin: 0 };

  const u = state.users.find(x => x.id === uid);
  if (!u) return { late: null, early: null, lateMin: 0, earlyMin: 0 };

  const shiftCode = _getUserShiftOnDate(u, dateKey);
  if (!shiftCode) return { late: null, early: null, lateMin: 0, earlyMin: 0 };

  const shiftCodeNorm = String(shiftCode).trim().toUpperCase();
  let def = SHIFT_DEFAULTS[shiftCodeNorm];
  if (!def) return { late: null, early: null, lateMin: 0, earlyMin: 0 };

  // If monthly attendance says HD1/HD2, use the half-day shift defaults so
  // late/early deltas are relative to the correct half-shift times (e.g. A1
  // ends at 19:00, not midnight) rather than the full-shift boundaries.
  const [, _attM] = dateKey.split('/');
  const _attMk = `2026-${_attM.padStart(2, '0')}`;
  const _attCode = state.monthlyAttendance?.[u.username]?.[_attMk]?.[dateKey];
  const _parsedAtt = _attCode && typeof _parseAttCode === 'function' ? _parseAttCode(_attCode) : null;
  if (_parsedAtt?.type === 'HD1' || _parsedAtt?.type === 'HD2') {
    const _hdKey = (_parsedAtt.shift || shiftCodeNorm.charAt(0)) + (_parsedAtt.type === 'HD1' ? '1' : '2');
    const _hdDef = SHIFT_DEFAULTS[_hdKey];
    if (_hdDef) def = _hdDef;
  }

  let lateMin = 0, earlyMin = 0;

  if (rec.start) {
    const actualStart = _parseTime(rec.start);
    const defStart = _parseTime(def.start);
    // Handle overnight shifts: if defStart ≥ 12:00 and actualStart < 12:00 → next day
    let diff = actualStart - defStart;
    if (Math.abs(diff) > 720) diff = diff > 0 ? diff - 1440 : diff + 1440;
    // Logbook late threshold: only count as late when start time is more than 1 minute after shift start
    if (diff > 1) lateMin = diff;
  }

  if (rec.end) {
    const actualEnd = _parseTime(rec.end);
    const defEnd = _parseTime(def.end);
    let diff = defEnd - actualEnd;
    if (Math.abs(diff) > 720) diff = diff > 0 ? diff - 1440 : diff + 1440;
    // Early threshold: only count as early when end time is more than 1 minute before shift end
    if (diff > 1) earlyMin = diff;
  }

  return {
    late: lateMin > 0 ? _fmtDiff(lateMin) : null,
    early: earlyMin > 0 ? _fmtDiff(earlyMin) : null,
    lateMin,
    earlyMin,
  };
}

// ── State for attendance page ──
let attendanceMonday = null;          // null = current week
let attendanceTab = 'log';            // 'log' | 'report'
let attendanceConflictFilter = false; // show conflicts-only rows

// Returns a Set of dateKeys where the user has half-day (HD1/HD2) monthly attendance
function _getHalfDayCellSet(u, weekDates) {
  const s = new Set();
  if (!u) return s;
  const y = new Date().getFullYear();
  weekDates.forEach(dk => {
    const [, _m] = dk.split('/');
    const mk = `${y}-${String(_m).padStart(2, '0')}`;
    const code = state.monthlyAttendance?.[u.username]?.[mk]?.[dk];
    if (!code) return;
    const p = typeof _parseAttCode === 'function' ? _parseAttCode(code) : null;
    if (p?.type === 'HD1' || p?.type === 'HD2') s.add(dk);
  });
  return s;
}

function _getAttendanceWeek() {
  if (attendanceMonday) return getWeekRange(attendanceMonday);
  // Week is Sun–Sat (not Mon–Sun like break schedule)
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const sun = new Date(now); sun.setDate(now.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sun); dt.setDate(sun.getDate() + i);
    dates.push(`${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`);
  }
  return dates;
}

function _getAttendanceSunday(weekDates) {
  return weekDates[0]; // first date = Sunday
}

function _getAllAttendanceSundays() {
  // Generate 8 weeks back and 4 weeks forward from today
  // This ensures navigation always works regardless of schedule data
  const sundays = new Set();

  // Start from 8 weeks ago Sunday
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const thisSun = new Date(now);
  thisSun.setDate(now.getDate() - day);
  thisSun.setHours(0, 0, 0, 0);

  for (let w = -8; w <= 4; w++) {
    const dt = new Date(thisSun);
    dt.setDate(thisSun.getDate() + w * 7);
    const dk = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    sundays.add(dk);
  }

  // Also add any Sundays found in schedule or attendance records
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(dk) {
      if (/\d{2}\/\d{2}/.test(dk) && getWkDay(dk) === 'Sun') sundays.add(dk);
    });
  });
  Object.keys(state.attendance || {}).forEach(key => {
    const dateKey = key.split('_')[1];
    if (dateKey && getWkDay(dateKey) === 'Sun') sundays.add(dateKey);
  });

  // Sort chronologically using full date comparison
  const toDate = dk => {
    const [d, m] = dk.split('/');
    const now = new Date();
    const y = now.getFullYear();
    // Handle year boundary: if month is more than 6 months ahead, it's last year
    const mInt = parseInt(m);
    const curM = now.getMonth() + 1;
    const yr = mInt - curM > 6 ? y - 1 : mInt - curM < -6 ? y + 1 : y;
    return new Date(yr, mInt - 1, parseInt(d));
  };

  return [...sundays].sort((a, b) => toDate(a) - toDate(b));
}

function _getLogbookConflicts(userId, weekDates) {
  const conflicts = [];
  const u = state.users.find(x => x.id === userId);
  if (!u) return conflicts;
  weekDates.forEach(dk => {
    const rec = DB.getAttendance(userId, dk);
    if (!rec) return;
    if (rec.note === 'auto') return;
    const hasRealRecord = (rec.start && rec.start.trim() && rec.start !== '—') ||
      (rec.end && rec.end.trim() && rec.end !== '—');
    if (!hasRealRecord) return;
    const [_d, _m] = dk.split('/');
    const y = new Date().getFullYear();
    const mk = `${y}-${_m.padStart ? _m : String(_m).padStart(2, '0')}`;
    const uAttCode = state.monthlyAttendance?.[u.username]?.[mk]?.[dk];
    if (!uAttCode) return;
    const parsed = typeof _parseAttCode === 'function' ? _parseAttCode(uAttCode) : null;
    if (!parsed) return;
    if (parsed.type === 'OFF' && uAttCode !== '0' && uAttCode !== '0.0') {
      conflicts.push({ dk, code: uAttCode, reason: parsed.reason || 'Off day' });
    }
  });
  return conflicts;
}

// ═══════════════════════════════════════════════
//  RENDER: ATTENDANCE PAGE
// ═══════════════════════════════════════════════
function renderAttendance() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';

  // Training role owns its entire attendance page (log + report tabs)
  if (isTraining(currentUser)) {
    if (typeof renderAttendanceTraining === 'function') return renderAttendanceTraining();
    return '<div class="empty">Loading…</div>';
  }

  // Tab header shared by both views
  const tabs = `
<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);">
  <button onclick="attendanceTab='log';nav('attendance')"
    style="padding:8px 20px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
      color:${attendanceTab === 'log' ? 'var(--accent)' : 'var(--text3)'};
      border-bottom:${attendanceTab === 'log' ? '2px solid var(--accent)' : '2px solid transparent'};
      margin-bottom:-2px;">
    ⏱ Weekly Log
  </button>
  <button onclick="attendanceTab='report';nav('attendance')"
    style="padding:8px 20px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
      color:${attendanceTab === 'report' ? 'var(--accent)' : 'var(--text3)'};
      border-bottom:${attendanceTab === 'report' ? '2px solid var(--accent)' : '2px solid transparent'};
      margin-bottom:-2px;">
    📋 Monthly Report
  </button>
</div>`;

  if (attendanceTab === 'report') {
    return `
<div class="page-header">
  <div><div class="page-title">⏱ Logbook & Reports</div></div>
</div>
${tabs}
${typeof renderReport === 'function' ? renderReport() : '<div class="empty">Report loading…</div>'}`;
  }

  // ── Tab: Weekly Log ──
  if (isTraining(currentUser)) {
    if (typeof renderAttendanceTraining === 'function') return renderAttendanceTraining();
    return '<div class="empty">Loading…</div>';
  }
  const weekDates = _getAttendanceWeek();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Users on this shift in this week (exclude training/admin roles)
  const shiftUsers = state.users.filter(u => {
    var _lvl = (ROLES[_resolveRole(u.role)] || {}).level;
    if (_lvl >= 3) return false;
    return weekDates.some(dk => {
      const s = _getUserShiftOnDate(u, dk);
      return s && s.startsWith && (s === currentShift || s.startsWith(currentShift));
    });
  }).sort((a, b) => (a.team || '').localeCompare(b.team || '', undefined, { numeric: true }) || (a.name || '').localeCompare(b.name || ''));

  // Week picker: all available sundays
  const allSundays = _getAllAttendanceSundays();
  const curSun = weekDates[0];
  const curIdx = allSundays.indexOf(curSun);
  const prevSun = curIdx > 0 ? allSundays[curIdx - 1] : null;
  const nextSun = curIdx < allSundays.length - 1 ? allSundays[curIdx + 1] : null;
  const btnStyle = (active) => `padding:4px 12px;border-radius:var(--r);
    border:1px solid var(--border2);background:var(--bg2);font-size:13px;
    cursor:${active ? 'pointer' : 'default'};color:${active ? 'var(--text)' : 'var(--text3)'}`;

  const weekPicker = `
    <div style="display:flex;align-items:center;gap:6px;">
      <button style="${btnStyle(!!prevSun)}"
        ${prevSun ? `onclick="attendanceMonday='${prevSun}';nav('attendance')"` : ''}>‹</button>
      <select class="login-select" style="font-size:12px;padding:4px 8px;min-width:140px;"
        onchange="attendanceMonday=this.value;nav('attendance')">
        ${allSundays.map(s =>
    `<option value="${s}" ${s === curSun ? 'selected' : ''}>${s} – ${_addDays(s, 6)}</option>`
  ).join('')}
      </select>
      <button style="${btnStyle(!!nextSun)}"
        ${nextSun ? `onclick="attendanceMonday='${nextSun}';nav('attendance')"` : ''}>›</button>
    </div>`;

  // Build rows
  const displayUsers = attendanceConflictFilter
    ? shiftUsers.filter(u => _getLogbookConflicts(u.id, weekDates).length > 0)
    : shiftUsers;

  const rows = displayUsers.map(u => {
    const logConflicts = _getLogbookConflicts(u.id, weekDates);
    const halfDayCells = _getHalfDayCellSet(u, weekDates);

    const cells = weekDates.map((dk, di) => {
      const shift = _getUserShiftOnDate(u, dk);
      if (!shift || !shift.startsWith(currentShift.charAt(0))) {
        return `<td style="background:var(--bg3);text-align:center;color:var(--text3);font-size:11px;">—</td>`;
      }
      const rec = DB.getAttendance(u.id, dk);
      const { late, early, lateMin, earlyMin } = calcLateEarly(u.id, dk);
      const hasData = rec && (rec.start || rec.end);
      const isLate = lateMin > 0;
      const isEarly = earlyMin > 0;

      const startTxt = rec?.start || '';
      const endTxt = rec?.end || '';
      const noteTxt = rec?.note || '';

      // Get effective shift defaults — override with half-day bounds when applicable
      const _shiftCodeRaw = _getUserShiftOnDate(u, dk);
      const _shiftCode = String(_shiftCodeRaw || '').trim().toUpperCase();
      let _def = SHIFT_DEFAULTS[_shiftCode] || {};
      if (halfDayCells.has(dk)) {
        const [, _hm] = dk.split('/');
        const _hmk = `${new Date().getFullYear()}-${String(_hm).padStart(2, '0')}`;
        const _hCode = state.monthlyAttendance?.[u.username]?.[_hmk]?.[dk];
        const _hParsed = _hCode && typeof _parseAttCode === 'function' ? _parseAttCode(_hCode) : null;
        if (_hParsed?.type === 'HD1' || _hParsed?.type === 'HD2') {
          const _hdKey = (_hParsed.shift || _shiftCode.charAt(0)) + (_hParsed.type === 'HD1' ? '1' : '2');
          const _hdDef = SHIFT_DEFAULTS[_hdKey];
          if (_hdDef) _def = _hdDef;
        }
      }

      // Row 1: login time only — color shows status
      const row1 = startTxt
        ? `<div style="font-size:10px;font-family:'IBM Plex Mono',monospace;
             color:${isLate ? 'var(--err)' : 'var(--ok)'};white-space:nowrap;">
             ${startTxt}
           </div>`
        : `<div style="font-size:10px;color:var(--text3);">—</div>`;

      // Row 2: delta always shown — (-) red if late, (+) green if on time
      const row2 = startTxt
        ? `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;
             color:${isLate ? 'var(--err)' : 'var(--ok)'};white-space:nowrap;">
             <span style="font-weight:700;">${isLate ? '(-)' : '(+)'}</span>
             ${_fmtDiffFull(lateMin, startTxt, _def.start)}
           </div>`
        : `<div style="font-size:9px;color:var(--text3);">—</div>`;

      // Row 3: logout time only — color shows status
      const row3 = endTxt
        ? `<div style="font-size:10px;font-family:'IBM Plex Mono',monospace;
             color:${isEarly ? 'var(--warn)' : 'var(--ok)'};white-space:nowrap;">
             ${endTxt}
           </div>`
        : `<div style="font-size:10px;color:var(--text3);">—</div>`;

      // Row 4: delta always shown — (-) amber if early, (+) green if on time
      const row4 = endTxt
        ? `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;
             color:${isEarly ? 'var(--warn)' : 'var(--ok)'};white-space:nowrap;">
             <span style="font-weight:700;">${isEarly ? '(-)' : '(+)'}</span>
             ${_fmtDiffFull(earlyMin, _def.end, endTxt)}
           </div>`
        : `<div style="font-size:9px;color:var(--text3);">—</div>`;

      const logConflict = logConflicts.find(c => c.dk === dk);
      const isHalfDayCell = halfDayCells.has(dk) && hasData;
      const bg = logConflict ? 'rgba(248,113,113,.18)'
        : isHalfDayCell ? 'rgba(59,130,246,.13)'
        : isLate || isEarly ? (isLate ? 'var(--D-bg)' : 'rgba(245,158,11,.08)')
        : (hasData ? 'var(--C-bg)' : '');

      // Check if this cell should be highlighted (came from conflict click)
      const isHighlighted = window._attHighlight &&
        window._attHighlight.uid === u.id &&
        window._attHighlight.dateKey === dk;

      const conflictTitle = logConflict ? `⚠ Time logged on ${logConflict.reason} (${logConflict.code})` : '';
      return `<td id="att-cell-${u.username}-${dk}"
        style="padding:3px 4px;background:${bg};cursor:pointer;min-width:110px;text-align:center;vertical-align:top;
          ${isHighlighted ? 'outline:2.5px solid var(--err);outline-offset:-2px;animation:attFlash 1s ease 3;' : ''}"
        onclick="openAttendanceModal(${u.id},'${dk}');window._attHighlight=null;">
        ${row1}
        ${row2}
        ${row3}
        ${row4}
        ${noteTxt ? `<div style="font-size:9px;color:var(--text3);white-space:nowrap;overflow:hidden;max-width:120px;text-overflow:ellipsis;" title="${noteTxt}">📝 ${noteTxt}</div>` : ''}
      </td>`;
    }).join('');

    // Row summary: count late + early days + conflicts
    let lateDays = 0, earlyDays = 0;
    weekDates.forEach(dk => {
      const { lateMin, earlyMin } = calcLateEarly(u.id, dk);
      if (lateMin > 0) lateDays++;
      if (earlyMin > 0) earlyDays++;
    });
    const summary = [
      lateDays > 0 ? `<span style="color:var(--err);font-size:10px;">${lateDays}L</span>` : '',
      earlyDays > 0 ? `<span style="color:var(--warn);font-size:10px;">${earlyDays}E</span>` : '',
    ].filter(Boolean).join(' ');

    const roleInfo = getRoleInfo(u.role);
    const stickyName = 'position:sticky;left:0;z-index:2;background:var(--bg);';
    const stickyUser = 'position:sticky;left:170px;z-index:2;background:var(--bg);border-right:2px solid var(--border);';
    return `<tr>
      <td style="padding:5px 8px;white-space:nowrap;${stickyName}">
        <div style="font-weight:600;font-size:12px;">${u.name}</div>
        <div style="font-size:10px;color:var(--text3);">${u.team || '—'} · <span class="role-tag ${roleInfo.tag}" style="font-size:9px;">${roleInfo.label}</span></div>
        ${logConflicts.length > 0 ? `<div style="font-size:9px;color:var(--err);margin-top:2px;">⚠ ${logConflicts.length} conflict${logConflicts.length > 1 ? 's' : ''}: ${logConflicts.map(c => c.dk).join(', ')}</div>` : ''}
        ${halfDayCells.size > 0 ? `<div style="font-size:9px;color:#3b82f6;margin-top:2px;">½ Half-day: ${[...halfDayCells].join(', ')}</div>` : ''}
      </td>
      <td style="padding:5px 8px;white-space:nowrap;${stickyUser}">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent);">${u.username}</div>
      </td>
      ${cells}
      <td style="text-align:center;padding:4px;">${summary || '<span style="color:var(--ok);font-size:10px;">✓</span>'}</td>
    </tr>`;
  }).join('');

  const dayHeaders = weekDates.map((dk, i) => {
    const isToday = dk === _todayDateKey();
    return `<th style="text-align:center;padding:4px 6px;min-width:68px;background:${isToday ? 'var(--accent)' : 'var(--bg4)'};color:${isToday ? '#fff' : 'var(--text2)'};font-size:11px;">
      <div>${dayLabels[i]}</div>
      <div style="font-weight:400;font-size:10px;">${dk}</div>
    </th>`;
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">⏱ Logbook & Reports</div>
    <div class="page-sub">Track late arrivals and early departures · Shift ${currentShift} · Week Sun–Sat</div>
  </div>
</div>
${tabs}

<!-- Week picker -->
<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
  <label style="font-size:12px;color:var(--text2);">WEEK:</label>
  ${weekPicker}
  <span style="font-size:11px;color:var(--text3);">${attendanceConflictFilter ? displayUsers.length : shiftUsers.length} staff on Shift ${currentShift}</span>
  <button onclick="attendanceConflictFilter=!attendanceConflictFilter;nav('attendance')"
    style="padding:4px 12px;border-radius:var(--r);font-size:12px;cursor:pointer;
      border:1px solid ${attendanceConflictFilter ? 'var(--err)' : 'var(--border2)'};
      background:${attendanceConflictFilter ? 'rgba(248,113,113,.12)' : 'var(--bg2)'};
      color:${attendanceConflictFilter ? 'var(--err)' : 'var(--text)'};">
    ⚠ Conflicts only${attendanceConflictFilter ? ' ✕' : ''}
  </button>
</div>

<!-- Legend -->
<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
  <span style="font-size:11px;padding:2px 8px;background:var(--D-bg);border-radius:4px;color:var(--err);">🔴 Late start</span>
  <span style="font-size:11px;padding:2px 8px;background:rgba(245,158,11,.08);border-radius:4px;color:var(--warn);">🟡 Early end</span>
  <span style="font-size:11px;padding:2px 8px;background:var(--C-bg);border-radius:4px;color:var(--ok);">🟢 On time</span>
  <span style="font-size:11px;padding:2px 8px;background:rgba(59,130,246,.13);border-radius:4px;color:#3b82f6;">🔵 Half day</span>
  <span style="font-size:11px;color:var(--text3);">Click any cell to fill/edit</span>
</div>

${(() => {
      const allConflicts = shiftUsers.flatMap(u =>
        _getLogbookConflicts(u.id, weekDates).map(c => ({ ...c, name: u.name }))
      );
      if (!allConflicts.length) return '';
      return `<div style="padding:10px 14px;background:var(--D-bg);border:1px solid var(--err);
    border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--err);line-height:1.8;">
    ⚠ <b>${allConflicts.length} conflict${allConflicts.length > 1 ? 's' : ''}</b> this week —
    ${allConflicts.map(c => `<b>${c.name}</b> on ${c.dk} (${c.code})`).join(' · ')}
  </div>`;
    })()}

<!-- Table -->
<div style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 280px);border:1px solid var(--border);border-radius:8px;">
  <table style="border-collapse:collapse;width:100%;font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 8px;background:var(--bg4);font-size:11px;min-width:170px;position:sticky;top:0;left:0;z-index:4;">NAME</th>
        <th style="text-align:left;padding:6px 8px;background:var(--bg4);font-size:11px;min-width:130px;position:sticky;top:0;left:170px;z-index:4;border-right:2px solid var(--border);">USERNAME</th>
        ${dayHeaders.replace(/position:sticky/g, 'position:sticky').replace(/<th style="/g, '<th style="position:sticky;top:0;z-index:3;')}
        <th style="text-align:center;padding:4px 6px;background:var(--bg4);font-size:11px;min-width:50px;position:sticky;top:0;z-index:3;">TOTAL</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="9" class="empty">No staff on Shift ' + currentShift + ' this week.</td></tr>'}</tbody>
  </table>
</div>`;
}

// ── Modal: fill attendance for one person one day ──
let _attendModal = { uid: null, dateKey: null };

function openAttendanceModal(uid, dateKey) {
  if (!isLeader(currentUser)) return;
  _attendModal = { uid, dateKey };
  const u = state.users.find(x => x.id === uid);
  const rec = DB.getAttendance(uid, dateKey) || {};
  const shift = _getUserShiftOnDate(u, dateKey);
  const def = SHIFT_DEFAULTS[shift] || {};

  document.getElementById('attend-modal-title').textContent =
    `${u?.name || '?'} — ${dateKey} (Shift ${shift || '?'})`;
  document.getElementById('attend-modal-default').textContent =
    def.start ? `Default: ${def.start} → ${def.end}` : 'No default for this shift';
  document.getElementById('attend-start').value = rec.start || '';
  document.getElementById('attend-end').value = rec.end || '';
  document.getElementById('attend-note').value = rec.note || '';
  const lastEditHtml = (rec.at) ? (() => {
  // Resolve editor name: stored name > state.users > staffInfo > ID fallback
  let editorName = rec.byName || null;
  if (!editorName && rec.by) {
    const found = state.users.find(x => x.id == rec.by); // loose == handles string/number mismatch
    if (found) editorName = found.name;
  }
  if (!editorName && rec.by) {
    // Check staffInfo by username hash (same pattern used elsewhere in codebase)
    const si = Object.entries(state.staffInfo || {}).find(([, v]) => v.name && state.users.find(u => u.id == rec.by && u.username));
    if (si) editorName = si[1].name;
  }
  if (!editorName) editorName = rec.by ? `ID ${rec.by}` : 'Unknown';

  const elapsed = Math.round((Date.now() - rec.at) / 60000);
  const timeAgo = elapsed < 2 ? 'just now'
    : elapsed < 60 ? `${elapsed}m ago`
    : elapsed < 1440 ? `${Math.round(elapsed/60)}h ago`
    : `${Math.round(elapsed/1440)}d ago`;
  return `<div style="font-size:11px;color:var(--text3);padding:5px 8px;
    background:var(--bg3);border-radius:5px;border-left:2px solid var(--border2);">
    ✏️ Last saved by <b style="color:var(--text2);">${editorName}</b> · ${timeAgo}
  </div>`;
})() : '';
document.getElementById('attend-result').innerHTML = lastEditHtml;
  document.getElementById('modal-attend').classList.add('show');
}

function previewAttendance() {
  const start = _normalizeTime(document.getElementById('attend-start').value.trim());
  const end = _normalizeTime(document.getElementById('attend-end').value.trim());
  const { uid, dateKey } = _attendModal;
  const u = state.users.find(x => x.id === uid);
  const shift = _getUserShiftOnDate(u, dateKey);
  const def = SHIFT_DEFAULTS[shift] || {};
  let html = '';
  if (start && def.start) {
    const diff = _parseTime(start) - _parseTime(def.start);
    const adj = Math.abs(diff) > 720 ? (diff > 0 ? diff - 1440 : diff + 1440) : diff;
    html += adj > 0
      ? `<span style="color:var(--err);">🔴 Late by ${_fmtDiff(adj)}</span> `
      : `<span style="color:var(--ok);">🟢 On time (start)</span> `;
  }
  if (end && def.end) {
    const diff = _parseTime(def.end) - _parseTime(end);
    const adj = Math.abs(diff) > 720 ? (diff > 0 ? diff - 1440 : diff + 1440) : diff;
    html += adj > 0
      ? `<span style="color:var(--warn);">🟡 Early by ${_fmtDiff(adj)}</span>`
      : `<span style="color:var(--ok);">🟢 On time (end)</span>`;
  }
  // Guard #3: start > end check (with overnight awareness)
  if (start && end) {
    let s = _parseTime(start), e = _parseTime(end);
    // Overnight shift: if end < start by more than 60 min, it's next-day — that's fine
    const diff = e - s;
    if (diff > 0 && diff < 720) {
      // end is after start within same half-day — suspicious but could be valid, just warn
    } else if (diff <= 0 && Math.abs(diff) < 720) {
      // end is before start on same side of midnight — clear error
      html += `<span style="color:var(--err);font-weight:600;">⚠ Logout is before login — please check times</span>`;
    }
  }
  document.getElementById('attend-result').innerHTML = html;
}

async function saveAttendance() {
  const startRaw = document.getElementById('attend-start').value.trim();
  const endRaw = document.getElementById('attend-end').value.trim();
  const start = _normalizeTime(startRaw);
  const end = _normalizeTime(endRaw);
  const note = document.getElementById('attend-note').value.trim();
  const { uid, dateKey } = _attendModal;
  // Guard #3: block save if logout is before login (non-overnight)
if (start && end) {
  const s = _parseTime(start), e = _parseTime(end);
  const diff = e - s;
  if (diff <= 0 && Math.abs(diff) < 720) {
    toast('⚠ Logout time is before login time — please correct.', 'err');
    return;
  }
}
  if (!start && !end && !note) {
    // Write tombstone so other browsers know this was deleted
    DB.setAttendance(uid, dateKey, { _deleted: true, at: Date.now() });
  } else {
    DB.setAttendance(uid, dateKey, { start, end, note, by: currentUser?.id, byName: currentUser?.name, at: Date.now() });
  }
  closeModal('modal-attend');
  await syncWrite();
  toast('Attendance saved', 'ok');
  nav('attendance');
}

function deleteAttendance() {
  const { uid, dateKey } = _attendModal;
  // Write tombstone so sync can propagate the deletion to other browsers
  DB.setAttendance(uid, dateKey, { _deleted: true, at: Date.now() });
  closeModal('modal-attend');
  syncWrite();
  toast('Cleared', 'ok');
  nav('attendance');
}

// ── Helpers ──
function _todayDateKey() {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
}

function _addDays(dateKey, n) {
  const [d, m] = dateKey.split('/');
  const dt = new Date(2026, parseInt(m) - 1, parseInt(d));
  dt.setDate(dt.getDate() + n);
  return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ── Dashboard widget: today's late/early summary ──
function renderAttendanceWidget() {
  const today = _todayDateKey();
  const allUsers = state.users.filter(u => {
    const s = _getUserShiftOnDate(u, today);
    return s && s.charAt(0) === currentShift.charAt(0);
  });

  const lateList = [];
  const earlyList = [];

  allUsers.forEach(u => {
    const { lateMin, earlyMin, late, early } = calcLateEarly(u.id, today);
    if (lateMin > 0) lateList.push({ name: u.name, diff: late, role: u.role });
    if (earlyMin > 0) earlyList.push({ name: u.name, diff: early, role: u.role });
  });

  if (lateList.length === 0 && earlyList.length === 0) {
    // Check if anyone has attendance recorded today at all
    const hasAny = allUsers.some(u => DB.getAttendance(u.id, today));
    if (!hasAny) return `
      <div style="font-size:11px;color:var(--text3);padding:8px 0;">
        No attendance recorded for today yet.
        ${isLeader(currentUser) ? `<a href="#" onclick="nav('attendance');return false;" style="color:var(--accent);margin-left:6px;">Fill in →</a>` : ''}
      </div>`;
    return `<div style="font-size:11px;color:var(--ok);padding:8px 0;">✓ All on time today</div>`;
  }

  const lateHTML = lateList.map(x =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;">${x.name}</span>
      <span style="font-size:11px;color:var(--err);font-family:'IBM Plex Mono',monospace;">${x.diff}</span>
    </div>`).join('');

  const earlyHTML = earlyList.map(x =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;">${x.name}</span>
      <span style="font-size:11px;color:var(--warn);font-family:'IBM Plex Mono',monospace;">${x.diff}</span>
    </div>`).join('');

  return `
    ${lateList.length > 0 ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--err);margin-bottom:4px;letter-spacing:.06em;">
        🔴 Late (${lateList.length})
      </div>
      ${lateHTML}` : ''}
    ${earlyList.length > 0 ? `
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--warn);margin:${lateList.length ? '10px' : 0} 0 4px;letter-spacing:.06em;">
        🟡 Early out (${earlyList.length})
      </div>
      ${earlyHTML}` : ''}
    ${isLeader(currentUser) ? `<div style="margin-top:8px;"><a href="#" onclick="nav('attendance');return false;" style="font-size:11px;color:var(--accent);">View full attendance →</a></div>` : ''}`;
}
