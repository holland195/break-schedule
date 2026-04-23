// ═══════════════════════════════════════════════
//  RENDER: DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const weekRange = getWeekRange(activeMonday);
  const mates     = state.users.filter(u => u.team === currentUser.team);

  return `
<div class="page-header">
  <div>
    <div class="page-title">Team Dashboard: ${currentUser.team}</div>
    <div class="page-sub">Week of ${activeMonday}</div>
  </div>
</div>
<div class="week-grid">
  <div class="wg-header">Member</div>
  ${weekRange.map(d => `<div class="wg-header" style="text-align:center">${d}</div>`).join('')}
  ${mates.map(u => `
    <div class="wg-row" style="display:contents">
      <div class="wg-name">${u.name}</div>
      ${weekRange.map(d => {
        const br        = getAssigned(u.id, d);
        const shortSlot = br ? getShortSlot(u.schedule[d], br.slot) : '—';
        return `<div class="wg-cell" style="text-align:center; font-weight:700; color:var(--accent)">${shortSlot}</div>`;
      }).join('')}
    </div>`).join('')}
</div>`;
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
  const headers = `<div class="wg-header">Name / Group</div>` + weekDates.map((dk, i) => {
    const dayName = dateToDayName[dk] || WEEK_DAYS[i];
    const isToday = dk === getWeekDates()[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    return `<div class="wg-header${isToday ? ' c-accent' : ''}" style="text-align:center">
      ${dayName}<br><span style="font-size:9px; opacity:0.5; font-weight:400">${dk}</span>
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
      return `<div class="wg-cell">
        <span class="${br ? 'break-slot assigned' : ''}"
          style="font-size:10px; padding:3px 8px; color:${br ? '' : 'var(--text3)'}"
          title="${br ? br.slot : 'Not assigned'}">
          ${shortCode}
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
      <span class="break-slot assigned" style="font-size:10px; min-width:28px; text-align:center">${currentShift}${i + 1}</span>
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
<div class="tbl-wrap" style="overflow:auto">
  <div class="week-grid" style="min-width:700px; grid-template-columns: 200px repeat(${weekDates.length}, 1fr)">
    ${headers}${rows}
  </div>
</div>` : ''}`;
}

// ═══════════════════════════════════════════════
//  RENDER: REQUESTS
//  Agent/QA/Sr roles: pick day + swap partner
//  (same shift + same role group required)
// ═══════════════════════════════════════════════
function renderRequests() {
  const myReqs = isLeader(currentUser)
    ? state.requests
    : state.requests.filter(r => r.userId === currentUser.id);

  const pending = myReqs.filter(r => r.status === 'pending');
  const rest    = myReqs.filter(r => r.status !== 'pending');

  const card = (r) => {
    const emp   = state.users.find(u => u.id === r.userId);
    const isOwn = r.userId === currentUser.id;
    const idx   = state.requests.indexOf(r);

    // Show swap partner info if present
    const partnerInfo = r.swapPartnerId
      ? (() => {
          const p = state.users.find(u => u.id === r.swapPartnerId);
          return p ? `<br><span style="color:var(--text3)">Swap with:</span> <b>${p.name}</b> (${p.team}) — their slot: <b style="color:var(--B-color)">${r.partnerSlot || '?'}</b>` : '';
        })()
      : '';

    return `<div class="req-card ${r.status}">
      <div class="req-header">
        <div>
          <div class="req-title">${emp?.name || 'Unknown'}</div>
          <div class="req-meta">${emp?.team || '—'} · ${r.day} · submitted ${timeSince(r.at)}</div>
        </div>
        <span class="req-status ${r.status}">${r.status.toUpperCase()}</span>
      </div>
      <div class="req-body">
        <span style="color:var(--text3)">Current slot:</span> <b>${r.current}</b> &nbsp;→&nbsp;
        <span style="color:var(--text3)">Requested:</span> <b style="color:var(--warn)">${r.requested}</b>
        ${partnerInfo}
        <br><span style="color:var(--text3)">Reason:</span> ${r.reason || 'No reason given'}
        ${r.status !== 'pending' && r.respNote ? `<br><span style="color:var(--text3)">Response:</span> ${r.respNote}` : ''}
      </div>
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

function renderArrange() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';
  const weekRange = getWeekRange(activeMonday);
  if (!arrangeActiveDay || !weekRange.includes(arrangeActiveDay)) arrangeActiveDay = weekRange[0];

  return `
<div class="page-header">
  <div class="page-title">Arrange Breaks — Shift ${currentShift}</div>
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
  ).map(u => u.team))].sort();

  const slots = BREAK_SLOTS[currentShift] || [];

  const bulkPanel = `
<div class="bulk-panel" style="margin-bottom:20px;">
  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Groups</div>
    <div class="group-checkbox-list">
      ${allShiftTeams.map(t => `
        <label class="group-check-item">
          <input type="checkbox" name="bulk-group" value="${t}"> ${t}
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
          <input type="checkbox" name="bulk-day" value="${d}">
        </label>`).join('')}
    </div>
  </div>
  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Slot</div>
    <select id="bulk-slot-multi" class="login-select" style="padding:6px 10px;">
      ${slots.map((s, i) => `<option value="${i}">${currentShift}${i+1} — ${s}</option>`).join('')}
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

  const summaryHeaders = weekRange.map((d, i) => `
    <th style="text-align:center;padding:7px 4px;font-size:9px;min-width:54px;
      color:${d===arrangeActiveDay?'var(--accent)':'var(--text3)'};">
      ${WEEK_DAYS[i]}<br>
      <span style="font-weight:400;opacity:0.7;">${d}</span>
    </th>`).join('');

  const summaryRows = shiftUsers.map(u => {
    const dayCells = weekRange.map((d, i) => {
      const dn       = WEEK_DAYS[i];
      const shiftVal = u.schedule[d] || u.schedule[dn] || '0';
      const onShift  = shiftVal === currentShift;
      const br       = getAssigned(u.id, d) || getAssigned(u.id, dn);

      if (shiftVal === '0') return `<td style="text-align:center;padding:6px 4px;"><span style="color:var(--text3);font-size:10px;">—</span></td>`;
      if (!onShift) return `<td style="text-align:center;padding:6px 4px;"><span class="sh sh-${shiftVal}" style="width:20px;height:20px;font-size:10px;">${shiftVal}</span></td>`;

      const code = br ? getShortSlot(currentShift, br.slot) : '?';
      return `<td style="text-align:center;padding:6px 4px;">
        <span onclick="switchArrangeMainTab('assign'); arrangeActiveDay='${d}'; nav('arrange');"
          style="display:inline-flex;align-items:center;justify-content:center;
            width:28px;height:22px;border-radius:4px;font-size:10px;font-weight:700;
            font-family:'IBM Plex Mono',monospace;cursor:pointer;
            background:${br?'#1a2a0a':'#2a1a00'};
            color:${br?'var(--ok)':'var(--warn)'};
            border:1px solid ${br?'var(--ok)':'var(--warn)'};
            ${d===arrangeActiveDay?'outline:2px solid var(--accent);outline-offset:1px;':''}"
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
        <th style="text-align:left;padding:7px 12px;font-size:10px;color:var(--text3);min-width:200px;border-right:1px solid var(--border);">MEMBER</th>
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

  return `<div class="break-board" style="gap:0;background:var(--bg2);border:1px solid var(--border);border-radius:0 0 10px 10px;">
    ${mates.map(u => {
      const br = getAssigned(u.id, day);
      const genderBadge = u.gender === 'F'
        ? `<span style="font-size:9px;color:var(--A-color);margin-left:4px;">♀</span>` : '';
      return `
      <div class="break-row" style="border-radius:0;border:none;border-bottom:1px solid var(--border);
            display:grid;grid-template-columns:70px 1fr 160px 110px 1fr 80px;
            align-items:center;gap:16px;padding:11px 16px;">
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
            <span class="break-slot${br?.slot===s?' assigned':''}"
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

function bulkAssignMulti() {
  const selectedGroups = Array.from(document.querySelectorAll('input[name="bulk-group"]:checked')).map(el => el.value);
  const selectedDays   = Array.from(document.querySelectorAll('input[name="bulk-day"]:checked')).map(el => el.value);
  const slotIdx        = parseInt(document.getElementById('bulk-slot-multi').value);

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
//  RENDER: STAFF DIRECTORY
//  Fix: instant filter (oninput), no Apply button,
//       horizontal + vertical scroll on table
// ═══════════════════════════════════════════════
function renderStaff() {
  if (!state.users || state.users.length === 0) return '<div class="empty">No staff data.</div>';

  const allDates         = Object.keys(state.users[0].schedule || {});
  const availableMondays = allDates.filter(d => getWkDay(d) === 'Mon');
  const weekRange        = getWeekRange(activeMonday);
  const displayDates     = showFullMonth ? allDates : weekRange;

  const filteredUsers = state.users.filter(u =>
    u.team.toLowerCase().includes(staffFilters.team.toLowerCase()) &&
    u.name.toLowerCase().includes(staffFilters.name.toLowerCase()) &&
    (u.gender || '').toLowerCase().includes((staffFilters.gender||'').toLowerCase()) &&
    (u.username || '').toLowerCase().includes(staffFilters.user.toLowerCase()) &&
    u.role.toLowerCase().includes(staffFilters.role.toLowerCase())
  );

  return `
<div class="page-header">
  <div>
    <div class="page-title">Staff Directory</div>
    <div class="page-sub">Week: ${activeMonday} · ${filteredUsers.length} staff shown</div>
  </div>
  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
    <label style="font-size:11px; opacity:0.7">Jump to Week:</label>
    <select class="login-select" style="width:130px; padding:4px;" onchange="activeMonday=this.value; nav('staff')">
      ${availableMondays.map(m => `<option value="${m}" ${m===activeMonday?'selected':''}>Week ${m}</option>`).join('')}
    </select>
    <button class="toggle-btn ${showFullMonth?'active':''}" onclick="showFullMonth=!showFullMonth; nav('staff')">
      ${showFullMonth ? '📂 Hide Others' : '📂 Show Full Month'}
    </button>
  </div>
</div>

<div class="staff-tbl-wrap">
  <table>
    <thead>
      <tr class="filter-row">
        <td><input class="filter-input" placeholder="Group…"  value="${staffFilters.team}"   oninput="staffFilters.team=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="Name…"   value="${staffFilters.name}"   oninput="staffFilters.name=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="Gender…" value="${staffFilters.gender||''}" oninput="staffFilters.gender=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="User…"   value="${staffFilters.user}"   oninput="staffFilters.user=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="Role…"   value="${staffFilters.role}"   oninput="staffFilters.role=this.value; _liveFilter()"></td>
        <td colspan="${displayDates.length}" style="padding-left:12px; color:var(--text3); font-size:10px; font-family:'IBM Plex Mono',monospace;">SCHEDULE</td>
      </tr>
      <tr>
        <th>GROUP</th><th>FULL NAME</th><th>GENDER</th><th>USER</th><th>POSITION</th>
        ${displayDates.map(d => `
          <th class="c" style="min-width:42px; padding:6px 2px;">
            <div style="color:var(--accent); font-size:11px;">${d}</div>
            <div style="font-size:8px; font-weight:400; opacity:0.5; margin-top:2px;">${getWkDay(d)}</div>
          </th>`).join('')}
      </tr>
    </thead>
    <tbody id="staff-tbody">
      ${renderStaffRows(filteredUsers, displayDates)}
    </tbody>
  </table>
</div>

<div id="staff-import-panel"></div>`;
}

function renderStaffRows(users, displayDates) {
  return users.map(u => {
    const g = u.gender === 'F' ? `<span style="color:var(--A-color);font-weight:700;">♀ F</span>`
            : u.gender === 'M' ? `<span style="color:var(--B-color);font-weight:700;">♂ M</span>`
            : `<span style="color:var(--text3);">—</span>`;
    return `<tr>
      <td class="mono" style="font-size:11px;">${u.team}</td>
      <td style="font-weight:600">${u.name}</td>
      <td style="text-align:center;font-size:12px;">${g}</td>
      <td class="mono" style="color:var(--accent);font-size:11px;">${u.username||''}</td>
      <td style="font-size:11px;color:var(--text2)">${u.role}</td>
      ${displayDates.map(d => {
        const s = u.schedule[d] || '0';
        return `<td class="c"><span class="sh sh-${s}">${s==='0'?'—':s}</span></td>`;
      }).join('')}
    </tr>`;
  }).join('');
}

// Live filter — updates only tbody to avoid losing focus
function _liveFilter() {
  // Recalculate displayDates
  const allDates     = Object.keys(state.users[0]?.schedule || {});
  const weekRange    = getWeekRange(activeMonday);
  const displayDates = showFullMonth ? allDates : weekRange;

  const filtered = state.users.filter(u =>
    u.team.toLowerCase().includes(staffFilters.team.toLowerCase()) &&
    u.name.toLowerCase().includes(staffFilters.name.toLowerCase()) &&
    (u.gender || '').toLowerCase().includes((staffFilters.gender||'').toLowerCase()) &&
    (u.username || '').toLowerCase().includes(staffFilters.user.toLowerCase()) &&
    u.role.toLowerCase().includes(staffFilters.role.toLowerCase())
  );

  const tbody = document.getElementById('staff-tbody');
  if (tbody) tbody.innerHTML = renderStaffRows(filtered, displayDates);

  // Update sub-title count
  const sub = document.querySelector('.page-sub');
  if (sub) sub.textContent = `Week: ${activeMonday} · ${filtered.length} staff shown`;
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
  // Collect all available dates in the schedule
  const allDates = state.users.length > 0 ? Object.keys(state.users[0].schedule || {}) : [];
  const weekDates = getWeekDates();

  // Build list of days this user has THIS shift (try date key + day name)
  const myShiftDays = [];
  allDates.forEach(dk => {
    const shiftVal = currentUser.schedule[dk];
    if (shiftVal === currentShift) myShiftDays.push(dk);
  });
  // Fallback: try day-name keys
  if (myShiftDays.length === 0) {
    WEEK_DAYS.forEach((d, i) => {
      if (currentUser.schedule[d] === currentShift) myShiftDays.push(weekDates[i]);
    });
  }

  const mySlot = getAssigned(currentUser.id, myShiftDays[0]) || getAssigned(currentUser.id, todayKey());
  const mySlotLabel = mySlot ? mySlot.slot : 'Not assigned';

  document.getElementById('req-cur').value = mySlotLabel;

  // Populate day selector
  const daySelect = document.getElementById('req-day');
  daySelect.innerHTML = myShiftDays.length > 0
    ? myShiftDays.map(d => {
        const br = getAssigned(currentUser.id, d) || getAssigned(currentUser.id, getWkDay(d));
        const slot = br ? ` (${getShortSlot(currentShift, br.slot)})` : ' (no break)';
        return `<option value="${d}">${d} ${getWkDay(d)}${slot}</option>`;
      }).join('')
    : `<option value="">No shift days found</option>`;

  // Trigger partner list update
  _updateReqPartners();

  document.getElementById('req-reason').value = '';
  document.getElementById('modal-request').classList.add('show');
}

// Called when day selection changes — refreshes partner list & slot display
function _updateReqDay() {
  const day    = document.getElementById('req-day').value;
  const br     = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
  document.getElementById('req-cur').value = br ? br.slot : 'Not assigned';
  _updateReqPartners();
}

// Rebuild the partner dropdown: same shift + SAME EXACT ROLE + different slot assigned
function _updateReqPartners() {
  const day = document.getElementById('req-day').value;
  if (!day) return;

  const myBr   = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));
  const mySlot = myBr ? myBr.slot : null;

  // Partners must have the SAME exact role as the requester
  const partners = state.users.filter(u => {
    if (u.id === currentUser.id) return false;
    if (u.role !== currentUser.role) return false;          // ← exact role match
    const shiftVal = u.schedule[day] || u.schedule[getWkDay(day)] || '0';
    if (shiftVal !== currentShift) return false;
    const theirBr = getAssigned(u.id, day) || getAssigned(u.id, getWkDay(day));
    if (!theirBr) return false;                             // must have a break assigned
    if (theirBr.slot === mySlot) return false;              // no point swapping same slot
    return true;
  });

  const partnerSelect = document.getElementById('req-partner');
  if (partners.length === 0) {
    partnerSelect.innerHTML = `<option value="">— No eligible partners on this day —</option>`;
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

// When partner is chosen, show their slot as the "requested" slot
function _updateReqSlot() {
  const partnerSel = document.getElementById('req-partner');
  const chosen     = partnerSel.options[partnerSel.selectedIndex];
  const theirSlot  = chosen?.dataset?.slot || '';

  const reqNew = document.getElementById('req-new');
  if (theirSlot) {
    reqNew.innerHTML = `<option value="${theirSlot}" selected>${theirSlot}</option>`;
  } else {
    reqNew.innerHTML = `<option value="">— pick partner first —</option>`;
  }
}

function submitRequest() {
  const day       = document.getElementById('req-day').value;
  const requested = document.getElementById('req-new').value;
  const reason    = document.getElementById('req-reason').value.trim();
  const partnerSel    = document.getElementById('req-partner');
  const partnerId     = partnerSel.value ? parseInt(partnerSel.value) : null;
  const partnerSlot   = partnerSel.options[partnerSel.selectedIndex]?.dataset?.slot || '';

  if (!day)       { toast('Select a day first.', 'err'); return; }
  if (!partnerId) { toast('Select a swap partner.', 'err'); return; }
  if (!requested) { toast('No swap slot available.', 'err'); return; }

  const myBr = getAssigned(currentUser.id, day) || getAssigned(currentUser.id, getWkDay(day));

  state.requests.unshift({
    id: Date.now(), userId: currentUser.id, day,
    current: myBr ? myBr.slot : 'Not assigned',
    requested, reason,
    swapPartnerId: partnerId,
    partnerSlot,
    status: 'pending', at: Date.now(), respNote: '',
  });
  save();
  closeModal('modal-request');
  toast('Swap request submitted!', 'warn');
  updateBadge();
  nav('requests');
}

function resolveRequest(idx, status) {
  const r      = state.requests[idx];
  r.status     = status;
  r.resolvedBy = currentUser.id;
  r.resolvedAt = Date.now();

  if (status === 'approved') {
    // Assign requester's new (partner's) slot
    assign(r.userId, r.day, r.requested, 'approved by ' + currentUser.name);
    // Swap: assign partner's slot to the partner (requester's old slot)
    if (r.swapPartnerId && r.partnerSlot && r.current && r.current !== 'Not assigned') {
      assign(r.swapPartnerId, r.day, r.current, 'swap approved — ' + currentUser.name);
    }
  }
  save();
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
      : entries.map((e, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);min-width:70px;">${e.day}</span>
          <span style="color:var(--text2);min-width:50px;">${getWkDay(e.day)}</span>
          <span style="background:var(--A-bg);color:var(--A-color);border:1px solid var(--A-color);
            border-radius:4px;padding:2px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;">
            ${e.position === 'before' ? '← Before' : 'After →'}
          </span>
          <span style="color:var(--text2);font-size:11px;flex:1;">${e.time}</span>
          <span style="font-size:10px;color:var(--text3);">${timeSince(e.at)}</span>
          ${u.id === currentUser.id || isLeader(currentUser) ? `
            <button class="btn btn-xs btn-err" onclick="deleteExtBreak(${u.id},'${mk}',${i})">✕</button>` : ''}
        </div>`).join('');

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

  DB.addExtBreak(currentUser.id, mk, { day, time, position: pos, at: Date.now() });
  closeModal('modal-extbreak');
  toast('Extra 30-min break registered! 🌸', 'ok');
  nav('extbreak');
}

function deleteExtBreak(uid, mk, idx) {
  if (!confirm('Cancel this extra break registration?')) return;
  DB.deleteExtBreak(uid, mk, idx);
  toast('Registration cancelled.', 'warn');
  nav('extbreak');
}



function closeModal(id) { document.getElementById(id).classList.remove('show'); }
