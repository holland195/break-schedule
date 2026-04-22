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
//  Fix: show all shift members; legend inline with title
// ═══════════════════════════════════════════════
function renderSchedule() {
  // FIX: Use actual date keys from user schedules so real data shows
  const weekDates = getWeekDates();

  // Build a date→dayName map so we can look up schedule by date key
  const dateToDayName = {};
  WEEK_DAYS.forEach((d, i) => { dateToDayName[weekDates[i]] = d; });

  // FIX: collect users who work this shift on ANY day this week
  const shiftUsers = state.users.filter(u =>
    weekDates.some(dateKey => {
      // Try date key first (imported data), fallback to day name (seed data)
      const dayName = dateToDayName[dateKey];
      return u.schedule[dateKey] === currentShift || u.schedule[dayName] === currentShift;
    })
  );

  // Helper: get shift for a user on a date (try both key formats)
  function getUserShift(u, dateKey) {
    const dayName = dateToDayName[dateKey];
    return u.schedule[dateKey] || u.schedule[dayName] || '0';
  }

  const headers = `<div class="wg-header">Name</div>` + WEEK_DAYS.map((d, i) => `
    <div class="wg-header${d === todayKey() ? ' c-accent' : ''}" style="text-align:center">
      ${d}<br><span style="font-size:9px; opacity:0.5; font-weight:400">${weekDates[i]}</span>
    </div>`).join('');

  const rows = shiftUsers.map(u => {
    const cells = weekDates.map(dateKey => {
      const shiftVal = getUserShift(u, dateKey);
      const onShift  = shiftVal === currentShift;
      const br       = getAssigned(u.id, dateKey) || getAssigned(u.id, dateToDayName[dateKey]);
      const dayOff   = shiftVal === '0';

      if (dayOff)    return `<div class="wg-cell"><span class="sh sh-0">—</span></div>`;
      if (!onShift)  return `<div class="wg-cell"><span class="sh sh-${shiftVal}">${shiftVal}</span></div>`;

      const shortCode = br ? getShortSlot(currentShift, br.slot) : '—';
      return `<div class="wg-cell">
        <span class="${br ? 'break-slot assigned' : ''}" style="font-size:10px; padding:3px 8px; color:${br ? '' : 'var(--text3)'}" title="${br ? br.slot : 'Not assigned'}">
          ${shortCode}
        </span>
      </div>`;
    }).join('');

    return `<div class="wg-row" style="display:contents">
      <div class="wg-name"><div class="n">${u.name}</div><div class="m">${u.team}</div></div>
      ${cells}
    </div>`;
  }).join('');

  // Legend items (inline with title)
  const shiftSlots = BREAK_SLOTS[currentShift] || [];
  const legendItems = shiftSlots.map((time, i) => `
    <div style="display:flex; align-items:center; gap:6px;">
      <span class="break-slot assigned" style="font-size:10px; min-width:28px; text-align:center">${currentShift}${i + 1}</span>
      <span style="color:var(--text2); font-size:11px">${time}</span>
    </div>`).join('');

  return `
<div class="schedule-title-row">
  <div>
    <div class="page-title">Break Schedule — Shift ${currentShift}</div>
    <div class="page-sub">${SHIFTS[currentShift].display}</div>
  </div>
  <div class="schedule-legend-inline">
    <span style="font-size:10px; color:var(--text3); font-family:'IBM Plex Mono',monospace; font-weight:700; text-transform:uppercase; letter-spacing:.06em;">Legend:</span>
    ${legendItems || '<span style="color:var(--text3); font-size:11px">No slots defined</span>'}
  </div>
</div>

<div class="tbl-wrap" style="overflow:auto">
  <div class="week-grid" style="min-width:700px">${headers}${rows}</div>
</div>`;
}

