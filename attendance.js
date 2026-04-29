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
  const mins = _parseTime(str);
  if (mins === null) return str.trim(); // store as-is if unrecognized
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}

// Format minute diff → "+HH:MM" string
function _fmtDiff(mins) {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60).toString().padStart(2, '0');
  const m = (abs % 60).toString().padStart(2, '0');
  return `+${h}:${m}`;
}

// Get shift code for a user on a specific date
// Uses schedule[dateKey] first, falls back to schedule[dayName]
function _getUserShiftOnDate(u, dateKey) {
  if (!u || !u.schedule) return null;
  return u.schedule[dateKey] || u.schedule[getWkDay(dateKey)] || null;
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

  const def = SHIFT_DEFAULTS[shiftCode];
  if (!def) return { late: null, early: null, lateMin: 0, earlyMin: 0 };

  let lateMin = 0, earlyMin = 0;

  if (rec.start) {
    const actualStart = _parseTime(rec.start);
    const defStart    = _parseTime(def.start);
    // Handle overnight shifts: if defStart ≥ 12:00 and actualStart < 12:00 → next day
    let diff = actualStart - defStart;
    if (Math.abs(diff) > 720) diff = diff > 0 ? diff - 1440 : diff + 1440;
    if (diff > 0) lateMin = diff;
  }

  if (rec.end) {
    const actualEnd = _parseTime(rec.end);
    const defEnd    = _parseTime(def.end);
    let diff = defEnd - actualEnd;
    if (Math.abs(diff) > 720) diff = diff > 0 ? diff - 1440 : diff + 1440;
    if (diff > 0) earlyMin = diff;
  }

  return {
    late:     lateMin  > 0 ? _fmtDiff(lateMin)  : null,
    early:    earlyMin > 0 ? _fmtDiff(earlyMin) : null,
    lateMin,
    earlyMin,
  };
}

// ── State for attendance page ──
let attendanceMonday = null; // null = current week
let attendanceTab    = 'log';  // 'log' | 'report'

function _getAttendanceWeek() {
  if (attendanceMonday) return getWeekRange(attendanceMonday);
  // Week is Sun–Sat (not Mon–Sun like break schedule)
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const sun = new Date(now); sun.setDate(now.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sun); dt.setDate(sun.getDate() + i);
    dates.push(`${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`);
  }
  return dates;
}

function _getAttendanceSunday(weekDates) {
  return weekDates[0]; // first date = Sunday
}

function _getAllAttendanceSundays() {
  // Collect all Sunday keys from attendance records
  const sundays = new Set();
  // Also gather from users' schedules
  state.users.forEach(u => {
    Object.keys(u.schedule || {}).forEach(dk => {
      if (getWkDay(dk) === 'Sun') sundays.add(dk);
    });
  });
  // Add current week
  const cur = _getAttendanceWeek();
  sundays.add(cur[0]);
  // Also from attendance records
  Object.keys(state.attendance || {}).forEach(key => {
    const dateKey = key.split('_')[1];
    if (dateKey && getWkDay(dateKey) === 'Sun') sundays.add(dateKey);
  });
  return [...sundays].sort((a, b) => {
    const [da, ma] = a.split('/'); const [db, mb] = b.split('/');
    return new Date(2026, parseInt(ma)-1, parseInt(da)) - new Date(2026, parseInt(mb)-1, parseInt(db));
  });
}

