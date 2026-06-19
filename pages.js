//  WORKING DAYS (store shift char):
//  XA → shift A working day
//  XB → shift B working day
//  XC → shift C working day
//  XD → shift D working day
//  XE → shift E working day
//  X2A–X2E → working × 2 multiplier (still working)
//  X3A–X3E → working × 3 multiplier (still working)
//  X4A–X4E → working × 4 multiplier (still working)
//
//  HALF-DAY (paid leave, first/second half):
//  A1,B1,C1,D1,E1 → work first half, leave second half
//  A2,B2,C2,D2,E2 → work second half, leave first half
//
//  HALF-DAY (unpaid):
//  UA1,UB1,UC1,UD1,UE1 → same but unpaid
//  UA2,UB2,UC2,UD2,UE2 → same but unpaid
//
//  FULL OFF (all should flag conflict if attendance log exists):
//  A  → annual leave (phép năm)
//  H  → public holiday (nghỉ lễ)
//  0  → weekly day off (nghỉ tuần)
//  U  → unpaid leave
//  S  → sick leave (BHXH)
//  L  → personal leave (kết hôn, tang)
//
//  SHIFT MISMATCH: XA on shift B day → conflict

// ── Monthly attendance code map (Excel legend rows 123-168) ──
const ATT_CODE_MAP = (() => {
  const map = {};
  ['A', 'B', 'C', 'D', 'E'].forEach(sh => {
    map[`X${sh}`] = { type: 'WD', shift: sh };
    map[`X2${sh}`] = { type: 'WD', shift: sh };
    map[`X3${sh}`] = { type: 'WD', shift: sh };
    map[`X4${sh}`] = { type: 'WD', shift: sh };
    map[`${sh}1`] = { type: 'HD1', shift: sh };
    map[`${sh}2`] = { type: 'HD2', shift: sh };
    map[`U${sh}1`] = { type: 'HD1', shift: sh };
    map[`U${sh}2`] = { type: 'HD2', shift: sh };
  });
  map['A'] = { type: 'OFF', reason: 'Annual leave' };
  map['H'] = { type: 'OFF', reason: 'Public holiday' };
  map['U'] = { type: 'OFF', reason: 'Unpaid leave' };
  map['S'] = { type: 'OFF', reason: 'Sick leave' };
  map['L'] = { type: 'OFF', reason: 'Personal leave' };
  map['0'] = { type: 'OFF', reason: 'Day off' };
  map['0.0'] = { type: 'OFF', reason: 'Day off' };
  return map;
})();

function _parseAttCode(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(typeof raw === 'number' ? Math.round(raw) : raw).trim().toUpperCase();
  return ATT_CODE_MAP[s] || null;
}

function _excelDateToDk(h, fallbackMonth) {
  if (!h) return null;
  if (h instanceof Date) {
    return String(h.getDate()).padStart(2, '0') + '/' + String(h.getMonth() + 1).padStart(2, '0');
  }
  if (typeof h === 'number' && h > 40000) {
    const dt = new Date(Math.round((h - 25569) * 86400 * 1000));
    return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0');
  }
  if (typeof h === 'string') {
    if (h.match(/^\d{4}-\d{2}-\d{2}/)) {
      const dt = new Date(h);
      if (!isNaN(dt)) return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
    }
    const c = h.replace(/[-–]/g, '/').trim();
    if (/^\d{1,2}\/\d{1,2}$/.test(c)) {
      const [d, m] = c.split('/');
      return d.padStart(2, '0') + '/' + m.padStart(2, '0');
    }
    if (/^\d{1,2}$/.test(c) && fallbackMonth) {
      return c.padStart(2, '0') + '/' + String(fallbackMonth).padStart(2, '0');
    }
  }
  return null;
}

function _getMondayOfWeek(dk) {
  // Given a DD/MM dateKey, return the Monday of that week as DD/MM
  // Week is Sun–Sat in the attendance view, but we need the Sunday
  const [d, m] = dk.split('/');
  const dt = new Date(new Date().getFullYear(), parseInt(m) - 1, parseInt(d));
  // Go back to Sunday (start of attendance week)
  const day = dt.getDay(); // 0=Sun
  dt.setDate(dt.getDate() - day);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function _checkAttConflict(u, dk, parsedCode) {
  if (!parsedCode) return null;
  const weekRec = DB.getLogbook(u.id, dk);
  // Auto-synced records (note='auto') haven't been reviewed by a leader — skip
  if (weekRec?.note === 'auto') return null;
  var schedShift = _getSched(u.username, dk).charAt(0);
  const conflicts = [];
  // Only flag if start or end is a non-empty, non-dash string
  const hasRealRecord = weekRec &&
    ((weekRec.start && weekRec.start.trim() !== '' && weekRec.start !== '—') ||
      (weekRec.end && weekRec.end.trim() !== '' && weekRec.end !== '—'));

  if (parsedCode.type === 'OFF') {
    if (hasRealRecord) {
      conflicts.push(`Attendance logged on ${parsedCode.reason || 'off day'}`);
    }
  } else if (parsedCode.type === 'WD') {
    if (schedShift && parsedCode.shift && schedShift !== parsedCode.shift) {
      conflicts.push(`Attendance: Shift ${parsedCode.shift}, Schedule: Shift ${schedShift}`);
    }
  }
  return conflicts.length > 0 ? conflicts : null;
}

// Always read gender from staffInfo first, fall back to user object
function _getUserGender(u) {
  if (!u) return '';
  return DB.getStaffInfo(u.username)?.gender || u.gender || '';
}

// ═══════════════════════════════════════════════
//  Role sort order for Staff Info tab
// ─────────────────────────────────────────────

const ROLE_SORT_ORDER = {
  'Training Manager':         0,
  'Training Assistant':       1,
  'Data Analyst Leader':      2,
  'Data Analyst Supervisor':  3,
  'Sr Data Supervisor':       4,
  'Data Supervisor':          5,
  'Sr Data Analyst':          6,
  'Data Analyst':             7,
  'Admin': 99,
};

function _roleSort(a, b) {
  const ra = ROLE_SORT_ORDER[_resolveRole(a.role)] ?? 9;
  const rb = ROLE_SORT_ORDER[_resolveRole(b.role)] ?? 9;
  if (ra !== rb) return ra - rb;
  return (a.name || '').localeCompare(b.name || '');
}

var _ROLE_COLOR = {
  'Training Manager':        '#34d399',
  'Training Assistant':      '#34d399',
  'Data Analyst Leader':     '#f59e0b',
  'Data Analyst Supervisor': '#38bdf8',
  'Sr Data Supervisor':      '#c084fc',
  'Data Supervisor':         '#818cf8',
  'Sr Data Analyst':         '#fb923c',
  'Data Analyst':            '#60a5fa',
};
function _roleColor(role) {
  return _ROLE_COLOR[_resolveRole(role)||role] || 'var(--text2)';
}

//  RENDER: DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const weekDates = getWeekDates(); // always real current week
  const todayDk = weekDates[new Date().getDay()]; 
  const si = DB.getStaffInfo(currentUser.username);
  const gender = _getUserGender(currentUser);
  const mk = currentMonthKey();
  const extUsed = DB.countExtBreaks(currentUser.id, mk);

  // My break today
  const myBr = getAssigned(currentUser.id, todayDk)
    || getAssigned(currentUser.id, getWkDay(todayDk));
  var myShift = _getSched(currentUser.username, todayDk);
  const onShift = myShift === currentShift;

  // Pending requests
  const myPending = state.requests.filter(r =>
    r.userId === currentUser.id && r.status === 'pending'
  ).length;
  const allPending = state.requests.filter(r => r.status === 'pending').length;

  // Team breaks today (same shift, exclude lead/sub/training)
  const shiftMates = getShiftMates(currentShift, todayDk).filter(function(u) {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    return (ROLES[_resolveRole(_ur)||_ur] || {}).level < 2;
  });
  const assigned = shiftMates.filter(u => getAssigned(u.id, todayDk)).length;

  const greetHour = new Date().getHours();
  const greet = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  // My break card
  const myBreakCard = `
<div class="card" style="margin-bottom:0;">
  <div class="card-title">🕐 My Break Today</div>
  ${!onShift
      ? `<div style="color:var(--text3);font-size:13px;">Not on Shift ${currentShift} today.</div>`
      : myBr
        ? `<div style="display:flex;align-items:center;gap:12px;">
          <span class="break-slot assigned slot-${(BREAK_SLOTS[currentShift] || []).indexOf(myBr.slot) + 1 || 1}"
            style="font-size:14px;padding:8px 18px;font-weight:700;">
            ${getShortSlot(currentShift, myBr.slot)}
          </span>
          <div>
            <div style="font-size:16px;font-weight:700;">${myBr.slot}</div>
            <div style="font-size:11px;color:var(--text3);">${SHIFTS[currentShift].display}</div>
          </div>
        </div>`
        : `<div style="color:var(--warn);font-size:13px;">⏳ Not assigned yet for today.</div>`}
  ${gender === 'F' ? `<div style="margin-top:10px;font-size:11px;color:var(--A-color);">🌸 Extra 30-min breaks used this month: <b>${extUsed}/3</b></div>` : ''}
</div>`;

  // Stats row
  const statsRow = `
<div class="stats">
  <div class="stat">
    <div class="stat-label">Shift Today</div>
    <div class="stat-num" style="font-size:20px;">${onShift ? `<span class="sh sh-${currentShift}" style="width:36px;height:36px;font-size:18px;">${currentShift}</span>` : '—'}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Team on shift</div>
    <div class="stat-num">${shiftMates.length}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Breaks assigned</div>
    <div class="stat-num" style="color:${assigned === shiftMates.length && shiftMates.length > 0 ? 'var(--ok)' : 'var(--warn)'}">${assigned}<span style="font-size:14px;color:var(--text3)">/${shiftMates.length}</span></div>
  </div>
  ${isLeader(currentUser)
      ? `<div class="stat">
        <div class="stat-label">Pending requests</div>
        <div class="stat-num" style="color:${allPending > 0 ? 'var(--warn)' : 'var(--ok)'}">${allPending}</div>
      </div>`
      : `<div class="stat">
        <div class="stat-label">My requests</div>
        <div class="stat-num" style="color:${myPending > 0 ? 'var(--warn)' : 'var(--ok)'}">${myPending}</div>
      </div>`}
</div>`;

  // Team breaks today grid — grouped by position
  var _tgPosOrder = ['Data Analyst','Sr Data Analyst','Data Supervisor','Sr Data Supervisor'];
  var _tgPosColor = {
    'Data Analyst':       ['#f97316','rgba(249,115,22,.12)'],
    'Sr Data Analyst':    ['#ea580c','rgba(234,88,12,.12)'],
    'Data Supervisor':    ['#0ea5e9','rgba(14,165,233,.12)'],
    'Sr Data Supervisor': ['#a855f7','rgba(168,85,247,.12)'],
  };
  var _tgGroups = {};
  shiftMates.forEach(function(u) {
    var pos = getRoleInfo(u.role).label || 'Other';
    if (!_tgGroups[pos]) _tgGroups[pos] = [];
    _tgGroups[pos].push(u);
  });
  _tgPosOrder.forEach(function(pos) {
    if (_tgGroups[pos]) _tgGroups[pos].sort(function(a,b){ return a.team < b.team ? -1 : a.team > b.team ? 1 : 0; });
  });
  var _tgSections = _tgPosOrder.filter(function(pos){ return _tgGroups[pos] && _tgGroups[pos].length > 0; });
  var _tgOther = Object.keys(_tgGroups).filter(function(p){ return !_tgPosOrder.includes(p); });
  var _tgAllPos = _tgSections.concat(_tgOther);
  var _tgHTML = _tgAllPos.map(function(pos) {
    var _col = (_tgPosColor[pos] || ['var(--border)','var(--bg3)']);
    var _cards = _tgGroups[pos].map(function(u) {
      var br = getAssigned(u.id, todayDk);
      var idx = br ? _slotIndex(br.slot, currentShift) : -1;
      var isSelf = u.id === currentUser.id;
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;' +
        'background:' + (isSelf ? 'var(--bg4)' : 'var(--bg3)') + ';border-radius:7px;' +
        'border:1px solid ' + (isSelf ? 'var(--accent)' : 'var(--border)') + ';' +
        'border-left:3px solid ' + _col[0] + ';">' +
        '<span class="break-slot ' + (br ? 'assigned slot-' + (idx + 1) : '') + '" style="font-size:10px;padding:3px 8px;min-width:28px;text-align:center;">' +
          (br ? getShortSlot(currentShift, br.slot) : '?') +
        '</span>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
            u.name + (isSelf ? ' <span style="font-size:10px;color:var(--accent);">(you)</span>' : '') +
            (u.gender === 'F' ? '<span style="font-size:10px;color:var(--A-color);margin-left:3px;">♀</span>' : '') +
          '</div>' +
          '<div style="font-size:10px;color:var(--text3);">' + u.team + ' · ' + getRoleInfo(u.role).label + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div style="margin-top:10px;">' +
      '<div style="font-size:10px;font-weight:700;color:' + _col[0] + ';text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">' + pos + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">' + _cards + '</div>' +
    '</div>';
  }).join('');
  const teamGrid = shiftMates.length === 0 ? '' :
    '<div class="card" style="margin-top:16px;">' +
    '<div class="card-title">👥 Team Breaks Today — Shift ' + currentShift + ' · ' + todayDk + '</div>' +
    _tgHTML +
    '</div>';

  // This Week card — Mon-Sun using activeMonday anchor
  var _wkMonSun = getWeekRange(activeMonday);
  var _thisWeekRows = _wkMonSun.map(function(dk) {
    var _isToday = dk === todayDk;
    var _sched = _getSched(currentUser.username, dk);
    var _isOff = !_sched || _sched === '0';
    var _br = getAssigned(currentUser.id, dk);
    var _slotTime = _br ? getSlotTime(_br.slot, dk) : '';
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;' +
      (_isToday ? 'background:var(--bg4);border-left:3px solid var(--accent);' : 'border-left:3px solid transparent;') + '">' +
      '<span style="font-size:10px;font-weight:700;color:var(--text3);width:28px;">' + getWkDay(dk) + '</span>' +
      '<span style="font-size:11px;font-family:monospace;color:var(--text2);width:36px;">' + dk + '</span>' +
      '<span class="sh sh-' + (_isOff ? '0' : _sched) + '" style="font-size:10px;padding:2px 7px;">' + (_isOff ? '—' : _sched) + '</span>' +
      '<span style="font-size:11px;flex:1;">' +
        (_isOff ? '<span style="color:var(--text3);">Day off</span>' :
         _slotTime ? _slotTime :
         '<span style="color:var(--warn);">Not assigned</span>') +
      '</span>' +
      (_isToday ? '<span style="font-size:9px;color:var(--accent);font-weight:700;letter-spacing:.04em;">TODAY</span>' : '') +
    '</div>';
  }).join('');
  var _thisWeekCard = '<div class="card" style="margin-bottom:0;">' +
    '<div class="card-title">📅 This Week</div>' +
    '<div style="margin-top:6px;">' + _thisWeekRows + '</div>' +
    '</div>';

  const noSchedule = state.users.length === 0 ? `
<div class="card" style="border-color:var(--warn);background:var(--D-bg);">
  <div style="font-size:13px;color:var(--warn);font-weight:600;">⚠ No schedule imported on this browser</div>
  <div style="font-size:12px;color:var(--text2);margin-top:6px;line-height:1.8;">
    Break assignments are synced from cloud ✓<br>
    To see the full schedule, go to <b>Staff → Staff Schedule</b> and paste your Google Sheets data.
  </div>
</div>` : '';

  return `
<div class="page-header">
  <div>
    <div class="page-title">${greet}, ${currentUser.name.split(' ').slice(-1)[0]} 👋</div>
    <div class="page-sub">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · Shift ${currentShift}</div>
  </div>
</div>
${noSchedule}
${statsRow}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
  ${myBreakCard}
  ${_thisWeekCard}
</div>
${teamGrid}`;
}

// ═══════════════════════════════════════════════
//  RENDER: BREAK SCHEDULE
//  Leaders/Supervisors: week picker
//  Other roles: current week only (read-only)
// ═══════════════════════════════════════════════

// State variable for schedule page week — leaders can change it
let scheduleMonday = null; // null = "use current real week"
var scheduleMonthStr = ''; // 'MM/YYYY'; empty = current month

function renderSchedule() {
  if (isTraining(currentUser)) {
    if (typeof renderScheduleTraining === 'function') return renderScheduleTraining();
    return '<div class="empty">Loading…</div>';
  }

  var shiftToShow = currentShift;
  var schedSearch = window._schedSearch || '';
  var shiftSlots = BREAK_SLOTS[shiftToShow] || [];
  var _tNow = new Date();
  var todayDk = _tNow.getDate().toString().padStart(2,'0') + '/' + (_tNow.getMonth()+1).toString().padStart(2,'0');

  // Determine selected month (MM/YYYY)
  var _curYear = _tNow.getFullYear();
  var _curMonthStr = String(_tNow.getMonth()+1).padStart(2,'0') + '/' + _curYear;

  // Collect available months from schedule keys — aggregate across ALL users
  var _schedKeySet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) { _schedKeySet[k] = true; });
  });
  var _allSchedKeys = Object.keys(_schedKeySet);
  var _monthSet = {};
  _allSchedKeys.forEach(function(dk) {
    var _p = dk.split('/');
    if (_p.length === 2) _monthSet[_p[1].padStart(2,'0') + '/' + _curYear] = true;
  });

  // Reset saved month if it's no longer in available months
  var _months = Object.keys(_monthSet).sort(function(a, b) { return parseInt(a) - parseInt(b); });
  if (scheduleMonthStr && _months.length > 0 && !_months.includes(scheduleMonthStr)) {
    scheduleMonthStr = null;
  }
  var activeMonthStr = scheduleMonthStr || _curMonthStr || (_months.length > 0 ? _months[_months.length - 1] : _curMonthStr);
  var _smParts = activeMonthStr.split('/');
  var _selMM = parseInt(_smParts[0]);
  var _selYYYY = parseInt(_smParts[1]);
  var _MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  var monthPickerHTML = _months.length > 0 ? `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">MONTH:</span>
      <select class="login-select" style="padding:4px 8px;font-size:11px;"
        onchange="scheduleMonthStr=this.value;nav('schedule')">
        ${_months.map(function(ms) {
          var _mp = ms.split('/');
          var _mn = _MONTH_NAMES[parseInt(_mp[0])-1] + ' ' + _mp[1];
          return '<option value="' + ms + '"' + (ms === activeMonthStr ? ' selected' : '') + '>' + _mn + '</option>';
        }).join('')}
      </select>
    </div>` : '';

  // Get all date keys for the selected month, sorted by day
  var monthDates = _allSchedKeys
    .filter(function(dk) {
      var _p = dk.split('/');
      return _p.length === 2 && parseInt(_p[1]) === _selMM;
    })
    .sort(function(a, b) { return parseInt(a) - parseInt(b); });

  // Map date key → day name (for schedule day-name fallback lookup)
  var dateToDayName = {};
  monthDates.forEach(function(dk) {
    var _p = dk.split('/');
    dateToDayName[dk] = WEEK_DAYS[new Date(_selYYYY, parseInt(_p[1])-1, parseInt(_p[0])).getDay()];
  });

  function getUserShift(u, dateKey) {
    return _getSched(u.username, dateKey);
  }

  // All users who work this shift at least once this month (exclude lead/sub/training)
  var allShiftUsers = state.users.filter(function(u) {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul >= 2) return false;
    return monthDates.some(function(dk) { return getUserShift(u, dk) === shiftToShow; });
  });

  // Slot totals across the month
  var slot1Count = 0, slot2Count = 0;
  allShiftUsers.forEach(function(u) {
    monthDates.forEach(function(dk) {
      var br = DB.getBreak(u.id, dk);
      if (!br) return;
      var idx = shiftSlots.indexOf(br.slot);
      if (idx === 0) slot1Count++;
      else if (idx === 1) slot2Count++;
    });
  });

  // Filtered for display
  var shiftUsers = allShiftUsers.slice();
  if (schedSearch) {
    var _sq = schedSearch.toLowerCase();
    shiftUsers = shiftUsers.filter(function(u) {
      return (u.name || '').toLowerCase().includes(_sq) ||
             (u.username || '').toLowerCase().includes(_sq);
    });
  }

  // Slot totals strip + search bar
  var slotTotalsHTML = shiftSlots.length > 0 ? `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 14px;
      background:var(--bg3);border-radius:8px;border:1px solid var(--border);
      margin-bottom:14px;flex-wrap:wrap;">
      <input class="filter-input" style="flex:1;min-width:160px;max-width:260px;padding:5px 10px;font-size:12px;"
        placeholder="🔍 Search by name…"
        value="${schedSearch}"
        oninput="window._schedSearch=this.value;
          var q=this.value.toLowerCase();
          document.querySelectorAll('#sched-tbody tr').forEach(function(r){
            var nm=(r.querySelector('.sched-name')||{}).textContent||'';
            r.style.display=nm.toLowerCase().includes(q)?'':'none';
          });
          document.getElementById('sched-count').textContent=([...document.querySelectorAll('#sched-tbody tr')].filter(function(r){return r.style.display!=='none';}).length)+' staff';">
      <span style="color:var(--border2);flex-shrink:0;">|</span>
      <span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;">
        Shift ${shiftToShow}
        <span style="color:var(--accent);margin-left:4px;" id="sched-count">${shiftUsers.length}</span>
        <span style="color:var(--text3);font-size:11px;font-weight:400;"> staff</span>
      </span>
      <span style="color:var(--border2);flex-shrink:0;">|</span>
      ${shiftSlots.map(function(time, i) {
        var count = i === 0 ? slot1Count : slot2Count;
        return '<span style="display:flex;align-items:center;gap:5px;white-space:nowrap;">' +
          '<span class="break-slot slot-' + (i+1) + '" style="font-size:10px;padding:2px 7px;">' + shiftToShow + (i+1) + '</span>' +
          '<span style="font-size:12px;color:var(--text);font-weight:600;">' + count + '</span>' +
          '<span style="font-size:11px;color:var(--text3);">assigned</span>' +
          '</span>';
      }).join('<span style="color:var(--border2);">·</span>')}
    </div>` : '';

  // Break slot legend
  var legendItems = shiftSlots.map(function(time, i) {
    return '<div style="display:flex;align-items:center;gap:6px;">' +
      '<span class="break-slot assigned slot-' + (i+1) + '" style="font-size:10px;min-width:28px;text-align:center;">' + shiftToShow + (i+1) + '</span>' +
      '<span style="color:var(--text2);font-size:11px;">' + time + '</span>' +
      '</div>';
  }).join('');

  // Table header — compact, one column per day
  var _WDAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  var theadCells = monthDates.map(function(dk) {
    var _p = dk.split('/');
    var _d = parseInt(_p[0]);
    var _m = parseInt(_p[1]);
    var dow = new Date(_selYYYY, _m-1, _d).getDay();
    var isToday = dk === todayDk;
    var isWknd = dow === 0 || dow === 6;
    var isSun = dow === 0;
    return '<th style="min-width:44px;width:44px;padding:4px 2px;text-align:center;' +
      'font-size:10px;font-weight:600;' +
      'color:' + (isToday ? 'var(--accent)' : isSun ? 'var(--err)' : isWknd ? 'var(--warn)' : 'var(--text2)') + ';' +
      'background:' + (isToday ? 'rgba(31,102,241,.08)' : isWknd ? 'var(--bg4)' : 'var(--bg3)') + ';' +
      'border-bottom:2px solid ' + (isToday ? 'var(--accent)' : isSun ? 'var(--err)' : isWknd ? 'var(--border2)' : 'var(--accent)') + ';' +
      'border-left:' + (isSun ? '2px solid var(--border)' : 'none') + ';' +
      'position:sticky;top:0;z-index:2;white-space:nowrap;">' +
      '<div style="font-size:9px;opacity:.65;line-height:1.5;">' + _WDAY_SHORT[dow] + '</div>' +
      '<div style="font-size:11px;line-height:1.3;">' + String(_d).padStart(2,'0') + '</div>' +
      '</th>';
  }).join('');

  // Table body
  var tbodyRows = shiftUsers.map(function(u) {
    var cells = monthDates.map(function(dk) {
      var userShift = getUserShift(u, dk);
      var _p = dk.split('/');
      var dow2 = new Date(_selYYYY, parseInt(_p[1])-1, parseInt(_p[0])).getDay();
      var isWknd2 = dow2 === 0 || dow2 === 6;
      var isToday2 = dk === todayDk;
      var tdBg = isToday2 ? 'background:rgba(31,102,241,.06);' : isWknd2 ? 'background:var(--bg4);' : '';
      if (userShift !== shiftToShow) {
        return '<td style="text-align:center;padding:3px 1px;' + tdBg + '">' +
          '<span style="font-size:9px;color:var(--text3);">' + (userShift !== '0' ? userShift : '·') + '</span></td>';
      }
      var br = DB.getBreak(u.id, dk);
      var _extEntries = DB.getExtBreaks(u.id, currentMonthKey()) || [];
      var hasExt = _extEntries.some(function(e) {
        var _days = (e.days && e.days.length > 0) ? e.days : (e.day ? [e.day] : []);
        return _days.includes(dk);
      });
      var slotIdx = br ? getShortSlot(shiftToShow, br.slot) : '';
      var slotNum = slotIdx.length === 2 ? parseInt(slotIdx[1]) : 0;
      var slotCls = slotNum > 0 ? 'slot-' + slotNum : '';
      var shortCode = br ? getShortSlot(shiftToShow, br.slot) : '?';
      return '<td style="text-align:center;padding:3px 1px;' + tdBg + '"' + (hasExt ? ' class="cell-female-ext"' : '') + '>' +
        '<span class="' + (br ? 'break-slot assigned ' + slotCls : '') + '" ' +
        'style="font-size:9px;padding:2px 4px;' + (br ? '' : 'color:var(--text3)') + '" ' +
        'title="' + (br ? br.slot + (hasExt ? ' 🌸+30min' : '') : 'Not assigned') + '">' +
        shortCode + (hasExt ? '🌸' : '') +
        '</span></td>';
    }).join('');
    return '<tr>' +
      '<td class="sched-name-col">' +
        '<div class="sched-name">' + u.name + '</div>' +
        '<div class="sched-meta">' + (u.team || '') + ' · ' + getRoleInfo(u.role).label + '</div>' +
      '</td>' + cells + '</tr>';
  }).join('');

  var monthLabel = _MONTH_NAMES[_selMM-1] + ' ' + _selYYYY;
  var emptyMsg = shiftUsers.length === 0 ? `
    <div class="empty" style="padding:40px;">
      <div class="empty-ico">👥</div>
      ${schedSearch ? `No results for "${schedSearch}"` : `No staff on Shift ${shiftToShow} in ${monthLabel}.`}
    </div>` : '';

  return `
<div class="schedule-title-row">
  <div>
    <div class="page-title">Break Schedule — Shift ${shiftToShow}</div>
    <div class="page-sub">${SHIFTS[shiftToShow]?.display || ''} · ${monthLabel}</div>
  </div>
  <div class="schedule-legend-inline" style="flex-wrap:wrap;gap:8px;">
    ${monthPickerHTML}
    <span style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Legend:</span>
    ${legendItems || '<span style="color:var(--text3);font-size:11px">—</span>'}
  </div>
</div>

${slotTotalsHTML}
${emptyMsg}
${shiftUsers.length > 0 ? `
<div class="sched-table-wrap">
  <table class="sched-table">
    <thead><tr>
      <th class="sched-th-name">Name / Group</th>
      ${theadCells}
    </tr></thead>
    <tbody id="sched-tbody">${tbodyRows}</tbody>
  </table>
</div>` : ''}`;
}

// ── Month filter helpers (shared by requests + ext break pages) ──
let _reqFilterYM      = null; // null = current month
let _extBreakFilterYM = null; // null = current month
let _ebTargetUser = null;    // training manager registering on behalf of