// ═══════════════════════════════════════════════
//  RENDER: REQUESTS
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
    return `<div class="req-card ${r.status}">
      <div class="req-header">
        <div>
          <div class="req-title">${emp?.name || 'Unknown'}</div>
          <div class="req-meta">${emp?.team || '—'} · ${r.day} · submitted ${timeSince(r.at)}</div>
        </div>
        <span class="req-status ${r.status}">${r.status.toUpperCase()}</span>
      </div>
      <div class="req-body">
        <span style="color:var(--text3)">Current:</span> <b>${r.current}</b> &nbsp;→&nbsp;
        <span style="color:var(--text3)">Requested:</span> <b style="color:var(--warn)">${r.requested}</b><br>
        <span style="color:var(--text3)">Reason:</span> ${r.reason || 'No reason given'}
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
//  Fix: multi-group + multi-day bulk assign
// ═══════════════════════════════════════════════
function renderArrange() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';
  const weekRange = getWeekRange(activeMonday);
  const today     = weekRange[0];

  // All teams that have any member on the current shift this week
  const allShiftTeams = [...new Set(state.users.filter(u =>
    weekRange.some(d => {
      const dayName = WEEK_DAYS[weekRange.indexOf(d)];
      return u.schedule[d] === currentShift || u.schedule[dayName] === currentShift;
    })
  ).map(u => u.team))].sort();

  const slots = BREAK_SLOTS[currentShift] || [];

  const bulkPanel = `
<div class="bulk-panel">
  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Select Groups (multi)</div>
    <div class="group-checkbox-list" id="bulk-groups">
      ${allShiftTeams.map(t => `
        <label class="group-check-item">
          <input type="checkbox" name="bulk-group" value="${t}"> ${t}
        </label>`).join('')}
    </div>
  </div>

  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Select Days (multi)</div>
    <div class="day-checkbox-list">
      ${weekRange.map(d => `
        <label class="day-check-item">
          <span style="font-weight:700; font-size:9px">${getWkDay(d)}</span>
          <span style="font-size:9px; color:var(--text3)">${d}</span>
          <input type="checkbox" name="bulk-day" value="${d}">
        </label>`).join('')}
    </div>
  </div>

  <div class="bulk-panel-section">
    <div class="bulk-panel-label">Break Slot</div>
    <select id="bulk-slot-multi" class="login-select" style="padding:6px 10px;">
      ${slots.map((s, i) => `<option value="${i}">${currentShift}${i + 1} — ${s}</option>`).join('')}
    </select>
  </div>

  <div class="bulk-panel-section" style="justify-content:flex-end">
    <button class="btn btn-accent" onclick="bulkAssignMulti()">Apply to Selection</button>
  </div>
</div>`;

  return `
<div class="page-header">
  <div class="page-title">Arrange Breaks</div>
</div>

${bulkPanel}

<div class="tabs" id="arrange-tabs">
  ${weekRange.map(d => `
    <div class="tab" onclick="switchArrangeDay('${d}')" data-day="${d}" style="min-width:90px; text-align:center">
      <div style="font-weight:600; font-size:11px">${getWkDay(d)}</div>
      <div style="font-size:9px; opacity:0.6">${d}</div>
    </div>`).join('')}
