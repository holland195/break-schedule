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
  ['A','B','C','D','E'].forEach(sh => {
    map[`X${sh}`]  = { type:'WD', shift:sh };
    map[`X2${sh}`] = { type:'WD', shift:sh };
    map[`X3${sh}`] = { type:'WD', shift:sh };
    map[`X4${sh}`] = { type:'WD', shift:sh };
    map[`${sh}1`]  = { type:'HD1', shift:sh };
    map[`${sh}2`]  = { type:'HD2', shift:sh };
    map[`U${sh}1`] = { type:'HD1', shift:sh };
    map[`U${sh}2`] = { type:'HD2', shift:sh };
  });
  map['A']   = { type:'OFF', reason:'Annual leave' };
  map['H']   = { type:'OFF', reason:'Public holiday' };
  map['U']   = { type:'OFF', reason:'Unpaid leave' };
  map['S']   = { type:'OFF', reason:'Sick leave' };
  map['L']   = { type:'OFF', reason:'Personal leave' };
  map['0']   = { type:'OFF', reason:'Day off' };
  map['0.0'] = { type:'OFF', reason:'Day off' };
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
    return String(h.getDate()).padStart(2,'0') + '/' + String(h.getMonth()+1).padStart(2,'0');
  }
  if (typeof h === 'number' && h > 40000) {
    const dt = new Date(Math.round((h - 25569) * 86400 * 1000));
    return String(dt.getUTCDate()).padStart(2,'0') + '/' + String(dt.getUTCMonth()+1).padStart(2,'0');
  }
  if (typeof h === 'string') {
    if (h.match(/^\d{4}-\d{2}-\d{2}/)) {
      const dt = new Date(h);
      if (!isNaN(dt)) return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0');
    }
    const c = h.replace(/[-–]/g,'/').trim();
    if (/^\d{1,2}\/\d{1,2}$/.test(c)) {
      const [d,m] = c.split('/');
      return d.padStart(2,'0') + '/' + m.padStart(2,'0');
    }
    if (/^\d{1,2}$/.test(c) && fallbackMonth) {
      return c.padStart(2,'0') + '/' + String(fallbackMonth).padStart(2,'0');
    }
  }
  return null;
}
 
function _checkAttConflict(u, dk, parsedCode) {
  if (!parsedCode) return null;
  const weekRec = DB.getAttendance(u.id, dk);
  const schedShift = (u.schedule?.[dk] || '').charAt(0);
  const conflicts = [];
  if (parsedCode.type === 'OFF') {
    if (weekRec && (weekRec.start || weekRec.end)) {
      conflicts.push(`Attendance logged on ${parsedCode.reason||'off day'}`);
    }
  } else if (parsedCode.type === 'HD1' || parsedCode.type === 'HD2') {
    if (weekRec && (weekRec.start || weekRec.end)) {
      conflicts.push('Half-day but attendance logged');
    }
  } else if (parsedCode.type === 'WD') {
    if (schedShift && parsedCode.shift && schedShift !== parsedCode.shift) {
      conflicts.push(`Attendance: Shift ${parsedCode.shift}, Schedule: Shift ${schedShift}`);
    }
  }
  return conflicts.length > 0 ? conflicts : null;
}

// ═══════════════════════════════════════════════
//  Role sort order for Staff Info tab
// ─────────────────────────────────────────────
 
const ROLE_SORT_ORDER = {
  'Agent Training Manager':   0,
  'Agent Training Assistant': 1,
  'Agent Leader':             2,
  'Agent Supervisor':         2,
  'Sr QA':                    3,
  'QA':                       4,
  'Sr Agent':                 5,
  'Agent':                    6,
  'Admin':                    99,
};
 
function _roleSort(a, b) {
  const ra = ROLE_SORT_ORDER[a.role] ?? 9;
  const rb = ROLE_SORT_ORDER[b.role] ?? 9;
  if (ra !== rb) return ra - rb;
  return (a.name || '').localeCompare(b.name || '');
}

