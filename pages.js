// ═══════════════════════════════════════════════
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
  const canPickWeek = isLeader(currentUser);

  // Determine which week dates to display
  let weekDates;
  if (canPickWeek && scheduleMonday) {
    weekDates = getWeekRange(scheduleMonday);
  } else {
    weekDates = getWeekDates(); // always real current week
  }

  // Build a date→dayName map for seed-data fallback
  const realWeekDates   = getWeekDates();
  const dateToDayName   = {};
  WEEK_DAYS.forEach((d, i) => { dateToDayName[realWeekDates[i]] = d; });
  // Also map selected week dates → day names
  weekDates.forEach((dk, i) => { if (!dateToDayName[dk]) dateToDayName[dk] = WEEK_DAYS[i]; });

  // Helper: get shift for a user on a date (try both key formats)
  function getUserShift(u, dateKey) {
    const dayName = dateToDayName[dateKey];
    return u.schedule[dateKey] || u.schedule[dayName] || '0';
  }

  // Users who work this shift on any day in the selected week
  const shiftUsers = state.users.filter(u =>
    weekDates.some(dk => getUserShift(u, dk) === currentShift)
  );

  // Week picker (leaders only) — gather all available Mondays from schedule data
  let weekPickerHTML = '';
  if (canPickWeek) {
    const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
    const mondays  = allDates.filter(d => getWkDay(d) === 'Mon').sort();
    // Determine active monday label for display
    const activeMon = scheduleMonday || weekDates[0];
    weekPickerHTML = mondays.length > 0 ? `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:11px; color:var(--text3); font-family:'IBM Plex Mono',monospace;">WEEK:</span>
        <select class="login-select" style="padding:4px 8px; font-size:11px;"
          onchange="scheduleMonday=this.value; nav('schedule')">
          ${mondays.map(m => `<option value="${m}" ${m===activeMon?'selected':''}>${m} — ${getWkDay(m)}</option>`).join('')}
        </select>
      </div>` : '';
  }

  // Column headers
  const todayDk   = getWeekDates()[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const headers = `<div class="wg-header" style="background:var(--bg4);">Name / Group</div>` + weekDates.map((dk, i) => {
    const dayName = dateToDayName[dk] || WEEK_DAYS[i];
    const isToday = dk === todayDk;
    return `<div class="wg-header" style="text-align:center;${isToday?'background:var(--accent);color:#000;border-bottom:2px solid var(--accent2);':''}">
      <span style="font-size:11px;font-weight:800;">${dayName}</span><br>
      <span style="font-size:9px;font-weight:400;opacity:${isToday?'0.7':'0.6'}">${dk}</span>
    </div>`;
  }).join('');

  // Rows
  const rows = shiftUsers.map(u => {
    const cells = weekDates.map(dateKey => {
      const shiftVal = getUserShift(u, dateKey);
      const onShift  = shiftVal === currentShift;
      const dayOff   = shiftVal === '0';
      const br       = getAssigned(u.id, dateKey) || getAssigned(u.id, dateToDayName[dateKey]);

      if (dayOff)   return `<div class="wg-cell"><span class="sh sh-0">—</span></div>`;
      if (!onShift) return `<div class="wg-cell"><span class="sh sh-${shiftVal}">${shiftVal}</span></div>`;

      const shortCode = br ? getShortSlot(currentShift, br.slot) : '—';
      // Slot index (0-based) for color differentiation
      const slotIdx   = br ? (BREAK_SLOTS[currentShift]||[]).indexOf(br.slot) : -1;
      const slotClass = slotIdx === 0 ? 'slot-1' : slotIdx === 1 ? 'slot-2' : '';
      // Female 30-min extra break registered?
      const mk        = currentMonthKey();
      const hasExt    = br && u.gender === 'F' && DB.countExtBreaks(u.id, mk) > 0
                        && DB.getExtBreaks(u.id, mk).some(e => e.day === dateKey);
      return `<div class="wg-cell${hasExt ? ' cell-female-ext' : ''}" style="position:relative;">
        <span class="${br ? `break-slot assigned ${slotClass}` : ''}"
          style="font-size:10px; padding:3px 8px; ${br ? '' : 'color:var(--text3)'}"
          title="${br ? br.slot + (hasExt?' 🌸+30min':'') : 'Not assigned'}">
          ${shortCode}${hasExt ? ' 🌸' : ''}
        </span>
      </div>`;
    }).join('');

    return `<div class="wg-row" style="display:contents">
      <div class="wg-name">
        <div class="n">${u.name}</div>
        <div class="m">${u.team} · ${getRoleInfo(u.role).label}</div>
      </div>
      ${cells}
    </div>`;
  }).join('');

  // Legend inline
  const shiftSlots  = BREAK_SLOTS[currentShift] || [];
  const legendItems = shiftSlots.map((time, i) => `
    <div style="display:flex; align-items:center; gap:6px;">
      <span class="break-slot assigned slot-${i+1}" style="font-size:10px; min-width:28px; text-align:center">${currentShift}${i + 1}</span>
      <span style="color:var(--text2); font-size:11px">${time}</span>
    </div>`).join('');

  const emptyMsg = shiftUsers.length === 0
    ? `<div class="empty" style="padding:48px;"><div class="empty-ico">👥</div>No staff on Shift ${currentShift} this week.</div>`
    : '';

  return `
<div class="schedule-title-row">
  <div>
    <div class="page-title">Break Schedule — Shift ${currentShift}</div>
    <div class="page-sub">${SHIFTS[currentShift].display}${!canPickWeek ? ' · Current week (read-only)' : ''}</div>
  </div>
  <div class="schedule-legend-inline">
    ${weekPickerHTML}
    <span style="font-size:10px; color:var(--text3); font-family:'IBM Plex Mono',monospace; font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin-left:8px;">Legend:</span>
    ${legendItems || '<span style="color:var(--text3); font-size:11px">No slots defined</span>'}
  </div>
</div>

${emptyMsg}
${shiftUsers.length > 0 ? `
<div class="week-grid-wrap">
  <div class="week-grid" style="min-width:700px; grid-template-columns: 200px repeat(${weekDates.length}, 1fr)">
    ${headers}${rows}
  </div>
</div>` : ''}`;
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
  <div style="display:flex;align-items:center;gap:12px;">${weekPickerHTML}</div>
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

  // Day sub-tabs
  const dayTabs = `
<div class="tabs" id="arrange-day-tabs" style="margin-bottom:0;">
  ${weekRange.map(d => `
    <div class="tab${d===arrangeActiveDay?' on':''}" onclick="switchArrangeDay('${d}')" data-day="${d}" style="min-width:90px;text-align:center;">
      <div style="font-weight:600;font-size:11px;">${getWkDay(d)}</div>
      <div style="font-size:9px;opacity:0.6;">${d}</div>
    </div>`).join('')}
</div>
<div id="arrange-day-content">${getArrangeDayMemberList(arrangeActiveDay)}</div>`;

  return bulkPanel + dayTabs;
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
      color:${isToday?'#000':isActive?'var(--accent)':'var(--text2)'};
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
<div class="staff-tbl-wrap" style="max-height:70vh;">
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
  document.querySelectorAll('#arrange-day-tabs .tab').forEach(t =>
    t.classList.toggle('on', t.dataset.day === day)
  );
  const content = document.getElementById('arrange-day-content');
  if (content) content.innerHTML = getArrangeDayMemberList(day);
}

