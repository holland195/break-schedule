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
  const weekRec = DB.getAttendance(u.id, dk);
  // Auto-synced records (note='auto') haven't been reviewed by a leader — skip
  if (weekRec?.note === 'auto') return null;
  const schedShift = (u.schedule?.[dk] || '').charAt(0);
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
  'Agent Training Manager':   0,
  'Agent Training Assistant': 1,
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
  const myShift = currentUser.schedule?.[todayDk]
    || currentUser.schedule?.[getWkDay(todayDk)] || '0';
  const onShift = myShift === currentShift;

  // Pending requests
  const myPending = state.requests.filter(r =>
    r.userId === currentUser.id && r.status === 'pending'
  ).length;
  const allPending = state.requests.filter(r => r.status === 'pending').length;

  // Team breaks today (same shift)
  const shiftMates = getShiftMates(currentShift, todayDk);
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

  // Team breaks today grid
  const teamGrid = shiftMates.length === 0 ? '' : `
<div class="card" style="margin-top:16px;">
  <div class="card-title">👥 Team Breaks Today — Shift ${currentShift} · ${todayDk}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:4px;">
    ${shiftMates.map(u => {
    const br = getAssigned(u.id, todayDk);
    const idx = br ? (BREAK_SLOTS[currentShift] || []).indexOf(br.slot) : -1;
    const isSelf = u.id === currentUser.id;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
        background:${isSelf ? 'var(--bg4)' : 'var(--bg3)'};border-radius:7px;
        border:1px solid ${isSelf ? 'var(--accent)' : 'var(--border)'};">
        <span class="break-slot ${br ? `assigned slot-${idx + 1}` : ''}" style="font-size:10px;padding:3px 8px;min-width:28px;text-align:center;">
          ${br ? getShortSlot(currentShift, br.slot) : '?'}
        </span>
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${u.name}${isSelf ? ' <span style="font-size:10px;color:var(--accent);">(you)</span>' : ''}
            ${u.gender === 'F' ? '<span style="font-size:10px;color:var(--A-color);margin-left:3px;">♀</span>' : ''}
          </div>
          <div style="font-size:10px;color:var(--text3);">${u.team} · ${getRoleInfo(u.role).label}</div>
        </div>
      </div>`;
  }).join('')}
  </div>