function _prevMonthKey(ym) {
  const [y,m] = ym.split('-').map(Number);
  return m===1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
}
function _nextMonthKey(ym) {
  const [y,m] = ym.split('-').map(Number);
  return m===12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
}
function _monthLabel(ym) {
  const [y,m] = ym.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleString('en-US',{month:'long',year:'numeric'});
}
function _monthPickerHTML(ym, setterFn, page) {
  const prev = _prevMonthKey(ym);
  const next = _nextMonthKey(ym);
  const curMk = currentMonthKey();
  const isCur = ym === curMk;
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
    <button class="btn btn-sm" style="padding:4px 10px;font-size:15px;line-height:1;" onclick="${setterFn}('${prev}');nav('${page}')">&#8249;</button>
    <span style="font-size:13px;font-weight:600;min-width:140px;text-align:center;">${_monthLabel(ym)}</span>
    <button class="btn btn-sm" style="padding:4px 10px;font-size:15px;line-height:1;" onclick="${setterFn}('${next}');nav('${page}')">&#8250;</button>
    ${!isCur ? `<button class="btn btn-sm" style="font-size:11px;" onclick="${setterFn}('${curMk}');nav('${page}')">Current</button>` : ''}
  </div>`;
}
function _setReqFilterYM(ym)      { _reqFilterYM      = ym; }
function _setExtBreakFilterYM(ym) { _extBreakFilterYM = ym; }

// ═══════════════════════════════════════════════
//  RENDER: REQUESTS
//  Agent/QA/Sr roles: pick day OR whole-week swap
//  Conflict detection: 2nd request for same partner
//  Visual impact preview before approval
// ═══════════════════════════════════════════════
function renderRequests() {
  if (!_reqFilterYM) _reqFilterYM = currentMonthKey();
  const filterYM = _reqFilterYM;

  const allReqs = (isLeader(currentUser) || isTraining(currentUser))
    ? state.requests
    : state.requests.filter(r => r.userId === currentUser.id || r.targetId === currentUser.id);
  const myReqs = allReqs.filter(r => {
    const d = new Date(r.at);
    const rym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return rym === filterYM;
  });

  const pending = myReqs.filter(r => r.status === 'pending');
  const rest = myReqs.filter(r => r.status !== 'pending');

  const card = (r) => {
    if (r.type === 'dayoff-swap') {
      var _dosEmp = state.users.find(u => u.id === r.userId);
      var _dosTgt = state.users.find(u => u.id === r.targetId);
      var _dosIdx = state.requests.indexOf(r);
      var _dosIsOwn = r.userId === currentUser.id;
      var _dosCanApprove = (isLeader(currentUser) || isTraining(currentUser)) && !_dosIsOwn;
      var _dosApprover = r.resolvedBy ? state.users.find(u => u.id === r.resolvedBy) : null;
      return '<div class="req-card ' + r.status + '">' +
        '<div class="req-card-top">' +
          '<div>' +
            '<div class="req-card-name">' + (_dosEmp ? _dosEmp.name : 'Unknown') +
              ' <span class="req-scope day" style="background:rgba(99,102,241,.13);color:#6366f1;">DAY-OFF</span>' +
            '</div>' +
            '<div class="req-card-meta">' + timeSince(r.at) + '</div>' +
          '</div>' +
          '<span class="req-status ' + r.status + '">' + r.status.toUpperCase() + '</span>' +
        '</div>' +
        '<hr class="req-card-divider">' +
        '<div class="req-card-row"><span class="req-card-lbl">Their day off</span>' +
          '<span class="req-card-val" style="font-weight:600;">' + r.myDate + ' (' + getWkDay(r.myDate) + ')</span>' +
        '</div>' +
        '<div class="req-card-row"><span class="req-card-lbl">↔ Swap with</span>' +
          '<span class="req-card-val">' + (_dosTgt ? _dosTgt.name + ' <span style="color:var(--text3)">(' + (_dosTgt.team||'?') + ')</span>' : '—') + '</span>' +
        '</div>' +
        '<div class="req-card-row"><span class="req-card-lbl">Their day off</span>' +
          '<span class="req-card-val" style="font-weight:600;">' + r.theirDate + ' (' + getWkDay(r.theirDate) + ')</span>' +
        '</div>' +
        (r.reason ? '<div class="req-card-reason">"' + r.reason + '"</div>' : '') +
        (_dosApprover && r.status !== 'pending'
          ? '<div class="req-resolved ' + r.status + '">' +
              (r.status === 'approved' ? '✓ Approved' : '✗ Rejected') +
              ' by <b>' + _dosApprover.name + '</b> · ' + timeSince(r.resolvedAt) +
            '</div>'
          : '') +
        (_dosCanApprove && r.status === 'pending'
          ? '<div class="req-actions">' +
              '<button class="btn btn-sm btn-ok" onclick="resolveRequest(' + _dosIdx + ',\'approved\')">✓ Approve</button>' +
              '<button class="btn btn-sm btn-err" onclick="resolveRequest(' + _dosIdx + ',\'rejected\')">✗ Reject</button>' +
            '</div>'
          : (_dosIsOwn && r.status === 'pending'
            ? '<div class="req-actions"><button class="btn btn-sm btn-err" onclick="cancelOwnRequest(' + _dosIdx + ')">✗ Cancel</button></div>'
            : '')) +
      '</div>';
    }
    const emp = state.users.find(u => u.id === r.userId);
    const partner = r.swapPartnerId ? state.users.find(u => u.id === r.swapPartnerId) : null;
    const approver = r.resolvedBy
      ? (state.users.find(u => u.id === r.resolvedBy) || (() => {
        const uname = Object.keys(state.staffInfo || {}).find(k => {
          let h = 0; for (let i = 0; i < k.length; i++) h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
          return Math.abs(h) === r.resolvedBy;
        });
        return uname ? { name: state.staffInfo[uname].name } : null;
      })())
      : null;
    const isOwn = r.userId === currentUser.id;
    const idx = state.requests.indexOf(r);
    const isWeek = r.swapWeek === true;
    const dateLabel = isWeek
      ? ((r.swapDays || []).length > 0 ? r.swapDays[0] + '–' + r.swapDays[r.swapDays.length - 1] : 'Week')
      : (r.day || '—');

    // Impact table (week swaps, leader pending view)
    let impactHTML = '';
    if (r.status === 'pending' && isLeader(currentUser) && !isOwn && isWeek && partner) {
      const allDays = r.swapDays || [];
      const weekSet = new Set(getWeekDates());
      const dispDays = allDays.filter(d => weekSet.has(d));
      const todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
      let futureCnt = 0;
      const impRows = dispDays.map(d => {
        const [dd, mm] = d.split('/').map(Number);
        const isPast = (mm - 1) * 100 + dd < todayMMDD;
        if (!isPast) futureCnt++;
        const myBr = getAssigned(r.userId, d) || getAssigned(r.userId, getWkDay(d));
        const ptBr = getAssigned(r.swapPartnerId, d) || getAssigned(r.swapPartnerId, getWkDay(d));
        const myCode = myBr ? getShortSlot(currentShift, myBr.slot) : '—';
        const ptCode = ptBr ? getShortSlot(currentShift, ptBr.slot) : '—';
        const dim = isPast ? 'opacity:.35;' : '';
        return '<div class="req-impact-row" style="' + dim + '">'
          + '<span class="req-impact-day">' + d + (isPast ? ' <span style="font-size:8px">past</span>' : '') + '</span>'
          + '<span class="req-impact-who">Req.</span>'
          + '<span class="req-pill">' + myCode + '</span>'
          + '<span style="color:var(--text3);font-size:9px;margin:0 2px;">→</span>'
          + '<span class="req-pill new">' + ptCode + '</span>'
          + '</div>'
          + '<div class="req-impact-row" style="' + dim + '">'
          + '<span class="req-impact-day"></span>'
          + '<span class="req-impact-who" style="opacity:.6">Part.</span>'
          + '<span class="req-pill">' + ptCode + '</span>'
          + '<span style="color:var(--text3);font-size:9px;margin:0 2px;">→</span>'
          + '<span class="req-pill new">' + myCode + '</span>'
          + '</div>';
      }).join('');
      if (impRows) {
        impactHTML = '<div class="req-impact">'
          + '<div class="req-impact-title">Impact · ' + futureCnt + ' upcoming day' + (futureCnt !== 1 ? 's' : '') + '</div>'
          + impRows + '</div>';
      }
    }

    // Resolved box
    const resolvedHTML = (approver && r.status !== 'pending')
      ? '<div class="req-resolved ' + r.status + '">'
      + (r.status === 'approved' ? '✓ ' : '✗ ')
      + (r.status === 'approved' ? 'Approved' : 'Rejected') + ' by <b>' + approver.name + '</b> · ' + timeSince(r.resolvedAt)
      + (r.respNote ? '<br><span style="opacity:.8">' + r.respNote + '</span>' : '')
      + '</div>'
      : '';

    return '<div class="req-card ' + r.status + '" data-status="' + r.status + '">'
      + '<div class="req-card-top">'
      + '<div>'
      + '<div class="req-card-name">'
      + (emp ? emp.name : 'Unknown')
      + ' <span class="req-scope ' + (isWeek ? 'week' : 'day') + '">' + (isWeek ? 'WEEK' : 'DAY') + '</span>'
      + '</div>'
      + '<div class="req-card-meta">' + (emp ? emp.team : '—') + ' · ' + dateLabel + ' · ' + timeSince(r.at) + '</div>'
      + '</div>'
      + '<span class="req-status ' + r.status + '">' + r.status.toUpperCase() + '</span>'
      + '</div>'
      + '<hr class="req-card-divider">'
      + '<div class="req-card-row"><span class="req-card-lbl">Slot</span>'
      + '<span class="req-pill">' + (r.current || '—') + '</span>'
      + '<span style="color:var(--text3);font-size:10px;margin:0 2px;">→</span>'
      + '<span class="req-pill new">' + (r.requested || '—') + '</span>'
      + '</div>'
      + '<div class="req-card-row"><span class="req-card-lbl">Partner</span>'
      + '<span class="req-card-val">' + (partner ? partner.name + ' <span style="color:var(--text3)">(' + (partner.team || '?') + ')</span>' : '—') + '</span>'
      + '</div>'
      + (r.reason ? '<div class="req-card-reason">"' + r.reason + '"</div>' : '')
      + impactHTML
      + resolvedHTML
      + (r.status === 'pending' && isLeader(currentUser) && !isOwn
        ? '<div class="req-actions">'
        + '<button class="btn btn-sm btn-ok" onclick="resolveRequest(' + idx + ',\'approved\')">✓ Approve</button>'
        + '<button class="btn btn-sm btn-err" onclick="resolveRequest(' + idx + ',\'rejected\')">✗ Reject</button>'
        + '</div>'
        : r.status === 'pending' && isOwn
          ? '<div class="req-actions">'
          + '<button class="btn btn-sm btn-err" onclick="cancelOwnRequest(' + idx + ')">✗ Cancel request</button>'
          + '</div>'
          : '')
      + '</div>';
  };

  const cntAll = myReqs.length;
  const cntPending = myReqs.filter(r => r.status === 'pending').length;
  const cntApproved = myReqs.filter(r => r.status === 'approved').length;
  const cntRejected = myReqs.filter(r => r.status === 'rejected').length;

  const filterBar = '<div class="req-filter-bar">'
    + '<button class="req-filter-btn f-all" onclick="_reqSetFilter(\'all\')">All <span class="req-filter-cnt">' + cntAll + '</span></button>'
    + '<button class="req-filter-btn" onclick="_reqSetFilter(\'pending\')">Pending <span class="req-filter-cnt">' + cntPending + '</span></button>'
    + '<button class="req-filter-btn" onclick="_reqSetFilter(\'approved\')">Approved <span class="req-filter-cnt">' + cntApproved + '</span></button>'
    + '<button class="req-filter-btn" onclick="_reqSetFilter(\'rejected\')">Rejected <span class="req-filter-cnt">' + cntRejected + '</span></button>'
    + '</div>';

  return `
<div class="page-header">
  <div>
    <div class="page-title">🔄 Break Swap</div>
    <div class="page-sub">${(isLeader(currentUser)||isTraining(currentUser)) ? `${cntPending} pending` : 'Your swap requests'}</div>
  </div>
  ${!(isLeader(currentUser)||isTraining(currentUser)) ? `<div style="display:flex;gap:8px;">
    <button class="btn btn-accent" onclick="openRequestModal()">+ Break swap</button>
    <button class="btn" onclick="staffSubTab='schedule';nav('staff')" title="Go to Staff Schedule to request a day-off swap">↔ Day-off swap</button>
  </div>` : ''}
</div>
${_monthPickerHTML(filterYM, '_setReqFilterYM', 'requests')}
${filterBar}
<div class="req-cards-grid" id="req-cards-list">
  ${myReqs.length > 0 ? myReqs.map(r => card(r)).join('') : '<div class="empty"><div class="empty-ico">✅</div>No requests for this month.</div>'}
</div>
`;
}

function cancelOwnRequest(idx) {
  if (!confirm('Cancel this swap request?')) return;
  const r = state.requests[idx];
  if (!r || r.status !== 'pending') return;
  r.status = 'rejected';
  r.respNote = 'Cancelled by requester.';
  r.resolvedAt = Date.now();
  r.resolvedBy = currentUser.id;
  if (typeof syncWrite === 'function') syncWrite(); else save();
  toast('Request cancelled.', 'warn');
  updateBadge();
  nav('requests');
}

function _reqSetFilter(f) {
  document.querySelectorAll('.req-filter-btn').forEach(b => {
    b.className = 'req-filter-btn';
    const t = b.textContent.trim().toLowerCase();
    if (f === 'all' && t.startsWith('al')) b.classList.add('f-all');
    if (f === 'pending' && t.startsWith('pe')) b.classList.add('f-pending');
    if (f === 'approved' && t.startsWith('ap')) b.classList.add('f-approved');
    if (f === 'rejected' && t.startsWith('re')) b.classList.add('f-rejected');
  });
  let visible = 0;
  document.querySelectorAll('#req-cards-list .req-card').forEach(c => {
    const show = f === 'all' || c.dataset.status === f;
    c.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  let emp = document.getElementById('req-filter-empty');
  if (!visible) {
    if (!emp) {
      emp = document.createElement('div');
      emp.id = 'req-filter-empty';
      emp.className = 'empty';
      emp.innerHTML = '<div class="empty-ico">🔍</div>No ' + f + ' requests.';
      document.getElementById('req-cards-list').appendChild(emp);
    }
  } else if (emp) emp.remove();
}

// ═══════════════════════════════════════════════
//  RENDER: ARRANGE (leader only)
//  Tab 1: Arrange Breaks (bulk panel + day tabs)
//  Tab 2: Week Overview (full grid)
// ═══════════════════════════════════════════════
let arrangeMainTab = 'assign'; // 'assign' | 'overview' | 'month'
let arrangeActiveDay = null;   // set on first render
var _arrangeMonth = '';        // 'MM/YYYY' filter for week picker; '' = show all
var _arrMonthYear  = new Date().getFullYear();
var _arrMonthMonth = new Date().getMonth() + 1; // 1–12
// Persisted bulk-panel state — survives re-renders and sync polls
let _bulkGroups = new Set(); // selected group checkboxes
let _bulkDays = new Set(); // selected day checkboxes
let _bulkSlotIdx = 0;         // slot dropdown index
// Persisted paste area content — survives re-renders
let _pasteContent = '';

function renderArrange() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';
  const weekRange = getWeekRange(activeMonday);
  if (!arrangeActiveDay || !weekRange.includes(arrangeActiveDay)) arrangeActiveDay = weekRange[0];

  // Build week picker from available schedule dates
  var _allSDSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) { Object.keys(sc||{}).forEach(function(k){ _allSDSet[k]=1; }); });
  var allDates = Object.keys(_allSDSet);

  // Derive sorted list of all Mondays
  var allMondays = allDates.filter(function(d) { return getWkDay(d) === 'Mon'; }).sort(function(a, b) {
    var pa = a.split('/'), pb = b.split('/');
    return new Date(2026, parseInt(pa[1])-1, parseInt(pa[0])) - new Date(2026, parseInt(pb[1])-1, parseInt(pb[0]));
  });

  // Derive unique months present in allMondays as 'MM/YYYY' labels
  var _monthSet = {}, _monthOrder = [];
  allMondays.forEach(function(mon) {
    var parts = mon.split('/');
    var key = parts[1] + '/' + '2026'; // MM/YYYY
    if (!_monthSet[key]) { _monthSet[key] = true; _monthOrder.push(key); }
  });

  // Ensure _arrangeMonth is valid; default to current month if possible
  if (_arrangeMonth && !_monthSet[_arrangeMonth]) _arrangeMonth = '';
  if (!_arrangeMonth) {
    var _nowMM = String(new Date().getMonth()+1).padStart(2,'0');
    var _curKey = _nowMM + '/2026';
    _arrangeMonth = _monthSet[_curKey] ? _curKey : (_monthOrder[0] || '');
  }

  // Filter mondays to selected month
  var mondays = _arrangeMonth ? allMondays.filter(function(mon) {
    var p = mon.split('/');
    return p[1] + '/2026' === _arrangeMonth;
  }) : allMondays;

  // If activeMonday is not in the filtered list, snap to first available
  if (mondays.length && mondays.indexOf(activeMonday) === -1) {
    activeMonday = mondays[0];
    arrangeActiveDay = null;
  }

  var _monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var _monoLbl = 'font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;';

  var monthPickerHTML = _monthOrder.length > 1
    ? '<div style="display:flex;align-items:center;gap:6px;">' +
      '<span style="' + _monoLbl + '">MONTH:</span>' +
      '<select class="login-select" style="padding:4px 8px;font-size:11px;" onchange="_arrangeMonth=this.value;nav(\'arrange\')">' +
      _monthOrder.map(function(mk) {
        var mm = parseInt(mk.split('/')[0]);
        return '<option value="' + mk + '"' + (mk === _arrangeMonth ? ' selected' : '') + '>' + _monthNames[mm-1] + '</option>';
      }).join('') + '</select></div>'
    : '';

  var weekPickerHTML = mondays.length > 0
    ? '<div style="display:flex;align-items:center;gap:6px;">' +
      '<span style="' + _monoLbl + '">WEEK:</span>' +
      '<select class="login-select" style="padding:4px 8px;font-size:11px;" onchange="activeMonday=this.value;arrangeActiveDay=null;nav(\'arrange\')">' +
      mondays.map(function(s) {
        var p = s.split('/');
        var end = new Date(2026, parseInt(p[1])-1, parseInt(p[0])+6);
        var endStr = String(end.getDate()).padStart(2,'0') + '/' + String(end.getMonth()+1).padStart(2,'0');
        return '<option value="' + s + '"' + (s === activeMonday ? ' selected' : '') + '>' + s + ' – ' + endStr + '</option>';
      }).join('') + '</select></div>'
    : '';

  var _slackCfg = (state.slackAutoPost || {})[currentShift] || {};
  var _slackOn  = !!_slackCfg.enabled;
  var _slackInline = `
    <div style="display:flex;align-items:center;gap:7px;padding:5px 10px;
      background:var(--bg3);border:1px solid var(--border);border-radius:8px;white-space:nowrap;cursor:default;">
      <span style="font-size:11px;font-weight:600;color:var(--text2);">🔔 Auto-Post</span>
      <div onclick="_toggleSlackAutoPost()" style="width:34px;height:18px;border-radius:10px;
        background:${_slackOn ? 'var(--accent)' : 'var(--bg4)'};position:relative;cursor:pointer;
        transition:background .2s;border:1px solid var(--border);">
        <div style="position:absolute;top:2px;${_slackOn ? 'right:2px' : 'left:2px'};width:12px;height:12px;
          border-radius:50%;background:#fff;transition:all .2s;box-shadow:0 1px 2px rgba(0,0,0,.3);"></div>
      </div>
      <span style="font-size:10px;font-weight:600;color:${_slackOn ? 'var(--accent)' : 'var(--text3)'};">${_slackOn ? 'ON' : 'OFF'}</span>
    </div>`;

  return `
<div class="page-header">
  <div class="page-title">Arrange Breaks — Shift ${currentShift}</div>
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    ${monthPickerHTML}
    ${weekPickerHTML}
    ${_slackInline}
    <button id="save-breaks-btn" class="btn btn-accent"
      onclick="saveBreaksToCloud()"
      style="display:flex;align-items:center;gap:7px;font-size:12px;padding:7px 16px;">
      <span id="save-breaks-ico">☁</span>
      <span id="save-breaks-lbl">Save Breaks</span>
    </button>
  </div>
</div>

<!-- Top-level 2 tabs -->
<div style="display:flex; gap:0; border-bottom:2px solid var(--border); margin-bottom:20px;">
  <button onclick="switchArrangeMainTab('assign')"
    style="padding:9px 24px; font-size:13px; font-weight:600; cursor:pointer; border:none;
      background:none; color:${arrangeMainTab === 'assign' ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:3px solid ${arrangeMainTab === 'assign' ? 'var(--accent)' : 'transparent'};
      margin-bottom:-2px; transition:all .12s;">
    ✏️ Arrange Breaks
  </button>
  <button onclick="switchArrangeMainTab('overview')"
    style="padding:9px 24px; font-size:13px; font-weight:600; cursor:pointer; border:none;
      background:none; color:${arrangeMainTab === 'overview' ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:3px solid ${arrangeMainTab === 'overview' ? 'var(--accent)' : 'transparent'};
      margin-bottom:-2px; transition:all .12s;">
    📊 Week Overview
  </button>
  <button onclick="switchArrangeMainTab('month')"
    style="padding:9px 24px; font-size:13px; font-weight:600; cursor:pointer; border:none;
      background:none; color:${arrangeMainTab === 'month' ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:3px solid ${arrangeMainTab === 'month' ? 'var(--accent)' : 'transparent'};
      margin-bottom:-2px; transition:all .12s;">
    📅 Month Overview
  </button>
</div>

<div id="arrange-main-content">
  ${arrangeMainTab === 'assign' ? _renderArrangeAssignTab(weekRange)
    : arrangeMainTab === 'month' ? _renderArrangeMonthOverview()
    : _renderArrangeOverviewTab(weekRange)}
</div>`;
}

// ── Save Breaks button handler ──
async function saveBreaksToCloud() {
  const btn = document.getElementById('save-breaks-btn');
  const ico = document.getElementById('save-breaks-ico');
  const lbl = document.getElementById('save-breaks-lbl');
  if (!btn) return;

  // ── Check: do we have a database URL to push to? ──
  // First try to reload sync-config.json in case it was updated since page load
  if (!syncEnabled() && typeof loadSyncConfig === 'function') {
    await loadSyncConfig();
  }
  const hasDb = typeof syncEnabled === 'function' && syncEnabled();

  if (!hasDb) {
    // No database URL — push is impossible
    // Guide the admin to Cloud Sync settings
    if (ico) ico.textContent = '⚠';
    if (lbl) lbl.textContent = 'Sync not configured';
    btn.style.background = 'var(--warn)';
    btn.style.color = '#000';
    setTimeout(() => {
      if (ico) ico.textContent = '☁';
      if (lbl) lbl.textContent = 'Save Breaks';
      btn.style.background = '';
      btn.style.color = '';
    }, 4000);
    toast('☁ Sync not configured. Go to Cloud Sync page → Connect.', 'warn');
    return;
  }

  // ── Saving state ──
  btn.disabled = true;
  btn.style.opacity = '0.75';
  if (ico) ico.textContent = '⏳';
  if (lbl) lbl.textContent = 'Saving…';

  const now = Date.now();
  state._breaksUpdatedAt = now;
  save(); // write localStorage immediately

  const ok = await syncPush();

  btn.disabled = false;
  btn.style.opacity = '';
  if (ok) {
    if (ico) ico.textContent = '✓';
    if (lbl) lbl.textContent = 'Saved!';
    updateSyncBadge('ok');
    setTimeout(() => {
      if (ico) ico.textContent = '☁';
      if (lbl) lbl.textContent = 'Save Breaks';
    }, 2500);
  } else {
    if (ico) ico.textContent = '⚠';
    const binGone = typeof syncCfg !== 'undefined' && !syncCfg.binId;
    if (lbl) lbl.textContent = binGone ? 'Reconnect Cloud Sync!' : 'Failed — retry?';
    btn.style.background = 'var(--err)';
    if (binGone && typeof nav === 'function') {
      setTimeout(() => nav('sync'), 1500); // auto-redirect to Cloud Sync page
    }
    setTimeout(() => {
      if (ico) ico.textContent = '☁';
      if (lbl) lbl.textContent = 'Save Breaks';
      btn.style.background = '';
    }, 4000);
  }
}

function switchArrangeMainTab(tab) {
  arrangeMainTab = tab;
  nav('arrange');
}

// ── Break Split Settings tab ──

function _renderBreakSplitTab() {
  const rows = VISIBLE_SHIFTS.map(shift => {
    const slots  = BREAK_SLOTS[shift] || [];
    const slot1  = slots[0] || '';
    const slot2  = slots[1] || '';
    const saved  = getBreakSplitPct(shift);   // null = default rotation
    const pct1   = saved !== null ? saved : 50;
    const pct2   = 100 - pct1;
    const isCustom = saved !== null;

    return `
<div class="card" style="padding:18px 20px;margin-bottom:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="font-size:14px;font-weight:700;">Shift ${shift}</span>
    ${isCustom
      ? `<span style="font-size:10px;font-weight:700;background:var(--accent);color:#fff;padding:3px 10px;border-radius:10px;">Custom: ${pct1}% / ${pct2}%</span>`
      : `<span style="font-size:10px;font-weight:600;background:var(--bg3);color:var(--text3);padding:3px 10px;border-radius:10px;">Default (50/50 rotation)</span>`}
  </div>

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
    <span style="font-size:11px;color:var(--text2);min-width:110px;white-space:nowrap;">${shift}1 — ${slot1}</span>
    <input type="range" id="split-slider-${shift}" min="0" max="100" step="1" value="${pct1}"
      style="flex:1;accent-color:var(--accent);"
      oninput="onBreakSplitSlide('${shift}', this.value)">
    <span style="font-size:11px;color:var(--text2);min-width:110px;text-align:right;white-space:nowrap;">${shift}2 — ${slot2}</span>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;">
    <span id="split-lbl-${shift}-1" style="font-size:13px;font-weight:700;color:var(--accent);">${pct1}%</span>
    <button onclick="resetBreakSplit('${shift}')"
      style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;"
      title="Clear custom % and go back to 50/50 weekly rotation">
      ↩ Reset to rotation
    </button>
    <span id="split-lbl-${shift}-2" style="font-size:13px;font-weight:700;color:var(--accent);">${pct2}%</span>
  </div>
</div>`;
  }).join('');

  return `
<div style="max-width:560px;">
  <div style="font-size:11px;color:var(--text2);margin-bottom:16px;line-height:1.7;">
    Set how the team is split across break slots for each shift. The <b>larger group</b> takes the slot on the left side of the slider.
    Rotation still applies — each week the groups swap which slot they get, keeping the set percentage.
  </div>
  ${rows}
  <button class="btn btn-accent" onclick="saveBreakSplits()" style="margin-top:4px;">
    Save Distribution Settings
  </button>
</div>`;
}

function onBreakSplitSlide(shift, rawVal, tier) {
  var pct1 = parseInt(rawVal);
  var pct2 = 100 - pct1;
  var id1 = tier ? ('split-lbl-' + shift + '-' + tier + '-1') : ('split-lbl-' + shift + '-1');
  var id2 = tier ? ('split-lbl-' + shift + '-' + tier + '-2') : ('split-lbl-' + shift + '-2');
  var lbl1 = document.getElementById(id1);
  var lbl2 = document.getElementById(id2);
  if (lbl1) lbl1.textContent = pct1 + '%';
  if (lbl2) lbl2.textContent = pct2 + '%';
}

// async function saveBreakSplits() {
//   const changedShifts = new Set();
//   VISIBLE_SHIFTS.forEach(shift => {
//     const slider = document.getElementById(`split-slider-${shift}`);
//     if (!slider) return;
//     const newPct = parseInt(slider.value);
//     const oldPct = getBreakSplitPct(shift);
//     if (newPct !== oldPct) changedShifts.add(shift);
//     setBreakSplitPct(shift, newPct);
//   });

//   if (changedShifts.size > 0) {
//     _clearAutoBreaksFromWeek(activeMonday, changedShifts);
//     const result = autoAssignBreaks(state.users);
//     await syncWrite();
//     toast(`Distribution saved. Re-assigned ${result.assigned} break(s) from week ${activeMonday}.`, 'ok');
//   } else {
//     await syncWrite();
//     toast('Break distribution settings saved (no changes).', 'ok');
//   }
//   nav('arrange');
// }

async function saveBreakSplits() {
  const changedShifts  = new Set(); // value changed — for toast label only
  const shiftsToProcess = new Set(); // all shifts with visible sliders — always reset+reassign
  VISIBLE_SHIFTS.forEach(shift => {
    if (shift === 'A') {
      var _sA = document.getElementById('split-slider-A-agent');
      var _sQ = document.getElementById('split-slider-A-qa');
      var _sS = document.getElementById('split-slider-A-sr_qa');
      if (!_sA && !_sQ && !_sS) return;
      shiftsToProcess.add('A');
      var _nA = _sA ? parseInt(_sA.value) : (getBreakSplitPct('A','agent') ?? 67);
      var _nQ = _sQ ? parseInt(_sQ.value) : (getBreakSplitPct('A','qa') ?? 67);
      var _nS = _sS ? parseInt(_sS.value) : (getBreakSplitPct('A','sr_qa') ?? 50);
      var _oA = getBreakSplitPct('A','agent');
      var _oQ = getBreakSplitPct('A','qa');
      var _oS = getBreakSplitPct('A','sr_qa');
      if (_nA !== _oA || _nQ !== _oQ || _nS !== _oS) changedShifts.add('A');
      var _sp = _loadBreakSplit();
      _sp['A'] = { agent: _nA, qa: _nQ, sr_qa: _nS };
      _saveBreakSplit(_sp);
      return;
    }
    const slider = document.getElementById(`split-slider-${shift}`);
    if (!slider) return;
    shiftsToProcess.add(shift);
    const newPct = parseInt(slider.value);
    const oldPct = getBreakSplitPct(shift);
    if (newPct !== oldPct) changedShifts.add(shift);
    setBreakSplitPct(shift, newPct);
  });

  if (shiftsToProcess.size > 0) {
    // 1. Clear break records (including manual) from next week onward
    var _applyFrom = _nextWeekMonday(activeMonday);
    _clearAutoBreaksFromWeek(_applyFrom, shiftsToProcess, true);

    // 2. Reset rotation so knownList is rebuilt with interleaved group order
    const rot = _loadRotation();
    shiftsToProcess.forEach(shift => {
      ['agent', 'qa', 'sr_qa'].forEach(tier => {
        delete rot[`${shift}_${tier}`];
      });
    });
    _saveRotation(rot);

    // 3. Re-assign with fresh rotation
    const result = autoAssignBreaks(state.users);
    await syncWrite();
    toast(`Distribution saved. Re-assigned ${result.assigned} break(s) from week ${_applyFrom}.`, 'ok');
  } else {
    await syncWrite();
    toast('Break distribution settings saved (no changes).', 'ok');
  }
  nav('arrange');
}

async function resetBreakSplit(shift) {
  setBreakSplitPct(shift, null);
  // Clear the member-order list so the sliding window starts fresh
  const rot = _loadRotation ? _loadRotation() : {};
  ['agent', 'qa', 'sr_qa'].forEach(tier => { delete rot[`${shift}_${tier}`]; });
  if (typeof _saveRotation === 'function') _saveRotation(rot);
  _clearAutoBreaksFromWeek(activeMonday, new Set([shift]), true);
  const result = autoAssignBreaks(state.users);
  await syncWrite();
  toast(`Shift ${shift} reset to 50/50 rotation. Re-assigned ${result.assigned} break(s).`, 'warn');
  nav('arrange');
}

// Deletes breaks for the given shifts on or after fromSunday.
// force=true also clears manually-set breaks, not just auto-assigned ones.
// Called before re-running autoAssignBreaks so the fresh split % takes effect.
function _nextWeekMonday(monStr) {
  var p = monStr.split('/');
  var dt = new Date(2026, parseInt(p[1]) - 1, parseInt(p[0]) + 7);
  return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0');
}

function _clearAutoBreaksFromWeek(fromSunday, shifts, force = false) {
  const [fd, fm] = fromSunday.split('/');
  const fromDate = new Date(2026, parseInt(fm) - 1, parseInt(fd));
  fromDate.setHours(0, 0, 0, 0);

  Object.keys(state.breaks || {}).forEach(key => {
    const parts = key.split('_');
    const day = parts[parts.length - 1]; // "DD/MM"
    if (!/^\d{1,2}\/\d{1,2}$/.test(day)) return;
    const [d, m] = day.split('/');
    const date = new Date(2026, parseInt(m) - 1, parseInt(d));
    date.setHours(0, 0, 0, 0);
    if (date < fromDate) return;
    const br = state.breaks[key];
    if (!br || (br.note !== 'auto' && !force)) return;
    if ([...shifts].some(shift => _slotBelongsToShift(br.slot, shift))) {
      delete state.breaks[key];
    }
  });
}

function _renderArrangeAssignTab(weekRange) {
  // Only include analyst-tier roles (level 0–1) in teams for manual assign
  const allShiftTeams = [...new Set(state.users.filter(u => {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul == null || _ul >= 2) return false;
    return weekRange.some(d => _getSched(u.username, d) === currentShift);
  }).map(u => u.team))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  const slots = BREAK_SLOTS[currentShift] || [];

  // ── Position abbreviation table (used for group tags and distribution panel) ──
  var _posAbbr = {
    'Data Analyst':       ['D.A',    '#60a5fa', 'rgba(96,165,250,.2)'],
    'Sr Data Analyst':    ['Sr D.A', '#fb923c', 'rgba(251,146,60,.2)'],
    'Data Supervisor':    ['D.S',    '#38bdf8', 'rgba(56,189,248,.2)'],
    'Sr Data Supervisor': ['Sr D.S', '#c084fc', 'rgba(192,132,252,.2)'],
  };
  var _validPosLabels = Object.keys(_posAbbr);

  // Map each team → unique analyst-tier role labels among its members
  var _teamRoles = {};
  allShiftTeams.forEach(function(t) {
    var seen = {};
    var labels = [];
    state.users.filter(function(u) {
      if (u.team !== t) return false;
      var _ur2 = u.role || (state.staffInfo[u.username]||{}).role || '';
      var _ul2 = (ROLES[_resolveRole(_ur2)||_ur2] || {}).level;
      return _ul2 != null && _ul2 < 2;
    }).forEach(function(u) {
      var lbl = getRoleInfo(u.role).label;
      if (_validPosLabels.includes(lbl) && !seen[lbl]) { seen[lbl] = true; labels.push(lbl); }
    });
    _teamRoles[t] = labels;
  });

  // ── Break Split row ──
  // Shift A: one slider per position tier; all other shifts: single slider.
  var _tierDefs = [
    ['agent', 'D.A',    '#f97316', 'rgba(249,115,22,.15)', 67],
    ['qa',    'D.S',    '#0ea5e9', 'rgba(14,165,233,.15)', 67],
    ['sr_qa', 'Sr D.S', '#a855f7', 'rgba(168,85,247,.15)', 50],
  ];

  const _splitSaved  = getBreakSplitPct(currentShift);
  const _splitPct1   = _splitSaved !== null ? _splitSaved : 50;
  const _splitPct2   = 100 - _splitPct1;
  const _splitCustom = _splitSaved !== null;

  const splitRow = slots.length >= 2 ? (currentShift === 'A' ? `
  <div style="padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:10px;">
    <span class="bulk-panel-label" style="display:block;margin-bottom:8px;">Split per Position</span>
    ${_tierDefs.map(([tier, label, color, bg, def]) => {
      const saved = getBreakSplitPct('A', tier);
      const p1 = saved !== null ? saved : def;
      const p2 = 100 - p1;
      return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:${bg};color:${color};min-width:46px;text-align:center;">${label}</span>
        ${saved !== null
          ? `<span style="font-size:10px;font-weight:700;background:var(--accent);color:#fff;padding:1px 7px;border-radius:10px;white-space:nowrap;">${p1}%/${p2}%</span>`
          : `<span style="font-size:10px;background:var(--bg3);color:var(--text3);padding:1px 7px;border-radius:10px;white-space:nowrap;">default</span>`}
        <span style="font-size:10px;color:var(--text2);">A1</span>
        <span id="split-lbl-A-${tier}-1" style="font-size:12px;font-weight:700;color:${color};min-width:26px;text-align:right;">${p1}%</span>
        <input type="range" id="split-slider-A-${tier}" min="0" max="100" step="1" value="${p1}"
          style="width:130px;accent-color:${color};"
          oninput="onBreakSplitSlide('A',this.value,'${tier}')">
        <span id="split-lbl-A-${tier}-2" style="font-size:12px;font-weight:700;color:${color};min-width:26px;">${p2}%</span>
        <span style="font-size:10px;color:var(--text2);">A2</span>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button onclick="saveBreakSplits()" class="btn btn-accent" style="font-size:11px;padding:3px 12px;white-space:nowrap;">Save</button>
      <button onclick="resetBreakSplit('A')" style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:3px 6px;border-radius:4px;white-space:nowrap;">↩ Reset all</button>
    </div>
  </div>` : `
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:10px;">
    <span class="bulk-panel-label" style="margin-bottom:0;">Split</span>
    ${_splitCustom
      ? `<span style="font-size:10px;font-weight:700;background:var(--accent);color:#fff;padding:2px 8px;border-radius:10px;white-space:nowrap;">${_splitPct1}%/${_splitPct2}%</span>`
      : `<span style="font-size:10px;font-weight:600;background:var(--bg3);color:var(--text3);padding:2px 8px;border-radius:10px;white-space:nowrap;">50/50</span>`}
    <span style="font-size:11px;color:var(--text2);white-space:nowrap;">${currentShift}1 — ${slots[0]}</span>
    <span id="split-lbl-${currentShift}-1" style="font-size:12px;font-weight:700;color:var(--accent);min-width:26px;text-align:right;">${_splitPct1}%</span>
    <input type="range" id="split-slider-${currentShift}" min="0" max="100" step="1" value="${_splitPct1}"
      style="width:160px;accent-color:var(--accent);"
      oninput="onBreakSplitSlide('${currentShift}', this.value)">
    <span id="split-lbl-${currentShift}-2" style="font-size:12px;font-weight:700;color:var(--accent);min-width:26px;">${_splitPct2}%</span>
    <span style="font-size:11px;color:var(--text2);white-space:nowrap;">${currentShift}2 — ${slots[1]}</span>
    <button onclick="saveBreakSplits()" class="btn btn-accent" style="font-size:11px;padding:3px 12px;white-space:nowrap;">Save</button>
    <button onclick="resetBreakSplit('${currentShift}')"
      style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:3px 6px;border-radius:4px;white-space:nowrap;">
      ↩ Reset
    </button>
  </div>`) : '';

  // ── Shift A: break distribution display ──
  var _distPanel = '';
  if (currentShift === 'A' && slots.length >= 2) {
    var _distTiers = { agent: [], qa: [], sr_qa: [] };
    var _tierRoleKey = {
      'data analyst': 'agent', 'sr data analyst': 'agent', 'agent': 'agent', 'sr agent': 'agent',
      'data supervisor': 'qa', 'qa': 'qa',
      'sr data supervisor': 'sr_qa', 'sr qa': 'sr_qa',
    };
    allShiftTeams.forEach(function(t) {
      var found = null;
      state.users.filter(function(u) { return u.team === t; }).forEach(function(u) {
        if (!found) { found = _tierRoleKey[(u.role || '').toLowerCase().trim()] || null; }
      });
      if (found && _distTiers[found]) _distTiers[found].push(t);
    });

    var _distRows = _tierDefs.map(function(td) {
      var tier = td[0]; var label = td[1]; var color = td[2]; var bg = td[3];
      var teams = _distTiers[tier];
      if (!teams || teams.length === 0) return '';
      // Read actual break assignments for this week — don't infer from percentage
      var t1 = [], t2 = [];
      teams.forEach(function(team) {
        var s1 = 0, s2 = 0;
        state.users.filter(function(u) {
          return u.team === team && _tierRoleKey[(u.role || '').toLowerCase().trim()] === tier;
        }).forEach(function(u) {
          weekRange.forEach(function(d, di) {
            if (_getSched(u.username, d) !== currentShift) return;
            var brk = DB.getBreak(u.id, d);
            if (!brk || !brk.slot) return;
            var _bsi = _slotIndex(brk.slot, currentShift);
            if (_bsi === 0) s1++;
            else if (_bsi === 1) s2++;
          });
        });
        (s2 > s1 ? t2 : t1).push(team);
      });
      if (t2.length === 0 && t1.length >= 2) t2.push(t1.pop());
      if (t1.length === 0 && t2.length >= 2) t1.push(t2.pop());
      var n1 = t1.length, n2 = t2.length;
      var chip = '<span style="font-size:9px;font-weight:600;padding:1px 5px;border-radius:4px;background:' + bg + ';color:' + color + ';min-width:40px;display:inline-block;text-align:center;">' + label + '</span>';
      return '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:5px;">' +
        chip +
        '<span style="font-size:11px;"><b>' + n1 + '</b> group' + (n1 !== 1 ? 's' : '') + ' → <span class="break-slot assigned slot-1" style="font-size:9px;padding:1px 5px;">A1</span>' +
        (t1.length ? '<span style="font-size:10px;color:var(--text3);margin-left:4px;">(' + t1.join(', ') + ')</span>' : '') + '</span>' +
        '<span style="font-size:11px;"><b>' + n2 + '</b> group' + (n2 !== 1 ? 's' : '') + ' → <span class="break-slot assigned slot-2" style="font-size:9px;padding:1px 5px;">A2</span>' +
        (t2.length ? '<span style="font-size:10px;color:var(--text3);margin-left:4px;">(' + t2.join(', ') + ')</span>' : '') + '</span>' +
        '</div>';
    }).filter(function(r) { return r; }).join('');

    if (_distRows) _distPanel = `
    <div style="padding:10px 12px;background:var(--bg4);border-radius:8px;border:1px solid var(--border);">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Break Distribution — this week</div>
      ${_distRows}
    </div>`;
  }

  const combinedPanel = `
<div class="bulk-panel" style="margin-bottom:12px;display:block;padding:12px 16px;">
  <div style="display:flex;gap:0;flex-wrap:wrap;align-items:flex-start;">

    <!-- COL 1: Manual Assign -->
    <div style="flex:1;min-width:240px;padding-right:20px;border-right:1px solid var(--border);">
      <span class="bulk-panel-label" style="display:block;margin-bottom:8px;">Manual Assign</span>
      <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;">
        <div class="bulk-panel-section">
          <div class="bulk-panel-label">Groups</div>
          <div class="group-checkbox-list">
            ${allShiftTeams.map(t => {
              const posChips = (_teamRoles[t] || []).map(l => {
                const info = _posAbbr[l];
                if (!info) return '';
                return `<span style="font-size:9px;font-weight:600;padding:1px 4px;border-radius:4px;background:${info[2]};color:${info[1]};white-space:nowrap;">${info[0]}</span>`;
              }).join('');
              return `<label class="group-check-item" style="align-items:center;">
                <input type="checkbox" name="bulk-group" value="${t}"
                  ${_bulkGroups.has(t) ? 'checked' : ''} onchange="_saveBulkGroups()">
                <span style="font-size:11px;">${t}</span>${posChips ? ' ' + posChips : ''}
              </label>`;
            }).join('')}
          </div>
        </div>
        <div class="bulk-panel-section">
          <div class="bulk-panel-label">Days</div>
          <div class="day-checkbox-list">
            ${weekRange.map(d => `
              <label class="day-check-item">
                <span style="font-weight:700;font-size:9px">${getWkDay(d)}</span>
                <span style="font-size:9px;color:var(--text3)">${d}</span>
                <input type="checkbox" name="bulk-day" value="${d}"
                  ${_bulkDays.has(d) ? 'checked' : ''} onchange="_saveBulkDays()">
              </label>`).join('')}
          </div>
        </div>
        <div class="bulk-panel-section">
          <div class="bulk-panel-label">Slot</div>
          <select id="bulk-slot-multi" class="login-select" style="padding:6px 10px;"
            onchange="_bulkSlotIdx=parseInt(this.value)">
            ${slots.map((s, i) => `<option value="${i}" ${i === _bulkSlotIdx ? 'selected' : ''}>${currentShift}${i + 1} — ${s}</option>`).join('')}
          </select>
        </div>
        <div class="bulk-panel-section">
          <button class="btn btn-accent" onclick="bulkAssignMulti()">Apply to Selection</button>
        </div>
        <div class="bulk-panel-section">
          <button class="btn" onclick="_copyBreaksForSlack()" style="font-size:12px;padding:6px 14px;white-space:nowrap;">📋 Copy for Slack</button>
        </div>
      </div>
    </div>

    <!-- COL 2: Split per Position -->
    <div style="flex:1;min-width:240px;padding:0 20px;${_distPanel ? 'border-right:1px solid var(--border);' : ''}">
      ${splitRow || '<span style="color:var(--text3);font-size:11px;">—</span>'}
    </div>

    <!-- COL 3: Break Distribution (Shift A only) -->
    ${_distPanel ? `<div style="flex:1;min-width:240px;padding-left:20px;">${_distPanel}</div>` : ''}

  </div>
</div>`;

  var _ctrlCollapsed = localStorage.getItem('arrange-controls-collapsed') === '1';
  var collapsePanel = `
<div class="arrange-controls-wrap">
  <div class="arrange-controls-header" onclick="_toggleArrangeControls()">
    <span class="arrange-controls-chevron${_ctrlCollapsed ? ' collapsed' : ''}" id="arrange-chevron">▼</span>
    <span>Controls</span>
  </div>
  <div class="arrange-controls-body${_ctrlCollapsed ? ' collapsed' : ''}" id="arrange-controls-body">
    ${combinedPanel}
  </div>
</div>`;

  const weekTable = getArrangeDayMemberList(null);
  // Disconnect previous observer so it doesn't fire on stale elements
  if (_arrResizeObs) { _arrResizeObs.disconnect(); _arrResizeObs = null; }
  requestAnimationFrame(function() { _initArrResize(); });
  return collapsePanel + weekTable;
}

function _resizeArrTable() {
  var wrap = document.querySelector('.arr-table-wrap');
  if (!wrap) return;
  var TOPBAR  = 52;
  var PADDING = 24;
  var GAP     = 8;
  var used    = TOPBAR + PADDING + GAP;
  var ph   = document.querySelector('.page-header');
  var tabs = document.querySelector('.arrange-tab-bar');
  var ctrl = document.querySelector('.arrange-controls-wrap');
  if (ph)   used += ph.offsetHeight   + GAP;
  if (tabs) used += tabs.offsetHeight + GAP;
  if (ctrl) used += ctrl.offsetHeight + GAP;
  wrap.style.maxHeight = Math.max(200, window.innerHeight - used) + 'px';
}

var _arrResizeObs = null;
window.addEventListener('resize', function() { _resizeArrTable(); });
function _initArrResize() {
  _resizeArrTable();
  var ctrl = document.querySelector('.arrange-controls-wrap');
  if (ctrl && window.ResizeObserver && !_arrResizeObs) {
    _arrResizeObs = new ResizeObserver(_resizeArrTable);
    _arrResizeObs.observe(ctrl);
  }
}

function _toggleArrangeControls() {
  var body = document.getElementById('arrange-controls-body');
  var chevron = document.getElementById('arrange-chevron');
  if (!body || !chevron) return;
  var nowCollapsed = body.classList.toggle('collapsed');
  chevron.classList.toggle('collapsed', nowCollapsed);
  localStorage.setItem('arrange-controls-collapsed', nowCollapsed ? '1' : '0');
  // Wait for CSS transition to settle then resize
  setTimeout(_resizeArrTable, 420);
}

function _renderArrangeOverviewTab(weekRange) {
  // All users on this shift in the week
  const shiftUsers = state.users.filter(function(u) {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur]||{}).level || 0;
    if (_ul >= 2) return false;
    return weekRange.some(function(d) { return _getSched(u.username, d) === currentShift; });
  });

  if (!shiftUsers.length) return `<div class="empty"><div class="empty-ico">👥</div>No staff on Shift ${currentShift} this week.</div>`;

  var _todayNow = new Date();
  const todayDkOv = String(_todayNow.getDate()).padStart(2,'0') + '/' + String(_todayNow.getMonth()+1).padStart(2,'0');
  const summaryHeaders = weekRange.map((d, i) => {
    const isToday = d === todayDkOv;
    const isActive = d === arrangeActiveDay;
    return `<th style="text-align:center;padding:7px 4px;font-size:10px;min-width:54px;
      font-weight:700;
      position:sticky;top:0;z-index:10;
      background:${isToday ? 'var(--accent)' : isActive ? 'var(--bg4)' : 'var(--bg3)'};
      color:${isToday ? '#fff' : isActive ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:2px solid ${isToday ? 'var(--accent2)' : 'var(--border)'};
      ">
      ${getWkDay(d)}<br>
      <span style="font-weight:400;font-size:9px;opacity:0.7;">${d}</span>
    </th>`;
  }).join('');

  const summaryRows = shiftUsers.map(u => {
    const dayCells = weekRange.map((d, i) => {
      const dn = getWkDay(d);
      var shiftVal = _getSched(u.username, d);
      const onShift = shiftVal === currentShift;
      const br = getAssigned(u.id, d) || getAssigned(u.id, dn);

      // 1. Handle empty cells (Off days or Different shifts)
      if (shiftVal === '0') return `<td style="text-align:center;padding:6px 4px;"><span style="color:var(--text3);font-size:10px;">—</span></td>`;
      if (!onShift) return `<td style="text-align:center;padding:6px 4px;"><span class="sh sh-${shiftVal}" style="width:20px;height:20px;font-size:10px;">${shiftVal}</span></td>`;

      // 2. CONVERT TIME TO LEGEND (D1, D2, etc.)
      // This uses your shift code (e.g., 'D') and the time (e.g., '19:30–21:00') 
      // to find the short legend code.
      const code = br ? getShortSlot(currentShift, br.slot) : '?';
const ov_si = (code.length === 2 && code[0] === currentShift) ? parseInt(code[1]) - 1 : -1;
const isActive = d === arrangeActiveDay;
const ov_class = br
  ? `break-slot slot-${ov_si === 0 ? 1 : 2} assigned overview-cell-assigned${isActive ? ' overview-cell-active' : ''}`
  : `break-slot overview-cell-pending${isActive ? ' overview-cell-active' : ''}`;

      return `<td style="text-align:center;padding:6px 4px;background:${isActive ? 'rgba(200,212,0,0.06)' : ''};">
    <span onclick="switchArrangeMainTab('assign'); arrangeActiveDay='${d}'; nav('arrange');"
      class="${ov_class}"
      style="display:inline-flex;align-items:center;justify-content:center;
        width:28px;height:22px;border-radius:4px;font-size:10px;font-weight:700;
        font-family:'IBM Plex Mono',monospace;cursor:pointer;
        ${isActive ? 'outline:2px solid var(--accent);outline-offset:2px;' : ''}"
      title="${br ? getSlotTime(br.slot, d) : 'Not assigned — click to assign'}">
      ${code} </span>
  </td>`;
    }).join('');

    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 12px;white-space:nowrap;border-right:1px solid var(--border);min-width:200px;">
        <div style="font-weight:600;font-size:12px;margin-bottom:2px;">${u.name}</div>
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${u.team}</span>
          <span class="role-tag ${getRoleInfo(u.role).tag}" style="font-size:9px;padding:1px 6px;">${getRoleInfo(u.role).label}</span>
        </div>
      </td>
      ${dayCells}
    </tr>`;
  }).join('');

  const assignedCount = shiftUsers.reduce((acc, u) =>
    acc + weekRange.filter(d => getAssigned(u.id, d) || getAssigned(u.id, WEEK_DAYS[weekRange.indexOf(d)])).length, 0);
  const totalSlots = shiftUsers.length * weekRange.filter(d => shiftUsers.some(u => _getSched(u.username, d) === currentShift)).length;

  return `
<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap;">
  <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">
    ${shiftUsers.length} members · ${assignedCount} assigned
  </span>
  <span style="color:var(--ok);font-size:11px;">■ Assigned</span>
  <span style="color:var(--warn);font-size:11px;">■ Pending</span>
  <span style="color:var(--accent);font-size:10px;opacity:0.7;">Click a cell to assign</span>
</div>
<div class="staff-tbl-wrap">
  <table style="border-collapse:collapse;width:100%;">
    <thead>
      <tr style="background:var(--bg3);">
        <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;color:var(--text2);min-width:200px;border-right:1px solid var(--border);position:sticky;top:0;z-index:10;background:var(--bg3);">MEMBER</th>
        ${summaryHeaders}
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>
</div>`;
}


function switchArrangeDay(day) {
  arrangeActiveDay = day;
  // Table is full-week now; clicking from overview just switches to assign tab
  // The table re-renders with the new active day highlighted
  const wrap = document.querySelector('.arr-table-wrap');
  if (wrap) { wrap.outerHTML = getArrangeDayMemberList(null); }
}

// ── Month Overview tab — all months stacked vertically ──
// Data cutoff: hide breaks before May 11 2026 (app go-live date)
var _MOV_CUTOFF = { year: 2026, month: 5, day: 11 };

function _movIsPast(dk, year) {
  var parts = dk.split('/');
  var dd = parseInt(parts[0]), mm = parseInt(parts[1]);
  if (year !== _MOV_CUTOFF.year) return year < _MOV_CUTOFF.year;
  if (mm !== _MOV_CUTOFF.month) return mm < _MOV_CUTOFF.month;
  return dd < _MOV_CUTOFF.day;
}

function _renderArrangeMonthOverview() {
  var now = new Date();
  var todayDk = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth()+1).padStart(2,'0');
  var curMonth = now.getMonth() + 1; // 1-12

  // Show May 2026 through current month + 2 ahead (capped at Dec 2026)
  var endMonth = Math.min(12, now.getMonth() + 3);
  var months = [];
  for (var _mi = 5; _mi <= endMonth; _mi++) { months.push(_mi); }

  var _arrTierKey = {
    'Data Analyst': 'analyst', 'Sr Data Analyst': 'analyst',
    'Data Supervisor': 'supervisor', 'Sr Data Supervisor': 'sr_supervisor'
  };
  var _arrTierOrder = ['analyst', 'supervisor', 'sr_supervisor'];
  var _arrTierLabel = { 'analyst': 'Data Analyst', 'supervisor': 'Data Supervisor', 'sr_supervisor': 'Sr Data Supervisor' };
  var _tierIcon = { 'analyst': '◆', 'supervisor': '▲', 'sr_supervisor': '★' };
  var _monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var sections = months.map(function(month) {
    var year = 2026;
    var lastDay = new Date(year, month, 0).getDate();
    var dates = [];
    for (var d = 1; d <= lastDay; d++) {
      dates.push(String(d).padStart(2,'0') + '/' + String(month).padStart(2,'0'));
    }

    // Teams on this shift this month (level < 2 only)
    var teamSet = {};
    state.users.forEach(function(u) {
      var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
      var _ul = (ROLES[_resolveRole(_ur)||_ur]||{}).level || 0;
      if (_ul >= 2) return;
      var onShift = dates.some(function(dk) { return _getSched(u.username, dk) === currentShift; });
      if (!onShift) return;
      var resolvedRole = _resolveRole(u.role || _ur) || u.role || '';
      if (!teamSet[u.team]) teamSet[u.team] = resolvedRole;
    });

    var teams = Object.keys(teamSet).sort(function(a, b) {
      var ta = _arrTierOrder.indexOf(_arrTierKey[teamSet[a]] || 'analyst');
      var tb = _arrTierOrder.indexOf(_arrTierKey[teamSet[b]] || 'analyst');
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    if (!teams.length) return '';

    // Column headers — weekend columns get a tinted background
    var theadCols = dates.map(function(dk) {
      var isToday = dk === todayDk;
      var dayName = getWkDay(dk).substring(0,3);
      var dd = dk.split('/')[0];
      var isWeekend = dayName === 'Sat' || dayName === 'Sun';
      var isPast = _movIsPast(dk, year);
      var bg = isToday ? 'var(--accent)' : isPast ? 'var(--bg4)' : isWeekend ? 'rgba(0,0,0,.055)' : 'var(--bg3)';
      var col = isToday ? '#fff' : (isPast || isWeekend) ? 'var(--text3)' : 'var(--text2)';
      return '<th style="text-align:center;min-width:34px;padding:5px 2px;font-size:10px;font-weight:700;' +
        'background:' + bg + ';color:' + col + ';opacity:' + (isPast ? '.35' : '1') + ';' +
        'position:sticky;top:0;z-index:10;">' +
        '<div>' + dd + '</div>' +
        '<div style="font-size:9px;font-weight:400;opacity:.7;">' + dayName + '</div>' +
      '</th>';
    }).join('');

    // Team rows with banded tier separators + alternating row tints
    var prevTier = null;
    var rowIndex = 0;
    var tbodyRows = teams.map(function(team) {
      var resolvedRole = teamSet[team];
      var tierKey = _arrTierKey[resolvedRole] || 'analyst';
      var tierLabel = _arrTierLabel[tierKey] || resolvedRole;

      // Stronger tier separator: full-band with icon + left accent border
      var separator = '';
      if (tierKey !== prevTier) {
        prevTier = tierKey;
        rowIndex = 0;
        var tierColor = _roleColor(resolvedRole);
        var icon = _tierIcon[tierKey] || '◆';
        separator = '<tr><td colspan="' + (dates.length + 1) + '" style="' +
          'padding:10px 12px 6px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;' +
          'color:' + tierColor + ';background:var(--bg2);' +
          'border-top:2px solid var(--border);border-left:3px solid ' + tierColor + ';">' +
          icon + '  ' + tierLabel + '</td></tr>';
      }

      var isEven = rowIndex % 2 === 0;
      rowIndex++;
      var rowBaseBg = isEven ? 'transparent' : 'rgba(0,0,0,.025)';

      var cells = dates.map(function(dk) {
        var isToday = dk === todayDk;
        var isWeekend = getWkDay(dk) === 'Sat' || getWkDay(dk) === 'Sun';
        var isPast = _movIsPast(dk, year);

        // Past cells: blank + dimmed
        if (isPast) {
          return '<td style="padding:4px 1px;opacity:.2;background:var(--bg4);"></td>';
        }

        var teamMembers = state.users.filter(function(u) { return u.team === team; });
        var onShiftCount = teamMembers.filter(function(u) {
          return _getSched(u.username, dk) === currentShift;
        }).length;

        // Not on shift this day: blank cell (no dash — reduces visual noise)
        if (onShiftCount === 0) {
          var emptyBg = isToday ? 'rgba(31,102,241,.06)' : isWeekend ? 'rgba(0,0,0,.04)' : '';
          return '<td style="padding:4px 1px;background:' + emptyBg + ';"></td>';
        }

        var slot = null;
        for (var i = 0; i < teamMembers.length; i++) {
          var br = DB.getBreak(teamMembers[i].id, dk);
          if (br && br.slot) { slot = br.slot; break; }
        }

        var slotCode = slot ? (function() {
          var si = -1;
          if (slot === currentShift + '1') si = 0;
          else if (slot === currentShift + '2') si = 1;
          else si = _slotIndex(slot, currentShift);
          return si >= 0 ? (currentShift + (si + 1)) : '?';
        })() : null;

        var badgeStyle, badgeText;
        if (slotCode === currentShift + '1') {
          badgeStyle = 'background:rgba(31,102,241,.18);color:var(--accent);border:1px solid rgba(31,102,241,.25);';
          badgeText = '1';
        } else if (slotCode === currentShift + '2') {
          badgeStyle = 'background:rgba(245,158,11,.18);color:var(--warn);border:1px solid rgba(245,158,11,.28);';
          badgeText = '2';
        } else {
          badgeStyle = 'background:rgba(156,163,175,.12);color:var(--text3);border:1px solid rgba(156,163,175,.18);';
          badgeText = '?';
        }

        var todayColBg = isToday ? 'rgba(31,102,241,.06)' : isWeekend ? 'rgba(0,0,0,.04)' : '';
        return '<td style="text-align:center;padding:4px 1px;background:' + todayColBg + ';">' +
          '<span style="display:inline-flex;align-items:center;justify-content:center;' +
            'width:22px;height:18px;border-radius:4px;font-size:11px;font-weight:700;' +
            'font-family:monospace;' + badgeStyle + '">' + badgeText + '</span></td>';
      }).join('');

      // Sticky team-name cell with right shadow to lift it from the scrolling grid
      var stickyCell = '<td style="padding:5px 12px 5px 10px;font-size:12px;font-weight:600;white-space:nowrap;' +
        'position:sticky;left:0;z-index:5;' +
        'background:' + (isEven ? 'var(--bg2)' : 'var(--bg3)') + ';' +
        'box-shadow:3px 0 8px -2px rgba(0,0,0,.18);' +
        'border-right:1px solid var(--border);">' + team + '</td>';

      return separator +
        '<tr style="background:' + rowBaseBg + ';" ' +
        'onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'' + rowBaseBg + '\'">' +
        stickyCell + cells + '</tr>';
    }).join('');

    var isCurrent = month === curMonth && year === now.getFullYear();
    return '<div id="mov-m' + month + '-' + year + '" style="margin-bottom:32px;scroll-margin-top:52px;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;' +
        'padding:8px 14px;background:var(--bg3);border-radius:7px;' +
        'border-left:4px solid ' + (isCurrent ? 'var(--accent)' : 'var(--border2)') + ';' +
        'display:flex;align-items:center;gap:10px;">' +
        _monthNames[month-1] + ' ' + year +
        '<span style="font-size:10px;color:var(--text3);font-weight:400;">' + teams.length + ' teams \xb7 Shift ' + currentShift + '</span>' +
        (isCurrent ? '<span style="font-size:10px;color:var(--accent);font-weight:600;margin-left:auto;' +
          'background:rgba(31,102,241,.1);padding:2px 8px;border-radius:20px;border:1px solid rgba(31,102,241,.2);">Current</span>' : '') +
      '</div>' +
      '<div style="overflow-x:auto;border-radius:6px;border:1px solid var(--border);box-shadow:0 1px 6px rgba(0,0,0,.07);">' +
      '<table style="border-collapse:collapse;width:max-content;min-width:100%;">' +
      '<thead><tr>' +
        '<th style="position:sticky;left:0;z-index:11;background:var(--bg3);padding:5px 12px 5px 10px;' +
          'font-size:10px;font-weight:700;color:var(--text3);text-align:left;letter-spacing:.06em;' +
          'box-shadow:3px 0 8px -2px rgba(0,0,0,.18);border-right:1px solid var(--border);">TEAM</th>' +
        theadCols +
      '</tr></thead>' +
      '<tbody>' + tbodyRows + '</tbody>' +
      '</table></div></div>';
  }).join('');

  if (!sections) return '<div class="empty">No data.</div>';

  // Sticky month-nav bar: quick-jump chips for each month
  var navChips = months.map(function(m) {
    var isCur = m === curMonth;
    return '<a href="#mov-m' + m + '-2026" onclick="event.preventDefault();' +
      'document.getElementById(\'mov-m' + m + '-2026\').scrollIntoView({behavior:\'smooth\',block:\'start\'});" ' +
      'style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;' +
        'font-size:11px;font-weight:' + (isCur ? '700' : '500') + ';text-decoration:none;' +
        'background:' + (isCur ? 'var(--accent)' : 'var(--bg4)') + ';' +
        'color:' + (isCur ? '#fff' : 'var(--text2)') + ';' +
        'border:1px solid ' + (isCur ? 'var(--accent)' : 'var(--border)') + ';' +
        'transition:opacity .15s;cursor:pointer;" ' +
      'onmouseover="this.style.opacity=\'.75\'" onmouseout="this.style.opacity=\'1\'">' +
      _monthNames[m-1].substring(0,3) + '</a>';
  }).join('');

  var navBar = '<div style="position:sticky;top:0;z-index:20;background:var(--bg2);' +
    'padding:8px 0 8px;margin-bottom:16px;' +
    'border-bottom:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;">' +
    navChips + '</div>';

  // Auto-scroll to current month after render
  var autoScroll = '<script>(function(){' +
    'var el=document.getElementById("mov-m' + curMonth + '-2026");' +
    'if(el)el.scrollIntoView({block:"start"});' +
    '})()</script>';

  return navBar + sections + autoScroll;
}
// Full-week assign table — all days as columns, no gender col, clear slot states
function getArrangeDayMemberList(_unused) {
  const weekRange = getWeekRange(activeMonday); // Mon–Sun since activeMonday = Monday
  const slots = BREAK_SLOTS[currentShift] || [];
  // Compute today's dateKey directly (robust, no index math)
  const _now = new Date();
  const todayDk = `${_now.getDate().toString().padStart(2,'0')}/${(_now.getMonth()+1).toString().padStart(2,'0')}`;
  // Normalize dashes for slot comparison
  const nd = (x) => (x||'').replace(/[\u2012\u2013\u2014\u002D\u2212]/g, '-').replace(/\s/g, '');

  // Only include Data Analyst, Sr Data Analyst, Data Supervisor, Sr Data Supervisor (level 0–1).
  // Exclude unknown roles (level == null), leaders, training, admin (level >= 2).
  const allMates = state.users.filter(u => {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul == null || _ul >= 2) return false;
    return weekRange.some(d => _getSched(u.username, d) === currentShift);
  });

  if (!allMates.length) return `<div class="empty" style="padding:60px;">
    <div class="empty-ico">👥</div>No staff on Shift ${currentShift} this week.</div>`;

  // Table header — day columns
  const thDays = weekRange.map(d => {
    const isToday = d === todayDk;
    const dayLabel = getWkDay(d);
    return `<th class="arr-th-day${isToday ? ' arr-th-today' : ''}" style="min-width:90px;text-align:center;">
      <div style="font-size:11px;font-weight:700;">${dayLabel}</div>
      <div style="font-size:9px;opacity:0.6;font-weight:400;">${d}</div>
    </th>`;
  }).join('');

  // Table rows — one per member
  const tbRows = allMates.map(u => {
    const dayCells = weekRange.map(d => {
      const dn = getWkDay(d);
      var shiftVal = _getSched(u.username, d);
      const onShift = shiftVal === currentShift;
      const isToday = d === todayDk;

      // Day off or different shift — show nothing
      if (!onShift) {
        return `<td class="arr-cell arr-cell-off${isToday ? ' arr-cell-today' : ''}">
          <span style="color:var(--text3);font-size:12px;">—</span>
        </td>`;
      }

      var arrMk = _now.getFullYear() + '-' + d.split('/')[1];
      var arrAttCode = (state.monthlyAttendance || {})[u.username] ? ((state.monthlyAttendance[u.username][arrMk] || {})[d]) : '';
      var arrAttParsed = arrAttCode ? _parseAttCode(arrAttCode) : null;
      var arrIsOff = arrAttParsed && arrAttParsed.type === 'OFF';

      if (arrIsOff) {
        var _offBg = {'A':'rgba(234,179,8,.13)','H':'rgba(220,38,38,.13)','0':'rgba(22,163,74,.13)','U':'rgba(225,29,72,.12)','S':'rgba(234,88,12,.12)','L':'rgba(8,145,178,.12)'};
        var _offFg = {'A':'#ca8a04','H':'#dc2626','0':'#16a34a','U':'#e11d48','S':'#ea580c','L':'#0891b2'};
        var _ck = String(arrAttCode).replace(/\.0$/,'').toUpperCase();
        var _cbg = _offBg[_ck] || 'rgba(107,114,128,.1)';
        var _cfg = _offFg[_ck] || 'var(--text3)';
        return `<td class="arr-cell${isToday ? ' arr-cell-today' : ''}" style="background:${_cbg};pointer-events:none;text-align:center;vertical-align:middle;">
          <span style="font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:${_cfg};">${_ck}</span>
        </td>`;
      }

      const br = getAssigned(u.id, d) || getAssigned(u.id, dn);
      const br_idx = br ? _slotIndex(br.slot, currentShift) : -1;

      function _nd(s) { return (s || '').replace(/[\u2012\u2013\u2014\u002D]/g, '-').replace(/\s/g, ''); }

      const slotBtns = slots.map((s, idx) => {
        // Normalize both sides for comparison to handle any dash variant in stored data
        const isAssigned = br && _slotIndex(br.slot, currentShift) === idx;
        return `<span
    class="arr-slot arr-slot-${idx + 1}${isAssigned ? ' arr-slot-on' : ' arr-slot-off'}"
    onclick="quickAssignByIndex(${u.id},'${d}',${idx})"
    title="${s}">
    ${currentShift}${idx + 1}
  </span>`;
      }).join('');

      return `<td class="arr-cell${isToday ? ' arr-cell-today' : ''}">
        <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
          ${slotBtns}
        </div>
      </td>`;
    }).join('');

    return `<tr class="arr-row">
      <td>
        <div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">
          ${u.name}
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${u.team}</span>
          <span class="role-tag ${getRoleInfo(u.role).tag}" style="font-size:9px;padding:1px 6px;">${getRoleInfo(u.role).label}</span>
        </div>
      </td>
      ${dayCells}
    </tr>`;
  }).join('');

  // Per-day slot totals by role tier — sticky tfoot
  const ARR_TIERS = [
    { label: 'Data Analyst', match: u => ['Data Analyst', 'Sr Data Analyst'].includes(_resolveRole(u.role)) },
    { label: 'Data Supervisor', match: u => _resolveRole(u.role) === 'Data Supervisor' },
    { label: 'Sr Data Supervisor', match: u => _resolveRole(u.role) === 'Sr Data Supervisor' },
    { label: 'Total', match: u => ['Data Analyst', 'Sr Data Analyst', 'Data Supervisor', 'Sr Data Supervisor'].includes(_resolveRole(u.role)) },
  ];

  const tierFootRows = ARR_TIERS.map((tier, tierIdx) => {
    const tierUsers = allMates.filter(tier.match);
    if (!tierUsers.length) return '';
    const isTotal = tier.label === 'Total';

    const footCells = weekRange.map(d => {
      const dn = getWkDay(d);
      let s1 = 0, s2 = 0;
      tierUsers.forEach(u => {
        var onShift = _getSched(u.username, d) === currentShift;
        if (!onShift) return;
        var _ftMk = _now.getFullYear() + '-' + d.split('/')[1];
        var _ftCode = (state.monthlyAttendance || {})[u.username] ? ((state.monthlyAttendance[u.username][_ftMk] || {})[d]) : '';
        var _ftParsed = _ftCode ? _parseAttCode(_ftCode) : null;
        if (_ftParsed && _ftParsed.type === 'OFF') return;
        const br = getAssigned(u.id, d) || getAssigned(u.id, dn);
        if (!br) return;
        const idx = _slotIndex(br.slot, currentShift);
        if (idx === 0) s1++;
        else if (idx === 1) s2++;
      });
      const isToday = d === todayDk;
      return `<td style="text-align:center;padding:${isTotal ? '6px' : '4px'} 4px;
        border-right:1px solid var(--border);
        background:${isToday ? 'rgba(31,102,241,.08)' : isTotal ? 'var(--bg3)' : 'var(--bg4)'};">
        <span class="arr-slot arr-slot-1 arr-slot-on"
          style="font-size:${isTotal ? '11px' : '10px'};padding:2px 7px;cursor:default;
            ${isTotal ? 'font-weight:700;' : ''}">${currentShift}1·${s1}</span>
        <span class="arr-slot arr-slot-2 arr-slot-on"
          style="font-size:${isTotal ? '11px' : '10px'};padding:2px 7px;cursor:default;margin-left:3px;
            ${isTotal ? 'font-weight:700;' : ''}">${currentShift}2·${s2}</span>
      </td>`;
    }).join('');

    return `<tr style="border-top:${isTotal ? '2px solid var(--border2)' : '0.5px solid var(--border)'};">
      <td style="position:sticky;left:0;z-index:11;
        font-size:${isTotal ? '11px' : '10px'};
        font-weight:${isTotal ? '700' : '600'};
        color:${isTotal ? 'var(--text)' : 'var(--text3)'};
        font-family:'IBM Plex Mono',monospace;
        letter-spacing:.03em;
        padding:${isTotal ? '6px' : '4px'} 14px;
        background:${isTotal ? 'var(--bg3)' : 'var(--bg4)'};
        border-right:2px solid var(--border2);
        min-width:200px;
        box-shadow:3px 0 8px rgba(0,0,0,.1);">
        ${tier.label}
      </td>
      ${footCells}
    </tr>`;
  }).filter(Boolean).join('');

  const tfoot = tierFootRows
    ? `<tfoot style="position:sticky;bottom:0;z-index:5;">${tierFootRows}</tfoot>`
    : '';

  return `
  <div class="arr-table-wrap">
    <table class="arr-table">
      <thead>
        <tr>
          <th class="arr-th-name">Member</th>
          ${thDays}
        </tr>
      </thead>
      <tbody>${tbRows}</tbody>
      ${tfoot}
    </table>
  </div>`;
}

function _renderSlackAutoPostToggle() {
  var cfg = (state.slackAutoPost || {})[currentShift] || {};
  var enabled = !!cfg.enabled;
  var lastAt = cfg.lastPostedAt ? new Date(cfg.lastPostedAt).toLocaleString('vi-VN') : '—';
  var schedMap = {A:'Mon, Tue, Sat, Sun · 15:15', D:'Mon, Tue, Sat, Sun · 00:15', E:'Mon, Sat, Sun · 06:15'};
  var sched = schedMap[currentShift] || '';
  return `<div class="bulk-panel" style="margin-bottom:16px;padding:10px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <span style="font-size:12px;font-weight:600;">🔔 Slack Auto-Post</span>
    <span style="font-size:11px;color:var(--text2);">Shift ${currentShift} · ${sched}</span>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-left:auto;">
      <span style="font-size:11px;color:${enabled ? 'var(--accent)' : 'var(--text3)'};">${enabled ? 'ON' : 'OFF'}</span>
      <div onclick="_toggleSlackAutoPost()" style="width:36px;height:20px;border-radius:10px;
        background:${enabled ? 'var(--accent)' : 'var(--bg4)'};position:relative;cursor:pointer;transition:background .2s;border:1px solid var(--border);">
        <div style="position:absolute;top:2px;${enabled ? 'right:2px' : 'left:2px'};width:14px;height:14px;
          border-radius:50%;background:#fff;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>
      </div>
    </label>
    <span style="font-size:10px;color:var(--text3);">Last post: ${lastAt}</span>
  </div>`;
}

async function _toggleSlackAutoPost() {
  if (!state.slackAutoPost) state.slackAutoPost = {};
  if (!state.slackAutoPost[currentShift]) state.slackAutoPost[currentShift] = {};
  state.slackAutoPost[currentShift].enabled = !state.slackAutoPost[currentShift].enabled;
  if (syncEnabled()) await syncPush();
  nav('arrange');
}

function _copyBreaksForSlack() {
  var now = new Date();
  var todayDk = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth() + 1).padStart(2,'0');
  var weekRange = getWeekRange(activeMonday);
  var dk = weekRange.indexOf(todayDk) >= 0 ? todayDk : (weekRange[1] || weekRange[0]);

  var parts = dk.split('/');
  var d = new Date(now.getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[0]));

  var dn = getWkDay(dk);
  var roleAbbr = {'Data Analyst':'D.A','Sr Data Analyst':'Sr D.A','Data Supervisor':'D.S','Sr Data Supervisor':'Sr D.S'};
  var offBg = {'A':'rgba(234,179,8,.18)','H':'rgba(220,38,38,.18)','0':'rgba(22,163,74,.18)','U':'rgba(225,29,72,.15)','S':'rgba(234,88,12,.15)','L':'rgba(8,145,178,.15)'};
  var offFg = {'A':'#92680a','H':'#b91c1c','0':'#15803d','U':'#be123c','S':'#c2410c','L':'#0e7490'};
  var validRoles = ['Data Analyst','Sr Data Analyst','Data Supervisor','Sr Data Supervisor'];
  var mk2 = now.getFullYear() + '-' + parts[1];
  var slots = BREAK_SLOTS[currentShift] || [];

  var shiftUsers = (state.users || []).filter(function(u) {
    if (_getSched(u.username, dk).toUpperCase() !== (currentShift || '').toUpperCase()) return false;
    return validRoles.indexOf(_resolveRole(u.role)) >= 0;
  }).sort(function(a, b) {
    if (a.team !== b.team) return a.team.localeCompare(b.team, undefined, {numeric:true});
    return _roleSort(a, b);
  });

  var tableRows = '';
  shiftUsers.forEach(function(u) {
    var attCode2 = (state.monthlyAttendance || {})[u.username] ? ((state.monthlyAttendance[u.username][mk2] || {})[dk]) : '';
    var attParsed2 = attCode2 ? _parseAttCode(attCode2) : null;
    var isOff2 = attParsed2 && attParsed2.type === 'OFF';
    var br2 = DB.getBreak(u.id, dk);
    var shortCode2 = br2 ? getShortSlot(currentShift, br2.slot) : '';
    var slotIdx2 = br2 ? _slotIndex(br2.slot, currentShift) : -1;
    var ck2 = isOff2 ? String(attCode2).replace(/\.0$/, '').toUpperCase() : '';
    var cellBg = isOff2 ? (offBg[ck2] || 'rgba(107,114,128,.1)') : slotIdx2 === 0 ? 'rgba(59,130,246,.18)' : slotIdx2 === 1 ? 'rgba(34,197,94,.18)' : 'var(--bg3)';
    var cellFg = isOff2 ? (offFg[ck2] || 'var(--text3)') : 'var(--text1)';
    var cellText = isOff2 ? ck2 : (shortCode2 || '—');
    var ra = roleAbbr[_resolveRole(u.role)] || _resolveRole(u.role);
    var td = 'border-right:1px solid var(--border);border-bottom:1px solid var(--border);';
    tableRows += '<tr>'
      + '<td style="padding:5px 10px;font-size:11px;font-family:\'IBM Plex Mono\',monospace;color:var(--text2);white-space:nowrap;' + td + '">' + (u.team || '') + '</td>'
      + '<td style="padding:5px 12px;font-size:12px;white-space:nowrap;' + td + '">' + u.name + '</td>'
      + '<td style="padding:5px 10px;font-size:11px;color:var(--text2);white-space:nowrap;' + td + '">' + ra + '</td>'
      + '<td style="padding:5px 10px;text-align:center;font-size:12px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;border-bottom:1px solid var(--border);background:' + cellBg + ';color:' + cellFg + ';">' + cellText + '</td>'
      + '</tr>';
  });

  var legendHtml = slots.map(function(s, i) {
    return '<span style="font-size:9px;display:block;opacity:.85;">' + currentShift + (i + 1) + ': ' + s + '</span>';
  }).join('');
  var dateHeaderLabel = parts[0] + '/' + parts[1] + ' (' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ')';
  var thStyle = 'background:var(--accent);color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:600;border-right:1px solid rgba(255,255,255,.2);';

  var html = '<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);font-family:\'IBM Plex Sans\',sans-serif;">'
    + '<thead><tr>'
    + '<th style="' + thStyle + 'width:52px;">Team</th>'
    + '<th style="' + thStyle + '">Name</th>'
    + '<th style="' + thStyle + 'width:68px;">Role</th>'
    + '<th style="background:var(--accent);color:#fff;padding:7px 10px;text-align:center;font-size:11px;font-weight:600;min-width:90px;">'
    + dateHeaderLabel + '<br>' + legendHtml + '</th>'
    + '</tr></thead>'
    + '<tbody>' + tableRows + '</tbody>'
    + '</table>';

  document.getElementById('slack-table-wrap').innerHTML = html;
  document.getElementById('modal-slack-preview').classList.add('show');
}

function _screenshotSlackTable() {
  var el = document.getElementById('slack-table-wrap');
  var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
  html2canvas(el, {backgroundColor: bgColor, scale: 2, useCORS: true}).then(function(canvas) {
    canvas.toBlob(function(blob) {
      try {
        navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(function() {
          _showArrangeToast('Image copied! Paste in Slack ✔');
        });
      } catch(e) {
        var url = canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url; a.download = 'break-schedule.png'; a.click();
        _showArrangeToast('Downloaded (clipboard not supported).');
      }
    }, 'image/png');
  });
}

function _showArrangeToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:1.2rem;right:1.2rem;background:var(--accent);color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;z-index:9999;opacity:1;transition:opacity .4s';
  document.body.appendChild(t);
  setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 400); }, 1500);
}