//  RENDER: DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const weekDates  = getWeekDates(); // always real current week
  const todayDk    = weekDates[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const si         = DB.getStaffInfo(currentUser.username);
  const gender     = si?.gender || currentUser.gender || '';
  const mk         = currentMonthKey();
  const extUsed    = DB.countExtBreaks(currentUser.id, mk);

  // My break today
  const myBr       = getAssigned(currentUser.id, todayDk)
                  || getAssigned(currentUser.id, getWkDay(todayDk));
  const myShift    = currentUser.schedule?.[todayDk]
                  || currentUser.schedule?.[getWkDay(todayDk)] || '0';
  const onShift    = myShift === currentShift;

  // Pending requests
  const myPending  = state.requests.filter(r =>
    r.userId === currentUser.id && r.status === 'pending'
  ).length;
  const allPending = state.requests.filter(r => r.status === 'pending').length;

  // Team breaks today (same shift)
  const shiftMates = getShiftMates(currentShift, todayDk);
  const assigned   = shiftMates.filter(u => getAssigned(u.id, todayDk)).length;

  const greetHour  = new Date().getHours();
  const greet      = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  // My break card
  const myBreakCard = `
<div class="card" style="margin-bottom:0;">
  <div class="card-title">🕐 My Break Today</div>
  ${!onShift
    ? `<div style="color:var(--text3);font-size:13px;">Not on Shift ${currentShift} today.</div>`
    : myBr
      ? `<div style="display:flex;align-items:center;gap:12px;">
          <span class="break-slot assigned slot-${(BREAK_SLOTS[currentShift]||[]).indexOf(myBr.slot)+1||1}"
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
    <div class="stat-num" style="color:${assigned===shiftMates.length&&shiftMates.length>0?'var(--ok)':'var(--warn)'}">${assigned}<span style="font-size:14px;color:var(--text3)">/${shiftMates.length}</span></div>
  </div>
  ${isLeader(currentUser)
    ? `<div class="stat">
        <div class="stat-label">Pending requests</div>
        <div class="stat-num" style="color:${allPending>0?'var(--warn)':'var(--ok)'}">${allPending}</div>
      </div>`
    : `<div class="stat">
        <div class="stat-label">My requests</div>
        <div class="stat-num" style="color:${myPending>0?'var(--warn)':'var(--ok)'}">${myPending}</div>
      </div>`}
</div>`;

  // Team breaks today grid
  const teamGrid = shiftMates.length === 0 ? '' : `
<div class="card" style="margin-top:16px;">
  <div class="card-title">👥 Team Breaks Today — Shift ${currentShift} · ${todayDk}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:4px;">
    ${shiftMates.map(u => {
      const br  = getAssigned(u.id, todayDk);
      const idx = br ? (BREAK_SLOTS[currentShift]||[]).indexOf(br.slot) : -1;
      const isSelf = u.id === currentUser.id;
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
        background:${isSelf?'var(--bg4)':'var(--bg3)'};border-radius:7px;
        border:1px solid ${isSelf?'var(--accent)':'var(--border)'};">
        <span class="break-slot ${br?`assigned slot-${idx+1}`:''}" style="font-size:10px;padding:3px 8px;min-width:28px;text-align:center;">
          ${br ? getShortSlot(currentShift, br.slot) : '?'}
        </span>
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${u.name}${isSelf?' <span style="font-size:10px;color:var(--accent);">(you)</span>':''}
            ${u.gender==='F'?'<span style="font-size:10px;color:var(--A-color);margin-left:3px;">♀</span>':''}
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
    <div class="page-sub">${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} · Shift ${currentShift}</div>
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
      ${!isLeader(currentUser) ? `<button class="btn" onclick="nav('requests')" style="text-align:left;justify-content:flex-start;">🔄 My Requests ${myPending>0?`<span class="nav-badge" style="display:inline;">${myPending}</span>`:''}</button>` : ''}
      ${isLeader(currentUser) ? `<button class="btn btn-accent" onclick="nav('arrange')" style="text-align:left;justify-content:flex-start;">✏️ Arrange Breaks ${allPending>0?`<span style="color:var(--warn);font-size:11px;">(${allPending} pending)</span>`:''}</button>` : ''}
      ${currentUser.gender==='F' || isLeader(currentUser) ? `<button class="btn" onclick="nav('extbreak')" style="text-align:left;justify-content:flex-start;">🌸 30-min Breaks</button>` : ''}
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
  const canPickWeek    = isLeader(currentUser);
  if (isTraining(currentUser)) return renderScheduleTraining();
  const isTrainingUser = isTraining(currentUser);
  const shiftToShow    = isTrainingUser
    ? (window._scheduleShiftTab || 'A')
    : currentShift;
 
  let weekDates;
  if (canPickWeek && scheduleMonday) {
    weekDates = getWeekRange(scheduleMonday);
  } else {
    weekDates = getWeekDates();
  }
 
  const realWeekDates = getWeekDates();
  const dateToDayName = {};
  WEEK_DAYS.forEach((d, i) => { dateToDayName[realWeekDates[i]] = d; });
  weekDates.forEach((dk, i) => { if (!dateToDayName[dk]) dateToDayName[dk] = WEEK_DAYS[i]; });
 
  function getUserShift(u, dateKey) {
    return u.schedule[dateKey] || u.schedule[dateToDayName[dateKey]] || '0';
  }
 
  const schedSearch  = window._schedSearch || '';
  const shiftSlots   = BREAK_SLOTS[shiftToShow] || [];
  const todayDk      = weekDates[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || weekDates[0];
 
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
    const mondays  = allDates.filter(d => getWkDay(d) === 'Mon').sort();
    const activeMon = scheduleMonday || weekDates[0];
    weekPickerHTML = mondays.length > 0 ? `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">WEEK:</span>
        <select class="login-select" style="padding:4px 8px;font-size:11px;"
          onchange="scheduleMonday=this.value;nav('schedule')">
          ${mondays.map(m => `<option value="${m}" ${m===activeMon?'selected':''}>${m}</option>`).join('')}
        </select>
      </div>` : '';
  }
 
  // Shift tab bar for training role
  const shiftTabsHTML = isTrainingUser ? `
    <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
      ${['A','B','C','D','E'].map(sh => {
        const active = shiftToShow === sh;
        const cnt = state.users.filter(u => weekDates.some(dk => getUserShift(u, dk) === sh)).length;
        return `<button onclick="window._scheduleShiftTab='${sh}';window._schedSearch='';nav('schedule')"
          style="padding:7px 18px;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;
            border:1.5px solid ${active?`var(--${sh}-color)`:'var(--border)'};
            background:${active?`var(--${sh}-bg)`:'var(--bg2)'};
            color:${active?`var(--${sh}-color)`:'var(--text2)'};transition:all .12s;">
          Shift ${sh}
          <span style="font-size:10px;opacity:.7;margin-left:4px;">${cnt}</span>
        </button>`;
      }).join('')}
    </div>` : '';
 
  // Slot totals summary
  const slotTotalsHTML = shiftSlots.length > 0 ? `
    <div style="display:flex;align-items:center;gap:14px;padding:9px 16px;
      background:var(--bg3);border-radius:8px;border:1px solid var(--border);
      margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:13px;font-weight:600;color:var(--text);">
        Shift ${shiftToShow}:
        <span style="color:var(--accent);margin-left:2px;">${allShiftUsers.length}</span>
        <span style="color:var(--text3);font-size:11px;margin-left:2px;">agents</span>
      </span>
      <span style="color:var(--border2);">|</span>
      ${shiftSlots.map((time, i) => {
        const count = i === 0 ? slot1Count : slot2Count;
        return `<span style="display:flex;align-items:center;gap:6px;font-size:12px;">
          <span class="break-slot slot-${i+1}" style="font-size:10px;padding:2px 8px;">${shiftToShow}${i+1}</span>
          <span style="color:var(--text);">
            <b>${count}</b>
            <span style="color:var(--text3);font-size:11px;">assigned</span>
          </span>
        </span>`;
      }).join(`<span style="color:var(--border2);">·</span>`)}
    </div>` : '';
 
  // Legend
  const legendItems = shiftSlots.map((time, i) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="break-slot assigned slot-${i+1}" style="font-size:10px;min-width:28px;text-align:center;">${shiftToShow}${i+1}</span>
      <span style="color:var(--text2);font-size:11px;">${time}</span>
    </div>`).join('');
 
  // Table header
  const theadCells = weekDates.map((dk, i) => {
    const isToday = dk === todayDk;
    return `<th style="min-width:70px;text-align:center;padding:8px 4px;
      background:${isToday?'rgba(31,102,241,.08)':'var(--bg3)'};
      border-bottom:2px solid ${isToday?'var(--accent)':'var(--border2)'};">
      <div style="color:${isToday?'var(--accent)':'var(--text2)'};font-size:11px;font-weight:700;">${WEEK_DAYS[i]}</div>
      <div style="font-size:10px;color:${isToday?'var(--accent)':'var(--text3)'};font-weight:400;">${dk}</div>
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
      const br       = DB.getBreak(u.id, dk);
      const hasExt   = DB.countExtBreaks(u.id, currentMonthKey()) > 0;
      const slotIdx  = br ? shiftSlots.indexOf(br.slot) : -1;
      const slotCls  = slotIdx >= 0 ? `slot-${slotIdx+1}` : '';
      const shortCode = br ? getShortSlot(shiftToShow, br.slot) : '?';
      return `<td style="text-align:center;padding:4px 2px;"${hasExt?' class="cell-female-ext"':''}>
        <span class="${br?`break-slot assigned ${slotCls}`:''}"
          style="font-size:10px;padding:3px 8px;${br?'':'color:var(--text3)'}"
          title="${br?br.slot+(hasExt?' 🌸+30min':''):'Not assigned'}">
          ${shortCode}${hasExt?' 🌸':''}
        </span></td>`;
    }).join('');
    return `<tr>
      <td class="sched-name-col">
        <div class="sched-name">${u.name}</div>
        <div class="sched-meta">${u.team||''} · ${getRoleInfo(u.role).label}</div>
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
    <div class="page-title">Break Schedule${isTrainingUser?' — All Shifts':` — Shift ${shiftToShow}`}</div>
    <div class="page-sub">${SHIFTS[shiftToShow]?.display||''}${!canPickWeek?' · Current week (read-only)':''}</div>
  </div>
  <div class="schedule-legend-inline" style="flex-wrap:wrap;gap:8px;">
    ${weekPickerHTML}
    <span style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Legend:</span>
    ${legendItems||'<span style="color:var(--text3);font-size:11px">—</span>'}
  </div>
</div>
${shiftTabsHTML}
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
  <input class="filter-input" style="width:280px;padding:7px 12px;font-size:13px;"
    placeholder="🔍 Search by name…"
    value="${schedSearch}"
    oninput="window._schedSearch=this.value;
      const q=this.value.toLowerCase();
      document.querySelectorAll('#sched-tbody tr').forEach(r=>{
        const nm=(r.querySelector('.sched-name')||{}).textContent||'';
        r.style.display=nm.toLowerCase().includes(q)?'':'none';
      });
      document.getElementById('sched-count').textContent=([...document.querySelectorAll('#sched-tbody tr')].filter(r=>r.style.display!=='none').length)+' staff';">
  <span id="sched-count" style="font-size:11px;color:var(--text3);">${shiftUsers.length} staff</span>
</div>
${slotTotalsHTML}
${emptyMsg}
${shiftUsers.length>0?`
<div class="sched-table-wrap">
  <table class="sched-table">
    <thead><tr>
      <th class="sched-th-name">Name / Group</th>
      ${theadCells}
    </tr></thead>
    <tbody id="sched-tbody">${tbodyRows}</tbody>
  </table>
</div>`:''}`;
}

// ═══════════════════════════════════════════════
//  RENDER: REQUESTS
//  Agent/QA/Sr roles: pick day OR whole-week swap
//  Conflict detection: 2nd request for same partner
//  Visual impact preview before approval
// ═══════════════════════════════════════════════
function renderRequests() {
  const myReqs = isLeader(currentUser)
    ? state.requests
    : state.requests.filter(r => r.userId === currentUser.id);

  const pending = myReqs.filter(r => r.status === 'pending');
  const rest    = myReqs.filter(r => r.status !== 'pending');

  const card = (r) => {
    const emp      = state.users.find(u => u.id === r.userId);
    const partner  = r.swapPartnerId ? state.users.find(u => u.id === r.swapPartnerId) : null;
    const approver = r.resolvedBy
      ? (state.users.find(u => u.id === r.resolvedBy) ||
         (() => {
           // fallback: search staffInfo by stable ID
           const uname = Object.keys(state.staffInfo||{}).find(k => {
             let h=0; for(let i=0;i<k.length;i++) h=(Math.imul(31,h)+k.charCodeAt(i))|0; return Math.abs(h)===r.resolvedBy;
           });
           return uname ? { name: state.staffInfo[uname].name } : null;
         })())
      : null;
    const isOwn    = r.userId === currentUser.id;
    const idx      = state.requests.indexOf(r);
    const isWeek   = r.swapWeek === true;

    // Build week-swap impact table for pending leader view
    let impactHTML = '';
    if (r.status === 'pending' && isLeader(currentUser) && !isOwn && isWeek && partner) {
      const days = r.swapDays || [];
      const rows = days.map(d => {
        const myBr    = getAssigned(r.userId, d) || getAssigned(r.userId, getWkDay(d));
        const ptBr    = getAssigned(r.swapPartnerId, d) || getAssigned(r.swapPartnerId, getWkDay(d));
        const myCode  = myBr  ? getShortSlot(currentShift, myBr.slot)  : '—';
        const ptCode  = ptBr  ? getShortSlot(currentShift, ptBr.slot)  : '—';
        return `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:4px 10px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${d} <span style="color:var(--text3)">${getWkDay(d)}</span></td>
          <td style="padding:4px 10px;text-align:center;"><span class="break-slot assigned" style="font-size:10px;">${myCode}</span> → <span class="break-slot" style="font-size:10px;color:var(--warn);">${ptCode}</span></td>
          <td style="padding:4px 10px;text-align:center;"><span class="break-slot assigned" style="font-size:10px;">${ptCode}</span> → <span class="break-slot" style="font-size:10px;color:var(--warn);">${myCode}</span></td>
        </tr>`;
      }).join('');
      impactHTML = rows ? `
        <div style="margin:10px 0 4px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;overflow:hidden;">
          <div style="padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);border-bottom:1px solid var(--border);background:var(--bg4);">
            📊 Swap Impact — ${days.length} day${days.length>1?'s':''}
          </div>
          <table style="border-collapse:collapse;width:100%;">
            <thead><tr style="background:var(--bg4);">
              <th style="padding:5px 10px;font-size:10px;color:var(--text3);text-align:left;">Day</th>
              <th style="padding:5px 10px;font-size:10px;color:var(--accent);">${emp?.name?.split(' ').slice(-1)[0]||'Req.'}</th>
              <th style="padding:5px 10px;font-size:10px;color:var(--warn);">${partner?.name?.split(' ').slice(-1)[0]||'Partner'}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '';
    }

    const scopeTag = isWeek
      ? `<span style="background:var(--B-bg);color:var(--B-color);border:1px solid var(--B-color);font-size:9px;padding:1px 7px;border-radius:99px;font-family:'IBM Plex Mono',monospace;font-weight:700;">WEEK</span>`
      : `<span style="background:var(--bg4);color:var(--text3);border:1px solid var(--border);font-size:9px;padding:1px 7px;border-radius:99px;font-family:'IBM Plex Mono',monospace;">DAY</span>`;

    const partnerLine = partner
      ? `<br><span style="color:var(--text3)">Swap with:</span> <b>${partner.name}</b> (${partner.team}) — their slot: <b style="color:var(--B-color)">${r.partnerSlot || '?'}</b>`
      : '';

    const approverLine = approver && r.status !== 'pending'
      ? `<br><span style="color:var(--text3)">${r.status==='approved'?'Approved':'Rejected'} by:</span> <b style="color:${r.status==='approved'?'var(--ok)':'var(--err)'};">${approver.name}</b> · <span style="color:var(--text3);font-size:10px;">${timeSince(r.resolvedAt)}</span>`
      : '';

    return `<div class="req-card ${r.status}">
      <div class="req-header">
        <div>
          <div class="req-title">${emp?.name || 'Unknown'} ${scopeTag}</div>
          <div class="req-meta">${emp?.team || '—'} · ${isWeek ? (r.swapDays||[]).join(', ') : r.day} · submitted ${timeSince(r.at)}</div>
        </div>
        <span class="req-status ${r.status}">${r.status.toUpperCase()}</span>
      </div>
      <div class="req-body">
        <span style="color:var(--text3)">Current slot:</span> <b>${r.current}</b> &nbsp;→&nbsp;
        <span style="color:var(--text3)">Requested:</span> <b style="color:var(--warn)">${r.requested}</b>
        ${partnerLine}
        <br><span style="color:var(--text3)">Reason:</span> ${r.reason || 'No reason given'}
        ${approverLine}
        ${r.status !== 'pending' && r.respNote ? `<br><span style="color:var(--text3)">Note:</span> ${r.respNote}` : ''}
      </div>
      ${impactHTML}
      ${r.status === 'pending' && isLeader(currentUser) && !isOwn ? `
        <div class="req-actions">
          <button class="btn btn-sm btn-ok"  onclick="resolveRequest(${idx},'approved')">✓ Approve</button>
          <button class="btn btn-sm btn-err" onclick="resolveRequest(${idx},'rejected')">✗ Reject</button>
        </div>` : ''}
    </div>`;
  };

  return `
<div class="page-header">
  <div>
    <div class="page-title">${isLeader(currentUser) ? 'Approval Queue' : 'My Requests'}</div>
    <div class="page-sub">${isLeader(currentUser) ? `${pending.length} pending approval` : 'Track your break change requests'}</div>
  </div>
  ${!isLeader(currentUser) ? `<button class="btn btn-accent" onclick="openRequestModal()">+ New request</button>` : ''}
</div>

${pending.length > 0 ? `
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);margin-bottom:10px;font-family:'IBM Plex Mono',monospace">⏳ Pending (${pending.length})</div>
  ${pending.map(r => card(r)).join('')}` : ''}

${rest.length > 0 ? `
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin:16px 0 10px;font-family:'IBM Plex Mono',monospace">History</div>
  ${rest.slice(0, 20).map(r => card(r)).join('')}
` : ''}

${myReqs.length === 0 ? `<div class="empty"><div class="empty-ico">✅</div>No requests yet.</div>` : ''}
`;
}

// ═══════════════════════════════════════════════
//  RENDER: ARRANGE (leader only)
//  Tab 1: Arrange Breaks (bulk panel + day tabs)
//  Tab 2: Week Overview (full grid)
// ═══════════════════════════════════════════════
let arrangeMainTab = 'assign'; // 'assign' | 'overview'
let arrangeActiveDay = null;   // set on first render
// Persisted bulk-panel state — survives re-renders and sync polls
let _bulkGroups   = new Set(); // selected group checkboxes
let _bulkDays     = new Set(); // selected day checkboxes
let _bulkSlotIdx  = 0;         // slot dropdown index
// Persisted paste area content — survives re-renders
let _pasteContent = '';

function renderArrange() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';
  const weekRange = getWeekRange(activeMonday);
  if (!arrangeActiveDay || !weekRange.includes(arrangeActiveDay)) arrangeActiveDay = weekRange[0];

  // Build week picker from available schedule dates
  const allDates  = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const mondays   = allDates.filter(d => getWkDay(d) === 'Mon').sort((a,b) => {
    const [da,ma] = a.split('/'); const [db,mb] = b.split('/');
    return new Date(2026,parseInt(ma)-1,parseInt(da)) - new Date(2026,parseInt(mb)-1,parseInt(db));
  });
  const weekPickerHTML = mondays.length > 0 ? `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">WEEK:</span>
      <select class="login-select" style="padding:4px 8px;font-size:11px;"
        onchange="activeMonday=this.value;arrangeActiveDay=null;nav('arrange')">
        ${mondays.map(m=>`<option value="${m}" ${m===activeMonday?'selected':''}>${m} — ${getWkDay(m)}</option>`).join('')}
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
      background:none; color:${arrangeMainTab==='assign'?'var(--accent)':'var(--text2)'};
      border-bottom:3px solid ${arrangeMainTab==='assign'?'var(--accent)':'transparent'};
      margin-bottom:-2px; transition:all .12s;">
    ✏️ Arrange Breaks
  </button>
  <button onclick="switchArrangeMainTab('overview')"
    style="padding:9px 24px; font-size:13px; font-weight:600; cursor:pointer; border:none;
      background:none; color:${arrangeMainTab==='overview'?'var(--accent)':'var(--text2)'};
      border-bottom:3px solid ${arrangeMainTab==='overview'?'var(--accent)':'transparent'};
      margin-bottom:-2px; transition:all .12s;">
    📊 Week Overview
  </button>
</div>

<div id="arrange-main-content">
  ${arrangeMainTab === 'assign' ? _renderArrangeAssignTab(weekRange) : _renderArrangeOverviewTab(weekRange)}
</div>`;
}

// ── Save Breaks button handler ──
async function saveBreaksToCloud() {
  const btn   = document.getElementById('save-breaks-btn');
  const ico   = document.getElementById('save-breaks-ico');
  const lbl   = document.getElementById('save-breaks-lbl');
  if (!btn) return;

  // ── Check: do we have the API key needed to push? ──
  // First try to reload sync-config.json in case it was updated since page load
  if (!syncEnabled() && typeof loadSyncConfig === 'function') {
    await loadSyncConfig();
  }
  const hasKey = typeof syncEnabled === 'function' && syncEnabled();
  const hasBin = typeof syncCfg !== 'undefined' && !!syncCfg.binId;

  if (!hasKey) {
    // No API key stored — push is impossible
    // Guide the admin to Cloud Sync settings
    if (ico) ico.textContent = '⚠';
    if (lbl) lbl.textContent = hasBin ? 'Need API key — go to Cloud Sync' : 'Sync not configured';
    btn.style.background = 'var(--warn)';
    btn.style.color = '#000';
    setTimeout(() => {
      if (ico) ico.textContent = '☁';
      if (lbl) lbl.textContent = 'Save Breaks';
      btn.style.background = '';
      btn.style.color = '';
    }, 4000);
    toast('☁ Sync key missing. Go to Cloud Sync page → enter your Secret Key → Connect.', 'warn');
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

  const bulkPanel = `
<div class="bulk-panel" style="margin-bottom:20px;">
  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Groups</div>
    <div class="group-checkbox-list">
      ${allShiftTeams.map(t => `
        <label class="group-check-item">
          <input type="checkbox" name="bulk-group" value="${t}"
            ${_bulkGroups.has(t)?'checked':''} onchange="_saveBulkGroups()"> ${t}
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
            ${_bulkDays.has(d)?'checked':''} onchange="_saveBulkDays()">
        </label>`).join('')}
    </div>
  </div>
  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Slot</div>
    <select id="bulk-slot-multi" class="login-select" style="padding:6px 10px;"
      onchange="_bulkSlotIdx=parseInt(this.value)">
      ${slots.map((s, i) => `<option value="${i}" ${i===_bulkSlotIdx?'selected':''}>${currentShift}${i+1} — ${s}</option>`).join('')}
    </select>
  </div>
  <div class="bulk-panel-section" style="justify-content:flex-end;">
    <button class="btn btn-accent" onclick="bulkAssignMulti()">Apply to Selection</button>
  </div>
</div>`;

  const weekTable = getArrangeDayMemberList(null);
  return bulkPanel + weekTable;
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
      background:${isToday?'var(--accent)':isActive?'var(--bg4)':'var(--bg3)'};
      color:${isToday?'#fff':isActive?'var(--accent)':'var(--text2)'};
      border-bottom:2px solid ${isToday?'var(--accent2)':'var(--border)'};
      ">
      ${WEEK_DAYS[i]}<br>
      <span style="font-weight:400;font-size:9px;opacity:0.7;">${d}</span>
    </th>`;
  }).join('');

  const summaryRows = shiftUsers.map(u => {
    const dayCells = weekRange.map((d, i) => {
      const dn       = WEEK_DAYS[i];
      const shiftVal = u.schedule[d] || u.schedule[dn] || '0';
      const onShift  = shiftVal === currentShift;
      const br       = getAssigned(u.id, d) || getAssigned(u.id, dn);

      if (shiftVal === '0') return `<td style="text-align:center;padding:6px 4px;"><span style="color:var(--text3);font-size:10px;">—</span></td>`;
      if (!onShift) return `<td style="text-align:center;padding:6px 4px;"><span class="sh sh-${shiftVal}" style="width:20px;height:20px;font-size:10px;">${shiftVal}</span></td>`;

      const code     = br ? getShortSlot(currentShift, br.slot) : '?';
      const ov_si    = br ? (BREAK_SLOTS[currentShift]||[]).indexOf(br.slot) : -1;
      const isActive = d === arrangeActiveDay;
      const ov_class = br
        ? `break-slot slot-${ov_si===0?1:2} assigned overview-cell-assigned${isActive?' overview-cell-active':''}`
        : `break-slot overview-cell-pending${isActive?' overview-cell-active':''}`;
      return `<td style="text-align:center;padding:6px 4px;background:${isActive?'rgba(200,212,0,0.06)':''};">
        <span onclick="switchArrangeMainTab('assign'); arrangeActiveDay='${d}'; nav('arrange');"
          class="${ov_class}"
          style="display:inline-flex;align-items:center;justify-content:center;
            width:28px;height:22px;border-radius:4px;font-size:10px;font-weight:700;
            font-family:'IBM Plex Mono',monospace;cursor:pointer;
            ${isActive?'outline:2px solid var(--accent);outline-offset:2px;':''}"
          title="${br?br.slot:'Not assigned — click to assign'}">${code}</span>
      </td>`;
    }).join('');

    const genderIcon = u.gender === 'F' ? '♀' : u.gender === 'M' ? '♂' : '';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 12px;white-space:nowrap;border-right:1px solid var(--border);min-width:200px;">
        <span style="font-weight:600;font-size:12px;">${u.name}</span>
        ${genderIcon ? `<span style="font-size:10px;color:${u.gender==='F'?'var(--A-color)':'var(--B-color)'};margin-left:4px;">${genderIcon}</span>` : ''}
        <div style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${u.team} · ${getRoleInfo(u.role).label}</div>
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
  const weekRange = getWeekRange(activeMonday);
  const slots     = BREAK_SLOTS[currentShift] || [];
  const todayDk   = getWeekDates()[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

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
    const isToday  = d === todayDk;
    const dayLabel = getWkDay(d);
    return `<th class="arr-th-day${isToday?' arr-th-today':''}" style="min-width:90px;text-align:center;">
      <div style="font-size:11px;font-weight:700;">${dayLabel}</div>
      <div style="font-size:9px;opacity:0.6;font-weight:400;">${d}</div>
    </th>`;
  }).join('');

  // Table rows — one per member
  const tbRows = allMates.map(u => {
    const dayCells = weekRange.map(d => {
      const dn       = WEEK_DAYS[weekRange.indexOf(d)];
      const shiftVal = u.schedule[d] || u.schedule[dn] || '0';
      const onShift  = shiftVal === currentShift;
      const isToday  = d === todayDk;

      // Day off or different shift — show nothing
      if (!onShift) {
        return `<td class="arr-cell arr-cell-off${isToday?' arr-cell-today':''}">
          <span style="color:var(--text3);font-size:12px;">—</span>
        </td>`;
      }

      const br     = getAssigned(u.id, d) || getAssigned(u.id, dn);
      const br_idx = br ? (slots.indexOf(br.slot)) : -1;

      const slotBtns = slots.map((s, idx) => {
        const isAssigned = br?.slot === s;
        return `<span
          class="arr-slot arr-slot-${idx+1}${isAssigned?' arr-slot-on':' arr-slot-off'}"
          onclick="quickAssign(${u.id},'${d}','${s}')"
          title="${s}">
          ${currentShift}${idx+1}
        </span>`;
      }).join('');

      return `<td class="arr-cell${isToday?' arr-cell-today':''}">
        <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
          ${slotBtns}
        </div>
      </td>`;
    }).join('');

    const genderBadge = u.gender === 'F'
      ? `<span style="font-size:9px;color:var(--A-color);margin-left:3px;">♀</span>` : '';

    return `<tr class="arr-row">
      <td class="arr-name-col">
        <div style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;margin-bottom:1px;">${u.team}</div>
        <div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${u.name}${genderBadge}
        </div>
        <span class="role-tag ${getRoleInfo(u.role).tag}" style="font-size:9px;padding:1px 6px;">${getRoleInfo(u.role).label}</span>
      </td>
      ${dayCells}
    </tr>`;
  }).join('');

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
    </table>
  </div>`;
}

function quickAssign(uid, day, slot) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  assign(uid, day, slot, '');
  toast(`Break assigned: ${slot}`);
  // Re-render just the table body (no full nav re-render = keeps bulk panel state)
  const wrap = document.querySelector('.arr-table-wrap');
  if (wrap) { wrap.outerHTML = getArrangeDayMemberList(null); }
  else { const c = document.getElementById('arrange-day-content'); if(c) c.innerHTML = getArrangeDayMemberList(null); }
  updateBadge();
}

function _saveBulkGroups() {
  _bulkGroups = new Set(Array.from(document.querySelectorAll('input[name="bulk-group"]:checked')).map(el=>el.value));
}
function _saveBulkDays() {
  _bulkDays = new Set(Array.from(document.querySelectorAll('input[name="bulk-day"]:checked')).map(el=>el.value));
}
function bulkAssignMulti() {
  // Read from DOM (current state) and also persist
  _saveBulkGroups(); _saveBulkDays();
  const selectedGroups = [..._bulkGroups];
  const selectedDays   = [..._bulkDays];
  const slotIdx        = _bulkSlotIdx;

  if (selectedGroups.length === 0) { toast('Select at least one Group.', 'err'); return; }
  if (selectedDays.length === 0)   { toast('Select at least one Day.', 'err'); return; }

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
  const day   = todayKey();
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
      background:none;color:${staffSubTab==='info'?'var(--accent)':'var(--text2)'};
      border-bottom:3px solid ${staffSubTab==='info'?'var(--accent)':'transparent'};
      margin-bottom:-2px;transition:all .12s;">
    👤 Staff Info
  </button>
  <button onclick="staffSubTab='schedule';nav('staff')"
    style="padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;
      background:none;color:${staffSubTab==='schedule'?'var(--accent)':'var(--text2)'};
      border-bottom:3px solid ${staffSubTab==='schedule'?'var(--accent)':'transparent'};
      margin-bottom:-2px;transition:all .12s;">
    📅 Staff Schedule
  </button>
  <button onclick="staffSubTab='attendance';nav('staff')"
    style="padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;
      background:none;color:${staffSubTab==='attendance'?'var(--accent)':'var(--text2)'};
      border-bottom:3px solid ${staffSubTab==='attendance'?'var(--accent)':'transparent'};
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
    (u.name||'').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.username||'').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.empNo||'').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.role||'').toLowerCase().includes(infoFilter.toLowerCase())
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
 
function _renderStaffInfoRows(filter) {
  const all = Object.entries(state.staffInfo || {})
    .map(([username, d]) => ({ username, ...d }))
    .sort(_roleSort);
  const f = (filter || '').toLowerCase();
  return all.filter(u =>
    !f ||
    (u.name||'').toLowerCase().includes(f) ||
    (u.username||'').toLowerCase().includes(f) ||
    (u.empNo||'').toLowerCase().includes(f) ||
    (u.role||'').toLowerCase().includes(f)
  ).map(u => {
    const g = u.gender === 'F'
      ? `<span style="color:var(--A-color);font-weight:700;">♀ Female</span>`
      : `<span style="color:var(--B-color);font-weight:700;">♂ Male</span>`;
    const roleLvl  = ROLE_SORT_ORDER[u.role] ?? 9;
    const roleColor = roleLvl <= 1 ? 'var(--accent)'
      : roleLvl <= 2 ? 'var(--warn)'
      : roleLvl <= 3 ? 'var(--ok)'
      : 'var(--text2)';
    return `<tr>
      <td class="mono" style="font-size:11px;color:var(--text3);">${u.empNo||'—'}</td>
      <td style="font-weight:600;">${u.name||'—'}</td>
      <td class="mono" style="color:var(--accent);font-size:11px;">${u.username}</td>
      <td>${g}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);">${u.dob||'—'}</td>
      <td style="font-size:11px;color:${roleColor};font-weight:500;">${u.role||'—'}</td>
    </tr>`;
  }).join('');
}

// ── Sub-tab 2: Staff Schedule ──
function _renderStaffSchedule() {
  const hasUsers = state.users && state.users.length > 0;

  const importPanel = `
<div class="card" style="margin-bottom:16px;padding:14px 16px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:'IBM Plex Mono',monospace;margin-bottom:10px;">Import Schedule (Paste from Sheets)</div>
  <div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.7;">
    Copy the schedule table from Google Sheets (select all cells including date headers) → <b>Ctrl+C</b> → paste below → <b>Parse</b>.<br>
    <span style="color:var(--text3);">Required columns: <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">Row# | Group | Name | Username | Role | DD/MM dates…</code></span>
  </div>
  <textarea id="paste-area" style="width:100%;min-height:100px;font-family:monospace;font-size:10px;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px;border-radius:5px;resize:vertical;" placeholder="Paste tab-separated data from Google Sheets here…" oninput="_pasteContent=this.value">${_pasteContent}</textarea>
  <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
    <button class="btn btn-accent btn-sm" onclick="importFromPaste()">⚡ Parse</button>
    <div id="paste-status" style="font-size:11px;flex:1;"></div>
  </div>
  <div id="sched-preview-section" style="display:none;margin-top:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:12px;">Preview: <b id="sched-preview-count">0</b> staff</span>
      <button class="btn btn-ok btn-sm" onclick="confirmScheduleImport()">✓ Confirm & Apply</button>
    </div>
    <div id="sched-preview-list" style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:6px;"></div>
  </div>
</div>`;

  // If no users yet, show only the import panel
  if (!hasUsers) {
    return `
<div style="margin-bottom:16px;">
  <div class="empty" style="padding:24px 0 16px;">
    <div class="empty-ico">📋</div>
    <div>No schedule data yet. Paste your Google Sheets schedule below to get started.</div>
  </div>
  ${importPanel}
</div>`;
  }

  const allDates         = Object.keys(state.users.find(u=>Object.keys(u.schedule).some(k=>/\d{2}\/\d{2}/.test(k)))?.schedule || state.users[0]?.schedule || {});
  const availableMondays = allDates.filter(d => getWkDay(d) === 'Mon').sort();
  const weekRange        = getWeekRange(activeMonday);
  const displayDates     = showFullMonth ? allDates : weekRange;

  const filteredUsers = state.users.filter(u =>
    (u.team||'').toLowerCase().includes(staffFilters.team.toLowerCase()) &&
    (u.name||'').toLowerCase().includes(staffFilters.name.toLowerCase()) &&
    (u.username||'').toLowerCase().includes(staffFilters.user.toLowerCase()) &&
    (u.role||'').toLowerCase().includes(staffFilters.role.toLowerCase())
  );

  return `
<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
  <label style="font-size:11px;opacity:.7;">Week:</label>
  <select class="login-select" style="width:130px;padding:4px;" onchange="activeMonday=this.value;nav('staff')">
    ${availableMondays.map(m=>`<option value="${m}" ${m===activeMonday?'selected':''}>Week ${m}</option>`).join('')}
  </select>
  <button class="toggle-btn ${showFullMonth?'active':''}" onclick="showFullMonth=!showFullMonth;nav('staff')">
    ${showFullMonth?'📂 Week only':'📂 Full month'}
  </button>
  <span style="font-size:11px;color:var(--text3);margin-left:auto;">${filteredUsers.length} staff</span>
</div>

${importPanel}

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
        ${displayDates.map(d=>`<th class="c" style="min-width:42px;padding:6px 2px;">
          <div style="color:var(--accent);font-size:11px;">${d}</div>
          <div style="font-size:8px;font-weight:400;opacity:.5;margin-top:2px;">${getWkDay(d)}</div>
        </th>`).join('')}
      </tr>
    </thead>
    <tbody id="staff-tbody">${renderStaffRows(filteredUsers, displayDates)}</tbody>
  </table>
</div>`;
}

let _attImportMonth = new Date().getMonth() + 1;
let _attImportYear  = new Date().getFullYear();
 
function _renderStaffAttendance() {
  const year     = _attImportYear;
  const month    = _attImportMonth;
  const monthKey = `${year}-${String(month).padStart(2,'0')}`;
  const monthLabel = new Date(year, month-1, 1).toLocaleString('en-US',{month:'long',year:'numeric'});
  const dates    = _getAllDatesInMonth(year, month);
  const attData  = state.monthlyAttendance || {};
  const users    = state.users;
 
  const monthPicker = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <select class="login-select" style="padding:5px 10px;font-size:12px;"
        onchange="_attImportMonth=+this.value;nav('staff')">
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m =>
          `<option value="${m}" ${m===month?'selected':''}>${new Date(year,m-1,1)
            .toLocaleString('en-US',{month:'long'})}</option>`
        ).join('')}
      </select>
      <select class="login-select" style="padding:5px 10px;font-size:12px;"
        onchange="_attImportYear=+this.value;nav('staff')">
        ${[2024,2025,2026,2027].map(y =>
          `<option value="${y}" ${y===year?'selected':''}>${y}</option>`
        ).join('')}
      </select>
    </div>`;
 
  const importPanel = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">📋 Import Monthly Attendance</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.8;">
        Excel format: same as your <b>Month attendance</b> sheet.<br>
        Col A = No. · Col B = Emp# · Col C = Name · Col D = Position · Col E onward = dates<br>
        Row 1 = date headers · Row 2 = day name formulas (auto-skipped) · Row 3+ = staff
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <input type="file" id="att-import-file" accept=".xlsx,.xls" style="font-size:12px;">
        <button class="btn btn-accent btn-sm" onclick="importMonthlyAttendance()">Import Excel</button>
        <button class="btn btn-sm" onclick="clearMonthlyAttendance(${year},${month})"
          style="color:var(--err);border-color:var(--err);">🗑 Clear ${monthLabel}</button>
        <span id="att-import-status" style="font-size:11px;"></span>
      </div>
    </div>`;
 
  const hasData = users.some(u => {
    const ud = attData[u.username]?.[monthKey];
    return ud && Object.keys(ud).length > 0;
  });
 
  if (!hasData) {
    return `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        ${monthPicker}
        <span style="font-size:12px;color:var(--text2);">${monthLabel}</span>
      </div>
      ${importPanel}
      <div class="empty" style="padding:48px;">
        <div class="empty-ico">📋</div>
        No attendance data for ${monthLabel}.<br>
        <span style="font-size:12px;color:var(--text3);">Import an Excel file above.</span>
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
 
  // Build table
  const theadDates = dates.map(dk => {
    const day = dk.split('/')[0];
    const dow = new Date(year, month-1, parseInt(day)).getDay();
    const isWknd = dow===0||dow===6;
    return `<th style="min-width:36px;padding:4px 1px;text-align:center;
      font-size:10px;font-weight:500;color:${isWknd?'var(--text3)':'var(--text2)'};
      background:${isWknd?'var(--bg4)':'var(--bg3)'};
      border-bottom:2px solid var(--border2);">
      <div>${['S','M','T','W','T','F','S'][dow]}</div>
      <div>${parseInt(day)}</div>
    </th>`;
  }).join('');
 
  let totalConflicts = 0;
 
  const tbodyRows = users.map(u => {
    const uAtt = attData[u.username]?.[monthKey] || {};
    const conflicts = [];
 
    const cells = dates.map(dk => {
      const rawCode = uAtt[dk];
      const parsed  = _parseAttCode(rawCode);
      const dow     = new Date(year, month-1, parseInt(dk)).getDay();
      const isWknd  = dow===0||dow===6;
 
      if (!rawCode && !parsed) {
        return `<td style="text-align:center;padding:2px 1px;background:${isWknd?'var(--bg4)':''};">
          <span style="font-size:10px;color:var(--text3);">·</span>
        </td>`;
      }
 
      const conflictList = _checkAttConflict(u, dk, parsed);
      const hasConflict  = conflictList && conflictList.length > 0;
      if (hasConflict) conflicts.push({ dk, msgs: conflictList });
 
      let bg='', txt='', color='';
      if (hasConflict) {
        bg='background:rgba(248,113,113,.12);';
        txt='⚠'; color='color:var(--err);font-weight:700;';
      } else if (!parsed) {
        txt=rawCode||'?'; color='color:var(--text3);';
      } else if (parsed.type==='OFF') {
        bg='background:var(--D-bg);';
        const code=String(rawCode).toUpperCase();
        txt = code==='0'||code==='0.0'?'0':code==='H'?'H':code==='A'?'A':code==='S'?'S':code==='U'?'U':code==='L'?'L':'OFF';
        color='color:var(--err);font-weight:600;';
      } else if (parsed.type==='HD1'||parsed.type==='HD2') {
        bg='background:rgba(245,158,11,.10);';
        txt=String(rawCode).toUpperCase(); color='color:var(--warn);font-weight:600;';
      } else {
        // WD — show shift letter
        bg='background:rgba(74,222,128,.06);';
        txt=parsed.shift||'✓'; color='color:var(--ok);font-weight:500;';
      }
 
      const title = conflictList ? conflictList.join(' | ') : (parsed?.reason||rawCode||'');
      return `<td style="text-align:center;padding:2px 1px;${bg}${isWknd?'opacity:.7;':''}"
        title="${title}">
        <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;${color}">${txt}</span>
      </td>`;
    }).join('');
 
    if (conflicts.length) totalConflicts++;
 
    const conflictSummary = conflicts.length > 0
      ? `<div style="font-size:10px;color:var(--err);margin-top:2px;">⚠ ${conflicts.length} conflict${conflicts.length>1?'s':''}: ${conflicts.map(c=>c.dk).join(', ')}</div>`
      : '';
 
    return `<tr style="border-bottom:0.5px solid var(--border);${conflicts.length?'background:rgba(248,113,113,.03);':''}">
      <td style="padding:5px 10px;white-space:nowrap;position:sticky;left:0;z-index:1;background:var(--bg2);">
        <div style="font-size:12px;font-weight:600;">${u.name}</div>
        <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        ${conflictSummary}
      </td>
      ${cells}
    </tr>`;
  }).filter(r => r).join('');
 
  const conflictBanner = totalConflicts > 0
    ? `<div style="padding:10px 14px;background:var(--D-bg);border:1px solid var(--err);
        border-radius:8px;font-size:12px;color:var(--err);margin-bottom:12px;font-weight:500;">
        ⚠ ${totalConflicts} staff with conflicts between monthly schedule and attendance log
      </div>`
    : `<div style="padding:8px 14px;background:var(--C-bg);border-radius:8px;
        font-size:12px;color:var(--ok);margin-bottom:12px;">
        ✓ No conflicts detected for ${monthLabel}
      </div>`;
 
  return `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
      ${monthPicker}
      <span style="font-size:12px;color:var(--text2);">${monthLabel} · ${users.length} staff</span>
    </div>
    ${importPanel}
    ${conflictBanner}
    ${legendHTML}
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;width:max-content;min-width:100%;">
        <thead style="position:sticky;top:0;z-index:2;background:var(--bg3);">
          <tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text2);
              min-width:180px;position:sticky;left:0;z-index:3;background:var(--bg3);
              border-bottom:2px solid var(--border2);">NAME</th>
            ${theadDates}
          </tr>
        </thead>
        <tbody>${tbodyRows}</tbody>
      </table>
    </div>`;
}

function importMonthlyAttendance() {
  const fileInput = document.getElementById('att-import-file');
  const statusEl  = document.getElementById('att-import-status');
  if (!fileInput?.files?.[0]) {
    statusEl.innerHTML = '<span style="color:var(--err);">Select a file first.</span>';
    return;
  }
  statusEl.innerHTML = '<span style="color:var(--text2);">Reading…</span>';
  const year = _attImportYear, month = _attImportMonth;
  const monthKey = `${year}-${String(month).padStart(2,'0')}`;
 
  const reader = new FileReader();
  reader.onload = e => {
    try {
      // Read with cellDates:true to get JS Date objects for date headers
      const wb   = XLSX.read(e.target.result, { type:'array', cellDates:true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:false });
      if (!rows.length) { statusEl.innerHTML = '<span style="color:var(--err);">Empty file.</span>'; return; }
 
      // Row 0 = date headers, Row 1 = formula row (CHOOSE/WEEKDAY) — skip
      // Row 2+ = staff data
      // Columns: 0=No. 1=Emp# 2=Name 3=Position 4+=dates
      const headerRow = rows[0];
      const dateCols  = [];
      headerRow.forEach((h, i) => {
        if (i < 4) return; // skip No./Emp#/Name/Position
        const dk = _excelDateToDk(h, month);
        if (dk) dateCols.push({ index: i, dateKey: dk });
      });
 
      if (!state.monthlyAttendance) state.monthlyAttendance = {};
      let imported = 0, skipped = 0;
 
      rows.slice(2).forEach(row => { // slice(2) skips header + formula row
        if (!row) return;
        const nameVal = String(row[2] || '').trim(); // col C = Name
        const empNo   = String(row[1] || '').trim(); // col B = Emp#
        if (!nameVal && !empNo) return;
 
        // Match by name first, then by empNo via staffInfo
        let user = state.users.find(u =>
          u.name === nameVal ||
          (u.name||'').toLowerCase() === nameVal.toLowerCase()
        );
        if (!user && empNo) {
          const si = Object.entries(state.staffInfo||{})
            .find(([,v]) => v.empNo === empNo);
          if (si) user = state.users.find(u => u.username === si[0]);
        }
        if (!user) { skipped++; return; }
 
        const uname = user.username;
        if (!state.monthlyAttendance[uname])           state.monthlyAttendance[uname] = {};
        if (!state.monthlyAttendance[uname][monthKey]) state.monthlyAttendance[uname][monthKey] = {};
 
        dateCols.forEach(({ index, dateKey }) => {
          const raw = row[index];
          if (raw === null || raw === undefined) return;
          const rawStr = String(typeof raw === 'number' ? Math.round(raw) : raw).trim().toUpperCase();
          if (!rawStr) return;
          state.monthlyAttendance[uname][monthKey][dateKey] = rawStr;
        });
        imported++;
      });
 
      save();
      if (typeof syncWrite === 'function') syncWrite();
      statusEl.innerHTML = `<span style="color:var(--ok);">✓ ${imported} staff imported · ${dateCols.length} date columns · ${skipped} not matched</span>`;
      nav('staff');
    } catch(ex) {
      console.error('[att import]', ex);
      statusEl.innerHTML = `<span style="color:var(--err);">Error: ${ex.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
}
 
function clearMonthlyAttendance(year, month) {
  const label = new Date(year, month-1).toLocaleString('en-US',{month:'long',year:'numeric'});
  if (!confirm(`Clear attendance data for ${label}?`)) return;
  const mk = `${year}-${String(month).padStart(2,'0')}`;
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
    <td class="mono" style="font-size:11px;">${u.team||'—'}</td>
    <td style="font-weight:600">${u.name}</td>
    <td class="mono" style="color:var(--accent);font-size:11px;">${u.username||''}</td>
    <td style="font-size:11px;color:var(--text2)">${u.role}</td>
    ${displayDates.map(d=>{const s=u.schedule[d]||'0';return`<td class="c"><span class="sh sh-${s}">${s==='0'?'—':s}</span></td>`;}).join('')}
  </tr>`).join('');
}

function _liveFilter() {
  const allDates     = Object.keys(state.users[0]?.schedule||{});
  const weekRange    = getWeekRange(activeMonday);
  const displayDates = showFullMonth ? allDates : weekRange;
  const filtered     = state.users.filter(u =>
    (u.team||'').toLowerCase().includes(staffFilters.team.toLowerCase()) &&
    (u.name||'').toLowerCase().includes(staffFilters.name.toLowerCase()) &&
    (u.username||'').toLowerCase().includes(staffFilters.user.toLowerCase()) &&
    (u.role||'').toLowerCase().includes(staffFilters.role.toLowerCase())
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
  const statusEl  = document.getElementById('excel-import-status');
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
      const wb   = XLSX.read(e.target.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        statusEl.innerHTML = '<span style="color:var(--err);">⚠ No rows found in sheet.</span>';
        return;
      }

      // Detect column names flexibly (first row keys)
      const firstRow = rows[0];
      const keys     = Object.keys(firstRow);

      // Helper: find key containing substring (case-insensitive)
      function col(sub) {
        return keys.find(k => k.toLowerCase().replace(/\s+/g,'').replace(/\n/g,'').includes(sub.toLowerCase())) || null;
      }

      const nameCol   = col('name');
      const userCol   = col('username');
      const genderCol = col('gender');
      const dobCol    = col('birth') || col('dob');
      const posCol    = col('position') || col('role');
      const empCol    = col('employee') || col('empno') || col('number');

      if (!nameCol || !userCol) {
        statusEl.innerHTML = `<span style="color:var(--err);">⚠ Could not find Name/Username columns. Found: ${keys.slice(0,6).join(', ')}</span>`;
        return;
      }

      let count = 0;
      rows.forEach(row => {
        const username = String(row[userCol] || '').trim();
        const name     = String(row[nameCol]  || '').trim();
        if (!username || !name) return;

        const gRaw  = String(row[genderCol] || '').trim().toLowerCase();
        const gender = gRaw.includes('female') || gRaw === 'f' ? 'F'
                     : gRaw.includes('male')   || gRaw === 'm' ? 'M' : '';

        const dob  = String(row[dobCol]  || '').trim();
        const role = String(row[posCol]  || '').trim();
        const empNo= String(row[empCol]  || '').trim();

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
  const cur   = getAssigned(uid, day);
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
  const allDates  = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const weekDates = getWeekDates();

  // Build list of days this user is on THIS shift
  const myShiftDays = [];
  allDates.forEach(dk => { if (currentUser.schedule[dk] === currentShift) myShiftDays.push(dk); });
  if (myShiftDays.length === 0) {
    WEEK_DAYS.forEach((d, i) => { if (currentUser.schedule[d] === currentShift) myShiftDays.push(weekDates[i]); });
  }

  const daySelect = document.getElementById('req-day');
  daySelect.innerHTML = myShiftDays.length > 0
    ? myShiftDays.map(d => {
        const br   = getAssigned(currentUser.id, d) || getAssigned(currentUser.id, getWkDay(d));
        const slot = br ? ` (${getShortSlot(currentShift, br.slot)})` : ' (no break)';
        return `<option value="${d}">${d} ${getWkDay(d)}${slot}</option>`;
      }).join('')
    : `<option value="">No shift days found</option>`;

  // Reset scope toggle to 'day'
  document.getElementById('req-scope-day').checked  = true;
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
  const br  = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
  document.getElementById('req-cur').value = br ? br.slot : 'Not assigned';
  _updateReqPartners();
}

function _updateReqPartners() {
  const day    = document.getElementById('req-day').value;
  const isWeek = document.getElementById('req-scope-week')?.checked;
  if (!day) return;

  const myBr   = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
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
  const chosen     = partnerSel.options[partnerSel.selectedIndex];
  const theirSlot  = chosen?.dataset?.slot || '';
  const reqNew     = document.getElementById('req-new');
  reqNew.innerHTML = theirSlot
    ? `<option value="${theirSlot}" selected>${theirSlot}</option>`
    : `<option value="">— pick partner first —</option>`;
}

function submitRequest() {
  const day       = document.getElementById('req-day').value;
  const requested = document.getElementById('req-new').value;
  const reason    = document.getElementById('req-reason').value.trim();
  const partnerSel= document.getElementById('req-partner');
  const partnerId = partnerSel.value ? parseInt(partnerSel.value) : null;
  const partnerSlot = partnerSel.options[partnerSel.selectedIndex]?.dataset?.slot || '';
  const isWeek    = document.getElementById('req-scope-week')?.checked || false;

  if (!day)       { toast('Select a day first.', 'err'); return; }
  if (!partnerId) { toast('Select a swap partner.', 'err'); return; }
  if (!requested) { toast('No swap slot available.', 'err'); return; }

  // ── Conflict detection: check if partner already has a PENDING request for the same day(s) ──
  const allDates   = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  let swapDays     = [day];
  if (isWeek) {
    // Collect all dates where BOTH users are on this shift
    const partner = state.users.find(u => u.id === partnerId);
    swapDays = allDates.filter(dk => {
      const myShift = currentUser.schedule[dk] || currentUser.schedule[getWkDay(dk)] || '0';
      const ptShift = partner?.schedule[dk]   || partner?.schedule[getWkDay(dk)]   || '0';
      return myShift === currentShift && ptShift === currentShift;
    });
    if (swapDays.length === 0) { toast('No matching shift days found for week swap.', 'err'); return; }
  }

  // Check for conflicting pending requests involving this partner
  const conflicts = state.requests.filter(r =>
    r.status === 'pending' &&
    r.swapPartnerId === partnerId &&
    (isWeek ? (r.swapDays||[r.day]).some(d => swapDays.includes(d)) : swapDays.includes(r.day))
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
  r.status     = status;
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
        other.status     = 'rejected';
        other.respNote   = `Auto-denied: swap partner's break was already committed to another approved request.`;
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
  const isFemale = currentUser.gender === 'F';
  if (isTraining(currentUser)) return renderExtBreakTraining();
  const mk       = currentMonthKey();  // 'YYYY-MM'
  const [yr, mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr), parseInt(mo)-1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // All female users in current shift this week
  const weekDates  = getWeekDates();
  const femaleShiftUsers = state.users.filter(u =>
    u.gender === 'F' &&
    weekDates.some(dk => {
      const dn = WEEK_DAYS[weekDates.indexOf(dk)];
      return u.schedule[dk] === currentShift || u.schedule[dn] === currentShift;
    })
  );

  // My registrations this month
  const myEntries    = DB.getExtBreaks(currentUser.id, mk);
  const myUsed       = myEntries.length;
  const myRemaining  = Math.max(0, 3 - myUsed);

  // Build registration list for current user (female) or full view (leader)
  const viewUsers = isLeader(currentUser) ? femaleShiftUsers : (isFemale ? [currentUser] : []);

  const userCards = viewUsers.map(u => {
    const entries = DB.getExtBreaks(u.id, mk);
    const used    = entries.length;
    const genderIcon = '♀';

    const entryRows = entries.length === 0
      ? `<div style="font-size:11px;color:var(--text3);padding:6px 0;">No registrations this month.</div>`
      : entries.map((e, i) => {
          // Who registered this entry?
          const registrar = e.registeredBy ? (state.users.find(x=>x.id===e.registeredBy) || (() => { const si=DB.getStaffInfo(Object.keys(state.staffInfo||{}).find(k=>state.staffInfo[k] && _stableId && _stableId(k)===e.registeredBy)); return si?{name:si.name}:null; })()) : null;
          const isSelfReg  = !registrar || registrar.id === u.id;
          const regByLine  = !isSelfReg && registrar
            ? `<span style="font-size:10px;background:var(--B-bg);color:var(--B-color);border:1px solid var(--B-color);border-radius:4px;padding:1px 7px;margin-left:6px;">Reg. by ${registrar.name}</span>`
            : '';
          // Who approved (leaders can only view/cancel; registration itself IS the approval for female staff)
          // For now show reg. source clearly
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap;">
            <span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);min-width:70px;">${e.day}</span>
            <span style="color:var(--text2);min-width:50px;">${getWkDay(e.day)}</span>
            <span style="background:var(--A-bg);color:var(--A-color);border:1px solid var(--A-color);
              border-radius:4px;padding:2px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;">
              ${e.position === 'before' ? '← Before' : 'After →'}
            </span>
            <span style="color:var(--text2);font-size:11px;">${e.time}</span>
            ${regByLine}
            <span style="font-size:10px;color:var(--text3);margin-left:auto;">${timeSince(e.at)}</span>
            ${u.id === currentUser.id || isLeader(currentUser) ? `
              <button class="btn btn-xs btn-err" onclick="deleteExtBreak(${u.id},'${mk}',${i},${currentUser.id})">✕</button>` : ''}
          </div>`;
        }).join('');

    return `
<div class="card" style="margin-bottom:14px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div>
      <span style="font-weight:600;font-size:14px;">${u.name}</span>
      <span style="color:var(--A-color);margin-left:6px;font-size:13px;">${genderIcon}</span>
      <span style="font-size:11px;color:var(--text3);margin-left:8px;">${u.team} · ${getRoleInfo(u.role).label}</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <!-- Quota dots -->
      <div style="display:flex;gap:4px;">
        ${[0,1,2].map(i => `<span style="width:10px;height:10px;border-radius:50%;
          background:${i < used ? 'var(--A-color)' : 'var(--border)'};
          border:1px solid ${i < used ? 'var(--A-color)' : 'var(--border2)'};"
          title="${i < used ? 'Used' : 'Available'}"></span>`).join('')}
      </div>
      <span style="font-size:11px;color:${myRemaining===0?'var(--err)':'var(--text2)'};">
        ${used}/3 used
      </span>
      ${u.id === currentUser.id && isFemale && used < 3 ? `
        <button class="btn btn-sm btn-accent" onclick="openExtBreakModal()">+ Register</button>` : ''}
    </div>
  </div>
  ${entryRows}
</div>`;
  }).join('');

  const noAccessMsg = !isFemale && !isLeader(currentUser)
    ? `<div class="empty"><div class="empty-ico">🌸</div>
        <div>This menu is for female staff only.</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">Female staff can register up to 3 extra 30-min breaks per month.</div>
      </div>` : '';

  return `
<div class="page-header">
  <div>
    <div class="page-title">🌸 30-Min Extra Break</div>
    <div class="page-sub">${monthLabel} · Shift ${currentShift} · ${isFemale&&!isLeader(currentUser)?`${myRemaining} registration${myRemaining!==1?'s':''} remaining`:'All female staff'}</div>
  </div>
  ${isFemale && !isLeader(currentUser) && myUsed < 3 ? `
    <button class="btn btn-accent" onclick="openExtBreakModal()">+ Register Extra Break</button>` : ''}
</div>

${noAccessMsg}

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
function openExtBreakModal() {
  if (currentUser.gender !== 'F') { toast('Only female staff can register.', 'err'); return; }
  const mk      = currentMonthKey();
  const used    = DB.countExtBreaks(currentUser.id, mk);
  if (used >= 3) { toast('You have used all 3 registrations this month.', 'err'); return; }

  // Days where user is on shift and has a break assigned
  const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const weekDates = getWeekDates();
  const eligibleDays = [];
  allDates.forEach(dk => {
    if (monthKeyFromDate(dk) !== mk) return;  // only this month
    const shiftVal = currentUser.schedule[dk];
    if (shiftVal !== currentShift) return;
    const br = getAssigned(currentUser.id, dk) || getAssigned(currentUser.id, getWkDay(dk));
    if (br) eligibleDays.push({ dk, slot: br.slot });
  });
  // Fallback to week day-names
  if (eligibleDays.length === 0) {
    weekDates.forEach((dk, i) => {
      const dn = WEEK_DAYS[i];
      if (currentUser.schedule[dn] !== currentShift) return;
      const br = getAssigned(currentUser.id, dk) || getAssigned(currentUser.id, dn);
      if (br) eligibleDays.push({ dk, slot: br.slot });
    });
  }

  const daySelect = document.getElementById('eb-day');
  daySelect.innerHTML = eligibleDays.length > 0
    ? eligibleDays.map(({ dk, slot }) => `<option value="${dk}" data-slot="${slot}">${dk} ${getWkDay(dk)} — ${slot}</option>`).join('')
    : `<option value="">No days with assigned break found</option>`;

  _updateEbDayChange();

  const quota = document.getElementById('eb-quota-info');
  quota.innerHTML = `<span style="color:${used>=2?'var(--warn)':'var(--ok)'};">
    ${3 - used} registration${3-used!==1?'s':''} remaining this month (${used}/3 used)</span>`;

  document.getElementById('eb-submit-btn').disabled = eligibleDays.length === 0;
  document.getElementById('modal-extbreak').classList.add('show');
}

function _updateEbDayChange() {
  const sel    = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const slot   = chosen?.dataset?.slot || '';
  document.getElementById('eb-main-slot').value = slot || '—';
  document.getElementById('eb-preview').style.display = 'none';
  // Reset radio
  document.getElementById('eb-before').checked = false;
  document.getElementById('eb-after').checked  = false;
}

function _updateEbPreview() {
  const sel    = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const slot   = chosen?.dataset?.slot || '';
  if (!slot) return;

  const pos    = document.querySelector('input[name="eb-pos"]:checked')?.value;
  if (!pos) return;

  // Parse slot times like "09:30–11:00"
  const parts = slot.split('–');
  if (parts.length !== 2) return;
  const [start, end] = parts.map(t => t.trim());

  function addMins(timeStr, mins) {
    const [h, m] = timeStr.split(':').map(Number);
    const total  = h * 60 + m + mins;
    const nh     = Math.floor(total / 60) % 24;
    const nm     = total % 60;
    return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
  }
  function subMins(timeStr, mins) { return addMins(timeStr, -mins); }

  let extraLabel;
  if (pos === 'before') extraLabel = `${subMins(start, 30)}–${start}`;
  else                  extraLabel = `${end}–${addMins(end, 30)}`;

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
  const sel    = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const day    = sel.value;
  const slot   = chosen?.dataset?.slot || '';
  const pos    = document.querySelector('input[name="eb-pos"]:checked')?.value;

  if (!day)  { toast('Choose a day first.', 'err'); return; }
  if (!pos)  { toast('Choose Before or After.', 'err'); return; }
  if (!slot) { toast('No main break found on that day.', 'err'); return; }

  const mk   = currentMonthKey();
  const used = DB.countExtBreaks(currentUser.id, mk);
  if (used >= 3) { toast('Monthly quota reached (3/3).', 'err'); return; }

  // Compute time label
  const parts = slot.split('–');
  const [start, end] = parts.map(t => t.trim());
  function addMins(t, m) {
    const [h, mi] = t.split(':').map(Number);
    const tot = h*60+mi+m;
    return `${String(Math.floor(tot/60)%24).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`;
  }
  const time = pos === 'before'
    ? `${addMins(start,-30)}–${start}`
    : `${end}–${addMins(end, 30)}`;

  DB.addExtBreak(currentUser.id, mk, { day, time, position: pos, at: Date.now(), registeredBy: currentUser.id });
  if (typeof syncWrite === 'function') syncWrite(); else save();
  closeModal('modal-extbreak');
  toast('Extra 30-min break registered! 🌸', 'ok');
  nav('extbreak');
}

function deleteExtBreak(uid, mk, idx, cancelledById) {
  const entry = DB.getExtBreaks(uid, mk)[idx];
  if (!entry) return;
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




// ═══════════════════════════════════════════════
//  RENDER: AUTO-ASSIGN ROTATION STATUS (admin)
//  Shown inside Cloud Sync page
// ═══════════════════════════════════════════════
function renderRotationPanel() {
  const summary    = typeof getRotationSummary === 'function' ? getRotationSummary() : [];
  const tierLabels = { agent: 'Agent + Sr Agent', qa: 'QA', sr_qa: 'Sr QA' };

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

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