</div>`;

  // No schedule imported yet
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
  <div class="card" style="margin-bottom:0;">
    <div class="card-title">📋 Quick Links</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
      <button class="btn" onclick="nav('schedule')" style="text-align:left;justify-content:flex-start;">📅 View Break Schedule</button>
      ${!isLeader(currentUser) ? `<button class="btn" onclick="nav('requests')" style="text-align:left;justify-content:flex-start;">🔄 My Requests ${myPending > 0 ? `<span class="nav-badge" style="display:inline;">${myPending}</span>` : ''}</button>` : ''}
      ${isLeader(currentUser) ? `<button class="btn btn-accent" onclick="nav('arrange')" style="text-align:left;justify-content:flex-start;">✏️ Arrange Breaks ${allPending > 0 ? `<span style="color:var(--warn);font-size:11px;">(${allPending} pending)</span>` : ''}</button>` : ''}
      ${_getUserGender(currentUser) === 'F' || isLeader(currentUser) ? `<button class="btn" onclick="nav('extbreak')" style="text-align:left;justify-content:flex-start;">🌸 30-min Breaks</button>` : ''}
    </div>
  </div>
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

function renderSchedule() {
  const canPickWeek = isLeader(currentUser);
  const canViewFutureWeeks = !isLeader(currentUser); // agents can view future but not edit
  if (isTraining(currentUser)) {
    if (typeof renderScheduleTraining === 'function') return renderScheduleTraining();
    return '<div class="empty">Loading…</div>';
  }
  const isTrainingUser = isTraining(currentUser);
  const shiftToShow = isTrainingUser
    ? (window._scheduleShiftTab || 'A')
    : currentShift;

  let weekDates;
  if (scheduleMonday) {
    weekDates = getWeekRange(scheduleMonday);
  } else {
    weekDates = getWeekDates();
  }

  const dateToDayName = {};
  weekDates.forEach((dk, i) => { dateToDayName[dk] = WEEK_DAYS[i]; });

  function getUserShift(u, dateKey) {
    return u.schedule[dateKey] || u.schedule[dateToDayName[dateKey]] || '0';
  }

  const schedSearch = window._schedSearch || '';
  const shiftSlots = BREAK_SLOTS[shiftToShow] || [];
  const _tNow = new Date();
const todayDk = `${_tNow.getDate().toString().padStart(2,'0')}/${(_tNow.getMonth()+1).toString().padStart(2,'0')}`;

  // All users on this shift (unfiltered, for totals)
  const allShiftUsers = state.users.filter(u =>
    weekDates.some(dk => getUserShift(u, dk) === shiftToShow)
  );

  // Slot totals across the week
  let slot1Count = 0, slot2Count = 0;
  allShiftUsers.forEach(u => {
    weekDates.forEach(dk => {
      const br = DB.getBreak(u.id, dk);
      if (!br) return;
      const idx = shiftSlots.indexOf(br.slot);
      if (idx === 0) slot1Count++;
      else if (idx === 1) slot2Count++;
    });
  });

  // Filtered for display
  let shiftUsers = [...allShiftUsers];
  if (schedSearch) {
    const q = schedSearch.toLowerCase();
    shiftUsers = shiftUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  }

  // Week picker (leaders only)
  let weekPickerHTML = '';
    if (canPickWeek) {
    const allDates = Object.keys(state.users[0]?.schedule || {});
    const sundays = allDates.filter(d => getWkDay(d) === 'Sun').sort((a, b) => {
      const [da, ma] = a.split('/'); const [db, mb] = b.split('/');
      return new Date(2026, parseInt(ma)-1, parseInt(da)) - new Date(2026, parseInt(mb)-1, parseInt(db));
    });
    const activeSun = scheduleMonday || weekDates[0];
    weekPickerHTML = sundays.length > 0 ? `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">WEEK:</span>
        <select class="login-select" style="padding:4px 8px;font-size:11px;"
          onchange="scheduleMonday=this.value;nav('schedule')">
          ${sundays.map(s => {
            const [d, m] = s.split('/');
            const end = new Date(2026, parseInt(m)-1, parseInt(d)+6);
            const endStr = String(end.getDate()).padStart(2,'0') + '/' + String(end.getMonth()+1).padStart(2,'0');
            return `<option value="${s}" ${s === activeSun ? 'selected' : ''}>${s} – ${endStr}</option>`;
          }).join('')}
        </select>
      </div>` : '';
  }


let agentWeekPickerHTML = '';
  if (!canPickWeek) {
    const _allDates = Object.keys(state.users[0]?.schedule || {});
    const _todayMMDD = (() => { const n = new Date(); return (n.getMonth()+1)*100 + n.getDate(); })();
    const _agentSundays = _allDates
      .filter(d => getWkDay(d) === 'Sun')
      .filter(d => {
        const [dd, mm] = d.split('/').map(Number);
        // Show current week (sun that started this week) and future
        const sundayMMDD = mm * 100 + dd;
        // Current week's Sunday: go back to this week's Sunday
        const now = new Date();
        const thisSun = new Date(now); thisSun.setDate(now.getDate() - now.getDay());
        const thisSunMMDD = (thisSun.getMonth()+1)*100 + thisSun.getDate();
        return sundayMMDD >= thisSunMMDD;
      })
      .sort((a, b) => {
        const [da, ma] = a.split('/'); const [db, mb] = b.split('/');
        return new Date(2026, parseInt(ma)-1, parseInt(da)) - new Date(2026, parseInt(mb)-1, parseInt(db));
      });
    const _activeSun = scheduleMonday || weekDates[0];
    if (_agentSundays.length > 0) {
      agentWeekPickerHTML = `
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">WEEK:</span>
          <select class="login-select" style="padding:3px 7px;font-size:11px;"
            onchange="scheduleMonday=this.value;nav('schedule')">
            ${_agentSundays.map(s => {
              const [d, m] = s.split('/');
              const end = new Date(2026, parseInt(m)-1, parseInt(d)+6);
              const endStr = String(end.getDate()).padStart(2,'0') + '/' + String(end.getMonth()+1).padStart(2,'0');
              return `<option value="${s}" ${s === _activeSun ? 'selected' : ''}>${s} – ${endStr}</option>`;
            }).join('')}
          </select>
        </div>`;
    }
  }

  // Shift tab bar for training role
  const shiftTabsHTML = isTrainingUser ? `
    <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
      ${['A', 'D', 'E'].map(sh => {
    const active = shiftToShow === sh;
    const cnt = state.users.filter(u => weekDates.some(dk => getUserShift(u, dk) === sh)).length;
    return `<button onclick="window._scheduleShiftTab='${sh}';window._schedSearch='';nav('schedule')"
          style="padding:7px 18px;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;
            border:1.5px solid ${active ? `var(--${sh}-color)` : 'var(--border)'};
            background:${active ? `var(--${sh}-bg)` : 'var(--bg2)'};
            color:${active ? `var(--${sh}-color)` : 'var(--text2)'};transition:all .12s;">
          Shift ${sh}
          <span style="font-size:10px;opacity:.7;margin-left:4px;">${cnt}</span>
        </button>`;
  }).join('')}
    </div>` : '';

  // Compact card: search + shift stats combined
  const slotTotalsHTML = shiftSlots.length > 0 ? `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 14px;
      background:var(--bg3);border-radius:8px;border:1px solid var(--border);
      margin-bottom:14px;flex-wrap:wrap;">
      <input class="filter-input" style="flex:1;min-width:160px;max-width:260px;padding:5px 10px;font-size:12px;"
        placeholder="🔍 Search by name…"
        value="${schedSearch}"
        oninput="window._schedSearch=this.value;
          const q=this.value.toLowerCase();
          document.querySelectorAll('#sched-tbody tr').forEach(r=>{
            const nm=(r.querySelector('.sched-name')||{}).textContent||'';
            r.style.display=nm.toLowerCase().includes(q)?'':'none';
          });
          document.getElementById('sched-count').textContent=([...document.querySelectorAll('#sched-tbody tr')].filter(r=>r.style.display!=='none').length)+' staff';">
      <span style="color:var(--border2);flex-shrink:0;">|</span>
      <span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;">
        Shift ${shiftToShow}
        <span style="color:var(--accent);margin-left:4px;" id="sched-count">${shiftUsers.length}</span>
        <span style="color:var(--text3);font-size:11px;font-weight:400;"> staff</span>
      </span>
      <span style="color:var(--border2);flex-shrink:0;">|</span>
      ${shiftSlots.map((time, i) => {
    const count = i === 0 ? slot1Count : slot2Count;
    return `<span style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
          <span class="break-slot slot-${i + 1}" style="font-size:10px;padding:2px 7px;">${shiftToShow}${i + 1}</span>
          <span style="font-size:12px;color:var(--text);font-weight:600;">${count}</span>
          <span style="font-size:11px;color:var(--text3);">assigned</span>
        </span>`;
  }).join(`<span style="color:var(--border2);">·</span>`)}
    </div>` : '';

  // Legend
  const legendItems = shiftSlots.map((time, i) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="break-slot assigned slot-${i + 1}" style="font-size:10px;min-width:28px;text-align:center;">${shiftToShow}${i + 1}</span>
      <span style="color:var(--text2);font-size:11px;">${time}</span>
    </div>`).join('');

  // Table header
  const theadCells = weekDates.map((dk, i) => {
    const isToday = dk === todayDk;
    return `<th style="min-width:70px;text-align:center;padding:8px 4px;
      background:${isToday ? 'rgba(31,102,241,.08)' : 'var(--bg3)'};
      border-bottom:2px solid ${isToday ? 'var(--accent)' : 'var(--border2)'};">
      <div style="color:${isToday ? 'var(--accent)' : 'var(--text2)'};font-size:11px;font-weight:700;">${WEEK_DAYS[i]}</div>
      <div style="font-size:10px;color:${isToday ? 'var(--accent)' : 'var(--text3)'};font-weight:400;">${dk}</div>
    </th>`;
  }).join('');

  // Table body
  const tbodyRows = shiftUsers.map(u => {
    const cells = weekDates.map(dk => {
      const userShift = getUserShift(u, dk);
      if (userShift !== shiftToShow) {
        return `<td style="text-align:center;padding:6px 4px;">
          <span style="font-size:10px;color:var(--text3);">—</span></td>`;
      }
      const br = DB.getBreak(u.id, dk);
      const _extEntries = DB.getExtBreaks(u.id, currentMonthKey()) || [];
      const hasExt = _extEntries.some(e => {
        const _days = (e.days && e.days.length > 0) ? e.days : (e.day ? [e.day] : []);
        return _days.includes(dk);
      });
      const slotIdx = br ? getShortSlot(shiftToShow, br.slot) : '';
      const slotNum = slotIdx.length === 2 ? parseInt(slotIdx[1]) : 0;
      const slotCls = slotNum > 0 ? `slot-${slotNum}` : '';
      const shortCode = br ? getShortSlot(shiftToShow, br.slot) : '?';


      return `<td style="text-align:center;padding:4px 2px;"${hasExt ? ' class="cell-female-ext"' : ''}>
        <span class="${br ? `break-slot assigned ${slotCls}` : ''}"
          style="font-size:10px;padding:3px 8px;${br ? '' : 'color:var(--text3)'}"
          title="${br ? br.slot + (hasExt ? ' 🌸+30min' : '') : 'Not assigned'}">
          ${shortCode}${hasExt ? ' 🌸' : ''}
        </span></td>`;
    }).join('');
    return `<tr>
      <td class="sched-name-col">
        <div class="sched-name">${u.name}</div>
        <div class="sched-meta">${u.team || ''} · ${getRoleInfo(u.role).label}</div>
      </td>${cells}
    </tr>`;
  }).join('');

  const emptyMsg = shiftUsers.length === 0
    ? `<div class="empty" style="padding:40px;">
        <div class="empty-ico">👥</div>
        ${schedSearch ? `No results for "${schedSearch}"` : `No staff on Shift ${shiftToShow} this week.`}
      </div>`
    : '';

  return `
<div class="schedule-title-row">
  <div>
    <div class="page-title">Break Schedule${isTrainingUser ? ' — All Shifts' : ` — Shift ${shiftToShow}`}</div>
    <div class="page-sub">${SHIFTS[shiftToShow]?.display || ''}</div>
  </div>
  <div class="schedule-legend-inline" style="flex-wrap:wrap;gap:8px;">
    ${canPickWeek ? weekPickerHTML : agentWeekPickerHTML}
    <span style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Legend:</span>
    ${legendItems || '<span style="color:var(--text3);font-size:11px">—</span>'}
  </div>
</div>

${shiftTabsHTML}
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
</div>`: ''}`;
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

  const allReqs = isLeader(currentUser) ? state.requests : state.requests.filter(r => r.userId === currentUser.id);
  const myReqs = allReqs.filter(r => {
    const d = new Date(r.at);
    const rym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return rym === filterYM;
  });

  const pending = myReqs.filter(r => r.status === 'pending');
  const rest = myReqs.filter(r => r.status !== 'pending');

  const card = (r) => {
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
    <div class="page-sub">${isLeader(currentUser) ? `${cntPending} pending · your shift` : 'Your break swap requests'}</div>
  </div>
  ${!isLeader(currentUser) ? `<button class="btn btn-accent" onclick="openRequestModal()">+ New swap</button>` : ''}
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
let arrangeMainTab = 'assign'; // 'assign' | 'overview' | 'split'
let arrangeActiveDay = null;   // set on first render
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
  const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const sundays = allDates.filter(d => getWkDay(d) === 'Sun').sort((a, b) => {
  const [da, ma] = a.split('/'); const [db, mb] = b.split('/');
  return new Date(2026, parseInt(ma) - 1, parseInt(da)) - new Date(2026, parseInt(mb) - 1, parseInt(db));
});
const weekPickerHTML = sundays.length > 0 ? `
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">WEEK:</span>
    <select class="login-select" style="padding:4px 8px;font-size:11px;"
      onchange="activeMonday=this.value;arrangeActiveDay=null;nav('arrange')">
      ${sundays.map(s => {
        const [d, m] = s.split('/');
        const end = new Date(2026, parseInt(m)-1, parseInt(d)+6);
        const endStr = `${end.getDate().toString().padStart(2,'0')}/${(end.getMonth()+1).toString().padStart(2,'0')}`;
        return `<option value="${s}" ${s === activeMonday ? 'selected' : ''}>${s} – ${endStr}</option>`;
      }).join('')}
    </select>
  </div>` : '';

  return `