// Keep quickAssign for backward compatibility (used by other callers)
function quickAssign(uid, day, slot) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  assign(uid, day, slot, '');
  toast(`Break assigned: ${getShortSlot(currentShift, slot) || slot}`);
  var wrap = document.querySelector('.arr-table-wrap');
  var _sT = wrap ? wrap.scrollTop : 0;
  var _sL = wrap ? wrap.scrollLeft : 0;
  if (wrap) { wrap.outerHTML = getArrangeDayMemberList(null); }
  else { const c = document.getElementById('arrange-day-content'); if (c) c.innerHTML = getArrangeDayMemberList(null); }
  var newWrap = document.querySelector('.arr-table-wrap');
  if (newWrap) { newWrap.scrollTop = _sT; newWrap.scrollLeft = _sL; }
  updateBadge();
}

// New: uses slot index instead of raw slot string in onclick — avoids en-dash encoding issues
function quickAssignByIndex(uid, day, slotIdx) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  const slots = BREAK_SLOTS[currentShift] || [];
  if (slotIdx < 0 || slotIdx >= slots.length) { toast('Invalid slot.', 'err'); return; }
  quickAssign(uid, day, currentShift + (slotIdx + 1));
}

function _saveBulkGroups() {
  _bulkGroups = new Set(Array.from(document.querySelectorAll('input[name="bulk-group"]:checked')).map(el => el.value));
}
function _saveBulkDays() {
  _bulkDays = new Set(Array.from(document.querySelectorAll('input[name="bulk-day"]:checked')).map(el => el.value));
}
function bulkAssignMulti() {
  // Read from DOM (current state) and also persist
  _saveBulkGroups(); _saveBulkDays();
  const selectedGroups = [..._bulkGroups];
  const selectedDays = [..._bulkDays];
  const slotIdx = _bulkSlotIdx;

  if (selectedGroups.length === 0) { toast('Select at least one Group.', 'err'); return; }
  if (selectedDays.length === 0) { toast('Select at least one Day.', 'err'); return; }

  const slots2 = BREAK_SLOTS[currentShift] || [];
  if (slotIdx < 0 || slotIdx >= slots2.length) { toast('Invalid slot selected.', 'err'); return; }
  const actualTime = currentShift + (slotIdx + 1);

  let totalAssigned = 0;
  selectedDays.forEach(day => {
    selectedGroups.forEach(team => {
      const dayName = getWkDay(day);
      const targets = state.users.filter(u =>
        u.team === team && _getSched(u.username, day) === currentShift
      );
      targets.forEach(u => { assign(u.id, day, actualTime, `Bulk by ${currentUser.name}`); totalAssigned++; });
    });
  });

  toast(`Assigned ${totalAssigned} breaks across ${selectedDays.length} days.`, 'ok');

  // Refresh the currently active day tab
  const activeTab = document.querySelector('#arrange-tabs .tab.on');
  if (activeTab) switchArrangeDay(activeTab.dataset.day);
}