// Only the per-member rows (no week summary — that's in the Overview tab now)
function getArrangeDayMemberList(day) {
  const mates = getShiftMates(currentShift, day);
  const slots = BREAK_SLOTS[currentShift] || [];

  if (!mates.length) return `<div class="empty" style="background:var(--bg2);border:1px solid var(--border);border-radius:0 0 10px 10px;padding:60px;">
    <div class="empty-ico">👥</div>No staff on Shift ${currentShift} for ${day}.</div>`;

  const colGrid = '70px 1fr 160px 110px 1fr 80px';
  return `
  <div class="arrange-member-header" style="grid-template-columns:${colGrid};border-radius:0;">
    <div>GROUP</div><div>NAME</div><div>ROLE</div><div>GENDER</div><div>BREAK SLOTS</div><div></div>
  </div>
  <div class="arrange-member-wrap">
    ${mates.map(u => {
      const br = getAssigned(u.id, day);
      const genderBadge = u.gender === 'F'
        ? `<span style="font-size:9px;color:var(--A-color);margin-left:4px;">♀</span>` : '';
      return `
      <div style="display:grid;grid-template-columns:${colGrid};
            align-items:center;gap:16px;padding:11px 16px;
            background:var(--bg2);border-bottom:1px solid var(--border);">
        <div class="emp-meta">${u.team}</div>
        <div style="min-width:0;">
          <div class="emp-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">
            ${u.name}${genderBadge}
          </div>
          <div class="emp-meta" style="color:var(--accent)">${u.username}</div>
        </div>
        <div><span class="role-tag ${getRoleInfo(u.role).tag}">${getRoleInfo(u.role).label}</span></div>
        <div style="font-size:11px;color:var(--text2);">${u.gender==='F'?'Female':u.gender==='M'?'Male':'—'}</div>
        <div class="break-slots">
          ${slots.map((s, idx) => `
            <span class="break-slot${br?.slot===s?' assigned':''} slot-${idx+1}"
                  onclick="quickAssign(${u.id},'${day}','${s}')"
                  style="font-size:10px;padding:4px 10px;" title="${s}">
              ${currentShift}${idx+1}
            </span>`).join('')}
        </div>
        <div style="text-align:right;">
          <button class="btn btn-xs" onclick="openAssignModal(${u.id},'${day}')" style="opacity:0.5">Edit</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function quickAssign(uid, day, slot) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  assign(uid, day, slot, '');
  toast(`Break assigned: ${slot}`);
  switchArrangeDay(day);
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
</div>
<div id="staff-subtab-content">
  ${staffSubTab === 'info' ? _renderStaffInfo() : _renderStaffSchedule()}
</div>`;
}

// ── Sub-tab 1: Staff Info ──
function _renderStaffInfo() {
  const all = Object.entries(state.staffInfo || {})
    .map(([username, d]) => ({ username, ...d }))
    .sort((a,b) => (a.name||'').localeCompare(b.name||''));

  const infoFilter = staffFilters._info || '';

  const filtered = all.filter(u =>
    !infoFilter ||
    (u.name||'').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.username||'').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.empNo||'').toLowerCase().includes(infoFilter.toLowerCase()) ||
    (u.role||'').toLowerCase().includes(infoFilter.toLowerCase())
  );

  const rows = filtered.map(u => {
    const g = u.gender === 'F'
      ? `<span style="color:var(--A-color);font-weight:700;">♀ Female</span>`
      : `<span style="color:var(--B-color);font-weight:700;">♂ Male</span>`;
    return `<tr>
      <td class="mono" style="font-size:11px;color:var(--text3);">${u.empNo||'—'}</td>
      <td style="font-weight:600;">${u.name||'—'}</td>
      <td class="mono" style="color:var(--accent);font-size:11px;">${u.username}</td>
      <td>${g}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);">${u.dob||'—'}</td>
      <td style="font-size:11px;color:var(--text2);">${u.role||'—'}</td>
    </tr>`;
  }).join('');

  return `