<div class="page-header">
  <div class="page-title">Arrange Breaks — Shift ${currentShift}</div>
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    ${weekPickerHTML}
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
</div>

<div id="arrange-main-content">
  ${arrangeMainTab === 'assign' ? _renderArrangeAssignTab(weekRange)
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

function onBreakSplitSlide(shift, rawVal) {
  const pct1 = parseInt(rawVal);
  const pct2 = 100 - pct1;
  const lbl1 = document.getElementById(`split-lbl-${shift}-1`);
  const lbl2 = document.getElementById(`split-lbl-${shift}-2`);
  if (lbl1) lbl1.textContent = `${pct1}%`;
  if (lbl2) lbl2.textContent = `${pct2}%`;
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
  const changedShifts = new Set();
  VISIBLE_SHIFTS.forEach(shift => {
    const slider = document.getElementById(`split-slider-${shift}`);
    if (!slider) return;
    const newPct = parseInt(slider.value);
    const oldPct = getBreakSplitPct(shift);
    if (newPct !== oldPct) changedShifts.add(shift);
    setBreakSplitPct(shift, newPct);
  });

  if (changedShifts.size > 0) {
    // 1. Clear break records (including manual) from this week onward so the new % takes effect
    _clearAutoBreaksFromWeek(activeMonday, changedShifts, true);
    
    // 2. Clear out the stale chronological rotation historical offsets for the modified shifts
    const rot = _loadRotation();
    changedShifts.forEach(shift => {
      ['agent', 'qa', 'sr_qa'].forEach(tier => {
        delete rot[`${shift}_${tier}`];
      });
    });
    _saveRotation(rot);

    // 3. Re-execute assign operations cleanly
    const result = autoAssignBreaks(state.users);
    await syncWrite();
    toast(`Distribution saved. Re-assigned ${result.assigned} break(s) from week ${activeMonday}.`, 'ok');
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
  const allShiftTeams = [...new Set(state.users.filter(u =>
    weekRange.some(d => {
      const dayName = WEEK_DAYS[weekRange.indexOf(d)];
      return u.schedule[d] === currentShift || u.schedule[dayName] === currentShift;
    })
  ).map(u => u.team))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  const slots = BREAK_SLOTS[currentShift] || [];

  // ── Combined: Break Split + Bulk Assign in one card ──
  const _splitSaved  = getBreakSplitPct(currentShift);
  const _splitPct1   = _splitSaved !== null ? _splitSaved : 50;
  const _splitPct2   = 100 - _splitPct1;
  const _splitCustom = _splitSaved !== null;

  const splitRow = slots.length >= 2 ? `
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
  </div>` : '';

  const combinedPanel = `
<div class="bulk-panel" style="margin-bottom:20px;display:block;padding:12px 16px;">
  ${splitRow}
  <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">
    <div class="bulk-panel-section">
      <div class="bulk-panel-label">Groups</div>
      <div class="group-checkbox-list">
        ${allShiftTeams.map(t => `
          <label class="group-check-item">
            <input type="checkbox" name="bulk-group" value="${t}"
              ${_bulkGroups.has(t) ? 'checked' : ''} onchange="_saveBulkGroups()"> ${t}
          </label>`).join('')}
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
  </div>
</div>`;

  const weekTable = getArrangeDayMemberList(null);
  return combinedPanel + weekTable;
}

function _renderArrangeOverviewTab(weekRange) {
  // All users on this shift in the week
  const shiftUsers = state.users.filter(u =>
    weekRange.some(d => {
      const dn = WEEK_DAYS[weekRange.indexOf(d)];
      return u.schedule[d] === currentShift || u.schedule[dn] === currentShift;
    })
  );

  if (!shiftUsers.length) return `<div class="empty"><div class="empty-ico">👥</div>No staff on Shift ${currentShift} this week.</div>`;

  const todayDkOv = getWeekDates()[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
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
      ${WEEK_DAYS[i]}<br>
      <span style="font-weight:400;font-size:9px;opacity:0.7;">${d}</span>
    </th>`;
  }).join('');

  const summaryRows = shiftUsers.map(u => {
    const dayCells = weekRange.map((d, i) => {
      const dn = WEEK_DAYS[i];
      const shiftVal = u.schedule[d] || u.schedule[dn] || '0';
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
      title="${br ? br.slot : 'Not assigned — click to assign'}">
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
  const totalSlots = shiftUsers.length * weekRange.filter(d => shiftUsers.some(u => {
    const dn = WEEK_DAYS[weekRange.indexOf(d)];
    return u.schedule[d] === currentShift || u.schedule[dn] === currentShift;
  })).length;

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

// Full-week assign table — all days as columns, no gender col, clear slot states
function getArrangeDayMemberList(_unused) {
  const weekRange = getWeekRange(activeMonday); // now Sun–Sat since activeMonday = Sunday
  const slots = BREAK_SLOTS[currentShift] || [];
  // Compute today's dateKey directly (robust, no index math)
  const _now = new Date();
  const todayDk = `${_now.getDate().toString().padStart(2,'0')}/${(_now.getMonth()+1).toString().padStart(2,'0')}`;
  // Normalize dashes for slot comparison
  const nd = (x) => (x||'').replace(/[\u2012\u2013\u2014\u002D\u2212]/g, '-').replace(/\s/g, '');

  // All users on this shift in ANY day this week
  const allMates = state.users.filter(u =>
    weekRange.some(d => {
      const dn = WEEK_DAYS[weekRange.indexOf(d)];
      return u.schedule[d] === currentShift || u.schedule[dn] === currentShift;
    })
  );

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
      const dn = WEEK_DAYS[weekRange.indexOf(d)];
      const shiftVal = u.schedule[d] || u.schedule[dn] || '0';
      const onShift = shiftVal === currentShift;
      const isToday = d === todayDk;

      // Day off or different shift — show nothing
      if (!onShift) {
        return `<td class="arr-cell arr-cell-off${isToday ? ' arr-cell-today' : ''}">
          <span style="color:var(--text3);font-size:12px;">—</span>
        </td>`;
      }

      const br = getAssigned(u.id, d) || getAssigned(u.id, dn);
      const br_idx = br ? (slots.indexOf(br.slot)) : -1;

      function _nd(s) { return (s || '').replace(/[\u2012\u2013\u2014\u002D]/g, '-').replace(/\s/g, ''); }

      const slotBtns = slots.map((s, idx) => {
        // Normalize both sides for comparison to handle any dash variant in stored data
        const isAssigned = br && nd(br.slot) === nd(s);
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
      const dn = WEEK_DAYS[weekRange.indexOf(d)];
      let s1 = 0, s2 = 0;
      tierUsers.forEach(u => {
        const onShift = u.schedule[d] === currentShift || u.schedule[dn] === currentShift;
        if (!onShift) return;
        const br = getAssigned(u.id, d) || getAssigned(u.id, dn);
        if (!br) return;
        //const code = getShortSlot(currentShift, br.slot);
        const idx = slots.findIndex(s => nd(s) === nd(br.slot));
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

// Keep quickAssign for backward compatibility (used by other callers)
function quickAssign(uid, day, slot) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  assign(uid, day, slot, '');
  toast(`Break assigned: ${getShortSlot(currentShift, slot) || slot}`);
  const wrap = document.querySelector('.arr-table-wrap');
  if (wrap) { wrap.outerHTML = getArrangeDayMemberList(null); }
  else { const c = document.getElementById('arrange-day-content'); if (c) c.innerHTML = getArrangeDayMemberList(null); }
  updateBadge();
}

// New: uses slot index instead of raw slot string in onclick — avoids en-dash encoding issues
function quickAssignByIndex(uid, day, slotIdx) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  const slot = (BREAK_SLOTS[currentShift] || [])[slotIdx];
  if (!slot) { toast('Invalid slot.', 'err'); return; }
  quickAssign(uid, day, slot);
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

  const actualTime = (BREAK_SLOTS[currentShift] || [])[slotIdx];
  if (!actualTime) { toast('Invalid slot selected.', 'err'); return; }

  let totalAssigned = 0;
  selectedDays.forEach(day => {
    selectedGroups.forEach(team => {
      const dayName = getWkDay(day);
      const targets = state.users.filter(u =>
        u.team === team && (u.schedule[day] === currentShift || u.schedule[dayName] === currentShift)
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
  mates.forEach((u, i) => assign(u.id, day, slots[i % slots.length], 'auto'));
  toast(`Auto-filled ${mates.length} breaks for today`, 'ok');
  nav('arrange');
}

function autofillWeek() {
  let count = 0;
  WEEK_DAYS.forEach(day => {
    const mates = getShiftMates(currentShift, day);
    const slots = BREAK_SLOTS[currentShift] || [];
    mates.forEach((u, i) => { assign(u.id, day, slots[i % slots.length], 'auto'); count++; });
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
  return `
<div class="page-header">
  <div><div class="page-title">Staff</div></div>
</div>
<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">
  <button onclick="staffSubTab='info';nav('staff')"
    style="padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;
      background:none;color:${staffSubTab === 'info' ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:3px solid ${staffSubTab === 'info' ? 'var(--accent)' : 'transparent'};
      margin-bottom:-2px;transition:all .12s;">
    👤 Staff Info
  </button>
  <button onclick="staffSubTab='schedule';nav('staff')"
    style="padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;
      background:none;color:${staffSubTab === 'schedule' ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:3px solid ${staffSubTab === 'schedule' ? 'var(--accent)' : 'transparent'};
      margin-bottom:-2px;transition:all .12s;">
    📅 Staff Schedule
  </button>
  <button onclick="staffSubTab='attendance';nav('staff')"
    style="padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;
      background:none;color:${staffSubTab === 'attendance' ? 'var(--accent)' : 'var(--text2)'};
      border-bottom:3px solid ${staffSubTab === 'attendance' ? 'var(--accent)' : 'transparent'};
      margin-bottom:-2px;transition:all .12s;">
    📋 Staff Attendance
  </button>
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

  return `
<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
  <input class="filter-input" style="width:260px;" placeholder="Search name, username, emp#, role…"
    value="${infoFilter}"
    oninput="staffFilters._info=this.value;document.getElementById('staff-info-tbody').innerHTML=_renderStaffInfoRows(this.value)">
  <span style="font-size:11px;color:var(--text3);">${filtered.length} records</span>
  ${isLeader(currentUser) ? `
  <div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
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
        <th>EMP#</th><th>FULL NAME</th><th>USERNAME</th><th>GENDER</th><th>DATE OF BIRTH</th><th>POSITION</th>
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
    const g = u.gender === 'F'
      ? `<span style="color:var(--A-color);font-size:15px;" title="Female">♀</span>`
      : u.gender === 'M'
        ? `<span style="color:var(--B-color);font-size:15px;" title="Male">♂</span>`
        : `<span style="color:var(--text3);font-size:11px;">—</span>`;

    const roleLvl = ROLE_SORT_ORDER[_resolveRole(u.role)] ?? 9;
    const roleColor = roleLvl <= 1 ? 'var(--accent)'
      : roleLvl <= 2 ? 'var(--warn)'
        : roleLvl <= 3 ? 'var(--ok)'
          : 'var(--text2)';

    // empNo and dob come from local staffInfo (Excel import) — never from cloud
    const empNo = u.empNo || '—';
    const dob   = u.dob   || '—';

    return `<tr>
      <td class="mono" style="font-size:11px;color:var(--text3);">${empNo}</td>
      <td style="font-weight:600;">${u.name || '—'}</td>
      <td class="mono" style="color:var(--accent);font-size:11px;">${u.username}</td>
      <td style="text-align:center;">${g}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);">${dob}</td>
      <td style="font-size:11px;color:${roleColor};font-weight:500;">${_resolveRole(u.role) || '—'}</td>
    </tr>`;
  }).join('');
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

  // 1. Save the parsed users to state
  state.users = _tempImportedUsers;
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
  const hasUsers = state.users && state.users.length > 0;

  if (!hasUsers) {
    return `
<div class="empty" style="padding:48px 0;">
  <div class="empty-ico">📋</div>
  <div>No schedule data available.</div>
  <div style="font-size:12px;color:var(--text3);margin-top:6px;">Schedule is synced automatically from Google Sheets each morning.</div>
</div>`;
  }

  const allDates = Object.keys(
    state.users.find(u => Object.keys(u.schedule).some(k => /\d{2}\/\d{2}/.test(k)))?.schedule
    || state.users[0]?.schedule || {}
  ).sort((a, b) => {
    const [da, ma] = a.split('/').map(Number);
    const [db, mb] = b.split('/').map(Number);
    return ma !== mb ? ma - mb : da - db;
  });

  // Available months (zero-padded MM strings) from schedule data
  const availableMonths = [...new Set(allDates.filter(d => /\d{2}\/\d{2}/.test(d)).map(d => d.split('/')[1]))].sort();

  // Auto-init or validate _schedMonth
  if (!_schedMonth || !availableMonths.includes(_schedMonth)) {
    const activeMM = activeMonday.split('/')[1];
    _schedMonth = availableMonths.includes(activeMM) ? activeMM : (availableMonths[0] || activeMM);
  }

  // Snap activeMonday to selected month if it drifted
  if (activeMonday.split('/')[1] !== _schedMonth) {
    const firstSun = _sortDateKeys(allDates.filter(d => getWkDay(d) === 'Sun' && d.split('/')[1] === _schedMonth))[0];
    if (firstSun) activeMonday = firstSun;
  }

  const monthSundays = _sortDateKeys(allDates.filter(d => getWkDay(d) === 'Sun' && d.split('/')[1] === _schedMonth));
  const weekRange = getWeekRange(activeMonday);
  const monthDates = _sortDateKeys(allDates.filter(d => /\d{2}\/\d{2}/.test(d) && d.split('/')[1] === _schedMonth));
  const displayDates = showFullMonth ? monthDates : weekRange;

  const MONTH_LABELS = {'01':'January','02':'February','03':'March','04':'April','05':'May','06':'June',
    '07':'July','08':'August','09':'September','10':'October','11':'November','12':'December'};

  const filteredUsers = state.users.filter(u =>
    (u.team || '').toLowerCase().includes(staffFilters.team.toLowerCase()) &&
    (u.name || '').toLowerCase().includes(staffFilters.name.toLowerCase()) &&
    (u.username || '').toLowerCase().includes(staffFilters.user.toLowerCase()) &&
    (_resolveRole(u.role) || '').toLowerCase().includes(staffFilters.role.toLowerCase())
  );

  return `
<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
  <label style="font-size:11px;opacity:.7;">Month:</label>
  <select class="login-select" style="width:130px;padding:4px;" onchange="_schedMonth=this.value;showFullMonth=true;nav('staff')">
    ${availableMonths.map(m => `<option value="${m}" ${m === _schedMonth ? 'selected' : ''}>${MONTH_LABELS[m] || m}</option>`).join('')}
  </select>
  <button class="toggle-btn ${showFullMonth ? 'active' : ''}" onclick="showFullMonth=!showFullMonth;nav('staff')" style="font-size:11px;">
    ${showFullMonth ? '🗓 Week view' : '🗓 Full month'}
  </button>
  ${!showFullMonth ? `<label style="font-size:11px;opacity:.7;">Week:</label>
  <select class="login-select" style="width:160px;padding:4px;" onchange="activeMonday=this.value;nav('staff')">
    ${monthSundays.map(s => {
      const end = getWeekRange(s)[6];
      return `<option value="${s}" ${s === activeMonday ? 'selected' : ''}>${s} – ${end}</option>`;
    }).join('')}
  </select>` : ''}
  <span style="font-size:11px;color:var(--text3);margin-left:auto;">${filteredUsers.length} staff</span>
</div>

<div class="staff-tbl-wrap">
  <table>
    <thead>
      <tr class="filter-row">
        <td><input class="filter-input" placeholder="Group…"  value="${staffFilters.team}" oninput="staffFilters.team=this.value;_liveFilter()"></td>
        <td><input class="filter-input" placeholder="Name…"   value="${staffFilters.name}" oninput="staffFilters.name=this.value;_liveFilter()"></td>
        <td><input class="filter-input" placeholder="User…"   value="${staffFilters.user}" oninput="staffFilters.user=this.value;_liveFilter()"></td>
        <td><input class="filter-input" placeholder="Role…"   value="${staffFilters.role}" oninput="staffFilters.role=this.value;_liveFilter()"></td>
        <td colspan="${displayDates.length}" style="padding-left:12px;color:var(--text3);font-size:10px;font-family:'IBM Plex Mono',monospace;">SCHEDULE</td>
      </tr>
      <tr>
        <th>GROUP</th><th>FULL NAME</th><th>USER</th><th>POSITION</th>
        ${displayDates.map(d => `<th class="c" style="min-width:42px;padding:6px 2px;">
          <div style="color:var(--accent);font-size:11px;">${d}</div>
          <div style="font-size:8px;font-weight:400;opacity:.5;margin-top:2px;">${getWkDay(d)}</div>
        </th>`).join('')}
      </tr>
    </thead>
    <tbody id="staff-tbody">${renderStaffRows(filteredUsers, displayDates)}</tbody>
  </table>
</div>`;
}

var _attNow = new Date();
let _attImportMonth = _attNow.getDate() >= 25
  ? (_attNow.getMonth() === 11 ? 1 : _attNow.getMonth() + 2)
  : _attNow.getMonth() + 1;
let _attImportYear = (_attNow.getDate() >= 25 && _attNow.getMonth() === 11)
  ? _attNow.getFullYear() + 1
  : _attNow.getFullYear();
let _staffAttConflictFilter = false;

function _renderStaffAttendance() {
  const year = _attImportYear;
  const month = _attImportMonth;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const monthLabel = `${new Date(prevYear, prevMonth - 1, 25).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(year, month - 1, 24).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const dates = _getAllDatesInMonth(year, month);
  const attData = state.monthlyAttendance || {};

  const monthPicker = `
      <select class="login-select" style="padding:5px 8px;font-size:12px;width:110px;"
        onchange="_attImportMonth=+this.value;nav('staff')">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m =>
    `<option value="${m}" ${m === month ? 'selected' : ''}>${new Date(year, m - 1, 1)
      .toLocaleString('en-US', { month: 'long' })}</option>`
  ).join('')}
      </select>
      <select class="login-select" style="padding:5px 8px;font-size:12px;width:70px;"
        onchange="_attImportYear=+this.value;nav('staff')">
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
    <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin-bottom:10px;">
      <span style="background:var(--C-bg);color:var(--ok);padding:2px 8px;border-radius:4px;font-weight:500;">XA–XE</span> Working day
      <span style="background:rgba(245,158,11,.12);color:var(--warn);padding:2px 8px;border-radius:4px;font-weight:500;">D1/D2</span> Half day
      <span style="background:var(--D-bg);color:var(--err);padding:2px 8px;border-radius:4px;font-weight:500;">OFF</span> Off / Leave
      <span style="background:var(--D-bg);color:var(--err);padding:2px 8px;border-radius:4px;font-weight:700;border:1.5px solid var(--err);">⚠</span> Conflict with attendance log
    </div>`;

  // Build table header dates
  const WDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const theadDates = dates.map(dk => {
    const [_d, _m] = dk.split('/');
    const _cy = (parseInt(_m) === month) ? year : (month === 1 ? year - 1 : year);
    const dow = new Date(_cy, parseInt(_m) - 1, parseInt(_d)).getDay();
    const isWknd = dow === 0 || dow === 6;
    const isSun = dow === 0;
    return `<th style="min-width:54px;width:54px;padding:4px 2px;text-align:center;
      font-size:10px;font-weight:600;
      color:${isSun ? 'var(--err)' : isWknd ? 'var(--warn)' : 'var(--text2)'};
      background:${isWknd ? 'var(--bg4)' : 'var(--bg3)'};
      border-bottom:2px solid ${isSun ? 'var(--err)' : isWknd ? 'var(--border2)' : 'var(--accent)'};
      border-left:${isSun ? '2px solid var(--border)' : 'none'};
      position:sticky;top:0;z-index:2;white-space:nowrap;">
      <div style="font-size:9px;opacity:.65;line-height:1.5;">${WDAY_SHORT[dow]}</div>
      <div style="font-size:11px;line-height:1.3;letter-spacing:-.3px;">${_d}/<span style="font-size:9px;opacity:.7;">${_m}</span></div>
    </th>`;
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
    const fu = state.users.find(u => u.username === uname);
    if (fu) return Object.assign({}, fu, { empNo: fu.empNo || _pcEmpNo[uname] || '' });
    const si = state.staffInfo?.[uname];
    return si ? { username: uname, name: si.name || uname, role: si.role || '', team: si.team || '', empNo: si.empNo || _pcEmpNo[uname] || '', id: null } : null;
  }).filter(Boolean).sort((a, b) => {
    const td = _attTier(a.role) - _attTier(b.role);
    return td !== 0 ? td : (a.name || '').localeCompare(b.name || '');
  });

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
  const filteredUsers = _staffAttConflictFilter
    ? rowUsers.filter(u => _preConflicts[u.username]?.length > 0)
    : rowUsers;

  var _shColors = {
    A: ['rgba(14,165,233,.14)','#0ea5e9'],
    B: ['rgba(14,165,233,.14)','#0ea5e9'],
    C: ['rgba(14,165,233,.14)','#0ea5e9'],
    D: ['rgba(14,165,233,.14)','#0ea5e9'],
    E: ['rgba(14,165,233,.14)','#0ea5e9']
  };
  var _hdColor = ['rgba(167,139,250,.14)','#a78bfa'];

  const tbodyRows = filteredUsers.map(u => {
    const uAtt = attData[u.username]?.[monthKey] || {};
    const conflicts = _preConflicts[u.username] || [];

    const cells = dates.map(dk => {
      const rawCode = uAtt[dk];
      const parsed = _parseAttCode(rawCode);
      const [_dd, _mm] = dk.split('/');
      const _cellYear = (parseInt(_mm) === month) ? year : (month === 1 ? year - 1 : year);
      const dow = new Date(_cellYear, parseInt(_mm) - 1, parseInt(_dd)).getDay();
      const isWknd = dow === 0 || dow === 6;

      if (!rawCode && !parsed) {
        return `<td style="text-align:center;padding:2px 1px;background:${isWknd ? 'var(--bg4)' : ''};">
          <span style="font-size:10px;color:var(--text3);">·</span></td>`;
      }

      const _preCell = conflicts.find(c => c.dk === dk);
      const conflictList = _preCell ? _preCell.msgs : null;
      const hasConflict = !!_preCell;

      let bg = '', txt = '', color = '';
      if (!parsed) {
        txt = rawCode || '?'; color = 'color:var(--text3);';
      } else if (parsed.type === 'OFF') {
        bg = 'background:var(--D-bg);';
        const code = String(rawCode).toUpperCase();
        txt = code === '0' || code === '0.0' ? '0' : (code === 'A' ? 'AL' : code);
        color = 'color:var(--err);font-weight:600;';
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
      const dimWknd = isWknd && parsed?.type !== 'OFF' && !hasConflict;
      const title = conflictList ? conflictList.join(' | ') : (parsed?.reason || rawCode || '');

      const _conflictShift = (u.schedule?.[dk] || u.schedule?.[getWkDay(dk)] || '').charAt(0) || 'A';
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

      return `<td style="text-align:center;padding:2px 2px;min-width:54px;width:54px;${bg}${dimWknd ? 'opacity:.55;' : ''}"
        title="${title}" ${conflictClick}>
        <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;${color}">${txt}${conflictBadge}</span>
      </td>`;

    }).join('');

    const rowBg = conflicts.length ? 'background:rgba(248,113,113,.03);' : '';
    const stickyCell = 'position:sticky;z-index:1;background:var(--bg2);';
    return `<tr style="border-bottom:0.5px solid var(--border);${rowBg}">
      <td style="padding:5px 8px;white-space:nowrap;${stickyCell}left:0;min-width:92px;width:92px;font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${u.empNo || '—'}</td>
      <td style="padding:5px 10px;white-space:nowrap;${stickyCell}left:92px;min-width:165px;width:165px;border-left:1px solid var(--border);">
        <div style="font-size:12px;font-weight:600;">${u.name}</div>
      </td>
      <td style="padding:5px 8px;white-space:nowrap;${stickyCell}left:257px;min-width:145px;width:145px;border-left:1px solid var(--border);font-size:11px;color:var(--text2);">${getRoleInfo(u.role).label || _resolveRole(u.role) || '—'}</td>
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

  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      ${monthPicker}
      ${conflictFilterBtn}
      <span style="font-size:11px;color:var(--text3);margin-left:4px;">${rowUsers.length} staff</span>
    </div>
    ${legendHTML}
    <div style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 280px);border:1px solid var(--border);border-radius:8px;">
      <table style="border-collapse:collapse;width:max-content;min-width:100%;">
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
      Object.keys(state.attendance || {}).forEach(key => {
        const rec = state.attendance[key];
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
  return users.map(u => `<tr>
    <td class="mono" style="font-size:11px;">${u.team || '—'}</td>
    <td style="font-weight:600">${u.name}</td>
    <td class="mono" style="color:var(--accent);font-size:11px;">${u.username || ''}</td>
    <td style="font-size:11px;color:var(--text2)">${_resolveRole(u.role)}</td>
    ${displayDates.map(d => { const s = u.schedule[d] || '0'; return `<td class="c"><span class="sh sh-${s}">${s === '0' ? '—' : s}</span></td>`; }).join('')}
  </tr>`).join('');
}

function _liveFilter() {
  const allDates = Object.keys(state.users[0]?.schedule || {});
  const weekRange = getWeekRange(activeMonday);
  const displayDates = showFullMonth ? allDates : weekRange;
  const filtered = state.users.filter(u =>
    (u.team || '').toLowerCase().includes(staffFilters.team.toLowerCase()) &&
    (u.name || '').toLowerCase().includes(staffFilters.name.toLowerCase()) &&
    (u.username || '').toLowerCase().includes(staffFilters.user.toLowerCase()) &&
    (_resolveRole(u.role) || '').toLowerCase().includes(staffFilters.role.toLowerCase())
  );
  const tbody = document.getElementById('staff-tbody');
  if (tbody) tbody.innerHTML = renderStaffRows(filtered, displayDates);
  const sub = document.querySelector('#staff-subtab-content .page-sub');
  if (sub) sub.textContent = `${filtered.length} staff`;
}

// ═══════════════════════════════════════════════
//  EXCEL IMPORT — Staff Info (SheetJS)
// ═══════════════════════════════════════════════
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
        const role = String(row[posCol] || '').trim();
        const empNo = String(row[empCol] || '').trim();

        DB.setStaffInfo(username, { empNo, name, gender, dob, role });

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
  document.getElementById('assign-slot').innerHTML = slots.map(s =>
    `<option value="${s}"${cur?.slot === s ? ' selected' : ''}>${s}</option>`
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
  const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const weekDates = getWeekDates();

  // Build list of days this user is on THIS shift
  const myShiftDays = [];
  allDates.forEach(dk => { if (currentUser.schedule[dk] === currentShift) myShiftDays.push(dk); });
  if (myShiftDays.length === 0) {
    WEEK_DAYS.forEach((d, i) => { if (currentUser.schedule[d] === currentShift) myShiftDays.push(weekDates[i]); });
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
  document.getElementById('req-cur').value = br ? br.slot : 'Not assigned';
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
    const shiftVal = u.schedule[day] || u.schedule[getWkDay(day)] || '0';
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
  const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  let swapDays = [day];
  if (isWeek) {
    const partner = state.users.find(u => u.id === partnerId);
    // Only use current week dates
    const weekDates = getWeekDates();
    swapDays = weekDates.filter(dk => {
      const myShift = currentUser.schedule[dk] || currentUser.schedule[getWkDay(dk)] || '0';
      const ptShift = partner?.schedule[dk] || partner?.schedule[getWkDay(dk)] || '0';
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

    // Auto-deny any other pending requests that conflict with the same partner + days
    state.requests.forEach((other, i) => {
      if (i === idx) return;
      if (other.status !== 'pending') return;
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
        return wd.some(dk => {
          const dn = WEEK_DAYS[wd.indexOf(dk)];
          return u.schedule[dk] === currentShift || u.schedule[dn] === currentShift;
        });
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

  const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const weekDates = getWeekDates();
  const eligibleDays = [];

  // Past-date check: DD/MM format → compare as (M-1)*100+D vs today
  const _todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
  function _isNotPast(dk) {
    const [d, m] = dk.split('/').map(Number);
    return (m - 1) * 100 + d >= _todayMMDD;
  }

  const targetShift = isOnBehalf
    ? (Object.values(target.schedule || {}).find(s => s && s !== '0') || currentShift)
    : currentShift;

  allDates.forEach(dk => {
    if (monthKeyFromDate(dk) !== mk) return;
    if (!_isNotPast(dk)) return;
    const sc = target.schedule[dk] || target.schedule[getWkDay(dk)];
    if (sc !== targetShift) return;
    const br = getAssigned(target.id, dk) || getAssigned(target.id, getWkDay(dk));
    if (br) eligibleDays.push({ dk, slot: br.slot });
  });
  if (eligibleDays.length === 0) {
    weekDates.forEach((dk, i) => {
      if (!_isNotPast(dk)) return;
      const dn = WEEK_DAYS[i];
      const sc = target.schedule[dk] || target.schedule[dn];
      if (sc !== targetShift) return;
      const br = getAssigned(target.id, dk) || getAssigned(target.id, dn);
      if (br) eligibleDays.push({ dk, slot: br.slot });
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