function autofillDay() {
  const day = todayKey();
  const mates = getShiftMates(currentShift, day);
  const slots = BREAK_SLOTS[currentShift] || [];
  mates.forEach((u, i) => assign(u.id, day, currentShift + (i % slots.length + 1), 'auto'));
  toast(`Auto-filled ${mates.length} breaks for today`, 'ok');
  nav('arrange');
}

function autofillWeek() {
  let count = 0;
  WEEK_DAYS.forEach(day => {
    const mates = getShiftMates(currentShift, day);
    const slots = BREAK_SLOTS[currentShift] || [];
    mates.forEach((u, i) => { assign(u.id, day, currentShift + (i % slots.length + 1), 'auto'); count++; });
  });
  toast(`Auto-filled ${count} breaks across the week`, 'ok');
  nav('arrange');
}

// ═══════════════════════════════════════════════
//  RENDER: STAFF — 2 sub-tabs
//  Tab 1: Staff Info (from Excel import)
//  Tab 2: Staff Schedule (shift grid, no gender col)
// ═══════════════════════════════════════════════
function renderStaff() {
  var _canSeeAll = isLeader(currentUser) || isTraining(currentUser);
  if (!_canSeeAll && staffSubTab !== 'schedule') staffSubTab = 'schedule';
  var _tabStyle = function(tab) {
    return 'padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;' +
      'color:' + (staffSubTab === tab ? 'var(--accent)' : 'var(--text2)') + ';' +
      'border-bottom:3px solid ' + (staffSubTab === tab ? 'var(--accent)' : 'transparent') + ';' +
      'margin-bottom:-2px;transition:all .12s;';
  };
  return `
<div class="page-header">
  <div><div class="page-title">Staff</div></div>
</div>
<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">
  ${_canSeeAll ? `<button onclick="staffSubTab='info';nav('staff')" style="${_tabStyle('info')}">👤 Staff Info</button>` : ''}
  <button onclick="staffSubTab='schedule';nav('staff')" style="${_tabStyle('schedule')}">📅 Staff Schedule</button>
  ${_canSeeAll ? `<button onclick="staffSubTab='attendance';nav('staff')" style="${_tabStyle('attendance')}">📋 Staff Attendance</button>` : ''}
</div>
<div id="staff-subtab-content">
  ${staffSubTab === 'info'
      ? _renderStaffInfo()
      : staffSubTab === 'attendance'
        ? _renderStaffAttendance()
        : _renderStaffSchedule()}
</div>`;
}

// ── Sub-tab 1: Staff Info ──
function _renderStaffInfo() {
  const all = Object.entries(state.staffInfo || {})
    .map(([username, d]) => ({ username, ...d }))
    .sort(_roleSort);

  const infoFilter = staffFilters._info || '';

  const filtered = all.filter(u =>
    !infoFilter ||
    (u.name || '').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.empNo || '').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (_resolveRole(u.role) || '').toLowerCase().includes(infoFilter.toLowerCase())
  );

  const rows = _renderStaffInfoRows(infoFilter);

  if (!document.getElementById('modal-staff-info')) {
    document.body.insertAdjacentHTML('beforeend', _staffInfoModalHTML());
  }
  return `
<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
  <input class="filter-input" style="width:260px;" placeholder="Search name, username, emp#, role…"
    value="${infoFilter}"
    oninput="staffFilters._info=this.value;document.getElementById('staff-info-tbody').innerHTML=_renderStaffInfoRows(this.value)">
  <span style="font-size:11px;color:var(--text3);">${filtered.length} records</span>
  ${isTraining(currentUser) ? `
  <div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <button class="btn btn-accent btn-sm" onclick="openStaffInfoModal(null)" style="font-size:11px;">+ Add Staff</button>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
      <input type="file" id="excel-file-input" accept=".xlsx,.xls" style="font-size:11px;max-width:200px;">
    </label>
    <button class="btn btn-accent btn-sm" onclick="importExcelStaffInfo()">Import Excel</button>
    <div id="excel-import-status" style="font-size:11px;min-width:160px;"></div>
  </div>` : ''}
</div>
<div class="staff-tbl-wrap">
  <table>
    <thead>
      <tr>
        <th style="text-align:center;width:52px;background:var(--bg3);">ACTIVE</th><th style="width:90px;background:var(--bg3);">EMP#</th><th style="background:var(--bg3);">FULL NAME</th><th style="background:var(--bg3);">USERNAME</th><th style="text-align:center;width:60px;background:var(--bg3);">GENDER</th><th style="background:var(--bg3);">DATE OF BIRTH</th><th style="background:var(--bg3);">POSITION</th><th style="background:var(--bg3);">PHONE</th>${isTraining(currentUser) ? '<th style="width:80px;text-align:center;background:var(--bg3);">ACTIONS</th>' : ''}
      </tr>
    </thead>
    <tbody id="staff-info-tbody">${rows}</tbody>
  </table>
</div>`;
}

// Find and replace entire _renderStaffInfoRows function:
function _renderStaffInfoRows(filter) {
  const all = Object.entries(state.staffInfo || {})
    .map(([username, d]) => ({ username, ...d }))
    .filter(u => _resolveRole(u.role))
    .sort(_roleSort);
  const f = (filter || '').toLowerCase();
  return all.filter(u =>
    !f ||
    (u.name || '').toLowerCase().includes(f) ||
    (u.username || '').toLowerCase().includes(f) ||
    (u.empNo || '').toLowerCase().includes(f) ||
    (_resolveRole(u.role) || '').toLowerCase().includes(f)
  ).map(u => {
    // Gender: icon only
    var g = u.gender === 'F'
      ? `<span style="color:var(--A-color);font-size:15px;" title="Female">♀</span>`
      : u.gender === 'M'
        ? `<span style="color:var(--B-color);font-size:15px;" title="Male">♂</span>`
        : `<span style="color:var(--text3);font-size:11px;">—</span>`;

    var roleColor = _roleColor(u.role);

    var empNo = u.empNo || '—';
    var dob   = u.dob   || '—';
    var phone = u.phone || '—';
    var isActive = u.active !== false;
    var activeBadge = isTraining(currentUser)
      ? `<button onclick="toggleStaffActive('${u.username}')"
           title="${isActive ? 'Click to deactivate' : 'Click to activate'}"
           style="background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:6px;
                  color:${isActive ? 'var(--ok)' : 'var(--err)'};font-size:15px;transition:opacity .1s;"
           onmouseover="this.style.opacity='.6'" onmouseout="this.style.opacity='1'">●</button>`
      : `<span style="color:${isActive ? 'var(--ok)' : 'var(--err)'};font-size:14px;" title="${isActive ? 'Active' : 'Inactive'}">●</span>`;

    var actionBtns = isTraining(currentUser)
      ? '<button onclick="openStaffInfoModal(\'' + u.username + '\')" title="Edit" style="background:none;border:none;cursor:pointer;padding:2px 5px;font-size:13px;color:var(--accent);border-radius:4px;" onmouseover="this.style.background=\'rgba(31,102,241,.1)\'" onmouseout="this.style.background=\'none\'">✎</button>' +
        '<button onclick="deleteStaffInfo(\'' + u.username + '\')" title="Delete" style="background:none;border:none;cursor:pointer;padding:2px 5px;font-size:13px;color:var(--err);border-radius:4px;" onmouseover="this.style.background=\'rgba(220,38,38,.1)\'" onmouseout="this.style.background=\'none\'">✕</button>'
      : '';
    return '<tr style="' + (isActive ? '' : 'opacity:0.45;') + '">' +
      '<td style="text-align:center;vertical-align:middle;">' + activeBadge + '</td>' +
      '<td class="mono" style="font-size:11px;color:var(--text3);">' + empNo + '</td>' +
      '<td style="font-weight:600;">' + (u.name || '—') + '</td>' +
      '<td class="mono" style="color:var(--accent);font-size:11px;">' + u.username + '</td>' +
      '<td style="text-align:center;vertical-align:middle;">' + g + '</td>' +
      '<td style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text2);">' + dob + '</td>' +
      '<td style="font-size:11px;color:' + roleColor + ';font-weight:500;">' + (getRoleInfo(u.role).label || _resolveRole(u.role) || '—') + '</td>' +
      '<td style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text2);">' + phone + '</td>' +
      (isTraining(currentUser) ? '<td style="text-align:center;white-space:nowrap;">' + actionBtns + '</td>' : '') +
      '</tr>';
  }).join('');
}
function toggleStaffActive(username) {
  if (!state.staffInfo[username]) return;
  var wasActive = state.staffInfo[username].active !== false;
  state.staffInfo[username].active = !wasActive;
  syncPush();
  var tbody = document.getElementById('staff-info-tbody');
  if (tbody) tbody.innerHTML = _renderStaffInfoRows(staffFilters._info || '');
}