</div>
<div id="arrange-day-content" style="margin-top:0">${getArrangeDayHTML(today)}</div>`;
}

function switchArrangeDay(day) {
  document.querySelectorAll('#arrange-tabs .tab').forEach(t =>
    t.classList.toggle('on', t.dataset.day === day)
  );
  document.getElementById('arrange-day-content').innerHTML = getArrangeDayHTML(day);
}

function getArrangeDayHTML(day) {
  const mates = getShiftMates(currentShift, day);
  const slots = BREAK_SLOTS[currentShift] || [];

  if (!mates.length) return `<div class="empty" style="background:var(--bg2); border:1px solid var(--border); border-radius:0 0 10px 10px; padding:60px;">
    <div class="empty-ico">👥</div>No staff scheduled on Shift ${currentShift} for ${day}.</div>`;

  return `<div class="break-board" style="gap:0; background:var(--bg2); border:1px solid var(--border); border-radius:0 0 10px 10px;">
    ${mates.map(u => {
      const br = getAssigned(u.id, day);
      return `
      <div class="break-row" style="border-radius:0; border:none; border-bottom:1px solid var(--border); display:grid; grid-template-columns: 70px 220px 180px 110px 1fr 80px; align-items:center; gap:16px; padding:12px 16px;">
        <div class="emp-meta">${u.team}</div>
        <div class="emp-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${u.name}</div>
        <div class="emp-meta" style="color:var(--accent)">${u.username}</div>
        <div><span class="role-tag ${getRoleInfo(u.role).tag}">${getRoleInfo(u.role).label}</span></div>
        <div class="break-slots">
          ${slots.map((s, idx) => `
            <span class="break-slot${br?.slot === s ? ' assigned' : ''}"
                  onclick="quickAssign(${u.id},'${day}','${s}')"
                  style="font-size:10px; padding:4px 10px;">
              ${currentShift}${idx + 1}
            </span>`).join('')}
        </div>
        <div style="text-align:right">
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
        <td><input class="filter-input" placeholder="Group…"    value="${staffFilters.team}" oninput="staffFilters.team=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="Name…"     value="${staffFilters.name}" oninput="staffFilters.name=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="User…"     value="${staffFilters.user}" oninput="staffFilters.user=this.value; _liveFilter()"></td>
        <td><input class="filter-input" placeholder="Role…"     value="${staffFilters.role}" oninput="staffFilters.role=this.value; _liveFilter()"></td>
        <td colspan="${displayDates.length}" style="padding-left:12px; color:var(--text3); font-size:10px; font-family:'IBM Plex Mono',monospace;">SCHEDULE</td>
      </tr>
      <tr>
        <th>GROUP</th><th>FULL NAME</th><th>USER</th><th>POSITION</th>
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
  return users.map(u => `
    <tr>
      <td class="mono" style="font-size:11px;">${u.team}</td>
      <td style="font-weight:600">${u.name}</td>
      <td class="mono" style="color:var(--accent); font-size:11px;">${u.username || ''}</td>
      <td style="font-size:11px; color:var(--text2)">${u.role}</td>
      ${displayDates.map(d => {
        const s = u.schedule[d] || '0';
        return `<td class="c"><span class="sh sh-${s}">${s==='0'?'—':s}</span></td>`;
      }).join('')}
    </tr>`).join('');
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

function openRequestModal(currentSlot) {
  const today = todayKey();
  const mine  = getAssigned(currentUser.id, today);
  const cur   = currentSlot || mine?.slot || 'Not assigned';
  document.getElementById('req-cur').value = cur;
  const slots = BREAK_SLOTS[currentShift] || [];
  document.getElementById('req-new').innerHTML = `<option value="">— pick a time —</option>` +
    slots.filter(s => s !== cur).map(s => `<option value="${s}">${s}</option>`).join('');
  document.getElementById('req-reason').value = '';
  document.getElementById('modal-request').classList.add('show');
}

function submitRequest() {
  const requested = document.getElementById('req-new').value;
  const reason    = document.getElementById('req-reason').value.trim();
  if (!requested) { toast('Pick a slot first.', 'err'); return; }
  state.requests.unshift({
    id: Date.now(), userId: currentUser.id, day: todayKey(),
    current: document.getElementById('req-cur').value,
    requested, reason, status: 'pending', at: Date.now(), respNote: '',
  });
  save();
  closeModal('modal-request');
  toast('Request submitted!', 'warn');
  updateBadge();
  nav('requests');
}

function resolveRequest(idx, status) {
  state.requests[idx].status     = status;
  state.requests[idx].resolvedBy = currentUser.id;
  state.requests[idx].resolvedAt = Date.now();
  if (status === 'approved') {
    const r = state.requests[idx];
    assign(r.userId, r.day, r.requested, 'approved by ' + currentUser.name);
  }
  save();
  toast(status === 'approved' ? 'Request approved ✓' : 'Request rejected', 'ok');
  updateBadge();
  nav('requests');
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