// ═══════════════════════════════════════════════
//  RENDER: ATTENDANCE PAGE
// ═══════════════════════════════════════════════
function renderAttendance() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';

  // Tab header shared by both views
  const tabs = `
<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);">
  <button onclick="attendanceTab='log';nav('attendance')"
    style="padding:8px 20px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
      color:${attendanceTab==='log'?'var(--accent)':'var(--text3)'};
      border-bottom:${attendanceTab==='log'?'2px solid var(--accent)':'2px solid transparent'};
      margin-bottom:-2px;">
    ⏱ Weekly Log
  </button>
  <button onclick="attendanceTab='report';nav('attendance')"
    style="padding:8px 20px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
      color:${attendanceTab==='report'?'var(--accent)':'var(--text3)'};
      border-bottom:${attendanceTab==='report'?'2px solid var(--accent)':'2px solid transparent'};
      margin-bottom:-2px;">
    📋 Monthly Report
  </button>
</div>`;

  if (attendanceTab === 'report') {
    return `
<div class="page-header">
  <div>
    <div class="page-title">⏱ Attendance & Reports</div>
    <div class="page-sub">Weekly log and monthly summary</div>
  </div>
</div>
${tabs}
${typeof renderReport === 'function' ? renderReport() : '<div class="empty">Report loading…</div>'}`;
  }

  // ── Tab: Weekly Log ──
  const weekDates  = _getAttendanceWeek();
  const dayLabels  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Users on this shift in this week
  const shiftUsers = state.users.filter(u =>
    weekDates.some(dk => {
      const s = _getUserShiftOnDate(u, dk);
      return s && s.startsWith && (s === currentShift || s.startsWith(currentShift));
    })
  ).sort((a, b) => (a.team||'').localeCompare(b.team||'', undefined, {numeric:true}) || (a.name||'').localeCompare(b.name||''));

  // Week picker: all available sundays
  const allSundays = _getAllAttendanceSundays();
  const curSun     = weekDates[0];
  const weekPicker = allSundays.length > 1 ? `
    <select class="fg" style="font-size:12px;padding:4px 8px;width:auto;"
      onchange="attendanceMonday=this.value==='cur'?null:this.value;nav('attendance')">
      ${allSundays.map(s => `<option value="${s}" ${s===curSun?'selected':''}>${s} – ${_addDays(s,6)}</option>`).join('')}
      ${!allSundays.includes(curSun) ? `<option value="cur" selected>This week</option>` : ''}
    </select>` : `<span style="font-size:12px;color:var(--text2);">${curSun} – ${_addDays(curSun,6)}</span>`;

  // Build rows
  const rows = shiftUsers.map(u => {
    const cells = weekDates.map((dk, di) => {
      const shift = _getUserShiftOnDate(u, dk);
      if (!shift || !shift.startsWith(currentShift.charAt(0))) {
        return `<td style="background:var(--bg3);text-align:center;color:var(--text3);font-size:11px;">—</td>`;
      }
      const rec = DB.getAttendance(u.id, dk);
      const {late, early, lateMin, earlyMin} = calcLateEarly(u.id, dk);
      const hasData = rec && (rec.start || rec.end);
      const isLate  = lateMin  > 0;
      const isEarly = earlyMin > 0;

      const startTxt  = rec?.start  || '';
      const endTxt    = rec?.end    || '';
      const noteTxt   = rec?.note   || '';

      const startCell = startTxt
        ? `<span style="font-size:10px;color:${isLate?'var(--err)':'var(--ok)'};">${startTxt}</span>${isLate ? `<span style="font-size:9px;color:var(--err);display:block;">${late}</span>` : ''}`
        : `<span style="color:var(--text3);font-size:11px;">—</span>`;
      const endCell = endTxt
        ? `<span style="font-size:10px;color:${isEarly?'var(--warn)':'var(--ok)'};">${endTxt}</span>${isEarly ? `<span style="font-size:9px;color:var(--warn);display:block;">${early}</span>` : ''}`
        : `<span style="color:var(--text3);font-size:11px;">—</span>`;

      const bg = isLate || isEarly ? (isLate ? 'var(--D-bg)' : 'rgba(245,158,11,.08)') : (hasData ? 'var(--C-bg)' : '');

      return `<td style="padding:3px 4px;background:${bg};cursor:pointer;min-width:68px;text-align:center;vertical-align:top;"
        onclick="openAttendanceModal(${u.id},'${dk}')">
        <div>${startCell}</div>
        <div>${endCell}</div>
        ${noteTxt ? `<div style="font-size:9px;color:var(--text3);white-space:nowrap;overflow:hidden;max-width:66px;text-overflow:ellipsis;" title="${noteTxt}">📝 ${noteTxt}</div>` : ''}
      </td>`;
    }).join('');

    // Row summary: count late + early days
    let lateDays = 0, earlyDays = 0;
    weekDates.forEach(dk => {
      const {lateMin, earlyMin} = calcLateEarly(u.id, dk);
      if (lateMin > 0)  lateDays++;
      if (earlyMin > 0) earlyDays++;
    });
    const summary = [
      lateDays  > 0 ? `<span style="color:var(--err);font-size:10px;">${lateDays}L</span>` : '',
      earlyDays > 0 ? `<span style="color:var(--warn);font-size:10px;">${earlyDays}E</span>` : '',
    ].filter(Boolean).join(' ');

    const roleInfo = getRoleInfo(u.role);
    const stickyName = 'position:sticky;left:0;z-index:2;background:var(--bg);';
    const stickyUser = 'position:sticky;left:170px;z-index:2;background:var(--bg);border-right:2px solid var(--border);';
    return `<tr>
      <td style="padding:5px 8px;white-space:nowrap;${stickyName}">
        <div style="font-weight:600;font-size:12px;">${u.name}</div>
        <div style="font-size:10px;color:var(--text3);">${u.team||'—'} · <span class="role-tag ${roleInfo.tag}" style="font-size:9px;">${roleInfo.label}</span></div>
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
    return `<th style="text-align:center;padding:4px 6px;min-width:68px;background:${isToday?'var(--accent)':'var(--bg4)'};color:${isToday?'#fff':'var(--text2)'};font-size:11px;">
      <div>${dayLabels[i]}</div>
      <div style="font-weight:400;font-size:10px;">${dk}</div>
    </th>`;
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">⏱ Attendance & Reports</div>
    <div class="page-sub">Track late arrivals and early departures · Shift ${currentShift} · Week Sun–Sat</div>
  </div>
</div>
${tabs}

<!-- Week picker -->
<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
  <label style="font-size:12px;color:var(--text2);">WEEK:</label>
  ${weekPicker}
  <span style="font-size:11px;color:var(--text3);">${shiftUsers.length} staff on Shift ${currentShift}</span>
</div>

<!-- Legend -->
<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
  <span style="font-size:11px;padding:2px 8px;background:var(--D-bg);border-radius:4px;color:var(--err);">🔴 Late start</span>
  <span style="font-size:11px;padding:2px 8px;background:rgba(245,158,11,.08);border-radius:4px;color:var(--warn);">🟡 Early end</span>
  <span style="font-size:11px;padding:2px 8px;background:var(--C-bg);border-radius:4px;color:var(--ok);">🟢 On time</span>
  <span style="font-size:11px;color:var(--text3);">Click any cell to fill/edit</span>
</div>

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
  const u   = state.users.find(x => x.id === uid);
  const rec = DB.getAttendance(uid, dateKey) || {};
  const shift = _getUserShiftOnDate(u, dateKey);
  const def   = SHIFT_DEFAULTS[shift] || {};

  document.getElementById('attend-modal-title').textContent =
    `${u?.name || '?'} — ${dateKey} (Shift ${shift || '?'})`;
  document.getElementById('attend-modal-default').textContent =
    def.start ? `Default: ${def.start} → ${def.end}` : 'No default for this shift';
  document.getElementById('attend-start').value = rec.start || '';
  document.getElementById('attend-end').value   = rec.end   || '';
  document.getElementById('attend-note').value  = rec.note  || '';
  document.getElementById('attend-result').innerHTML = '';
  document.getElementById('modal-attend').classList.add('show');
}

function previewAttendance() {
  const start = _normalizeTime(document.getElementById('attend-start').value.trim());
  const end   = _normalizeTime(document.getElementById('attend-end').value.trim());
  const {uid, dateKey} = _attendModal;
  const u = state.users.find(x => x.id === uid);
  const shift = _getUserShiftOnDate(u, dateKey);
  const def   = SHIFT_DEFAULTS[shift] || {};
  let html = '';
  if (start && def.start) {
    const diff = _parseTime(start) - _parseTime(def.start);
    const adj  = Math.abs(diff) > 720 ? (diff > 0 ? diff - 1440 : diff + 1440) : diff;
    html += adj > 0
      ? `<span style="color:var(--err);">🔴 Late by ${_fmtDiff(adj)}</span> `
      : `<span style="color:var(--ok);">🟢 On time (start)</span> `;
  }
  if (end && def.end) {
    const diff = _parseTime(def.end) - _parseTime(end);
    const adj  = Math.abs(diff) > 720 ? (diff > 0 ? diff - 1440 : diff + 1440) : diff;
    html += adj > 0
      ? `<span style="color:var(--warn);">🟡 Early by ${_fmtDiff(adj)}</span>`
      : `<span style="color:var(--ok);">🟢 On time (end)</span>`;
  }
  document.getElementById('attend-result').innerHTML = html;
}

async function saveAttendance() {
  const startRaw = document.getElementById('attend-start').value.trim();
  const endRaw   = document.getElementById('attend-end').value.trim();
  const start = _normalizeTime(startRaw);
  const end   = _normalizeTime(endRaw);
  const note  = document.getElementById('attend-note').value.trim();
  const {uid, dateKey} = _attendModal;
  if (!start && !end && !note) {
    DB.delAttendance(uid, dateKey);
  } else {
    DB.setAttendance(uid, dateKey, { start, end, note, by: currentUser?.id, at: Date.now() });
  }
  closeModal('modal-attend');
  await syncWrite();
  toast('Attendance saved', 'ok');
  nav('attendance');
}

function deleteAttendance() {
  const {uid, dateKey} = _attendModal;
  DB.delAttendance(uid, dateKey);
  closeModal('modal-attend');
  syncWrite();
  toast('Cleared', 'ok');
  nav('attendance');
}

// ── Helpers ──
function _todayDateKey() {
  const now = new Date();
  return `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}`;
}

function _addDays(dateKey, n) {
  const [d, m] = dateKey.split('/');
  const dt = new Date(2026, parseInt(m)-1, parseInt(d));
  dt.setDate(dt.getDate() + n);
  return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
}

// ── Dashboard widget: today's late/early summary ──
function renderAttendanceWidget() {
  const today     = _todayDateKey();
  const allUsers  = state.users.filter(u => {
    const s = _getUserShiftOnDate(u, today);
    return s && s.charAt(0) === currentShift.charAt(0);
  });

  const lateList  = [];
  const earlyList = [];

  allUsers.forEach(u => {
    const {lateMin, earlyMin, late, early} = calcLateEarly(u.id, today);
    if (lateMin  > 0) lateList.push({ name: u.name, diff: late,  role: u.role });
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
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--warn);margin:${lateList.length?'10px':0} 0 4px;letter-spacing:.06em;">
        🟡 Early out (${earlyList.length})
      </div>
      ${earlyHTML}` : ''}
    ${isLeader(currentUser) ? `<div style="margin-top:8px;"><a href="#" onclick="nav('attendance');return false;" style="font-size:11px;color:var(--accent);">View full attendance →</a></div>` : ''}`;
}