// ── Staff Info CRUD ──
function _staffInfoModalHTML() {
  var roleOpts = Object.keys(ROLES).map(function(r) {
    return '<option value="' + r + '">' + (ROLES[r].label || r) + '</option>';
  }).join('');
  return '<div id="modal-staff-info" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-staff-info\')">' +
    '<div class="modal" style="width:500px;">' +
      '<div class="modal-title" id="sif-modal-title">Add Staff</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin:16px 0;">' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Full Name *</label>' +
          '<input id="sif-name" class="filter-input" style="width:100%;" placeholder="Nguyen Van A"></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Username *</label>' +
          '<input id="sif-username" class="filter-input" style="width:100%;" placeholder="a.nguyen"></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Emp #</label>' +
          '<input id="sif-empno" class="filter-input" style="width:100%;" placeholder="1234"></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Team</label>' +
          '<input id="sif-team" class="filter-input" style="width:100%;" placeholder="SR1"></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Position *</label>' +
          '<select id="sif-role" class="login-select" style="width:100%;">' + roleOpts + '</select></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Gender</label>' +
          '<select id="sif-gender" class="login-select" style="width:100%;"><option value="">—</option><option value="M">Male</option><option value="F">Female</option></select></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Date of Birth</label>' +
          '<input id="sif-dob" class="filter-input" style="width:100%;" placeholder="DD/MM/YYYY"></div>' +
        '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Phone</label>' +
          '<input id="sif-phone" class="filter-input" style="width:100%;" placeholder="09xxxxxxxx"></div>' +
      '</div>' +
      '<div id="sif-error" style="font-size:11px;color:var(--err);min-height:16px;margin-bottom:8px;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button class="btn" onclick="closeModal(\'modal-staff-info\')">Cancel</button>' +
        '<button class="btn btn-accent" onclick="saveStaffInfoModal()">Save</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

var _sifEditingUsername = null;

function openStaffInfoModal(username) {
  if (!document.getElementById('modal-staff-info')) {
    document.body.insertAdjacentHTML('beforeend', _staffInfoModalHTML());
  }
  _sifEditingUsername = username || null;
  document.getElementById('sif-modal-title').textContent = username ? 'Edit Staff' : 'Add Staff';
  document.getElementById('sif-error').textContent = '';
  var usernameEl = document.getElementById('sif-username');
  if (username) {
    var d = state.staffInfo[username] || {};
    document.getElementById('sif-name').value = d.name || '';
    usernameEl.value = username;
    usernameEl.disabled = true;
    document.getElementById('sif-empno').value = d.empNo || '';
    document.getElementById('sif-team').value = d.team || '';
    document.getElementById('sif-role').value = _resolveRole(d.role) || d.role || 'Data Analyst';
    document.getElementById('sif-gender').value = d.gender || '';
    document.getElementById('sif-dob').value = d.dob || '';
    document.getElementById('sif-phone').value = d.phone || '';
  } else {
    document.getElementById('sif-name').value = '';
    usernameEl.value = '';
    usernameEl.disabled = false;
    document.getElementById('sif-empno').value = '';
    document.getElementById('sif-team').value = '';
    document.getElementById('sif-role').value = 'Data Analyst';
    document.getElementById('sif-gender').value = '';
    document.getElementById('sif-dob').value = '';
    document.getElementById('sif-phone').value = '';
  }
  document.getElementById('modal-staff-info').classList.add('show');
}

function saveStaffInfoModal() {
  var name     = (document.getElementById('sif-name').value || '').trim();
  var username = _sifEditingUsername || (document.getElementById('sif-username').value || '').trim().toLowerCase();
  var empNo    = (document.getElementById('sif-empno').value || '').trim();
  var team     = (document.getElementById('sif-team').value || '').trim();
  var role     = document.getElementById('sif-role').value;
  var gender   = document.getElementById('sif-gender').value;
  var dob      = (document.getElementById('sif-dob').value || '').trim();
  var phone    = (document.getElementById('sif-phone').value || '').trim();
  var errEl    = document.getElementById('sif-error');
  if (!name) { errEl.textContent = 'Full name is required.'; return; }
  if (!username) { errEl.textContent = 'Username is required.'; return; }
  if (!_sifEditingUsername && state.staffInfo[username]) { errEl.textContent = 'Username already exists.'; return; }
  if (!state.staffInfo) state.staffInfo = {};
  var existing = state.staffInfo[username] || {};
  state.staffInfo[username] = Object.assign({}, existing, { name: name, role: role, team: team, active: existing.active !== false });
  if (empNo)  state.staffInfo[username].empNo  = empNo;
  if (gender) state.staffInfo[username].gender = gender;
  if (dob)    state.staffInfo[username].dob    = dob;
  if (phone)  state.staffInfo[username].phone  = phone;
  // Sync to state.users
  var uIdx = -1;
  for (var i = 0; i < state.users.length; i++) { if (state.users[i].username === username) { uIdx = i; break; } }
  if (uIdx >= 0) {
    state.users[uIdx].name = name;
    state.users[uIdx].role = role;
    state.users[uIdx].team = team;
    if (empNo)  state.users[uIdx].empNo  = empNo;
    if (gender) state.users[uIdx].gender = gender;
    if (dob)    state.users[uIdx].dob    = dob;
    if (phone)  state.users[uIdx].phone  = phone;
  } else {
    var h = 0;
    for (var ci = 0; ci < username.length; ci++) { h = ((h << 5) - h) + username.charCodeAt(ci); h |= 0; }
    state.users.push({ id: Math.abs(h), username: username, name: name, role: role, team: team,
      empNo: empNo, gender: gender, dob: dob, phone: phone, active: true });
  }
  syncPush();
  closeModal('modal-staff-info');
  nav('staff');
}

function deleteStaffInfo(username) {
  if (!username || !state.staffInfo[username]) return;
  var uName = state.staffInfo[username].name || username;
  if (!confirm('Delete ' + uName + '? Their break and attendance records are kept.')) return;
  delete state.staffInfo[username];
  for (var i = 0; i < state.users.length; i++) {
    if (state.users[i].username === username) { state.users.splice(i, 1); break; }
  }
  syncPush();
  nav('staff');
}

// Variable to hold the parsed preview data before final confirmation
let _tempImportedUsers = [];

// Builds the compact break-split sliders shown in the import flow.
// Shifts with a saved custom % show it pre-loaded; others default to 50.
// Sliders are only persisted when the user drags them (data-dirty flag).
function _buildImportSplitHTML(shiftsInData) {
  const rows = VISIBLE_SHIFTS.filter(s => shiftsInData.has(s)).map(shift => {
    const slots  = BREAK_SLOTS[shift] || [];
    const saved  = getBreakSplitPct(shift);
    const pct1   = saved !== null ? saved : 50;
    const pct2   = 100 - pct1;
    const isCustom = saved !== null;
    return `
<div style="margin-bottom:12px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <span style="font-size:12px;font-weight:700;">Shift ${shift}</span>
    <span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600;
      background:${isCustom ? 'var(--accent)' : 'var(--bg3)'};
      color:${isCustom ? '#fff' : 'var(--text3)'};">
      ${isCustom ? `Custom ${pct1}%/${pct2}%` : 'Default (50/50 rotation)'}
    </span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-size:10px;color:var(--text2);min-width:90px;white-space:nowrap;">${shift}1 ${slots[0] || ''}</span>
    <input type="range" id="import-split-slider-${shift}" min="0" max="100" step="1" value="${pct1}"
      style="flex:1;accent-color:var(--accent);"
      oninput="onImportSplitSlide('${shift}',this.value)">
    <span style="font-size:10px;color:var(--text2);min-width:90px;text-align:right;white-space:nowrap;">${shift}2 ${slots[1] || ''}</span>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:2px;">
    <span id="import-split-lbl-${shift}-1" style="font-size:12px;font-weight:700;color:var(--accent);">${pct1}%</span>
    <span id="import-split-lbl-${shift}-2" style="font-size:12px;font-weight:700;color:var(--accent);">${pct2}%</span>
  </div>
</div>`;
  }).join('');

  if (!rows) return '';
  return `
<div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px;background:var(--bg2);">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:10px;font-family:'IBM Plex Mono',monospace;">
    Break Distribution
  </div>
  <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.6;">
    Drag a slider to change the group size ratio for a shift. Rotation still applies — groups swap slots each week. Changes are saved for future imports.
    Full settings: <b>Arrange Breaks → 📐 Break Split</b>.
  </div>
  ${rows}
</div>`;
}

function onImportSplitSlide(shift, rawVal) {
  const pct1 = parseInt(rawVal);
  const pct2 = 100 - pct1;
  const lbl1 = document.getElementById(`import-split-lbl-${shift}-1`);
  const lbl2 = document.getElementById(`import-split-lbl-${shift}-2`);
  if (lbl1) lbl1.textContent = `${pct1}%`;
  if (lbl2) lbl2.textContent = `${pct2}%`;
  const slider = document.getElementById(`import-split-slider-${shift}`);
  if (slider) slider.dataset.dirty = 'true';
}

function importFromPaste() {
  const pasteArea = document.getElementById('paste-area');
  const statusEl = document.getElementById('paste-status');
  const previewSection = document.getElementById('sched-preview-section');
  const previewList = document.getElementById('sched-preview-list');
  const previewCount = document.getElementById('sched-preview-count');

  if (!pasteArea || !pasteArea.value.trim()) {
    statusEl.innerHTML = '<span style="color:var(--err);">⚠ Paste data from Sheets first.</span>';
    return;
  }

  const lines = pasteArea.value.trim().split('\n');
  const header = lines[0].split('\t');

  // Identify date columns starting specifically from column 5
  const dateCols = [];
  header.forEach((h, i) => {
    if (h.match(/^\d{1,2}\/\d{1,2}$/)) {
      dateCols.push({ index: i, dateKey: h });
    }
  });

  _tempImportedUsers = [];
  lines.slice(1).forEach(line => {
    const cols = line.split('\t');
    if (cols.length < 5) return;

    const username = cols[3]?.trim().toLowerCase() || '';
// Generate stable ID from username (same hash used elsewhere in codebase)
const _stableId = (uname) => {
  let h = 0;
  for (let i = 0; i < uname.length; i++) h = (Math.imul(31, h) + uname.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const user = {
  id: _stableId(username),
  team: cols[1]?.trim() || '—',
  name: cols[2]?.trim() || '—',
  username,
  role: cols[4]?.trim() || '—',
  schedule: {}
};

    if (!user.username) return;

    dateCols.forEach(col => {
      // Capture the exact shift code (A, D, E, 0) from the mapped column
      user.schedule[col.dateKey] = cols[col.index]?.trim().toUpperCase() || '0';
    });

    _tempImportedUsers.push(user);
  });

  // 3. Render Table Preview (Mirrors Screenshot 1)
  previewCount.textContent = _tempImportedUsers.length;

  const tableHeader = `
    <tr style="background:var(--bg3); position:sticky; top:0; z-index:10;">
      <th style="padding:8px; border:1px solid var(--border);">No.</th>
      <th style="padding:8px; border:1px solid var(--border);">Group</th>
      <th style="padding:8px; border:1px solid var(--border); min-width:150px;">NAME</th>
      <th style="padding:8px; border:1px solid var(--border);">Username</th>
      <th style="padding:8px; border:1px solid var(--border);">Roles</th>
      ${dateCols.map(d => `<th style="padding:4px; border:1px solid var(--border); min-width:40px; color:var(--accent);">${d.dateKey}</th>`).join('')}
    </tr>`;

  const tableRows = _tempImportedUsers.map((u, i) => `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:6px; border:1px solid var(--border); text-align:center;">${i + 1}</td>
      <td style="padding:6px; border:1px solid var(--border); text-align:center;">${u.team}</td>
      <td style="padding:6px; border:1px solid var(--border); font-weight:600;">${u.name}</td>
      <td style="padding:6px; border:1px solid var(--border); color:var(--accent); font-family:monospace;">${u.username}</td>
      <td style="padding:6px; border:1px solid var(--border); font-size:10px;">${_resolveRole(u.role)}</td>
      ${dateCols.map(d => {
    const shift = u.schedule[d.dateKey] || '0';
    let colorStyle = "";

    // Apply specific styles for each shift type
    if (shift === 'D') colorStyle = "background:#fecaca; color:#b91c1c;"; // Red
    else if (shift === 'A') colorStyle = "background:#fef08a; color:#a16207;"; // Yellow
    else if (shift === 'E') colorStyle = "background:#d8b4fe; color:#6b21a8;"; // Purple for Shift E
    else if (shift === '0') colorStyle = "background:white; color:#9ca3af;"; // Day off

    return `<td style="padding:4px; border:1px solid var(--border); text-align:center; font-weight:bold; ${colorStyle}">${shift}</td>`;
  }).join('')}
    </tr>`).join('');

  previewList.innerHTML = `
    <div style="overflow-x:auto; max-height:400px; border:1px solid var(--border); border-radius:8px;">
      <table style="width:max-content; border-collapse:collapse; background:white; text-align:left;">
        <thead>${tableHeader}</thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  // Collect which shifts appear in this import to show relevant sliders
  const shiftsInData = new Set();
  _tempImportedUsers.forEach(u => {
    Object.values(u.schedule).forEach(s => { if (VISIBLE_SHIFTS.includes(s)) shiftsInData.add(s); });
  });
  const splitPanel = document.getElementById('import-split-panel');
  if (splitPanel) splitPanel.innerHTML = _buildImportSplitHTML(shiftsInData);

  statusEl.innerHTML = '<span style="color:var(--ok);">✓ Data parsed successfully.</span>';
  previewSection.style.display = 'block';
}

async function confirmScheduleImport() {
  if (_tempImportedUsers.length === 0) return;

  // Save any split slider adjustments made in the import flow
  VISIBLE_SHIFTS.forEach(shift => {
    const slider = document.getElementById(`import-split-slider-${shift}`);
    if (slider && slider.dataset.dirty === 'true') {
      setBreakSplitPct(shift, parseInt(slider.value));
    }
  });

  // 1. Save the parsed users to state; extract schedule into staffSchedule
  if (!state.staffSchedule) state.staffSchedule = {};
  _tempImportedUsers.forEach(function(u) {
    if (u.username && u.schedule) state.staffSchedule[u.username] = u.schedule;
  });
  state.users = _tempImportedUsers.map(function(u) {
    return { id: u.id, username: u.username, name: u.name, team: u.team, role: u.role, gender: u.gender || '' };
  });
  state._usersUpdatedAt = Date.now();

  // 2. TRIGGER THE AUTO-ASSIGN LOGIC
  console.log("Starting Auto-Assignment...");
  const result = autoAssignBreaks(state.users);
  console.log(`Auto-assign complete: ${result.assigned} breaks set across ${result.weekCount} weeks.`);

  // 3. Save to LocalStorage and Sync to Cloud
  save();
  if (typeof syncWrite === 'function') await syncWrite();

  toast(`Imported ${state.users.length} staff. Auto-assigned ${result.assigned} breaks.`, 'ok');

  // 4. Refresh UI
  document.getElementById('sched-preview-section').style.display = 'none';
  nav('staff');
}
// ── Sub-tab 2: Staff Schedule ──
function _renderStaffSchedule() {
  // DA/DS/Sr DA/Sr DS: default to their working shift; force week view (no full-month for non-leaders)
  var _isNonLeader = !isLeader(currentUser) && !isTraining(currentUser);
  if (_isNonLeader) {
    if (_ssShiftFilter === 'All') _ssShiftFilter = currentShift || 'A';
    showFullMonth = false; // non-leaders always see week view
  }
  const hasUsers = state.users && state.users.length > 0;

  if (!hasUsers) {
    return `
<div class="empty" style="padding:48px 0;">
  <div class="empty-ico">📋</div>
  <div>No schedule data available.</div>
  <div style="font-size:12px;color:var(--text3);margin-top:6px;">Schedule is synced automatically from Google Sheets each morning.</div>
</div>`;
  }

  // Collect available months across all schedule data (fast: only MM strings)
  var _allMonthSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) {
      if (/^\d{2}\/\d{2}$/.test(k)) _allMonthSet[k.split('/')[1]] = 1;
    });
  });
  var availableMonths = Object.keys(_allMonthSet).sort();

  // Auto-init or validate _schedMonth before restricting date collection
  if (!_schedMonth || !availableMonths.includes(_schedMonth)) {
    var _activeMM0 = _ssActiveMonday.split('/')[1];
    _schedMonth = availableMonths.includes(_activeMM0) ? _activeMM0 : (availableMonths[availableMonths.length - 1] || _activeMM0);
  }

  // Collect dates ONLY for the selected month (avoids iterating all months for every render)
  var _sdSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) {
      if (/^\d{2}\/\d{2}$/.test(k) && k.split('/')[1] === _schedMonth) _sdSet[k] = 1;
    });
  });
  const allDates = Object.keys(_sdSet).sort(function(a, b) {
    var da = parseInt(a.split('/')[0]), ma = parseInt(a.split('/')[1]);
    var db = parseInt(b.split('/')[0]), mb = parseInt(b.split('/')[1]);
    return ma !== mb ? ma - mb : da - db;
  });

  const hasImportedDates = allDates.length > 0;

  var _currTrn = isTraining(currentUser);
  const filteredUsers = state.users.filter(u => {
    var _effR    = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _roleStr = (_resolveRole(_effR) || '').toLowerCase();
    var _teamCh  = (u.team || '').toUpperCase().charAt(0);
    var _isTrn   = isTraining(u) || _roleStr.includes('training') || _teamCh === 'T';
    if (!_currTrn && _isTrn) return false;   // lead/sub: hide training users
    var _sq = (staffFilters.search || '').toLowerCase();
    if (!_sq) return true;
    return (u.team || '').toLowerCase().includes(_sq) ||
      (u.name || '').toLowerCase().includes(_sq) ||
      (u.username || '').toLowerCase().includes(_sq) ||
      _roleStr.includes(_sq);
  });

  var _stickyTh = 'background:var(--bg3);position:sticky;z-index:20;top:0;';
  var _shadowR   = 'box-shadow:3px 0 6px rgba(0,0,0,.12);';

  var _searchBar = '<input class="filter-input" style="width:200px;" placeholder="Search group, name, user, role…" value="' + (staffFilters.search || '') + '" oninput="staffFilters.search=this.value;_liveFilter()">';

  const _schedTbl = function(displayDates, shiftFilteredUsers) {
    var _tblUsers = _sortStaffUsers(shiftFilteredUsers || filteredUsers);
    return `<div class="staff-tbl-wrap">
  <table>
    <thead>
      <tr>
        <th style="${_stickyTh}left:0;min-width:60px;width:60px;">GROUP</th>
        <th style="${_stickyTh}left:60px;min-width:200px;width:200px;">FULL NAME</th>
        <th style="${_stickyTh}left:260px;min-width:130px;width:130px;">USER</th>
        <th style="${_stickyTh}left:390px;min-width:140px;width:140px;${_shadowR}">POSITION</th>
        ${displayDates.map(function(d) { return '<th class="c" style="min-width:42px;padding:6px 2px;">' +
          '<div style="color:var(--accent);font-size:11px;">' + d + '</div>' +
          '<div style="font-size:8px;font-weight:400;opacity:.5;margin-top:2px;">' + getWkDay(d) + '</div>' +
          '</th>'; }).join('')}
      </tr>
    </thead>
    <tbody id="staff-tbody">${renderStaffRows(_tblUsers, displayDates)}</tbody>
  </table>
</div>`;
  };

  var _shiftPicker = '<select class="login-select" style="width:120px;padding:4px 8px;font-size:11px;" onchange="_ssShiftFilter=this.value;nav(\'staff\')">' +
    ['All','A','D','E'].map(function(s) { return '<option value="' + s + '"' + (_ssShiftFilter === s ? ' selected' : '') + '>' + (s === 'All' ? 'All shifts' : 'Shift ' + s) + '</option>'; }).join('') +
    '</select>';

  var _ssCanSwap = !isLeader(currentUser) && !isTraining(currentUser);
  var _dosSwapBtn = _ssCanSwap ? '<button class="btn btn-sm" onclick="openDayoffSwapModal(null)" style="font-size:11px;">↔ Day-off Swap</button>' : '';

  if (!hasImportedDates) {
    var _wkDates = getWeekRange(_ssActiveMonday);
    var _wkFiltered = _ssShiftFilter === 'All' ? filteredUsers : filteredUsers.filter(function(u) {
      return _wkDates.some(function(d) { return _getSched(u.username, d) === _ssShiftFilter; });
    });
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
  ${_searchBar}
  <div style="width:1px;height:20px;background:var(--border);"></div>
  <span style="font-size:11px;color:var(--text3);">Current week</span>
  ${_shiftPicker}
  ${_dosSwapBtn}
  <span style="font-size:11px;color:var(--text3);margin-left:auto;">${_wkFiltered.length} staff</span>
</div>
${_schedTbl(_wkDates, _wkFiltered)}`;
  }

  // Snap _ssActiveMonday to selected month if it drifted
  if (_ssActiveMonday.split('/')[1] !== _schedMonth) {
    var _firstMon = _sortDateKeys(allDates.filter(function(d) { return getWkDay(d) === 'Mon' && d.split('/')[1] === _schedMonth; }))[0];
    if (_firstMon) _ssActiveMonday = _firstMon;
  }

  const monthMondays = _sortDateKeys(allDates.filter(function(d) { return getWkDay(d) === 'Mon' && d.split('/')[1] === _schedMonth; }));
  // Clip week range to selected month so it never leaks into adjacent months
  const weekRange = getWeekRange(_ssActiveMonday).filter(function(d) { return d.split('/')[1] === _schedMonth; });
  const monthDates = _sortDateKeys(allDates.filter(d => /\d{2}\/\d{2}/.test(d) && d.split('/')[1] === _schedMonth));
  const displayDates = showFullMonth ? monthDates : weekRange;

  var _sfDates = showFullMonth ? monthDates : weekRange;
  var _displayUsers = _ssShiftFilter === 'All' ? filteredUsers : filteredUsers.filter(function(u) {
    return _sfDates.some(function(d) { return _getSched(u.username, d) === _ssShiftFilter; });
  });

  const MONTH_LABELS = {'01':'January','02':'February','03':'March','04':'April','05':'May','06':'June',
    '07':'July','08':'August','09':'September','10':'October','11':'November','12':'December'};

  // Month picker: for non-leaders switching months stays in week view
  var _monthPickerChange = _isNonLeader ? '_schedMonth=this.value;nav(\'staff\')' : '_schedMonth=this.value;showFullMonth=true;nav(\'staff\')';

  return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
  ${_searchBar}
  <div style="width:1px;height:20px;background:var(--border);"></div>
  ${!_isNonLeader ? `<button class="toggle-btn ${showFullMonth ? 'active' : ''}" onclick="showFullMonth=!showFullMonth;nav('staff')" style="font-size:11px;">
    ${showFullMonth ? '🗓 Week view' : '🗓 Full month'}
  </button>` : ''}
  <select class="login-select" style="width:130px;padding:4px;" onchange="${_monthPickerChange}">
    ${availableMonths.map(m => `<option value="${m}" ${m === _schedMonth ? 'selected' : ''}>${MONTH_LABELS[m] || m}</option>`).join('')}
  </select>
  ${!showFullMonth ? `<select class="login-select" style="width:160px;padding:4px;" onchange="_ssActiveMonday=this.value;nav('staff')">
    ${monthMondays.map(function(mon) {
      var end = getWeekRange(mon).filter(function(d){return d.split('/')[1]===_schedMonth;}).pop() || mon;
      return '<option value="' + mon + '"' + (mon === _ssActiveMonday ? ' selected' : '') + '>' + mon + ' – ' + end + '</option>';
    }).join('')}
  </select>` : ''}
  ${_shiftPicker}
  ${_dosSwapBtn}
  <span style="font-size:11px;color:var(--text3);margin-left:auto;">${_displayUsers.length} staff</span>
</div>
${_schedTbl(displayDates, _displayUsers)}`;
}

// nav('staff') preserving scroll position so fill/clear ops don't jump to top
function _navStaff() {
  var wrap = document.getElementById('sa-table-wrap');
  var wrapTop = wrap ? wrap.scrollTop : 0;
  var sc = document.getElementById('main-content');
  var top = sc ? sc.scrollTop : window.pageYOffset;
  nav('staff');
  var newWrap = document.getElementById('sa-table-wrap');
  if (newWrap) newWrap.scrollTop = wrapTop;
  if (sc) sc.scrollTop = top; else window.scrollTo(0, top);
}

var _attNow = new Date();
let _attImportMonth = _attNow.getDate() >= 25
  ? (_attNow.getMonth() === 11 ? 1 : _attNow.getMonth() + 2)
  : _attNow.getMonth() + 1;
let _attImportYear = (_attNow.getDate() >= 25 && _attNow.getMonth() === 11)
  ? _attNow.getFullYear() + 1
  : _attNow.getFullYear();
let _staffAttConflictFilter = false;
let _saShiftFilter = 'All';
var _saDateFilter = '';
let _saFillCode = 'XA';
var _saFilteredUsernames = [];
var _saCurrentDates = [];
var _saCurrentMonthKey = '';
var _attCopiedCode = '';
var _staffAttUndoStack = [];

function _staffAttSnapshot() {
  var snap = [];
  _saFilteredUsernames.forEach(function(username) {
    var d = DB.getMonthlyAtt(username, _saCurrentMonthKey);
    snap.push({ username: username, monthKey: _saCurrentMonthKey, data: Object.assign({}, d) });
  });
  return snap;
}

function undoClearAtt() {
  if (!_staffAttUndoStack.length) return;
  var snap = _staffAttUndoStack.pop();
  snap.forEach(function(entry) { DB.setMonthlyAtt(entry.username, entry.monthKey, entry.data); });
  syncWrite();
  _navStaff();
}

function fillAttRow(username, monthKey) {
  if (!_saFillCode) return;
  var dates = _saCurrentDates.length ? _saCurrentDates : (function() {
    var y = parseInt(monthKey.split('-')[0]);
    var m = parseInt(monthKey.split('-')[1]);
    return _getAllDatesInMonth(y, m);
  })();
  var existing = Object.assign({}, DB.getMonthlyAtt(username, monthKey));
  var filled = 0;
  dates.forEach(function(dk) {
    if (existing[dk]) return;
    existing[dk] = _saFillCode;
    filled++;
  });
  if (filled === 0) return;
  DB.setMonthlyAtt(username, monthKey, existing);
  syncWrite();
  _navStaff();
}

function fillAttAll() {
  if (!_saCurrentMonthKey) return;
  var _fNow = new Date();
  var _fToday = (_fNow.getDate().toString().padStart(2,'0')) + '/' + ((_fNow.getMonth()+1).toString().padStart(2,'0'));
  _saFilteredUsernames.forEach(function(username) {
    var existing = Object.assign({}, DB.getMonthlyAtt(username, _saCurrentMonthKey));
    if (existing[_fToday]) return;
    var _fCode;
    if (_saShiftFilter !== 'All') {
      _fCode = 'X' + _saShiftFilter;
    } else {
      var sc = _getSched(username, _fToday);
      _fCode = (sc && sc !== '0') ? 'X' + sc : '';
    }
    if (!_fCode) return;
    existing[_fToday] = _fCode;
    DB.setMonthlyAtt(username, _saCurrentMonthKey, existing);
  });
  syncWrite();
  _navStaff();
}

function clearAttAll() {
  if (!_saCurrentMonthKey) return;
  _staffAttUndoStack.push(_staffAttSnapshot());
  var _cNow = new Date();
  var _cToday = (_cNow.getDate().toString().padStart(2,'0')) + '/' + ((_cNow.getMonth()+1).toString().padStart(2,'0'));
  _saFilteredUsernames.forEach(function(username) {
    var existing = Object.assign({}, DB.getMonthlyAtt(username, _saCurrentMonthKey));
    var cur = existing[_cToday];
    if (!cur) return;
    if (_saShiftFilter === 'All' && cur.charAt(0) !== 'X') return;
    delete existing[_cToday];
    DB.setMonthlyAtt(username, _saCurrentMonthKey, existing);
  });
  syncWrite();
  _navStaff();
}

var _attHoveredCell = null;
var _attKbdInstalled = false;

function _installAttKbd() {
  if (_attKbdInstalled) return;
  _attKbdInstalled = true;
  document.addEventListener('keydown', function(e) {
    var tag = (e.target || {}).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (!document.getElementById('sa-kbd-marker')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (!_staffAttUndoStack.length) return;
      e.preventDefault();
      undoClearAtt();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (!_attHoveredCell || !_attHoveredCell.code) return;
      e.preventDefault();
      _attCopiedCode = _attHoveredCell.code;
      _navStaff();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (!_attHoveredCell || !_attCopiedCode) return;
      e.preventDefault();
      var existing = Object.assign({}, DB.getMonthlyAtt(_attHoveredCell.username, _attHoveredCell.monthKey));
      existing[_attHoveredCell.dk] = _attCopiedCode;
      DB.setMonthlyAtt(_attHoveredCell.username, _attHoveredCell.monthKey, existing);
      syncWrite();
      _navStaff();
    }
    if (e.key === 'Escape' && _attCopiedCode) {
      _attCopiedCode = '';
      _navStaff();
    }
  });
}

function _attCellModalHTML() {
  return '<div id="modal-att-cell" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-att-cell\')">' +
    '<div class="modal" style="width:380px;">' +
      '<div class="modal-title" id="att-cell-modal-title">Edit Attendance</div>' +
      '<div id="att-cell-code-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:14px 0;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:4px;">' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-sm" style="color:var(--err);border-color:var(--err);" onclick="clearAttCell()">Clear</button>' +
          '<button class="btn btn-sm" title="Copy code for quick paste" onclick="_attCopiedCode=_attCellSelected;closeModal(\'modal-att-cell\');_navStaff()">Copy</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-sm" onclick="closeModal(\'modal-att-cell\')">Cancel</button>' +
          '<button class="btn btn-accent btn-sm" onclick="saveAttCell()">Save</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

var _attCellTarget = null;
var _attCellSelected = '';

function openAttCellModal(username, monthKey, dk) {
  if (!document.getElementById('modal-att-cell')) {
    document.body.insertAdjacentHTML('beforeend', _attCellModalHTML());
  }
  _attCellTarget = { username: username, monthKey: monthKey, dk: dk };
  var existing = (DB.getMonthlyAtt(username, monthKey) || {})[dk] || '';
  _attCellSelected = existing;
  var uObj = state.users.find(function(x) { return x.username === username; });
  var uName = uObj ? uObj.name : username;
  document.getElementById('att-cell-modal-title').textContent = 'Edit ' + dk + ' — ' + uName;
  var allCodes = ['XA','XD','XE','A1','A2','D1','D2','E1','E2','A','H','0','U','S','L'];
  var grid = document.getElementById('att-cell-code-grid');
  grid.innerHTML = allCodes.map(function(c) {
    var isActive = c === existing;
    return '<button class="btn btn-sm' + (isActive ? ' btn-accent' : '') + '" ' +
      'onclick="document.querySelectorAll(\'#att-cell-code-grid .btn\').forEach(function(b){b.classList.remove(\'btn-accent\');});this.classList.add(\'btn-accent\');_attCellSelected=\'' + c + '\'">' +
      c + '</button>';
  }).join('');
  document.getElementById('modal-att-cell').classList.add('show');
}

function saveAttCell() {
  if (!_attCellTarget || !_attCellSelected) return;
  var t = _attCellTarget;
  var existing = Object.assign({}, DB.getMonthlyAtt(t.username, t.monthKey));
  existing[t.dk] = _attCellSelected;
  DB.setMonthlyAtt(t.username, t.monthKey, existing);
  syncWrite();
  closeModal('modal-att-cell');
  _navStaff();
}

function clearAttCell() {
  if (!_attCellTarget) return;
  var t = _attCellTarget;
  var existing = Object.assign({}, DB.getMonthlyAtt(t.username, t.monthKey));
  delete existing[t.dk];
  DB.setMonthlyAtt(t.username, t.monthKey, existing);
  syncWrite();
  closeModal('modal-att-cell');
  _navStaff();
}

function attCellClick(username, monthKey, dk) {
  if (!_attCopiedCode) {
    openAttCellModal(username, monthKey, dk);
    return;
  }
  var existing = Object.assign({}, DB.getMonthlyAtt(username, monthKey));
  existing[dk] = _attCopiedCode;
  DB.setMonthlyAtt(username, monthKey, existing);
  syncWrite();
  _navStaff();
}

function _renderStaffAttendance() {
  const year = _attImportYear;
  const month = _attImportMonth;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const monthLabel = `${new Date(prevYear, prevMonth - 1, 25).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(year, month - 1, 24).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  // Generate Mon–Sun week containing today.
  // When today is Sunday (dow=0), treat it as day 7 → Monday is tomorrow.
  var allDates = _getAllDatesInMonth(year, month);
  const dates = (_saDateFilter && allDates.indexOf(_saDateFilter) !== -1) ? [_saDateFilter] : allDates;
  const attData = state.monthlyAttendance || {};

  const monthPicker = `
      <select class="login-select" style="padding:5px 8px;font-size:12px;width:110px;"
        onchange="_attImportMonth=+this.value;_saDateFilter='';_navStaff()">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m =>
    `<option value="${m}" ${m === month ? 'selected' : ''}>${new Date(year, m - 1, 1)
      .toLocaleString('en-US', { month: 'long' })}</option>`
  ).join('')}
      </select>
      <select class="login-select" style="padding:5px 8px;font-size:12px;width:70px;"
        onchange="_attImportYear=+this.value;_saDateFilter='';_navStaff()">
        ${[2024, 2025, 2026, 2027].map(y =>
    `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
  ).join('')}
      </select>`;

  // ── FIX: check monthlyAttendance directly, not through state.users ──
  const hasData = Object.values(attData).some(userMonths => {
    const ud = userMonths?.[monthKey];
    return ud && Object.keys(ud).length > 0;
  });

  if (!hasData) {
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        ${monthPicker}
      </div>
      <div class="empty" style="padding:48px;">
        <div class="empty-ico">📋</div>
        No attendance data for ${monthLabel}.
      </div>`;
  }

  // Legend
  const legendHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;margin-bottom:10px;align-items:center;">
      <span style="background:var(--C-bg);color:var(--ok);padding:2px 8px;border-radius:4px;font-weight:500;">XA–XE</span> Working
      <span style="background:rgba(167,139,250,.14);color:#a78bfa;padding:2px 8px;border-radius:4px;font-weight:500;">D1/D2</span> Half day
      <span style="color:var(--text3);font-size:10px;margin:0 2px;">│</span>
      <span style="background:rgba(234,179,8,.13);color:#ca8a04;padding:2px 7px;border-radius:4px;font-weight:600;">A</span> Annual
      <span style="background:rgba(220,38,38,.13);color:#dc2626;padding:2px 7px;border-radius:4px;font-weight:600;">H</span> Holiday
      <span style="background:rgba(22,163,74,.13);color:#16a34a;padding:2px 7px;border-radius:4px;font-weight:600;">0</span> Day off
      <span style="background:rgba(225,29,72,.12);color:#e11d48;padding:2px 7px;border-radius:4px;font-weight:600;">U</span> Unpaid
      <span style="background:rgba(234,88,12,.12);color:#ea580c;padding:2px 7px;border-radius:4px;font-weight:600;">S</span> Sick
      <span style="background:rgba(99,102,241,.13);color:#6366f1;padding:2px 7px;border-radius:4px;font-weight:600;">L</span> Personal
      <span style="color:var(--text3);font-size:10px;margin:0 2px;">│</span>
      <span style="background:var(--D-bg);color:var(--err);padding:2px 8px;border-radius:4px;font-weight:700;border:1.5px solid var(--err);">⚠</span> Conflict
    </div>`;

  // Build table header dates — each column has A/D/E shift filter buttons
  const WDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var _shiftColors = { A: '#10b981', D: '#3b82f6', E: '#a855f7' };
  const theadDates = dates.map(dk => {
    const [_d, _m] = dk.split('/');
    const _cy = (parseInt(_m) === month) ? year : (month === 1 ? year - 1 : year);
    const dow = new Date(_cy, parseInt(_m) - 1, parseInt(_d)).getDay();
    const isWknd = dow === 0 || dow === 6;
    const isSun = dow === 0;
    var _isDayActive = _saDateFilter === dk;
    var _shiftBtns = ['A','D','E'].map(function(s) {
      var _isActive = _isDayActive && _saShiftFilter === s;
      var _col = _shiftColors[s];
      return '<span onclick="' +
        (_isActive
          ? '_saDateFilter=\'\';_saShiftFilter=\'All\';_navStaff()'
          : '_saDateFilter=\'' + dk + '\';_saShiftFilter=\'' + s + '\';_navStaff()') +
        '" style="display:inline-flex;align-items:center;justify-content:center;' +
        'width:14px;height:14px;border-radius:3px;font-size:8px;font-weight:700;cursor:pointer;' +
        'border:1px solid ' + (_isActive ? _col : 'var(--border)') + ';' +
        'background:' + (_isActive ? _col : 'transparent') + ';' +
        'color:' + (_isActive ? '#fff' : 'var(--text3)') + ';' +
        'transition:all .1s;"' +
        ' onmouseover="this.style.borderColor=\'' + _col + '\';this.style.color=\'' + (_isActive ? '#fff' : _col) + '\'"' +
        ' onmouseout="this.style.borderColor=\'' + (_isActive ? _col : 'var(--border)') + '\';this.style.color=\'' + (_isActive ? '#fff' : 'var(--text3)') + '\'"' +
        '>' + s + '</span>';
    }).join('');
    return '<th style="min-width:46px;padding:4px 2px 4px;text-align:center;' +
      'font-size:10px;font-weight:600;' +
      'color:' + (isSun ? 'var(--err)' : isWknd ? 'var(--warn)' : 'var(--text2)') + ';' +
      'background:' + (_isDayActive ? 'rgba(31,102,241,.06)' : isWknd ? 'var(--bg4)' : 'var(--bg3)') + ';' +
      'border-bottom:2px solid ' + (_isDayActive ? 'var(--accent)' : isSun ? 'var(--err)' : isWknd ? 'var(--border2)' : 'var(--accent)') + ';' +
      'border-left:' + (isSun ? '2px solid var(--border)' : 'none') + ';' +
      'position:sticky;top:0;z-index:2;white-space:nowrap;">' +
      '<div style="font-size:9px;' + (isWknd ? '' : 'opacity:.65;') + 'line-height:1.4;">' + WDAY_SHORT[dow] + '</div>' +
      '<div style="font-size:11px;line-height:1.3;letter-spacing:-.3px;">' + _d + '/<span style="font-size:9px;opacity:.7;">' + _m + '</span></div>' +
      '<div style="display:flex;justify-content:center;gap:2px;margin-top:4px;">' + _shiftBtns + '</div>' +
      '</th>';
  }).join('');

  // ── FIX: build rows from attData keys, not state.users ──
  const attUsernames = Object.keys(attData).filter(uname => {
    const ud = attData[uname]?.[monthKey];
    return ud && Object.keys(ud).length > 0;
  });

  // Build empNo lookup from policyCompliance records (covers users missing empNo in users array)
  var _pcEmpNo = {};
  (state.policyCompliance || []).forEach(function(r) {
    if (r.username && r.empNo && !_pcEmpNo[r.username]) _pcEmpNo[r.username] = r.empNo;
  });

  var _attTier = function(role) {
    var r = (_resolveRole(role) || '').toLowerCase();
    if (r === 'training manager') return 0;
    if (r.includes('training')) return 1;
    if (r === 'd.a leader' || r === 'leader') return 2;
    if (r === 'd.a supervisor' || r === 'supervisor') return 3;
    if (r === 'sr data supervisor' || r === 'sr qa') return 4;
    if (r === 'data supervisor' || r === 'qa') return 5;
    if (r === 'sr data analyst' || r === 'sr agent') return 6;
    if (r === 'data analyst' || r === 'agent') return 7;
    return 8;
  };
  const rowUsers = attUsernames.map(uname => {
    const si = state.staffInfo?.[uname];
    const siEmpNo = (si && si.empNo) || _pcEmpNo[uname] || '';
    const fu = state.users.find(u => u.username === uname);
    if (fu) return Object.assign({}, fu, { empNo: fu.empNo || siEmpNo });
    return si ? { username: uname, name: si.name || uname, role: si.role || '', team: si.team || '', empNo: siEmpNo, id: null } : null;
  }).filter(Boolean).sort((a, b) => _roleSort(a, b));

  // Pre-compute conflicts per user (needed for filter + total count)
  const _preConflicts = {};
  for (const u of rowUsers) {
    const uAtt = attData[u.username]?.[monthKey] || {};
    const uc = [];
    for (const dk of dates) {
      const rawCode = uAtt[dk];
      if (!rawCode && !_parseAttCode(rawCode)) continue;
      const cl = _checkAttConflict(u, dk, _parseAttCode(rawCode));
      if (cl && cl.length > 0) uc.push({ dk, msgs: cl });
    }
    _preConflicts[u.username] = uc;
  }

  const totalConflicts = rowUsers.filter(u => _preConflicts[u.username]?.length > 0).length;
  let filteredUsers = _staffAttConflictFilter
    ? rowUsers.filter(u => _preConflicts[u.username]?.length > 0)
    : rowUsers;
  if (_saShiftFilter !== 'All') {
    filteredUsers = filteredUsers.filter(u => {
      return dates.some(dk => _getSched(u.username, dk) === _saShiftFilter);
    });
  }
  filteredUsers = _sortStaffUsers(filteredUsers);

  var _shColors = {
    A: ['rgba(14,165,233,.14)','#0ea5e9'],
    B: ['rgba(14,165,233,.14)','#0ea5e9'],
    C: ['rgba(14,165,233,.14)','#0ea5e9'],
    D: ['rgba(14,165,233,.14)','#0ea5e9'],
    E: ['rgba(14,165,233,.14)','#0ea5e9']
  };
  var _hdColor = ['rgba(167,139,250,.14)','#a78bfa'];
  var _offColors = {
    'A': ['rgba(234,179,8,.13)',  '#ca8a04'],
    'H': ['rgba(220,38,38,.13)', '#dc2626'],
    '0': ['rgba(22,163,74,.13)', '#16a34a'],
    'U': ['rgba(225,29,72,.12)', '#e11d48'],
    'S': ['rgba(234,88,12,.12)', '#ea580c'],
    'L': ['rgba(99,102,241,.13)', '#6366f1']
  };

  const tbodyRows = filteredUsers.map(u => {
    const uAtt = attData[u.username]?.[monthKey] || {};
    const conflicts = _preConflicts[u.username] || [];
    var _uEffRoleForConflict = _resolveRole(u.role || (state.staffInfo[u.username]||{}).role || '') || '';
    var _uIsTraining = (ROLES[_uEffRoleForConflict]||{}).level === 3;

    const cells = dates.map(dk => {
      const rawCode = uAtt[dk];
      const parsed = _parseAttCode(rawCode);
      const [_dd, _mm] = dk.split('/');
      const _cellYear = (parseInt(_mm) === month) ? year : (month === 1 ? year - 1 : year);
      const dow = new Date(_cellYear, parseInt(_mm) - 1, parseInt(_dd)).getDay();
      const isWknd = dow === 0 || dow === 6;

      if (!rawCode && !parsed) {
        return `<td style="text-align:center;padding:2px 1px;background:${isWknd ? 'var(--bg4)' : ''};cursor:pointer;"
          onclick="attCellClick('${u.username}','${monthKey}','${dk}')"
          onmouseover="_attHoveredCell={username:'${u.username}',monthKey:'${monthKey}',dk:'${dk}',code:''}">
          <span style="font-size:10px;color:var(--text3);">·</span></td>`;
      }

      const _preCell = conflicts.find(c => c.dk === dk);
      const conflictList = _preCell ? _preCell.msgs : null;
      const hasConflict = !_uIsTraining && !!_preCell;

      let bg = '', txt = '', color = '';
      if (!parsed) {
        txt = rawCode || '?'; color = 'color:var(--text3);';
      } else if (parsed.type === 'OFF') {
        const code = String(rawCode).toUpperCase();
        txt = code === '0' || code === '0.0' ? '0' : code;
        const _oc = _offColors[code === '0.0' ? '0' : code] || ['var(--D-bg)', 'var(--err)'];
        bg = 'background:' + _oc[0] + ';';
        color = 'color:' + _oc[1] + ';font-weight:600;';
      } else if (parsed.type === 'HD1' || parsed.type === 'HD2') {
        bg = `background:${_hdColor[0]};`;
        color = `color:${_hdColor[1]};font-weight:600;`;
        txt = String(rawCode).toUpperCase();
      } else {
        const sh = (parsed.shift || '').toUpperCase();
        const sc = _shColors[sh];
        bg = sc ? `background:${sc[0]};` : 'background:rgba(74,222,128,.06);';
        color = sc ? `color:${sc[1]};font-weight:600;` : 'color:var(--ok);font-weight:500;';
        txt = parsed.shift || '✓';
      }
      if (hasConflict) {
        bg = 'background:rgba(248,113,113,.12);';
        color = 'color:var(--err);font-weight:700;';
      }

      const conflictBadge = hasConflict
        ? `<sup style="font-size:7px;position:relative;top:-1px;margin-left:1px;">⚠</sup>` : '';
      const dimWknd = false; // weekends are full contrast
      const title = conflictList ? conflictList.join(' | ') : (parsed?.reason || rawCode || '');

      var _conflictShift = _getSched(u.username, dk).charAt(0) || 'A';
      const conflictClick = hasConflict ? `
        onclick="
          const [_d,_m]='${dk}'.split('/');
          const _cy=${year};
          const _dt=new Date(_cy,parseInt(_m)-1,parseInt(_d));
          const _day=_dt.getDay();
          const _sun=new Date(_dt);_sun.setDate(_dt.getDate()-_day);
          const _sdk=(_sun.getDate().toString().padStart(2,'0'))+'/'+((_sun.getMonth()+1).toString().padStart(2,'0'));
          window._attHighlight={uid:${u.id || 'null'},username:'${u.username}',dateKey:'${dk}'};
          attendanceTab='log';
          attendanceMonday=_sdk;
          currentShift='${_conflictShift}';
          _updateShiftPills();
          nav('attendance');
          setTimeout(()=>{
            const el=document.getElementById('att-cell-${u.username}-${dk}');
            if(el){el.scrollIntoView({behavior:'smooth',block:'center'});}
          },400);"
        style="cursor:pointer;"` : '';

      const hoverAttr = `onmouseover="_attHoveredCell={username:'${u.username}',monthKey:'${monthKey}',dk:'${dk}',code:'${(rawCode||'').replace(/'/g,"\\'")}'}"`;
      const cellInteract = hasConflict ? conflictClick
        : `onclick="attCellClick('${u.username}','${monthKey}','${dk}')" style="cursor:pointer;"`;
      return `<td style="text-align:center;padding:2px 2px;${bg}${dimWknd ? 'opacity:.55;' : ''}"
        title="${title}" ${hoverAttr} ${cellInteract}>
        <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;${color}">${txt}${conflictBadge}</span>
      </td>`;

    }).join('');

    const rowBg = conflicts.length ? 'background:rgba(248,113,113,.03);' : '';
    const stickyCell = 'position:sticky;z-index:1;background:var(--bg3);';
    var _saEffRole = u.role || (state.staffInfo[u.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===u.username;})||{}).role||'';
    return `<tr style="border-bottom:0.5px solid var(--border);${rowBg}">
      <td style="padding:5px 8px;white-space:nowrap;${stickyCell}left:0;min-width:92px;width:92px;font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${u.empNo || '—'}</td>
      <td style="padding:5px 10px;white-space:nowrap;${stickyCell}left:92px;min-width:165px;width:165px;border-left:1px solid var(--border);">
        <div style="font-size:12px;font-weight:600;">${u.name}</div>
      </td>
      <td style="padding:5px 8px;white-space:nowrap;${stickyCell}left:257px;min-width:145px;width:145px;border-left:1px solid var(--border);font-size:11px;color:${_roleColor(_saEffRole)};">${getRoleInfo(_saEffRole).label || _resolveRole(_saEffRole) || '—'}</td>
      ${cells}
    </tr>`;
  }).join('');

  const conflictBanner = totalConflicts > 0
    ? `<div style="padding:10px 14px;background:var(--D-bg);border:1px solid var(--err);
        border-radius:8px;font-size:12px;color:var(--err);margin-bottom:12px;font-weight:500;">
        ⚠ ${totalConflicts} staff with conflicts between monthly schedule and attendance log
      </div>`
    : `<div style="padding:8px 14px;background:var(--C-bg);border-radius:8px;
        font-size:12px;color:var(--ok);margin-bottom:12px;">
        ✓ No conflicts detected for ${monthLabel}
      </div>`;

  const conflictFilterBtn = `
    <button class="btn btn-sm" onclick="_staffAttConflictFilter=!_staffAttConflictFilter;nav('staff')"
      style="${_staffAttConflictFilter ? 'background:var(--err);color:#fff;border-color:var(--err);' : 'border-color:var(--err);color:var(--err);'}font-size:11px;">
      ⚠ Conflicts only${_staffAttConflictFilter ? ' ✕' : ''}
    </button>`;

  const datePicker = '<select class="login-select" style="padding:5px 8px;font-size:12px;width:90px;" onchange="_saDateFilter=this.value;_navStaff()">' +
    '<option value="">All dates</option>' +
    allDates.map(function(dk) {
      return '<option value="' + dk + '"' + (_saDateFilter === dk ? ' selected' : '') + '>' + dk + '</option>';
    }).join('') +
    '</select>';

  const shiftFilterPicker = `
    <select class="login-select" style="padding:5px 8px;font-size:12px;width:100px;"
      onchange="_saShiftFilter=this.value;_saDateFilter='';_navStaff()">
      <option value="All" ${_saShiftFilter==='All'?'selected':''}>All shifts</option>
      <option value="A" ${_saShiftFilter==='A'?'selected':''}>Shift A</option>
      <option value="D" ${_saShiftFilter==='D'?'selected':''}>Shift D</option>
      <option value="E" ${_saShiftFilter==='E'?'selected':''}>Shift E</option>
    </select>`;

  const codePicker = `<button class="btn btn-accent btn-sm" onclick="fillAttAll()" style="font-size:11px;">Fill All ↓</button>
    <button class="btn btn-sm" onclick="clearAttAll()" style="color:var(--err);border-color:var(--err);font-size:11px;">Clear ✕</button>
    <button class="btn btn-sm" onclick="undoClearAtt()" title="Undo last clear (Ctrl+Z)" style="font-size:11px;${!_staffAttUndoStack.length ? 'opacity:.35;cursor:not-allowed;' : ''}">↩ Undo</button>`;

  _saFilteredUsernames = filteredUsers.map(u => u.username);
  _saCurrentDates = dates;
  _saCurrentMonthKey = monthKey;
  _installAttKbd();

  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <span id="sa-kbd-marker" style="display:none;"></span>
      ${datePicker}
      ${monthPicker}
      ${codePicker}
      ${conflictFilterBtn}
      ${_attCopiedCode ? `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--accent);color:#fff;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">📋 ${_attCopiedCode} <button onclick="_attCopiedCode='';nav('staff')" style="background:none;border:none;color:#fff;cursor:pointer;padding:0;font-size:12px;line-height:1;">✕</button></span>` : ''}
      <span style="font-size:11px;color:var(--text3);margin-left:4px;">${filteredUsers.length} staff</span>
    </div>
    ${legendHTML}
    <div id="sa-table-wrap" style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 280px);border:1px solid var(--border);border-radius:8px;">
      <table style="border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);
              min-width:92px;width:92px;position:sticky;top:0;left:0;z-index:4;background:var(--bg3);
              border-bottom:2px solid var(--border2);">EMP NO.</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text2);
              min-width:165px;width:165px;position:sticky;top:0;left:92px;z-index:4;background:var(--bg3);
              border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">NAME</th>
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);
              min-width:145px;width:145px;position:sticky;top:0;left:257px;z-index:4;background:var(--bg3);
              border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">POSITION</th>
            ${theadDates}
          </tr>
        </thead>
        <tbody>${tbodyRows}</tbody>
      </table>
    </div>`;
}

function importMonthlyAttendance() {
  const fileInput = document.getElementById('att-import-file');
  const statusEl = document.getElementById('att-import-status');
  if (!fileInput?.files?.[0]) {
    statusEl.innerHTML = '<span style="color:var(--err);">Select a file first.</span>';
    return;
  }
  statusEl.innerHTML = '<span style="color:var(--text2);">Reading…</span>';

  const year = _attImportYear;
  const month = _attImportMonth;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      // Read WITHOUT cellDates — keep dates as raw serial numbers
      // This avoids all timezone issues with Date object local/UTC ambiguity
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

      if (!rows.length) {
        statusEl.innerHTML = '<span style="color:var(--err);">Empty file.</span>';
        return;
      }

      // Convert Excel serial number to DD/MM string
      // Excel serial: days since 1899-12-30 (with 1900 leap bug)
      // 46137 = 25/04/2026
      function serialToDk(serial) {
        if (!serial || typeof serial !== 'number') return null;
        if (serial < 40000 || serial > 60000) return null;
        // Use UTC to avoid ANY local timezone influence
        const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
        const dt = new Date(ms);
        const d = String(dt.getUTCDate()).padStart(2, '0');
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        return `${d}/${m}`;
      }

      // Parse date from header cell — handles serial numbers and strings
      function parseDateHeader(h) {
        if (h === null || h === undefined) return null;

        // Serial number (most common with raw:true)
        if (typeof h === 'number') return serialToDk(h);

        // String fallbacks
        if (typeof h === 'string') {
          const c = h.trim();
          // m/d/yyyy
          if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c)) {
            const [mo, day] = c.split('/');
            return String(parseInt(day)).padStart(2, '0') + '/' + String(parseInt(mo)).padStart(2, '0');
          }
          // dd/mm
          if (/^\d{1,2}\/\d{1,2}$/.test(c)) {
            const [d, m] = c.split('/');
            return String(parseInt(d)).padStart(2, '0') + '/' + String(parseInt(m)).padStart(2, '0');
          }
          // ISO 2026-04-25
          if (/^\d{4}-\d{2}-\d{2}/.test(c)) {
            const parts = c.split('-');
            return parts[2].substring(0, 2) + '/' + parts[1];
          }
        }
        return null;
      }

      // Row 0 = date headers
      // Row 1 = CHOOSE/WEEKDAY formula row → skip
      // Row 2+ = staff data
      const headerRow = rows[0];
      const dateCols = [];

      headerRow.forEach((h, i) => {
        if (i < 4) return; // skip No./Emp#/Name/Position
        const dk = parseDateHeader(h);
        if (dk) dateCols.push({ index: i, dateKey: dk });
      });

      console.log('[att import] first 5 dateCols:',
        dateCols.slice(0, 5).map(c => `[${c.index}]=${c.dateKey}`).join(' '));

      if (dateCols.length === 0) {
        const sample = headerRow.slice(4, 8)
          .map(h => `${typeof h}:${h}`).join(' | ');
        statusEl.innerHTML = `<span style="color:var(--err);">No date columns detected. Header: ${sample}</span>`;
        return;
      }

      if (!state.monthlyAttendance) state.monthlyAttendance = {};
      let imported = 0, skipped = 0;

      rows.slice(2).forEach(row => {
        if (!row) return;
        const nameVal = String(row[2] || '').trim();
        const empNo = String(row[1] || '').trim();
        if (!nameVal && !empNo) return;

        let user = state.users.find(u =>
          u.name === nameVal ||
          (u.name || '').toLowerCase() === nameVal.toLowerCase()
        );
        if (!user && empNo) {
          const si = Object.entries(state.staffInfo || {})
            .find(([, v]) => v.empNo === empNo);
          if (si) user = state.users.find(u => u.username === si[0]);
        }
        if (!user) {
          const si = Object.entries(state.staffInfo || {}).find(([, v]) =>
            v.name === nameVal ||
            (v.name || '').toLowerCase() === nameVal.toLowerCase()
          );
          if (si) user = { username: si[0], name: si[1].name, id: null };
        }
        if (!user) { skipped++; return; }

        const uname = user.username;
        if (!state.monthlyAttendance[uname]) state.monthlyAttendance[uname] = {};
        if (!state.monthlyAttendance[uname][monthKey]) state.monthlyAttendance[uname][monthKey] = {};

        dateCols.forEach(({ index, dateKey }) => {
          const raw = row[index];
          if (raw === null || raw === undefined) return;
          let rawStr;
          if (typeof raw === 'number') {
            rawStr = String(Math.round(raw)); // 0.0 → "0"
          } else {
            rawStr = String(raw).trim().toUpperCase();
          }
          if (!rawStr) return;
          state.monthlyAttendance[uname][monthKey][dateKey] = rawStr;
        });
        imported++;
      });

      save();
      if (typeof syncWrite === 'function') syncWrite();
      statusEl.innerHTML = `<span style="color:var(--ok);">✓ ${imported} staff · ${dateCols.length} dates · ${skipped} not matched</span>`;
      // After import: scan for attendance records that now conflict with OFF/HD codes
      const conflicts = [];
      Object.keys(state.logbook || {}).forEach(key => {
        const rec = state.logbook[key];
        if (!rec || rec._deleted || (!rec.start && !rec.end)) return;
        const [uidStr, dk] = key.split('_');
        const uid = parseInt(uidStr);
        const u = state.users.find(x => x.id === uid);
        if (!u) return;
        const [_d, _m] = dk.split('/');
        const mk = `${new Date().getFullYear()}-${String(_m).padStart(2, '0')}`;
        const code = state.monthlyAttendance?.[u.username]?.[mk]?.[dk];
        if (!code) return;
        const parsed = _parseAttCode(code);
        if (parsed?.type === 'OFF' || parsed?.type === 'HD1' || parsed?.type === 'HD2') {
          conflicts.push({ name: u.name, dk, code, reason: parsed.reason || parsed.type });
        }
      });

      if (conflicts.length > 0) {
        const lines = conflicts.map(c => `• ${c.name} on ${c.dk} → ${c.code} (${c.reason})`).join('\n');
        statusEl.innerHTML += `<div style="margin-top:10px;padding:8px 12px;background:var(--D-bg);
    border:1px solid var(--err);border-radius:6px;font-size:11px;color:var(--err);line-height:1.8;">
    ⚠ <b>${conflicts.length} retroactive conflict${conflicts.length > 1 ? 's' : ''} found</b> —
    time was already logged on these OFF/half-day dates:<br>
    ${conflicts.map(c => `<b>${c.name}</b> ${c.dk} (${c.code}: ${c.reason})`).join(' · ')}
    <br><span style="color:var(--text3);">Go to Logbook to review and clear these entries.</span>
  </div>`;
        // Don't auto-nav — let the leader see the warning first
      } else {
        nav('staff');
      }
      nav('staff');
    } catch (ex) {
      console.error('[att import]', ex);
      statusEl.innerHTML = `<span style="color:var(--err);">Error: ${ex.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
}