<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
  <input class="filter-input" style="width:260px;" placeholder="Search name, username, emp#, role…"
    value="${infoFilter}" oninput="staffFilters._info=this.value; document.getElementById('staff-info-tbody').innerHTML=_renderStaffInfoRows(this.value)">
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
    .sort((a,b) => (a.name||'').localeCompare(b.name||''));
  const f = (filter||'').toLowerCase();
  return all.filter(u =>
    !f ||
    (u.name||'').toLowerCase().includes(f) ||
    (u.username||'').toLowerCase().includes(f) ||
    (u.empNo||'').toLowerCase().includes(f) ||
    (u.role||'').toLowerCase().includes(f)
  ).map(u => {
    const g = u.gender==='F'
      ? `<span style="color:var(--A-color);font-weight:700;">♀ Female</span>`
      : `<span style="color:var(--B-color);font-weight:700;">♂ Male</span>`;
    return `<tr>
      <td class="mono" style="font-size:11px;color:var(--text3);">${u.empNo||'—'}</td>
      <td style="font-weight:600;">${u.name||'—'}</td>
      <td class="mono" style="color:var(--accent);font-size:11px;">${u.username}</td>
      <td>${g}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);">${u.dob||'—'}</td>
      <td style="font-size:11px;color:var(--text2);">${u.role||'—'}</td>
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
      save();
      buildDatalist();
      statusEl.innerHTML = `<span style="color:var(--ok);">✓ Imported ${count} records.</span>`;
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



function closeModal(id) { document.getElementById(id).classList.remove('show'); }