function clearMonthlyAttendance(year, month) {
  const label = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  if (!confirm(`Clear attendance data for ${label}?`)) return;
  const mk = `${year}-${String(month).padStart(2, '0')}`;
  if (state.monthlyAttendance) {
    Object.keys(state.monthlyAttendance).forEach(u => {
      if (state.monthlyAttendance[u]) delete state.monthlyAttendance[u][mk];
    });
  }
  save();
  nav('staff');
}

function renderStaffRows(users, displayDates) {
  var _canReqSwap = !isLeader(currentUser) && !isTraining(currentUser);
  var _nowMs = new Date().setHours(0,0,0,0);
  var _nowYr = new Date().getFullYear();
  return users.map(function(u) {
    var _srEffRole = u.role || (state.staffInfo[u.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===u.username;})||{}).role||'';
    var _isMyRow = u.username === currentUser.username && _canReqSwap;
    return '<tr>' +
    '<td class="mono" style="font-size:11px;position:sticky;left:0;z-index:2;background:var(--bg3);min-width:60px;width:60px;">' + (u.team || '—') + '</td>' +
    '<td style="font-weight:600;position:sticky;left:60px;z-index:2;background:var(--bg3);min-width:200px;width:200px;">' + u.name + '</td>' +
    '<td class="mono" style="color:var(--accent);font-size:11px;position:sticky;left:260px;z-index:2;background:var(--bg3);min-width:130px;width:130px;">' + (u.username || '') + '</td>' +
    '<td style="font-size:11px;color:' + _roleColor(_srEffRole) + ';position:sticky;left:390px;z-index:2;background:var(--bg3);min-width:140px;width:140px;box-shadow:3px 0 6px rgba(0,0,0,.12);">' + (getRoleInfo(_srEffRole).label || _resolveRole(_srEffRole) || '—') + '</td>' +
    displayDates.map(function(d) {
      var s = _getSched(u.username, d);
      if (_isMyRow && s === '0') {
        var _dp = d.split('/');
        var _ddt = new Date(_nowYr, parseInt(_dp[1])-1, parseInt(_dp[0]));
        var _eligible = Math.floor((_ddt - _nowMs) / 86400000) >= 2;
        if (_eligible) {
          return '<td class="c" style="cursor:pointer;" onclick="openDayoffSwapModal(\'' + d + '\')" title="Request day-off swap">' +
            '<span class="sh sh-0">—</span>' +
            '<div style="font-size:8px;color:var(--accent);margin-top:1px;line-height:1;">↔</div>' +
            '</td>';
        }
      }
      return '<td class="c"><span class="sh sh-' + s + '">' + (s === '0' ? '—' : s) + '</span></td>';
    }).join('') +
    '</tr>';
  }).join('');
}

var _STAFF_SORT_RANK = {
  'Training Manager':1,'Training Assistant':2,
  'Data Analyst Leader':3,'Data Analyst Supervisor':4,
  'Sr Data Supervisor':5,'Data Supervisor':6,
  'Sr Data Analyst':7,'Data Analyst':8
};
function _sortStaffUsers(users) {
  return users.filter(function(u) {
    var _r = u.role || (state.staffInfo[u.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===u.username;})||{}).role||'';
    return !!_resolveRole(_r);
  }).sort(function(a, b) {
    var aRole = a.role || (state.staffInfo[a.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===a.username;})||{}).role||'';
    var bRole = b.role || (state.staffInfo[b.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===b.username;})||{}).role||'';
    var aRes = _resolveRole(aRole)||aRole, bRes = _resolveRole(bRole)||bRole;
    var aRnk = _STAFF_SORT_RANK[aRes]||99, bRnk = _STAFF_SORT_RANK[bRes]||99;
    if (aRnk !== bRnk) return aRnk - bRnk;
    var aTeam = a.team||'', bTeam = b.team||'';
    if (aTeam !== bTeam) return aTeam < bTeam ? -1 : 1;
    return (a.name||'').localeCompare(b.name||'');
  });
}

function _liveFilter() {
  var _lfSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) { Object.keys(sc||{}).forEach(function(k){ _lfSet[k]=1; }); });
  const allDates = Object.keys(_lfSet);
  const weekRange = getWeekRange(activeMonday);
  const displayDates = showFullMonth ? allDates : weekRange;
  var _currTrn2 = isTraining(currentUser);
  const filtered = state.users.filter(u => {
    var _effR2   = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _roleStr = (_resolveRole(_effR2) || '').toLowerCase();
    var _teamCh  = (u.team || '').toUpperCase().charAt(0);
    var _isTrn   = isTraining(u) || _roleStr.includes('training') || _teamCh === 'T';
    if (!_currTrn2 && _isTrn) return false;
    var _sq2 = (staffFilters.search || '').toLowerCase();
    if (!_sq2) return true;
    return (u.team || '').toLowerCase().includes(_sq2) ||
      (u.name || '').toLowerCase().includes(_sq2) ||
      (u.username || '').toLowerCase().includes(_sq2) ||
      _roleStr.includes(_sq2);
  });
  const tbody = document.getElementById('staff-tbody');
  if (tbody) tbody.innerHTML = renderStaffRows(_sortStaffUsers(filtered), displayDates);
  const sub = document.querySelector('#staff-subtab-content .page-sub');
  if (sub) sub.textContent = `${filtered.length} staff`;
}

// ═══════════════════════════════════════════════
//  DAY-OFF SWAP REQUEST
// ═══════════════════════════════════════════════
var _dosMyDate = '';

// Return the 7 Mon–Sun dates for the week containing dk (DD/MM)
function _dosGetWeekDates(dk) {
  var p = dk.split('/');
  var yr = new Date().getFullYear();
  var dt = new Date(yr, parseInt(p[1])-1, parseInt(p[0]));
  var dow = dt.getDay();
  var monDt = new Date(dt);
  monDt.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
  var monDk = ('0'+monDt.getDate()).slice(-2) + '/' + ('0'+(monDt.getMonth()+1)).slice(-2);
  return getWeekRange(monDk);
}

// Returns {ok, reason} — checks that neither party ends up with 8+ consecutive working days
function _checkDayoffSwapValid(myUsername, myDate, theirUsername, theirDate) {
  var _yr = new Date().getFullYear();
  var _dk2dt = function(dk) {
    var p = dk.split('/');
    return new Date(_yr, parseInt(p[1])-1, parseInt(p[0]));
  };
  var _dt2dk = function(dt) {
    return ('0'+dt.getDate()).slice(-2) + '/' + ('0'+(dt.getMonth()+1)).slice(-2);
  };
  var _getShiftCode = function(username) {
    var sc = state.staffSchedule[username] || {};
    var counts = {};
    Object.keys(sc).forEach(function(k) {
      var v = sc[k]; if (v && v !== '0') counts[v] = (counts[v]||0)+1;
    });
    var best = Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];
    return best || 'A';
  };
  // Check max consecutive working days for username after simulating: turnOnDate becomes working, turnOffDate becomes day-off
  var _checkUser = function(username, turnOnDate, turnOffDate) {
    var dtOn = _dk2dt(turnOnDate);
    var dtOff = _dk2dt(turnOffDate);
    var dtMin = dtOn < dtOff ? dtOn : dtOff;
    var dtMax = dtOn > dtOff ? dtOn : dtOff;
    var start = new Date(dtMin); start.setDate(start.getDate()-14);
    var end = new Date(dtMax); end.setDate(end.getDate()+14);
    var overrides = {};
    overrides[turnOnDate] = _getShiftCode(username);
    overrides[turnOffDate] = '0';
    var maxRun = 0, run = 0;
    var cur = new Date(start);
    while (cur <= end) {
      var dk = _dt2dk(cur);
      var code = overrides[dk] !== undefined ? overrides[dk] : _getSched(username, dk);
      if (code && code !== '0') { run++; if (run > maxRun) maxRun = run; }
      else { run = 0; }
      cur.setDate(cur.getDate()+1);
    }
    return maxRun;
  };
  // myUsername: myDate (currently off) → working; theirDate → day-off
  var myRun = _checkUser(myUsername, myDate, theirDate);
  // theirUsername: theirDate (currently off) → working; myDate → day-off
  var theirRun = _checkUser(theirUsername, theirDate, myDate);
  var myName = (state.users.find(function(u){return u.username===myUsername;})||{name:myUsername}).name;
  var theirName = (state.users.find(function(u){return u.username===theirUsername;})||{name:theirUsername}).name;
  if (myRun >= 8) return {ok:false, reason: myName + ' would work ' + myRun + ' consecutive days.'};
  if (theirRun >= 8) return {ok:false, reason: theirName + ' would work ' + theirRun + ' consecutive days.'};
  return {ok:true, reason:''};
}

function _dayoffSwapModalHTML() {
  return '<div id="modal-dayoff-swap" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-dayoff-swap\')">' +
    '<div class="modal" style="width:420px;">' +
      '<div class="modal-title">↔ Request Day-Off Swap</div>' +
      '<div style="margin-bottom:12px;">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Your day off</div>' +
        '<div id="dos-my-date-wrap"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Swap with (same position, different day-off)</div>' +
        '<select id="dos-target-user" class="login-select" style="width:100%;font-size:13px;" onchange="_dosUpdateDates()">' +
          '<option value="">— Select person —</option>' +
        '</select>' +
      '</div>' +
      '<div style="margin-bottom:12px;" id="dos-target-date-wrap"></div>' +
      '<div id="dos-validation-msg" style="display:none;margin-bottom:10px;padding:8px 10px;background:rgba(239,68,68,.1);border-left:3px solid var(--err);border-radius:4px;font-size:12px;color:var(--err);"></div>' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Reason (optional)</div>' +
        '<input id="dos-reason" class="login-input" style="width:100%;box-sizing:border-box;font-size:13px;" placeholder="e.g. family event…" />' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button class="btn" onclick="closeModal(\'modal-dayoff-swap\')">Cancel</button>' +
        '<button class="btn btn-accent" id="dos-submit-btn" onclick="submitDayoffSwap()">Submit Request</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function openDayoffSwapModal(dateKey) {
  if (!document.getElementById('modal-dayoff-swap')) {
    document.body.insertAdjacentHTML('beforeend', _dayoffSwapModalHTML());
  }
  document.getElementById('dos-reason').value = '';
  document.getElementById('dos-target-date-wrap').innerHTML = '';
  document.getElementById('dos-validation-msg').style.display = 'none';
  document.getElementById('dos-target-user').innerHTML = '<option value="">— Select person —</option>';

  // Must be at least 2 calendar days before the day-off date
  var _dosIsAdvance = function(dk) {
    var p = dk.split('/');
    var yr = new Date().getFullYear();
    var dt = new Date(yr, parseInt(p[1])-1, parseInt(p[0]));
    var today = new Date(); today.setHours(0,0,0,0);
    return Math.floor((dt - today) / 86400000) >= 2;
  };

  if (!dateKey) {
    // Button mode: show date picker for user's eligible day-offs; scan up to 4 future weeks if needed
    var _myWeekDates = getWeekRange(_ssActiveMonday);
    var _myDayoffs = _myWeekDates.filter(function(d) {
      return _getSched(currentUser.username, d) === '0' && _dosIsAdvance(d);
    });
    if (_myDayoffs.length === 0) {
      // Navigate to nearest future week that has an eligible day-off
      var _found = null, _foundWeekMon = null;
      for (var _wi = 1; _wi <= 4 && !_found; _wi++) {
        var _wDt = new Date(); _wDt.setHours(0,0,0,0);
        var _wDow = _wDt.getDay();
        _wDt.setDate(_wDt.getDate() - (_wDow === 0 ? 6 : _wDow - 1) + _wi * 7);
        var _wMon = ('0'+_wDt.getDate()).slice(-2)+'/'+('0'+(_wDt.getMonth()+1)).slice(-2);
        var _wDates = getWeekRange(_wMon);
        var _wDayoffs = _wDates.filter(function(d) {
          return _getSched(currentUser.username, d) === '0' && _dosIsAdvance(d);
        });
        if (_wDayoffs.length > 0) { _found = _wDayoffs; _foundWeekMon = _wMon; }
      }
      if (!_found) { toast('No eligible day-offs in the next 4 weeks.', 'err'); return; }
      _ssActiveMonday = _foundWeekMon;
      _myDayoffs = _found;
    }
    _dosMyDate = '';
    document.getElementById('dos-my-date-wrap').innerHTML =
      '<select id="dos-my-date-sel" class="login-select" style="width:100%;font-size:13px;" onchange="_dosMyDate=this.value;_dosUpdateUsers()">' +
      '<option value="">— Select your day-off —</option>' +
      _myDayoffs.map(function(d) { return '<option value="'+d+'">'+d+' ('+getWkDay(d)+')</option>'; }).join('') +
      '</select>';
  } else {
    if (!_dosIsAdvance(dateKey)) { toast('Request must be made at least 2 days before the day-off.', 'err'); return; }
    _dosMyDate = dateKey;
    document.getElementById('dos-my-date-wrap').innerHTML =
      '<div style="font-size:14px;font-weight:700;color:var(--accent);">'+dateKey+' ('+getWkDay(dateKey)+')</div>';
    _dosUpdateUsers();
  }
  document.getElementById('modal-dayoff-swap').classList.add('show');
}

// Standard day-off days in the BPO rotation schedule
var _DOS_STD_DAYS = ['Mon', 'Sat', 'Sun'];

// Returns the adjacent standard off-days (±1 calendar day, Mon/Sat/Sun only) for a given date key
function _dosAdjacentDates(dk) {
  var _p = dk.split('/');
  var _yr = new Date().getFullYear();
  var _dt = new Date(_yr, parseInt(_p[1])-1, parseInt(_p[0]));
  var _dt2dk = function(d) { return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2); };
  var _prev = new Date(_dt); _prev.setDate(_dt.getDate()-1);
  var _next = new Date(_dt); _next.setDate(_dt.getDate()+1);
  var _result = [];
  var _prevDk = _dt2dk(_prev), _nextDk = _dt2dk(_next);
  if (_DOS_STD_DAYS.indexOf(getWkDay(_prevDk)) !== -1) _result.push(_prevDk);
  if (_DOS_STD_DAYS.indexOf(getWkDay(_nextDk)) !== -1) _result.push(_nextDk);
  return _result;
}

// Populate same-role, same-shift users who have a standard day-off on adjacent dates to _dosMyDate
function _dosUpdateUsers() {
  var _sel = document.getElementById('dos-target-user');
  document.getElementById('dos-target-date-wrap').innerHTML = '';
  document.getElementById('dos-validation-msg').style.display = 'none';
  if (!_dosMyDate) { _sel.innerHTML = '<option value="">— Select person —</option>'; return; }
  var _myRole = _resolveRole(currentUser.role || (state.staffInfo[currentUser.username]||{}).role || '') || '';
  // Use the displayed week for shift detection (working days excluding day-off)
  var _weekDates = getWeekRange(_ssActiveMonday);
  // Adjacent dates are the valid swap targets (±1 day, restricted to Mon/Sat/Sun)
  var _adjDates = _dosAdjacentDates(_dosMyDate);
  // Determine requester's working shift from their schedule in the displayed week
  var _myShift = '';
  _weekDates.forEach(function(d) {
    if (!_myShift && d !== _dosMyDate) {
      var s = _getSched(currentUser.username, d);
      if (s && s !== '0') _myShift = s;
    }
  });
  var _candidates = state.users.filter(function(u) {
    if (u.username === currentUser.username) return false;
    var _uRole = _resolveRole(u.role || (state.staffInfo[u.username]||{}).role || '') || '';
    if (!_myRole || !_uRole || _uRole !== _myRole) return false;
    // Must work the same shift as the requester
    if (_myShift) {
      var _uWeekDates = getWeekRange(_ssActiveMonday);
      var _sameShift = _uWeekDates.some(function(d) {
        var s = _getSched(u.username, d);
        return s && s !== '0' && s === _myShift;
      });
      if (!_sameShift) return false;
    }
    // Must have a day-off on one of the adjacent dates
    var _hasOff = _adjDates.some(function(d) {
      return _getSched(u.username, d) === '0';
    });
    return _hasOff;
  });
  _sel.innerHTML = '<option value="">— Select person —</option>' +
    _candidates.map(function(u) {
      return '<option value="'+u.username+'">'+u.name+' ('+( u.team || '?')+')</option>';
    }).join('');
}

function _dosUpdateDates() {
  var targetUsername = document.getElementById('dos-target-user').value;
  var wrap = document.getElementById('dos-target-date-wrap');
  document.getElementById('dos-validation-msg').style.display = 'none';
  if (!targetUsername || !_dosMyDate) { wrap.innerHTML = ''; return; }
  // Show only adjacent standard off-days where the target user also has a day-off
  var _adjDates = _dosAdjacentDates(_dosMyDate);
  var _dayoffs = _adjDates.filter(function(d) {
    return _getSched(targetUsername, d) === '0';
  });
  if (_dayoffs.length === 0) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);">No eligible adjacent day-offs for this person.</div>';
    return;
  }
  wrap.innerHTML = '<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Their adjacent day off</div>' +
    '<select id="dos-target-date" class="login-select" style="width:100%;font-size:13px;" onchange="_dosValidate()">' +
    '<option value="">— Select date —</option>' +
    _dayoffs.map(function(d) { return '<option value="'+d+'">'+d+' ('+getWkDay(d)+')</option>'; }).join('') +
    '</select>';
}

// Validate swap and show/hide warning; enable/disable submit
function _dosValidate() {
  var targetUsername = document.getElementById('dos-target-user').value;
  var targetDateEl = document.getElementById('dos-target-date');
  var targetDate = targetDateEl ? targetDateEl.value : '';
  var msgEl = document.getElementById('dos-validation-msg');
  var submitBtn = document.getElementById('dos-submit-btn');
  if (!_dosMyDate || !targetUsername || !targetDate) {
    msgEl.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
    return;
  }
  var result = _checkDayoffSwapValid(currentUser.username, _dosMyDate, targetUsername, targetDate);
  if (!result.ok) {
    msgEl.textContent = '⚠ ' + result.reason;
    msgEl.style.display = 'block';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
  } else {
    msgEl.style.display = 'none';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
  }
}

function submitDayoffSwap() {
  var targetUsername = document.getElementById('dos-target-user').value;
  var targetDateEl = document.getElementById('dos-target-date');
  var targetDate = targetDateEl ? targetDateEl.value : '';
  var reason = (document.getElementById('dos-reason').value || '').trim();
  if (!_dosMyDate) { toast('Please select your day-off date.', 'err'); return; }
  if (!targetUsername || !targetDate) { toast('Please select a person and their day off.', 'err'); return; }
  var result = _checkDayoffSwapValid(currentUser.username, _dosMyDate, targetUsername, targetDate);
  if (!result.ok) { toast('Cannot swap: ' + result.reason, 'err'); return; }
  var targetUser = state.users.find(function(u) { return u.username === targetUsername; });
  if (!targetUser) return;
  state.requests.push({
    type: 'dayoff-swap',
    userId: currentUser.id,
    username: currentUser.username,
    targetId: targetUser.id,
    targetUsername: targetUsername,
    myDate: _dosMyDate,
    theirDate: targetDate,
    status: 'pending',
    at: Date.now(),
    reason: reason,
    resolvedBy: null,
    resolvedAt: null
  });
  syncWrite();
  closeModal('modal-dayoff-swap');
  toast('Day-off swap request submitted', 'ok');
  nav('requests');
}

// ═══════════════════════════════════════════════
//  EXCEL IMPORT — Staff Info (SheetJS)
// ═══════════════════════════════════════════════
var _POS_MAP = {
  'training manager':        'Agent Training Manager',
  'training assistant':      'Agent Training Assistant',
  'data analyst leader':     'Data Analyst Leader',
  'data analyst supervisor': 'Data Analyst Supervisor',
  'sr data supervisor':      'Sr Data Supervisor',
  'sr data analyst':         'Sr Data Analyst',
  'data supervisor':         'Data Supervisor',
  'data analyst':            'Data Analyst',
  'inspection manager':      'Admin',
};
function importExcelStaffInfo() {
  const fileInput = document.getElementById('excel-file-input');
  const statusEl = document.getElementById('excel-import-status');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    statusEl.innerHTML = '<span style="color:var(--err);">⚠ Please choose a file first.</span>';
    return;
  }
  const file = fileInput.files[0];
  statusEl.innerHTML = '<span style="color:var(--text2);">Reading file…</span>';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (typeof XLSX === 'undefined') {
        statusEl.innerHTML = '<span style="color:var(--err);">SheetJS not loaded. Check internet connection.</span>';
        return;
      }
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        statusEl.innerHTML = '<span style="color:var(--err);">⚠ No rows found in sheet.</span>';
        return;
      }

      // Detect column names flexibly (first row keys)
      const firstRow = rows[0];
      const keys = Object.keys(firstRow);

      // Helper: find key containing substring (case-insensitive)
      function col(sub) {
        return keys.find(k => k.toLowerCase().replace(/\s+/g, '').replace(/\n/g, '').includes(sub.toLowerCase())) || null;
      }

      const nameCol = col('name');
      const userCol = col('username');
      const genderCol = col('gender');
      const dobCol = col('birth') || col('dob');
      const posCol = col('position') || col('role');
      const empCol = col('employee') || col('empno') || col('number');
      const activeCol = col('active');
      const phoneCol = col('phone');

      if (!nameCol || !userCol) {
        statusEl.innerHTML = `<span style="color:var(--err);">⚠ Could not find Name/Username columns. Found: ${keys.slice(0, 6).join(', ')}</span>`;
        return;
      }

      let count = 0;
      rows.forEach(row => {
        const username = String(row[userCol] || '').trim();
        const name = String(row[nameCol] || '').trim();
        if (!username || !name) return;

        const gRaw = String(row[genderCol] || '').trim().toLowerCase();
        const gender = gRaw.includes('female') || gRaw === 'f' ? 'F'
          : gRaw.includes('male') || gRaw === 'm' ? 'M' : '';

        const dob = String(row[dobCol] || '').trim();
        const rawPos = String(row[posCol] || '').trim();
        const role = _POS_MAP[rawPos.toLowerCase()] || rawPos;
        const empNo = String(row[empCol] || '').trim();
        const phone = String(row[phoneCol] || '').trim();

        const activeRaw = activeCol ? row[activeCol] : undefined;
        const active = activeRaw === false ? false
          : (typeof activeRaw === 'string'
            ? !['false', 'no', 'inactive', '0'].includes(activeRaw.toLowerCase())
            : true);

        // Merge with existing to preserve password / mustChangePassword
        const existing = state.staffInfo[username] || {};
        DB.setStaffInfo(username, Object.assign({}, existing, { empNo, name, gender, dob, role, active, phone }));

        // Also patch gender onto matching user in schedule DB (for extbreak eligibility)
        const schedUser = state.users.find(u => u.username === username);
        if (schedUser && gender) { schedUser.gender = gender; }

        count++;
      });
      // Also update _usersUpdatedAt so cloud merge knows users changed
      state._usersUpdatedAt = Date.now();
      if (typeof syncWrite === 'function') syncWrite(); else save();
      buildDatalist();
      statusEl.innerHTML = `<span style="color:var(--ok);">✓ Imported ${count} records. Syncing to cloud…</span>`;
      // Refresh table
      const tbody = document.getElementById('staff-info-tbody');
      if (tbody) tbody.innerHTML = _renderStaffInfoRows('');
    } catch (err) {
      statusEl.innerHTML = `<span style="color:var(--err);">Parse error: ${err.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════
//  MODALS: ASSIGN & REQUEST
// ═══════════════════════════════════════════════
function openAssignModal(uid, day) {
  assigningEmp = { uid, day };
  const u = state.users.find(x => x.id === uid);
  document.getElementById('assign-title').textContent = `Assign break — ${u?.name || '?'} (${day})`;
  const slots = BREAK_SLOTS[currentShift] || [];
  const cur = getAssigned(uid, day);
  document.getElementById('assign-slot').innerHTML = slots.map((s, i) =>
    `<option value="${currentShift}${i + 1}"${_slotIndex(cur?.slot, currentShift) === i ? ' selected' : ''}>${s}</option>`
  ).join('');
  document.getElementById('assign-note').value = '';
  document.getElementById('modal-assign').classList.add('show');
}

function confirmAssign() {
  if (!assigningEmp) return;
  const slot = document.getElementById('assign-slot').value;
  const note = document.getElementById('assign-note').value;
  assign(assigningEmp.uid, assigningEmp.day, slot, note);
  closeModal('modal-assign');
  toast('Break assigned!', 'ok');
  nav(currentPage);
}

function openRequestModal() {
  var _rmSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) { Object.keys(sc||{}).forEach(function(k){ _rmSet[k]=1; }); });
  const allDates = Object.keys(_rmSet);
  const weekDates = getWeekDates();

  // Build list of days this user is on THIS shift
  const myShiftDays = [];
  allDates.forEach(dk => { if (_getSched(currentUser.username, dk) === currentShift) myShiftDays.push(dk); });
  if (myShiftDays.length === 0) {
    weekDates.forEach((dk, i) => { if (_getSched(currentUser.username, dk) === currentShift) myShiftDays.push(dk); });
  }

  // Filter out past dates — only show today and future scheduled days
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const todayYear = todayObj.getFullYear();
  const todayMMDD = todayObj.getMonth() * 100 + todayObj.getDate(); // e.g. 404 for 04/04
  const futureDays = myShiftDays.filter(dk => {
    const [d, m] = dk.split('/').map(Number);
    const dkMMDD = (m - 1) * 100 + d; // same format: month*100 + day
    return dkMMDD >= todayMMDD;
  });
  const displayDays = futureDays.length > 0 ? futureDays : myShiftDays;

  const daySelect = document.getElementById('req-day');
  daySelect.innerHTML = displayDays.length > 0
    ? displayDays.map(d => {
      const br = getAssigned(currentUser.id, d) || getAssigned(currentUser.id, getWkDay(d));
      const slot = br ? ` (${getShortSlot(currentShift, br.slot)})` : ' (no break)';
      return `<option value="${d}">${d} ${getWkDay(d)}${slot}</option>`;
    }).join('')
    : `<option value="">No upcoming shift days found</option>`;



  // Reset scope toggle to 'day'
  document.getElementById('req-scope-day').checked = true;
  document.getElementById('req-scope-week').checked = false;
  document.getElementById('req-week-note').style.display = 'none';

  _updateReqDay();
  document.getElementById('req-reason').value = '';
  document.getElementById('modal-request').classList.add('show');
}

function _toggleReqScope() {
  const isWeek = document.getElementById('req-scope-week').checked;
  document.getElementById('req-week-note').style.display = isWeek ? '' : 'none';
  _updateReqPartners();
}

function _updateReqDay() {
  const day = document.getElementById('req-day').value;
  const br = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
  document.getElementById('req-cur').value = br ? getSlotTime(br.slot, day) : 'Not assigned';
  _updateReqPartners();
}

function _updateReqPartners() {
  const day = document.getElementById('req-day').value;
  const isWeek = document.getElementById('req-scope-week')?.checked;
  if (!day) return;

  const myBr = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
  const mySlot = myBr ? myBr.slot : null;

  // If week swap: partner must have same slot mismatch on ALL days they share this shift
  const partners = state.users.filter(u => {
    if (u.id === currentUser.id) return false;
    if (u.role !== currentUser.role) return false;
    var shiftVal = _getSched(u.username, day);
    if (shiftVal !== currentShift) return false;
    const theirBr = getAssigned(u.id, day) || getAssigned(u.id, getWkDay(day));
    if (!theirBr) return false;
    if (theirBr.slot === mySlot) return false;
    return true;
  });

  const partnerSelect = document.getElementById('req-partner');
  if (partners.length === 0) {
    partnerSelect.innerHTML = `<option value="">— No eligible partners —</option>`;
    document.getElementById('req-new').innerHTML = `<option value="">— pick partner first —</option>`;
  } else {
    partnerSelect.innerHTML = `<option value="">— Choose swap partner —</option>` +
      partners.map(u => {
        const theirBr = getAssigned(u.id, day) || getAssigned(u.id, getWkDay(day));
        return `<option value="${u.id}" data-slot="${theirBr.slot}">
          ${u.name} (${u.team}) — ${getShortSlot(currentShift, theirBr.slot)} [${theirBr.slot}]
        </option>`;
      }).join('');
  }
  _updateReqSlot();
}

function _updateReqSlot() {
  const partnerSel = document.getElementById('req-partner');
  const chosen = partnerSel.options[partnerSel.selectedIndex];
  const theirSlot = chosen?.dataset?.slot || '';
  const reqNew = document.getElementById('req-new');
  reqNew.innerHTML = theirSlot
    ? `<option value="${theirSlot}" selected>${theirSlot}</option>`
    : `<option value="">— pick partner first —</option>`;
}

function submitRequest() {
  const day = document.getElementById('req-day').value;
  const requested = document.getElementById('req-new').value;
  const reason = document.getElementById('req-reason').value.trim();
  const partnerSel = document.getElementById('req-partner');
  const partnerId = partnerSel.value ? parseInt(partnerSel.value) : null;
  const partnerSlot = partnerSel.options[partnerSel.selectedIndex]?.dataset?.slot || '';
  const isWeek = document.getElementById('req-scope-week')?.checked || false;

  if (!day) { toast('Select a day first.', 'err'); return; }
  if (!partnerId) { toast('Select a swap partner.', 'err'); return; }
  if (!requested) { toast('No swap slot available.', 'err'); return; }

  // ── Conflict detection: check if partner already has a PENDING request for the same day(s) ──
  let swapDays = [day];
  if (isWeek) {
    const partner = state.users.find(u => u.id === partnerId);
    // Only use current week dates
    const weekDates = getWeekDates();
    swapDays = weekDates.filter(dk => {
      var myShift = _getSched(currentUser.username, dk);
      var ptShift = partner ? _getSched(partner.username, dk) : '0';
      return myShift === currentShift && ptShift === currentShift;
    });
    if (swapDays.length === 0) { toast('No matching shift days found for week swap.', 'err'); return; }
  }

  // Check for conflicting pending requests involving this partner
  const conflicts = state.requests.filter(r =>
    r.status === 'pending' &&
    r.swapPartnerId === partnerId &&
    (isWeek ? (r.swapDays || [r.day]).some(d => swapDays.includes(d)) : swapDays.includes(r.day))
  );
  if (conflicts.length > 0) {
    toast('⚠ A pending request already involves this partner on those days. Yours will be auto-denied.', 'warn');
    // Auto-create the request but mark it denied immediately
    const myBr = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
    state.requests.unshift({
      id: Date.now(), userId: currentUser.id, day, swapDays, swapWeek: isWeek,
      current: myBr ? myBr.slot : 'Not assigned', requested, reason,
      swapPartnerId: partnerId, partnerSlot,
      status: 'rejected', respNote: 'Auto-denied: partner already has a prior pending request for these days.',
      at: Date.now(), resolvedAt: Date.now(), resolvedBy: null,
    });
    if (typeof syncWrite === 'function') syncWrite(); else save();
    closeModal('modal-request');
    updateBadge();
    nav('requests');
    return;
  }

  const myBr = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
  state.requests.unshift({
    id: Date.now(), userId: currentUser.id, day, swapDays, swapWeek: isWeek,
    current: myBr ? myBr.slot : 'Not assigned', requested, reason,
    swapPartnerId: partnerId, partnerSlot,
    status: 'pending', at: Date.now(), respNote: '',
  });
  if (typeof syncWrite === 'function') syncWrite(); else save();
  closeModal('modal-request');
  toast('Swap request submitted!', 'warn');
  updateBadge();
  nav('requests');
}

function resolveRequest(idx, status) {
  const r = state.requests[idx];
  r.status = status;
  r.resolvedBy = currentUser.id;
  r.resolvedAt = Date.now();

  if (status === 'approved') {
    if (r.type === 'dayoff-swap') {
      // Determine each person's normal shift by looking at their most-used schedule code
      var _getShift = function(username) {
        var sc = state.staffSchedule[username] || {};
        var _counts = {};
        Object.keys(sc).forEach(function(k) {
          var v = sc[k]; if (v && v !== '0') _counts[v] = (_counts[v] || 0) + 1;
        });
        var _best = Object.keys(_counts).sort(function(a, b) { return _counts[b] - _counts[a]; })[0];
        return _best || 'A';
      };
      if (!state.staffSchedule[r.username]) state.staffSchedule[r.username] = {};
      if (!state.staffSchedule[r.targetUsername]) state.staffSchedule[r.targetUsername] = {};
      // Requester: give up their day off, work on target's date
      state.staffSchedule[r.username][r.myDate] = _getShift(r.username);
      state.staffSchedule[r.username][r.theirDate] = '0';
      // Target: give up their day off, work on requester's date
      state.staffSchedule[r.targetUsername][r.theirDate] = _getShift(r.targetUsername);
      state.staffSchedule[r.targetUsername][r.myDate] = '0';
    } else {
    const days = r.swapDays || [r.day];
    days.forEach(d => {
      // Give requester the partner's slot
      assign(r.userId, d, r.requested, 'approved by ' + currentUser.name);
      // Give partner the requester's original slot on that day
      if (r.swapPartnerId && r.current && r.current !== 'Not assigned') {
        const mySlotOnDay = getAssigned(r.userId, d)?.slot || r.current;
        assign(r.swapPartnerId, d, r.current, 'swap approved — ' + currentUser.name);
      }
    });

    // Auto-deny any other pending break-swap requests that conflict with same partner + days
    state.requests.forEach((other, i) => {
      if (i === idx) return;
      if (other.status !== 'pending') return;
      if (other.type === 'dayoff-swap') return;
      if (other.swapPartnerId !== r.swapPartnerId) return;
      const otherDays = other.swapDays || [other.day];
      const days2 = r.swapDays || [r.day];
      if (otherDays.some(d => days2.includes(d))) {
        other.status = 'rejected';
        other.respNote = `Auto-denied: swap partner's break was already committed to another approved request.`;
        other.resolvedBy = currentUser.id;
        other.resolvedAt = Date.now();
      }
    });
    } // end break-swap else
  }

  if (typeof syncWrite === 'function') syncWrite(); else save();
  toast(status === 'approved' ? 'Swap approved ✓' : 'Request rejected', 'ok');
  updateBadge();
  nav('requests');
}

// ═══════════════════════════════════════════════
//  RENDER: 30-MIN EXTRA BREAK (females only)
//  All female staff can register; 3 times/month max
//  Leaders see everyone's registrations for current shift
// ═══════════════════════════════════════════════

function renderExtBreak() {
  const isFemale = _getUserGender(currentUser) === 'F';
  if (isTraining(currentUser)) {
    if (typeof renderExtBreakTraining === 'function') return renderExtBreakTraining();
    return '<div class="empty">Loading…</div>';
  }
  const canApprove = isLeader(currentUser) || isTraining(currentUser);
  const pendingCount = DB.countPendingExtBreaks ? DB.countPendingExtBreaks() : 0;
  if (!_extBreakFilterYM) _extBreakFilterYM = currentMonthKey();
  const mk = _extBreakFilterYM;
  const [yr, mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr), parseInt(mo) - 1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // For leader: show all female staff who have any ext break entries in the selected month.
  // For agents: only themselves.
  const allFemaleUsers = state.users.filter(u => _getUserGender(u) === 'F');
  const femaleShiftUsers = isLeader(currentUser)
    ? allFemaleUsers.filter(u => {
        const wd = getWeekDates();
        return wd.some(dk => _getSched(u.username, dk) === currentShift);
      })
    : allFemaleUsers;

  // My registrations this month
  const myEntries = DB.getExtBreaks(currentUser.id, mk);
  const myUsed = myEntries.length;
  const myRemaining = Math.max(0, 3 - myUsed);

  // Build registration list for current user (female) or full view (leader)
  const viewUsers = isLeader(currentUser) ? femaleShiftUsers : (isFemale ? [currentUser] : []);

  const userCards = viewUsers.map(u => {
    const entries = DB.getExtBreaks(u.id, mk) || [];
    const used = entries.length;
    const myRemaining = Math.max(0, 3 - used);

    const entryCards = entries.length === 0
      ? '<div style="font-size:11px;color:var(--text3);padding:6px 0;">No registrations this month.</div>'
      : entries.map((e, i) => {
        const status = e.status || 'pending';
        const isPending = status === 'pending';
        const borderCol = status === 'approved' ? 'var(--ok)' : status === 'rejected' ? 'var(--err)' : 'var(--warn)';
        const statusBadge = status === 'approved'
          ? '<span class="req-status approved">APPROVED</span>'
          : status === 'rejected'
            ? '<span class="req-status rejected">REJECTED</span>'
            : '<span class="req-status pending">PENDING</span>';

        const resolvedBy = e.approvedBy
  ? (() => {
      // Try state.users first
      const u = state.users.find(x => x.id === e.approvedBy);
      if (u) return u.name;
      // Fall back to staffInfo by matching hashed ID
      const uname = Object.keys(state.staffInfo || {}).find(k => {
        let h = 0;
        for (let i = 0; i < k.length; i++) h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
        return Math.abs(h) === e.approvedBy;
      });
      return uname ? (state.staffInfo[uname].name || uname) : 'Leader';
    })()
  : null;

        const resolvedBox = (!isPending && resolvedBy)
          ? '<div class="req-resolved ' + status + '" style="margin-top:8px;">'
          + (status === 'approved' ? '✓ ' : '✗ ')
          + (status === 'approved' ? 'Approved' : 'Rejected') + ' by <b>' + resolvedBy + '</b>'
          + (e.rejectedReason ? ' · <span style="opacity:.8">' + e.rejectedReason + '</span>' : '')
          + '</div>'
          : '';

        const actions = (canApprove && isPending)
          ? '<div class="req-actions">'
          + '<button class="btn btn-sm btn-ok" onclick="approveExtBreak(' + u.id + ',\'' + mk + '\',' + i + ')">✓ Approve</button>'
          + '<button class="btn btn-sm btn-err" onclick="rejectExtBreakPrompt(' + u.id + ',\'' + mk + '\',' + i + ')">✗ Reject</button>'
          + '</div>'
          : '';

        const todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
        const dayStr = (e.days && e.days.length > 0) ? e.days[0] : (e.day || '');
        const [_d, _m] = dayStr.split('/').map(Number);
        const isPastDay = dayStr ? ((_m - 1) * 100 + _d) < todayMMDD : false;
        const canCancel = (u.id === currentUser.id || isLeader(currentUser)) && !isPastDay;
        const delBtn = canCancel
          ? '<button class="btn btn-xs" style="margin-top:6px;font-size:11px;color:var(--text3);" '
          + 'onclick="deleteExtBreak(' + u.id + ',\'' + mk + '\',' + i + ',' + currentUser.id + ')">🗑 Cancel</button>'
          : '';

        const daysLabel = (e.days && e.days.length > 1)
          ? e.days.join(', ')
          : (e.day || '—');

        return '<div class="req-card ' + status + '" style="width:240px;">'
          + '<div class="req-card-top">'
          + '<div>'
          + '<div class="req-card-name" style="font-size:12px;">' + daysLabel + '</div>'
          + '<div class="req-card-meta">' + (e.position === 'before' ? '← Before' : 'After →') + ' · ' + timeSince(e.at) + '</div>'
          + '</div>'
          + statusBadge
          + '</div>'
          + '<hr class="req-card-divider">'
          + '<div class="req-card-row"><span class="req-card-lbl">Time</span>'
          + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--A-color);">' + (e.time || '—') + '</span>'
          + '</div>'
          + resolvedBox
          + actions
          + delBtn
          + '</div>';
      }).join('');

    const dots = [0, 1, 2].map(i =>
      '<span style="width:8px;height:8px;border-radius:50%;display:inline-block;'
      + 'background:' + (i < used ? 'var(--A-color)' : 'var(--border2)') + ';'
      + 'border:1px solid ' + (i < used ? 'var(--A-color)' : 'var(--border2)') + ';"></span>'
    ).join('');

    return '<div style="margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      + '<span style="font-weight:600;font-size:13px;color:var(--text);">' + u.name + '</span>'
      + '<span style="color:var(--A-color);font-size:12px;">♀</span>'
      + '<span style="font-size:11px;color:var(--text3);">' + u.team + ' · ' + getRoleInfo(u.role).label + '</span>'
      + '<div style="margin-left:auto;display:flex;align-items:center;gap:6px;">'
      + '<div style="display:flex;gap:3px;">' + dots + '</div>'
      + '<span style="font-size:11px;color:' + (myRemaining === 0 ? 'var(--err)' : 'var(--text3)') + ';">' + used + '/3</span>'
      + (u.id === currentUser.id && isFemale && used < 3
        ? '<button class="btn btn-sm btn-accent" onclick="openExtBreakModal()">Register</button>'
        : '')
      + '</div>'
      + '</div>'
      + '<div class="req-cards-grid">' + entryCards + '</div>'
      + '</div>';
  }).join('');

  const noAccessMsg = !isFemale && !isLeader(currentUser)
    ? `<div class="empty"><div class="empty-ico">🌸</div>
        <div>This menu is for female staff only.</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">Female staff can register up to 3 extra 30-min breaks per month.</div>
      </div>` : '';

  const myPendingHtml = (!isLeader(currentUser) && isFemale) ? (() => {
    const mk2 = currentMonthKey();
    const myEntries = DB.getExtBreaks(currentUser.id, mk2) || [];
    const myPending = myEntries.filter((e, i) => (e.status || 'pending') === 'pending');
    if (!myPending.length) return '';
    return `
    
    <div style="padding:10px 14px;background:rgba(245,158,11,.10);border:1px solid var(--warn);
      border-radius:8px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
        color:var(--warn);margin-bottom:8px;">⏳ Your pending requests</div>
      ${myPending.map((e, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;
          border-bottom:1px solid var(--border);font-size:12px;">
          <span style="color:var(--text3);">${e.day}</span>
          <span style="color:var(--A-color);font-size:11px;">${e.position === 'before' ? '← Before' : 'After →'}</span>
          <span style="font-family:'IBM Plex Mono',monospace;color:var(--text2);font-size:11px;">${e.time}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--text3);">${timeSince(e.at)}</span>
        </div>`).join('')}
    </div>`;
  })() : '';
  return `
<div class="page-header">
  <div>
    <div class="page-title">🌸 30-Min Extra Break</div>
    <div class="page-sub">${monthLabel} · Shift ${currentShift} · ${isFemale && !isLeader(currentUser) ? `${myRemaining} registration${myRemaining !== 1 ? 's' : ''} remaining` : 'All female staff'}</div>
  </div>

</div>

${_monthPickerHTML(mk, '_setExtBreakFilterYM', 'extbreak')}
${noAccessMsg}
${myPendingHtml}

  
 
  ${canApprove && pendingCount > 0 ? `
  <div style="padding:10px 16px;background:rgba(245,158,11,.12);border:1px solid var(--warn);
    border-radius:8px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:20px;">⏳</span>
    <div>
      <div style="font-weight:600;color:var(--warn);">${pendingCount} pending request${pendingCount > 1 ? 's' : ''}</div>
      <div style="font-size:11px;color:var(--text2);">Review below — approve or reject each request</div>
    </div>
  </div>` : ''}
 
  ${viewUsers.length === 0 && !noAccessMsg ? `<div class="empty"><div class="empty-ico">👥</div>No female staff on Shift ${currentShift} this week.</div>` : ''}
 
  ${userCards}

<div class="card" style="background:var(--bg3);border-color:var(--border2);">
  <div class="card-title">Rules</div>
  <div style="font-size:12px;color:var(--text2);line-height:1.8;">
    ✦ Only female staff are eligible for the extra 30-min break.<br>
    ✦ Maximum <b style="color:var(--accent);">3 registrations per calendar month</b>.<br>
    ✦ The extra 30 min is taken immediately <b>before</b> or <b>after</b> your assigned main break window.<br>
    ✦ You must have a main break assigned on that day before registering.<br>
    ✦ Registration can be cancelled at any time before the break occurs.
  </div>
</div>`;
}

// ── ExtBreak Modal ──
function openExtBreakModalFor(targetUser) {
  _ebTargetUser = targetUser;
  openExtBreakModal();
}

function openExtBreakModal() {
  const target = _ebTargetUser || currentUser;
  const isOnBehalf = _ebTargetUser && _ebTargetUser.id !== currentUser.id;
  if (!isOnBehalf && _getUserGender(currentUser) !== 'F') { toast('Only female staff can register.', 'err'); return; }
  const mk = currentMonthKey();
  const used = DB.countExtBreaks(target.id, mk);
  const remaining = 3 - used;
  if (remaining <= 0) { toast(`${isOnBehalf ? target.name + ' has' : 'You have'} used all 3 registrations this month.`, 'err'); return; }

  var _ebSDSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) { Object.keys(sc||{}).forEach(function(k){ if(/\d{2}\/\d{2}/.test(k)) _ebSDSet[k]=1; }); });
  const allDates = Object.keys(_ebSDSet);
  const weekDates = getWeekDates();
  const eligibleDays = [];

  // Past-date check: DD/MM format → compare as (M-1)*100+D vs today
  const _todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
  function _isNotPast(dk) {
    const [d, m] = dk.split('/').map(Number);
    return (m - 1) * 100 + d >= _todayMMDD;
  }

  var _tSched = _getSchedObj(target.username);
  const targetShift = isOnBehalf
    ? (Object.values(_tSched).find(s => s && s !== '0') || currentShift)
    : currentShift;

  allDates.forEach(dk => {
    if (monthKeyFromDate(dk) !== mk) return;
    if (!_isNotPast(dk)) return;
    var sc = _getSched(target.username, dk);
    if (sc !== targetShift) return;
    const br = getAssigned(target.id, dk) || getAssigned(target.id, getWkDay(dk));
    if (br) eligibleDays.push({ dk, slot: getSlotTime(br.slot, dk) });
  });
  if (eligibleDays.length === 0) {
    weekDates.forEach((dk, i) => {
      if (!_isNotPast(dk)) return;
      var sc = _getSched(target.username, dk);
      if (sc !== targetShift) return;
      const br = getAssigned(target.id, dk) || getAssigned(target.id, WEEK_DAYS[i]);
      if (br) eligibleDays.push({ dk, slot: getSlotTime(br.slot, dk) });
    });
  }

  const listEl = document.getElementById('eb-day-list');
  listEl.innerHTML = eligibleDays.length > 0
    ? eligibleDays.map(({ dk, slot }) => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;
        background:var(--bg3);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
        <input type="checkbox" name="eb-day-check" value="${dk}" data-slot="${slot}"
          onchange="_updateEbMultiChange(${remaining})">
        <span style="font-size:12px;font-weight:500;">${dk} <span style="color:var(--text3);">${getWkDay(dk)}</span></span>
        <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent);">${slot}</span>
      </label>`).join('')
    : `<div style="font-size:12px;color:var(--text3);">No days with assigned break found.</div>`;

  document.getElementById('eb-main-slot').value = '';
  document.getElementById('eb-main-slot-wrap').style.display = 'none';
  document.getElementById('eb-preview').style.display = 'none';
  document.getElementById('eb-before').checked = false;
  document.getElementById('eb-after').checked = false;

  const quota = document.getElementById('eb-quota-info');
  quota.innerHTML = `${isOnBehalf ? `<div style="font-size:11px;color:var(--accent);margin-bottom:4px;">Registering for <b>${target.name}</b></div>` : ''}
    <span style="color:${remaining <= 1 ? 'var(--warn)' : 'var(--ok)'};">
    ${remaining} registration${remaining !== 1 ? 's' : ''} remaining this month (${used}/3 used)</span>`;

  document.getElementById('eb-submit-btn').disabled = eligibleDays.length === 0;
  document.getElementById('modal-extbreak').classList.add('show');
}

function _updateEbMultiChange(remaining) {
  const checked = [...document.querySelectorAll('input[name="eb-day-check"]:checked')];
  // Enforce max = remaining quota
  if (checked.length > remaining) {
    event.target.checked = false;
    toast(`You can only select up to ${remaining} day${remaining !== 1 ? 's' : ''}.`, 'warn');
    return;
  }
  // Show slot of first checked day
  const slotWrap = document.getElementById('eb-main-slot-wrap');
  if (checked.length > 0) {
    const slots = [...new Set(checked.map(c => c.dataset.slot))];
    document.getElementById('eb-main-slot').value = slots.length === 1 ? slots[0] : 'Multiple slots';
    slotWrap.style.display = '';
    _updateEbPreview();
  } else {
    slotWrap.style.display = 'none';
    document.getElementById('eb-preview').style.display = 'none';
  }
}

function _updateEbDayChange() {
  const sel = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const slot = chosen?.dataset?.slot || '';
  document.getElementById('eb-main-slot').value = slot || '—';
  document.getElementById('eb-preview').style.display = 'none';
  // Reset radio
  document.getElementById('eb-before').checked = false;
  document.getElementById('eb-after').checked = false;
}

function _updateEbPreview() {
  const sel = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const slot = chosen?.dataset?.slot || '';
  if (!slot) return;

  const pos = document.querySelector('input[name="eb-pos"]:checked')?.value;
  if (!pos) return;

  // Parse slot times like "09:30–11:00"
  const parts = slot.split('–');
  if (parts.length !== 2) return;
  const [start, end] = parts.map(t => t.trim());

  function addMins(timeStr, mins) {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + mins;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }
  function subMins(timeStr, mins) { return addMins(timeStr, -mins); }

  let extraLabel;
  if (pos === 'before') extraLabel = `${subMins(start, 30)}–${start}`;
  else extraLabel = `${end}–${addMins(end, 30)}`;

  const preview = document.getElementById('eb-preview');
  preview.style.display = 'block';
  preview.innerHTML = `
    <span style="color:var(--text3);font-size:10px;">MAIN BREAK</span>
    <span style="color:var(--accent);margin-left:8px;">${slot}</span>
    &nbsp;+&nbsp;
    <span style="color:var(--text3);font-size:10px;">EXTRA 30 MIN</span>
    <span style="color:var(--A-color);margin-left:8px;">${extraLabel}</span>
    &nbsp;=&nbsp;
    <span style="color:var(--ok);">Total: 90 min window</span>`;
}

function submitExtBreak() {
  const checked = [...document.querySelectorAll('input[name="eb-day-check"]:checked')];
  const pos = document.querySelector('input[name="eb-pos"]:checked')?.value;

  if (!checked.length) { toast('Select at least one day.', 'err'); return; }
  if (!pos) { toast('Choose Before or After.', 'err'); return; }

  const target = _ebTargetUser || currentUser;
  const mk = currentMonthKey();
  const used = DB.countExtBreaks(target.id, mk);
  if (used + checked.length > 3) {
    toast(`Only ${3 - used} registration${3 - used !== 1 ? 's' : ''} remaining.`, 'err'); return;
  }

  function addMins(t, m) {
    const [h, mi] = t.split(':').map(Number);
    const tot = h * 60 + mi + m;
    return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  }

  const days = checked.map(c => ({ dk: c.value, slot: c.dataset.slot }));
  const firstSlot = days[0].slot;
  const parts = firstSlot.split('–');
  if (parts.length !== 2) { toast('Could not parse slot time.', 'err'); return; }
  const [start, end] = parts.map(t => t.trim());
  const time = pos === 'before' ? `${addMins(start, -30)}–${start}` : `${end}–${addMins(end, 30)}`;

  // Store as one request with days array
  DB.addExtBreak(target.id, mk, {
    days: days.map(d => d.dk),
    day: days[0].dk,
    mk,
    time, position: pos,
    status: 'pending',
    at: Date.now(), registeredBy: currentUser.id
  });
  _ebTargetUser = null;
  if (typeof syncWrite === 'function') syncWrite(); else save();
  closeModal('modal-extbreak');
  toast(`Extra break registered for ${days.length} day${days.length > 1 ? 's' : ''} 🌸`, 'ok');
  nav('extbreak');
}

function deleteExtBreak(uid, mk, idx, cancelledById) {
  // mk may be wrong if entry is from a past month — try to resolve from the entry's stored 'at'
  let entries = DB.getExtBreaks(uid, mk);
  let entry = entries[idx];

  // Fallback: scan all months for this user to find the right entry
  if (!entry) {
    // Block cancellation for past dates
    const dayStr = (entry.days && entry.days.length > 0) ? entry.days[0] : (entry.day || '');
    if (dayStr) {
      const [d, m] = dayStr.split('/').map(Number);
      const todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
      if ((m - 1) * 100 + d < todayMMDD && cancelledById === uid) {
        toast('Cannot cancel a past registration.', 'err');
        return;
      }
    }
    const allKeys = Object.keys(state.extBreaks || {})
      .filter(k => k.startsWith(uid + '_'));
    for (const key of allKeys) {
      const [, entryMk] = key.split('_');
      const arr = DB.getExtBreaks(uid, entryMk);
      if (arr[idx] !== undefined) {
        mk = entryMk;
        entries = arr;
        entry = arr[idx];
        break;
      }
    }
  }

  if (!entry) { toast('Entry not found.', 'err'); return; }

  const u = state.users.find(x => x.id === uid);
  const cancelledBy = cancelledById && cancelledById !== uid
    ? state.users.find(x => x.id === cancelledById)
    : null;
  const msg = cancelledBy
    ? `Cancel this extra break for ${u?.name || '?'} (cancelled by ${cancelledBy.name})?`
    : 'Cancel this extra break registration?';
  if (!confirm(msg)) return;
  DB.deleteExtBreak(uid, mk, idx);
  if (typeof syncWrite === 'function') syncWrite(); else save();
  toast('Registration cancelled.', 'warn');
  nav('extbreak');
}

function approveExtBreak(uid, mk, idx) {
  DB.approveExtBreak(uid, mk, idx, currentUser.id);
  if (typeof syncWrite === 'function') syncWrite(); else save();
  updateBadge();
  toast('✓ Extra break approved.', 'ok');
  nav('extbreak');
}

function rejectExtBreakPrompt(uid, mk, idx) {
  const reason = prompt('Rejection reason (optional):');
  if (reason === null) return; // user cancelled prompt
  DB.rejectExtBreak(uid, mk, idx, currentUser.id, reason || '');
  if (typeof syncWrite === 'function') syncWrite(); else save();
  updateBadge();
  toast('Extra break rejected.', 'warn');
  nav('extbreak');
}


// ═══════════════════════════════════════════════
//  RENDER: AUTO-ASSIGN ROTATION STATUS (admin)
//  Shown inside Cloud Sync page
// ═══════════════════════════════════════════════
function renderRotationPanel() {
  const summary = typeof getRotationSummary === 'function' ? getRotationSummary() : [];
  const tierLabels = { agent: 'Data Analyst + Sr Data Analyst', qa: 'Data Supervisor', sr_qa: 'Sr Data Supervisor' };

  if (summary.length === 0) {
    return `<div class="card" style="max-width:740px;margin-top:0;">
      <div class="card-title">🔄 Break Auto-Assign Rotation</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.8;">
        No rotation history yet. Import a schedule to start auto-assignment.<br>
        <b>How the rotation works:</b><br>
        ✦ <b>Current/past week re-import</b> → keeps existing phase (idempotent, no flip)<br>
        ✦ <b>Future week import</b> → flips phase once per new future Monday found<br>
        ✦ Importing this week + next week in one paste → this week keeps phase, next week flips
      </div>
    </div>`;
  }

  const rows = summary.map(s => {
    const phaseLabel = s.phase === 0
      ? `<span style="color:var(--ok);font-weight:600;">Phase 0</span> <span style="color:var(--text3);font-size:10px;">first half → Slot 1</span>`
      : `<span style="color:var(--B-color);font-weight:600;">Phase 1</span> <span style="color:var(--text3);font-size:10px;">first half → Slot 2</span>`;
    const weekBadge = s.isFuture
      ? `<span style="background:var(--B-bg);color:var(--B-color);border:1px solid var(--B-color);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'IBM Plex Mono',monospace;margin-left:6px;">future</span>`
      : `<span style="background:var(--bg4);color:var(--text3);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'IBM Plex Mono',monospace;margin-left:6px;">current</span>`;
    const nextPhase = s.phase === 0 ? 'Phase 1 (first half → Slot 2)' : 'Phase 0 (first half → Slot 1)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:9px 12px;font-weight:700;font-size:12px;">Shift ${s.shift}</td>
      <td style="padding:9px 12px;color:var(--text2);font-size:12px;">${tierLabels[s.tier] || s.tier}</td>
      <td style="padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
        ${s.lastWeek}${weekBadge}
      </td>
      <td style="padding:9px 12px;font-size:12px;">${phaseLabel}</td>
      <td style="padding:9px 12px;font-size:11px;color:var(--text3);">→ ${nextPhase}</td>
      <td style="padding:9px 12px;">
        <button class="btn btn-xs btn-warn"
          onclick="resetRotation('${s.shift}','${s.tier}');nav('sync');"
          title="Delete history — next import will restart at Phase 0">↺ Reset</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="card" style="max-width:860px;margin-top:0;">
    <div class="card-title">🔄 Break Auto-Assign Rotation</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.9;">
      <b>Rotation rule (Option C):</b><br>
      ✦ <b>Current or past week re-imported</b> → phase unchanged (safe to re-import corrections)<br>
      ✦ <b>New future week imported</b> → phase flips exactly once per new future Monday<br>
      ✦ Importing this week + next week together → this week keeps phase, next week gets flipped phase<br>
      ✦ "Next phase" shown below is what the <b>next new future import</b> will use for that tier
    </div>
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:var(--bg3);">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">SHIFT</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">ROLE TIER</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">LAST IMPORTED WEEK</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">CURRENT PHASE</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">NEXT FUTURE IMPORT</th>
            <th style="padding:8px 12px;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  if (id === 'modal-extbreak') _ebTargetUser = null;
}

// ═══════════════════════════════════════════════
//  RENDER: SHIFT CONFIG — manage shift times and break slots
//  Access: Leader (level 2+)
// ═══════════════════════════════════════════════
function renderShiftConfig() {
  var todayDk = (function() {
    var n = new Date();
    return n.getDate().toString().padStart(2,'0') + '/' + (n.getMonth()+1).toString().padStart(2,'0');
  })();
  var cfg = getConfigForDate(todayDk);
  var allShifts = Object.keys(cfg.breakSlots).sort();

  var rows = allShifts.map(function(sh) {
    var shiftDef = SHIFTS[sh] || null;
    var times = shiftDef ? shiftDef.start + ' – ' + shiftDef.end : '—';
    var slots = cfg.breakSlots[sh] || [];
    var s1 = slots[0] || '—';
    var s2 = slots[1] || '—';
    return '<tr>' +
      '<td style="padding:10px 16px;font-weight:700;font-family:\"IBM Plex Mono\",monospace;font-size:14px;">' +
        '<span class="sh sh-' + sh + '" style="width:28px;height:28px;font-size:13px;display:inline-flex;align-items:center;justify-content:center;">' + sh + '</span>' +
      '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:var(--text2);">' + times + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;font-family:\"IBM Plex Mono\",monospace;">' +
        '<span class="break-slot assigned slot-1" style="font-size:10px;padding:2px 6px;margin-right:4px;">' + sh + '1</span>' + s1 +
      '</td>' +
      '<td style="padding:10px 12px;font-size:12px;font-family:\"IBM Plex Mono\",monospace;">' +
        '<span class="break-slot assigned slot-2" style="font-size:10px;padding:2px 6px;margin-right:4px;">' + sh + '2</span>' + s2 +
      '</td>' +
      '<td style="padding:10px 12px;text-align:center;">' +
        '<button class="btn btn-sm" onclick="openShiftConfigModal(\'' + sh + '\')" style="font-size:11px;">Edit</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  var history = (state.shiftConfig || []).filter(function(e) { return e.effectiveFrom; }).sort(function(a,b) {
    return _parseDateKey(b.effectiveFrom) - _parseDateKey(a.effectiveFrom);
  });
  var historyHTML = history.length > 0
    ? '<details style="margin-top:24px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text2);">Change History (' + history.length + ')</summary>' +
      '<div style="margin-top:10px;">' +
      history.map(function(e) {
        var changes = Object.entries(e.breakSlots || {}).map(function(kv) {
          return '<span style="font-size:11px;font-family:\"IBM Plex Mono\",monospace;margin-right:8px;">' + kv[0] + '1: ' + (kv[1][0]||'?') + ' / ' + kv[0] + '2: ' + (kv[1][1]||'?') + '</span>';
        }).join('');
        return '<div style="padding:8px 12px;background:var(--bg3);border-radius:6px;margin-bottom:6px;">' +
          '<span style="font-size:11px;font-weight:700;color:var(--accent);margin-right:12px;">Effective ' + e.effectiveFrom + '</span>' + changes +
        '</div>';
      }).join('') +
      '</div></details>'
    : '';

  return '<div class="page-header"><div>' +
    '<div class="page-title">⚙ Shift Configuration</div>' +
    '<div class="page-sub">Manage shift break slot times. Changes apply to new auto-assignments from the effective date onward.</div>' +
  '</div>' +
  '<button class="btn btn-accent" onclick="openShiftConfigModal(null)" style="white-space:nowrap;">+ Add Shift</button></div>' +
  '<div class="card" style="overflow-x:auto;">' +
  '<table style="width:100%;border-collapse:collapse;">' +
  '<thead><tr style="border-bottom:2px solid var(--border);">' +
    '<th style="padding:8px 16px;text-align:left;font-size:11px;color:var(--text3);">Shift</th>' +
    '<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);">Work Hours</th>' +
    '<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);">Slot 1</th>' +
    '<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);">Slot 2</th>' +
    '<th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text3);"></th>' +
  '</tr></thead>' +
  '<tbody>' + rows + '</tbody>' +
  '</table></div>' +
  '<div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.7;">' +
    '<b>Note:</b> Updating slot times here affects auto-assignment from the effective date onward. ' +
    'Historical break records are stored as short codes (A1/A2) and display correctly via the original config. ' +
    'Update <code>BREAK_SLOTS_MAP</code> in <code>scripts/daily_sync.gs</code> to keep Slack posts in sync.' +
  '</div>' +
  historyHTML +
  _shiftConfigModalHTML();
}

function _shiftConfigModalHTML() {
  return '<div id="modal-shiftcfg" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-shiftcfg\')">' +
  '<div class="modal" style="width:460px;">' +
    '<div class="modal-title" id="shiftcfg-title">Edit Shift</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
      '<label style="font-size:12px;">Shift Letter<br>' +
        '<input id="shiftcfg-letter" type="text" maxlength="2" class="login-input" style="margin-top:4px;text-transform:uppercase;" placeholder="A">' +
      '</label>' +
      '<label style="font-size:12px;">Effective From (DD/MM)<br>' +
        '<input id="shiftcfg-from" type="text" class="login-input" style="margin-top:4px;" placeholder="01/07">' +
      '</label>' +
      '<label style="font-size:12px;">Slot 1 (HH:MM–HH:MM)<br>' +
        '<input id="shiftcfg-s1" type="text" class="login-input" style="margin-top:4px;" placeholder="09:30–11:00">' +
      '</label>' +
      '<label style="font-size:12px;">Slot 2 (HH:MM–HH:MM)<br>' +
        '<input id="shiftcfg-s2" type="text" class="login-input" style="margin-top:4px;" placeholder="11:00–12:30">' +
      '</label>' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn" onclick="closeModal(\'modal-shiftcfg\')">Cancel</button>' +
      '<button class="btn btn-accent" onclick="saveShiftConfigEntry()">Save</button>' +
    '</div>' +
  '</div></div>';
}

function openShiftConfigModal(shift) {
  var todayDk = (function() {
    var n = new Date();
    return n.getDate().toString().padStart(2,'0') + '/' + (n.getMonth()+1).toString().padStart(2,'0');
  })();
  document.getElementById('shiftcfg-title').textContent = shift ? 'Edit Shift ' + shift : 'Add New Shift';
  document.getElementById('shiftcfg-letter').value = shift || '';
  document.getElementById('shiftcfg-letter').disabled = !!shift;
  document.getElementById('shiftcfg-from').value = todayDk;
  var slots = shift ? (getConfigForDate(todayDk).breakSlots[shift] || []) : [];
  document.getElementById('shiftcfg-s1').value = slots[0] || '';
  document.getElementById('shiftcfg-s2').value = slots[1] || '';
  document.getElementById('modal-shiftcfg').classList.add('show');
}

function saveShiftConfigEntry() {
  var letter = document.getElementById('shiftcfg-letter').value.trim().toUpperCase();
  var from   = document.getElementById('shiftcfg-from').value.trim();
  var s1     = document.getElementById('shiftcfg-s1').value.trim();
  var s2     = document.getElementById('shiftcfg-s2').value.trim();

  if (!letter || letter.length > 2) { toast('Enter a shift letter (A–Z).', 'err'); return; }
  if (!from || !/^\d{1,2}\/\d{1,2}/.test(from)) { toast('Enter effective date as DD/MM.', 'err'); return; }
  if (!s1 || !s2) { toast('Enter both slot time windows.', 'err'); return; }

  if (!state.shiftConfig) state.shiftConfig = [];

  // Check if existing baseline needs to be created
  if (state.shiftConfig.length === 0) {
    state.shiftConfig.push({ effectiveFrom: null, breakSlots: Object.assign({}, BREAK_SLOTS) });
  }

  // Append new versioned entry
  state.shiftConfig.push({ effectiveFrom: from, breakSlots: { [letter]: [s1, s2] } });
  state._shiftConfigUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  closeModal('modal-shiftcfg');
  toast('Shift config saved. Effective from ' + from + '.', 'ok');
  nav('shiftconfig');
}
