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
  ${_canSeeAll ? `<button onclick="staffSubTab='workingtime';nav('staff')" style="${_tabStyle('workingtime')}">⏱ Working Time</button>` : ''}
</div>
<div id="staff-subtab-content">
  ${staffSubTab === 'info'
      ? _renderStaffInfo()
      : staffSubTab === 'attendance'
        ? _renderStaffAttendance()
        : staffSubTab === 'workingtime'
          ? _renderWorkingTime()
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
  showFullMonth = true; // force full-month view (Week view removed)
  const hasUsers = state.users && state.users.length > 0;
  if (!hasUsers) {
    return `
<div class="empty" style="padding:48px 0;">
  <div class="empty-ico">📋</div>
  <div>No schedule data available.</div>
  <div style="font-size:12px;color:var(--text3);margin-top:6px;">Schedule is synced automatically from Google Sheets each morning.</div>
</div>`;
  }

  var _allMonthSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) {
      if (/^\d{2}\/\d{2}$/.test(k)) _allMonthSet[k.split('/')[1]] = 1;
    });
  });
  var availableMonths = Object.keys(_allMonthSet).sort();

  if (!_schedMonth || !availableMonths.includes(_schedMonth)) {
    var _activeMM0 = _ssActiveMonday.split('/')[1];
    _schedMonth = availableMonths.includes(_activeMM0) ? _activeMM0 : (availableMonths[availableMonths.length - 1] || _activeMM0);
  }

  var _sdSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) {
      if (/^\d{2}\/\d{2}$/.test(k) && k.split('/')[1] === _schedMonth) _sdSet[k] = 1;
    });
  });
  const displayDates = _sortDateKeys(Object.keys(_sdSet));

  var _currTrn = isTraining(currentUser);
  const filteredUsers = state.users.filter(u => {
    if (u.username === 'tuan.mai' || u.username === 'nhon.bui') return false;
    var _effR    = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _roleStr = (_resolveRole(_effR) || '').toLowerCase();
    var _teamCh  = (u.team || '').toUpperCase().charAt(0);
    var _isTrn   = isTraining(u) || _roleStr.includes('training') || _teamCh === 'T';
    if (!_currTrn && _isTrn) return false;
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
        ${displayDates.map(function(d) {
          const isOpen = _ssFilterDk === d;
          return '<th class="c" style="min-width:48px;padding:6px 2px;">' +
            '<div style="font-size:8px;font-weight:400;opacity:.65;line-height:1.5;">' + getWkDay(d) + '</div>' +
            '<div style="color:var(--accent);font-size:11px;line-height:1.3;">' + d + '</div>' +
            '<select onclick="event.stopPropagation()" onchange="window._ssFilterDk=this.value===\'All\'?\'\':\'' + d + '\';window._ssShiftFilter=this.value;nav(\'staff\')"' +
            ' style="display:block;margin:4px auto 0 auto;font-size:9px;padding:1px 2px;pointer-events:auto;border:1px solid var(--border2);border-radius:4px;background:var(--bg3);color:var(--text2);cursor:pointer;width:38px;height:18px;text-align:center;">' +
            ['All','A','D','E'].map(function(s) {
              var isSel = isOpen && _ssShiftFilter === s;
              if (!isOpen && s === 'All') isSel = true;
              return '<option value="' + s + '"' + (isSel ? ' selected' : '') + '>' + s + '</option>';
            }).join('') +
            '</select>' +
            '</th>';
        }).join('')}
      </tr>
    </thead>
    <tbody id="staff-tbody">${renderStaffRows(_tblUsers, displayDates)}</tbody>
  </table>
</div>`;
  };

  var _ssCanSwap = !isLeader(currentUser) && !isTraining(currentUser);
  var _dosSwapBtn = _ssCanSwap ? '<button class="btn btn-sm" onclick="openDayoffSwapModal(null)" style="font-size:11px;">↔ Day-off Swap</button>' : '';

  var _displayUsers;
  if (_ssFilterDk && _ssShiftFilter !== 'All') {
    _displayUsers = filteredUsers.filter(function(u) {
      return (_getSched(u.username, _ssFilterDk) || '').charAt(0) === _ssShiftFilter;
    });
  } else {
    _displayUsers = _ssShiftFilter === 'All' ? filteredUsers : filteredUsers.filter(function(u) {
      return displayDates.some(function(d) { return (_getSched(u.username, d) || '').charAt(0) === _ssShiftFilter; });
    });
  }

  const MONTH_LABELS = {'01':'January','02':'February','03':'March','04':'April','05':'May','06':'June',
    '07':'July','08':'August','09':'September','10':'October','11':'November','12':'December'};

  var _ssActiveFilterBadge = (_ssFilterDk && _ssShiftFilter !== 'All')
    ? '<span style="font-size:11px;color:var(--text3);margin-left:8px;">Shift <b>' + _ssShiftFilter + '</b> on ' + _ssFilterDk + ' <span onclick="_ssFilterDk=\'\';_ssShiftFilter=\'All\';nav(\'staff\')" style="cursor:pointer;color:var(--err);margin-left:2px;">✕</span></span>'
    : '';

  return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
  ${_searchBar}
  <div style="width:1px;height:20px;background:var(--border);"></div>
  <select class="login-select" style="width:130px;padding:4px;" onchange="_schedMonth=this.value;nav('staff')">
    ${availableMonths.map(m => `<option value="${m}" ${m === _schedMonth ? 'selected' : ''}>${MONTH_LABELS[m] || m}</option>`).join('')}
  </select>
  ${_ssActiveFilterBadge}
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
var _saFilterDk = '';
var _saDateFilter = '';
var _saShiftFilterDate = ''; // date for per-day shift filter (separate from date zoom)
let _saFillCode = 'XA';
var _saFilteredUsernames = [];
var _saCurrentDates = [];
var _saCurrentMonthKey = '';
var _attCopiedCode = '';
var _staffAttUndoStack = [];

// ── Working Time sub-tab state ──
var _wtNow = new Date();
var _wtMonth = _wtNow.getMonth() + 1;
var _wtYear  = _wtNow.getFullYear();

var _wtShiftFilter = 'All';
var _wtFilterDk = '';

function _renderWorkingTime() {
  var month    = _wtMonth;
  var year     = _wtYear;
  var monthKey = year + '-' + String(month).padStart(2, '0');
  var allDates = _getAllDatesInMonth(year, month);

  // Build user list same as _renderStaffAttendance: from staffInfo + users, exclude training/admin
  var _wtPcEmpNo = {};
  (state.policyCompliance || []).forEach(function(r) {
    if (r.username && r.empNo && !_wtPcEmpNo[r.username]) _wtPcEmpNo[r.username] = r.empNo;
  });

  var allUsernames = Object.keys(state.staffInfo || {});
  state.users.forEach(function(u) {
    if (u.username && allUsernames.indexOf(u.username) === -1) allUsernames.push(u.username);
  });

  var isJulyOnward = (year > 2026) || (year === 2026 && month >= 7);
  var allWtUsers = allUsernames.map(function(uname) {
    var si = state.staffInfo[uname] || {};
    var fu = state.users.find(function(u) { return u.username === uname; });
    var role = (fu && fu.role) || si.role || '';
    var lvl  = (ROLES[_resolveRole(role)] || {}).level;
    if (lvl === undefined) lvl = 0;
    // Exclude training (3), admin (4)
    if (lvl >= 3) return null;
    var empNo = (fu && fu.empNo) || si.empNo || _wtPcEmpNo[uname] || '';
    if (isJulyOnward && empNo && empNo.trim().toUpperCase().indexOf('AG') === 0) return null;
    var name  = (fu && fu.name)  || si.name  || uname;
    var team  = (fu && fu.team)  || si.team  || '';
    return { username: uname, name: name, role: role, team: team, empNo: empNo, id: fu ? fu.id : null };
  }).filter(Boolean);

  // Shift filter: per-column — filter by schedule on the selected date
  var wtUsers;
  if (_wtFilterDk && _wtShiftFilter !== 'All') {
    wtUsers = allWtUsers.filter(function(u) {
      return (_getSched(u.username, _wtFilterDk) || '').charAt(0) === _wtShiftFilter;
    });
  } else {
    wtUsers = allWtUsers;
  }
  wtUsers = wtUsers.slice().sort(function(a, b) { return _roleSort(a, b); });

  var WDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Category colors — training now min (total time)
  var CAT_LATE     = { color: '#f87171', bg: 'rgba(248,113,113,.18)' };
  var CAT_EARLY    = { color: '#fb923c', bg: 'rgba(251,146,60,.18)'  };
  var CAT_TRAINING = { color: '#34d399', bg: 'rgba(52,211,153,.18)'  };
  var CAT_OTHERS   = { color: '#a78bfa', bg: 'rgba(167,139,250,.18)' };


  // Date header — two rows: date + shift-filter arrow row
  var theadRow1 = '<tr>';
  theadRow1 +=
    '<th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);' +
      'min-width:92px;width:92px;position:sticky;top:0;left:0;z-index:4;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);">EMP NO.</th>' +
    '<th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text2);' +
      'min-width:165px;width:165px;position:sticky;top:0;left:92px;z-index:4;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">NAME</th>' +
    '<th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);' +
      'min-width:145px;width:145px;position:sticky;top:0;left:257px;z-index:4;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">POSITION</th>';

  var SH_COL = { A: '#0ea5e9', D: '#f59e0b', E: '#a78bfa' };
  allDates.forEach(function(dk, idx) {
    var dkParts = dk.split('/');
    var _d = dkParts[0]; var _m = dkParts[1];
    var _cy = (parseInt(_m) === month) ? year : (month === 1 ? year - 1 : year);
    var dow = new Date(_cy, parseInt(_m) - 1, parseInt(_d)).getDay();
    var isWknd = dow === 0 || dow === 6;
    var isSun  = dow === 0;
    var isOpen = _wtFilterDk === dk;
    // Compute which shifts exist on this date
    var shiftSet = {};
    allWtUsers.forEach(function(u) {
      var s = (_getSched(u.username, dk) || '').charAt(0);
      if (SH_COL[s]) shiftSet[s] = true;
    });
    // Arrow row: ↓ to open, then A/D/E badges when open
    var arrowPart = '<div style="margin-top:2px;">';
    if (!isOpen) {
      arrowPart += '<span onclick="_wtFilterDk=\'' + dk + '\';nav(\'staff\')" style="cursor:pointer;font-size:9px;color:var(--text3);padding:1px 4px;border-radius:3px;display:inline-block;" title="Filter by shift">↓</span>';
    } else {
      arrowPart += '<span onclick="_wtFilterDk=\'\';_wtShiftFilter=\'All\';nav(\'staff\')" style="cursor:pointer;font-size:9px;color:var(--accent);padding:1px 4px;" title="Close filter">↑</span>';
      ['A','D','E'].forEach(function(s) {
        if (!shiftSet[s]) return;
        var isAct = _wtShiftFilter === s;
        arrowPart += '<span onclick="_wtShiftFilter=(_wtShiftFilter===\'' + s + '\'?\'All\':\'' + s + '\');nav(\'staff\')"' +
          ' style="cursor:pointer;font-size:8px;font-weight:700;padding:0 3px;border-radius:2px;margin:0 1px;display:inline-block;line-height:14px;' +
          'color:' + (isAct ? '#fff' : SH_COL[s]) + ';background:' + (isAct ? SH_COL[s] : 'transparent') + ';border:1px solid ' + SH_COL[s] + ';">' + s + '</span>';
      });
    }
    arrowPart += '</div>';
    theadRow1 +=
      '<th style="min-width:40px;padding:4px 2px;text-align:center;font-size:10px;font-weight:600;' +
      'color:' + (isSun ? 'var(--err)' : isWknd ? 'var(--warn)' : 'var(--text2)') + ';' +
      'background:' + (isWknd ? 'var(--bg4)' : 'var(--bg3)') + ';' +
      'border-bottom:2px solid ' + (isSun ? 'var(--err)' : isWknd ? 'var(--border2)' : 'var(--accent)') + ';' +
      'border-left:' + (idx === 0 ? '2px solid var(--border)' : isSun ? '2px solid var(--border)' : 'none') + ';' +
      'position:sticky;top:0;z-index:2;white-space:nowrap;">' +
      '<div style="font-size:9px;' + (isWknd ? '' : 'opacity:.65;') + 'line-height:1.5;">' + WDAY_SHORT[dow] + '</div>' +
      '<div style="font-size:11px;line-height:1.3;letter-spacing:-.3px;">' + _d + '/<span style="font-size:9px;opacity:.7;">' + _m + '</span></div>' +
      arrowPart +
      '</th>';
  });
  theadRow1 +=
    '<th style="text-align:center;padding:6px 4px;font-size:10px;color:' + CAT_LATE.color + ';' +
      'min-width:45px;width:45px;position:sticky;top:0;z-index:2;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);border-left:2px solid var(--border);" title="Total Late">LATE</th>' +
    '<th style="text-align:center;padding:6px 4px;font-size:10px;color:var(--text2);' +
      'min-width:45px;width:45px;position:sticky;top:0;z-index:2;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);border-left:1px solid var(--border);" title="Total Early">EARLY</th>' +
    '<th style="text-align:center;padding:6px 4px;font-size:10px;color:var(--text2);' +
      'min-width:55px;width:55px;position:sticky;top:0;z-index:2;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);border-left:1px solid var(--border);" title="Total Training">TRAIN</th>' +
    '<th style="text-align:center;padding:6px 4px;font-size:10px;color:var(--text2);' +
      'min-width:45px;width:45px;position:sticky;top:0;z-index:2;background:var(--bg3);' +
      'border-bottom:2px solid var(--border2);border-left:1px solid var(--border);" title="Total Others">OTHER</th>';
  theadRow1 += '</tr>';


  var stickyCell = 'position:sticky;z-index:1;background:var(--bg3);';

  var tbodyRows = wtUsers.map(function(u) {
    var effRole = u.role || '';
    var totalLate = 0, totalEarly = 0, totalTraining = 0, totalOthers = 0;
    var monthData = DB.getWorkingTime(u.username, monthKey) || {};
    Object.keys(monthData).forEach(function(dk) {
      var d = monthData[dk];
      if (d.late) totalLate += d.late;
      if (d.early) totalEarly += d.early;
      if (d.training) totalTraining += d.training;
      if (d.others) totalOthers += d.others;

    });
    var cells = allDates.map(function(dk, idx) {
      var dkParts = dk.split('/');
      var _dd = dkParts[0]; var _mm = dkParts[1];
      var _cy2 = (parseInt(_mm) === month) ? year : (month === 1 ? year - 1 : year);
      var dow2 = new Date(_cy2, parseInt(_mm) - 1, parseInt(_dd)).getDay();
      var isWknd2 = dow2 === 0 || dow2 === 6;
      var wtDay = ((DB.getWorkingTime(u.username, monthKey) || {}))[dk] || {};
      var hasAny = wtDay.late || wtDay.early || wtDay.training || wtDay.others || wtDay.total;
      var wkBg = isWknd2 ? 'background:var(--bg4);' : '';
      var safeName = (u.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var cellBorder = idx === 0 ? 'border-left:2px solid var(--border);' : '';
      return '<td style="text-align:center;padding:3px 1px;cursor:pointer;' + cellBorder + (hasAny ? '' : wkBg) + '"' +
        ' onclick="openWtModal(\'' + u.username + '\',\'' + monthKey + '\',\'' + dk + '\',\'' + safeName + '\')">' +
        (hasAny
          ? '<div style="display:flex;flex-direction:column;gap:1px;padding:2px 1px;">' +

            (wtDay.late     !== undefined && wtDay.late     !== null ? '<span style="font-size:9px;font-weight:700;color:' + CAT_LATE.color     + ';background:' + CAT_LATE.bg     + ';border-radius:3px;padding:0 3px;white-space:nowrap;">L ' + wtDay.late     + '</span>' : '') +
            (wtDay.early    !== undefined && wtDay.early    !== null ? '<span style="font-size:9px;font-weight:700;color:' + CAT_EARLY.color    + ';background:' + CAT_EARLY.bg    + ';border-radius:3px;padding:0 3px;white-space:nowrap;">E ' + wtDay.early    + '</span>' : '') +
            (wtDay.training !== undefined && wtDay.training !== null ? '<span style="font-size:9px;font-weight:700;color:' + CAT_TRAINING.color + ';background:' + CAT_TRAINING.bg + ';border-radius:3px;padding:0 3px;white-space:nowrap;">T ' + wtDay.training + '</span>' : '') +
            (wtDay.others   !== undefined && wtDay.others   !== null ? '<span style="font-size:9px;font-weight:700;color:' + CAT_OTHERS.color   + ';background:' + CAT_OTHERS.bg   + ';border-radius:3px;padding:0 3px;white-space:nowrap;">O ' + wtDay.others   + '</span>' : '') +
            '</div>'
          : '<span style="font-size:10px;color:var(--text3);">·</span>') +
        '</td>';
    }).join('');

    return '<tr style="border-bottom:0.5px solid var(--border);">' +
      '<td style="padding:5px 8px;white-space:nowrap;' + stickyCell + 'left:0;min-width:92px;width:92px;' +
        'font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + (u.empNo || '—') + '</td>' +
      '<td style="padding:5px 10px;white-space:nowrap;' + stickyCell + 'left:92px;min-width:165px;width:165px;border-left:1px solid var(--border);">' +
        '<div style="font-size:12px;font-weight:600;">' + u.name + '</div>' +
      '</td>' +
      '<td style="padding:5px 8px;white-space:nowrap;' + stickyCell + 'left:257px;min-width:145px;width:145px;border-left:1px solid var(--border);' +
        'font-size:11px;color:' + _roleColor(effRole) + ';">' +
        (getRoleInfo(effRole).label || _resolveRole(effRole) || '—') + '</td>' +
      cells +

      '<td style="padding:5px 4px;text-align:center;min-width:45px;width:45px;border-left:2px solid var(--border);' +
        'font-size:11px;font-weight:600;color:' + (totalLate > 0 ? CAT_LATE.color : 'var(--text3)') + ';">' + (totalLate || '—') + '</td>' +
      '<td style="padding:5px 4px;text-align:center;min-width:45px;width:45px;border-left:1px solid var(--border);' +
        'font-size:11px;font-weight:600;color:' + (totalEarly > 0 ? CAT_EARLY.color : 'var(--text3)') + ';">' + (totalEarly || '—') + '</td>' +
      '<td style="padding:5px 4px;text-align:center;min-width:55px;width:55px;border-left:1px solid var(--border);' +
        'font-size:11px;font-weight:600;color:' + (totalTraining > 0 ? CAT_TRAINING.color : 'var(--text3)') + ';">' + (totalTraining || '—') + '</td>' +
      '<td style="padding:5px 4px;text-align:center;min-width:45px;width:45px;border-left:1px solid var(--border);' +
        'font-size:11px;font-weight:600;color:' + (totalOthers > 0 ? CAT_OTHERS.color : 'var(--text3)') + ';">' + (totalOthers || '—') + '</td>' +
    '</tr>';
  }).join('');

  var monthPicker =
    '<select class="login-select" style="padding:5px 8px;font-size:12px;width:110px;" onchange="_wtMonth=+this.value;_wtFilterDk=\'\';_wtShiftFilter=\'All\';nav(\'staff\')">' +
    [1,2,3,4,5,6,7,8,9,10,11,12].map(function(m) {
      return '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' +
        new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'long' }) + '</option>';
    }).join('') + '</select>' +
    '<select class="login-select" style="padding:5px 8px;font-size:12px;width:70px;" onchange="_wtYear=+this.value;_wtFilterDk=\'\';_wtShiftFilter=\'All\';nav(\'staff\')">' +
    [2026,2027].map(function(y) {
      return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>';
    }).join('') + '</select>';

  var shiftSelect = (_wtFilterDk && _wtShiftFilter !== 'All')
    ? '<span style="font-size:11px;color:var(--text3);">Shift <b>' + _wtShiftFilter + '</b> · ' + _wtFilterDk +
      ' <span onclick="_wtFilterDk=\'\';_wtShiftFilter=\'All\';nav(\'staff\')" style="cursor:pointer;color:var(--err);margin-left:2px;">✕</span></span>'
    : '';

  var legend =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;margin-bottom:10px;align-items:center;">' +
    '<span style="background:' + CAT_LATE.bg     + ';color:' + CAT_LATE.color     + ';padding:2px 7px;border-radius:4px;font-weight:600;">L</span> Late login (min)' +
    ' &nbsp;<span style="background:' + CAT_EARLY.bg    + ';color:' + CAT_EARLY.color    + ';padding:2px 7px;border-radius:4px;font-weight:600;">E</span> Early logout (min)' +
    ' &nbsp;<span style="background:' + CAT_TRAINING.bg + ';color:' + CAT_TRAINING.color + ';padding:2px 7px;border-radius:4px;font-weight:600;">T</span> Training time (min)' +
    ' &nbsp;<span style="background:' + CAT_OTHERS.bg   + ';color:' + CAT_OTHERS.color   + ';padding:2px 7px;border-radius:4px;font-weight:600;">O</span> Others (min)' +
    '</div>';

  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">' +
    monthPicker + shiftSelect +
    '</div>' +
    legend +
    '<div style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 280px);border:1px solid var(--border);border-radius:8px;">' +
    '<table style="border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;">' +
    '<thead>' + theadRow1 + '</thead>' +
    '<tbody>' + tbodyRows + '</tbody>' +
    '</table></div>';
}

function _ensureWtModal() {
  if (document.getElementById('modal-wt-cell')) return;
  var inputRow = function(id, label, unit, color) {
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
      '<label style="font-size:11px;font-weight:700;color:' + color + ';min-width:72px;">' + label + '</label>' +
      '<input id="' + id + '" type="number" min="0" step="1" placeholder="—"' +
        ' style="flex:1;padding:6px 10px;font-size:14px;font-family:\'IBM Plex Mono\',monospace;' +
        'border:1.5px solid var(--border2);border-radius:8px;background:var(--bg3);color:var(--text);text-align:right;">' +
      '<span style="font-size:11px;color:var(--text3);min-width:28px;">' + unit + '</span>' +
      '</div>';
  };
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-wt-cell" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-wt-cell\')">' +
    '<div class="modal" style="width:360px;">' +
      '<div class="modal-title" id="wt-modal-title">Working Time</div>' +
      '<div style="margin:4px 0 14px;font-size:11px;color:var(--text3);" id="wt-modal-desc"></div>' +
      inputRow('wt-inp-late',     'LATE',     'min', '#f87171') +
      inputRow('wt-inp-early',    'EARLY',    'min', '#fb923c') +
      inputRow('wt-inp-training', 'TRAINING', 'min', '#34d399') +
      inputRow('wt-inp-others',   'OTHERS',   'min', '#a78bfa') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">' +
        '<button class="btn btn-sm" onclick="closeModal(\'modal-wt-cell\')">Cancel</button>' +
        '<button class="btn btn-accent btn-sm" onclick="saveWtCell()">Save</button>' +
      '</div>' +
    '</div></div>'
  );
}

var _wtPending = {};

function openWtModal(username, monthKey, dk, name) {
  _ensureWtModal();
  _wtPending = { username: username, monthKey: monthKey, dk: dk };
  document.getElementById('wt-modal-title').textContent = name;
  document.getElementById('wt-modal-desc').textContent = dk + ' · ' + monthKey;
  var existing = (DB.getWorkingTime(username, monthKey) || {})[dk] || {};
  var setInp = function(id, key) {
    var el = document.getElementById(id);
    if (el) el.value = (existing[key] !== undefined && existing[key] !== null) ? existing[key] : '';
  };
  setInp('wt-inp-late',     'late');
  setInp('wt-inp-early',    'early');
  setInp('wt-inp-training', 'training');
  setInp('wt-inp-others',   'others');
  document.getElementById('modal-wt-cell').classList.add('show');
  setTimeout(function() { var e = document.getElementById('wt-inp-late'); if (e) e.focus(); }, 80);
}

function saveWtCell() {
  if (!_wtPending.username) return;
  var getNum = function(id) {
    var el = document.getElementById(id);
    if (!el || el.value.trim() === '') return undefined;
    var n = parseFloat(el.value);
    return isNaN(n) ? undefined : n;
  };
  var existing = DB.getWorkingTime(_wtPending.username, _wtPending.monthKey) || {};
  var dayData = Object.assign({}, existing[_wtPending.dk] || {});
  var keys = ['late','early','training','others'];
  var ids  = ['wt-inp-late','wt-inp-early','wt-inp-training','wt-inp-others'];
  for (var i = 0; i < keys.length; i++) {
    var n = getNum(ids[i]);
    if (n !== undefined) { dayData[keys[i]] = n; } else { delete dayData[keys[i]]; }
  }
  var updated = Object.assign({}, existing);
  if (Object.keys(dayData).length === 0) {
    delete updated[_wtPending.dk];
  } else {
    updated[_wtPending.dk] = dayData;
  }
  DB.setWorkingTime(_wtPending.username, _wtPending.monthKey, updated);
  closeModal('modal-wt-cell');
  nav('staff');
  if (typeof syncPush === 'function') syncPush();
}

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
  var allCodes = [
    'XA','XD','XE','0',
    'A1','A2','UA1','UA2',
    'D1','D2','UD1','UD2',
    'E1','E2','UE1','UE2',
    'A','H','U','S',
    'L'
  ];
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
  var allDates = _getAllDatesInMonth(year, month);
  const dates = (_saDateFilter && allDates.indexOf(_saDateFilter) !== -1) ? [_saDateFilter] : allDates;
  const attData = state.monthlyAttendance || {};

  const monthPicker = `
      <select class="login-select" style="padding:5px 8px;font-size:12px;width:110px;"
        onchange="_attImportMonth=+this.value;_saDateFilter='';_saFilterDk='';_saShiftFilter='All';_navStaff()">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m =>
    `<option value="${m}" ${m === month ? 'selected' : ''}>${new Date(year, m - 1, 1)
      .toLocaleString('en-US', { month: 'long' })}</option>`
  ).join('')}
      </select>
      <select class="login-select" style="padding:5px 8px;font-size:12px;width:70px;"
        onchange="_attImportYear=+this.value;_saDateFilter='';_saFilterDk='';_saShiftFilter='All';_navStaff()">
        ${[2026, 2027].map(y =>
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

  // Build table header dates — arrow icon opens per-day A/D/E shift filter
  const WDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var _saSHCol = { A: '#0ea5e9', D: '#f59e0b', E: '#a78bfa' };
  const theadDates = dates.map(dk => {
    const [_d, _m] = dk.split('/');
    const _cy = (parseInt(_m) === month) ? year : (month === 1 ? year - 1 : year);
    const dow = new Date(_cy, parseInt(_m) - 1, parseInt(_d)).getDay();
    const isWknd = dow === 0 || dow === 6;
    const isSun = dow === 0;
    const isOpen = _saFilterDk === dk;
    // Which shifts exist on this date (from all attendance users)
    var _saShiftSet = {};
    (state.users || []).forEach(function(u) {
      var s = (_getSched(u.username, dk) || '').charAt(0);
      if (_saSHCol[s]) _saShiftSet[s] = true;
    });
    var arrowPart = '<div style="margin-top:2px;">';
    if (!isOpen) {
      arrowPart += '<span onclick="_saFilterDk=\'' + dk + '\';_navStaff()" style="cursor:pointer;font-size:9px;color:var(--text3);padding:1px 4px;border-radius:3px;display:inline-block;" title="Filter by shift">↓</span>';
    } else {
      arrowPart += '<span onclick="_saFilterDk=\'\';_saShiftFilter=\'All\';_navStaff()" style="cursor:pointer;font-size:9px;color:var(--accent);padding:1px 4px;" title="Close filter">↑</span>';
      ['A','D','E'].forEach(function(s) {
        if (!_saShiftSet[s]) return;
        var isAct = _saShiftFilter === s;
        arrowPart += '<span onclick="_saShiftFilter=(_saShiftFilter===\'' + s + '\'?\'All\':\'' + s + '\');_navStaff()"' +
          ' style="cursor:pointer;font-size:8px;font-weight:700;padding:0 3px;border-radius:2px;margin:0 1px;display:inline-block;line-height:14px;' +
          'color:' + (isAct ? '#fff' : _saSHCol[s]) + ';background:' + (isAct ? _saSHCol[s] : 'transparent') + ';border:1px solid ' + _saSHCol[s] + ';">' + s + '</span>';
      });
    }
    arrowPart += '</div>';
    return '<th style="min-width:40px;padding:4px 2px;text-align:center;' +
      'font-size:10px;font-weight:600;' +
      'color:' + (isSun ? 'var(--err)' : isWknd ? 'var(--warn)' : 'var(--text2)') + ';' +
      'background:' + (isWknd ? 'var(--bg4)' : 'var(--bg3)') + ';' +
      'border-bottom:2px solid ' + (isSun ? 'var(--err)' : isWknd ? 'var(--border2)' : 'var(--accent)') + ';' +
      'border-left:' + (isSun ? '2px solid var(--border)' : 'none') + ';' +
      'position:sticky;top:0;z-index:2;white-space:nowrap;">' +
      '<div style="font-size:9px;' + (isWknd ? '' : 'opacity:.65;') + 'line-height:1.5;">' + WDAY_SHORT[dow] + '</div>' +
      '<div style="font-size:11px;line-height:1.3;letter-spacing:-.3px;">' + _d + '/<span style="font-size:9px;opacity:.7;">' + _m + '</span></div>' +
      arrowPart +
      '</th>';
  }).join('');

  // Build list of usernames from both active roster (state.users) and historical attData (excluding viewers)
  var _activeUsernames = (state.users || [])
    .filter(function(u) { return u.username !== 'tuan.mai' && u.username !== 'nhon.bui'; })
    .map(function(u) { return u.username; });
  var _historicalUsernames = Object.keys(attData).filter(function(uname) {
    if (uname === 'tuan.mai' || uname === 'nhon.bui') return false;
    var ud = attData[uname]?.[monthKey];
    return ud && Object.keys(ud).length > 0;
  });
  var _allUsernamesSet = {};
  _activeUsernames.forEach(function(u) { _allUsernamesSet[u] = true; });
  _historicalUsernames.forEach(function(u) { _allUsernamesSet[u] = true; });
  const attUsernames = Object.keys(_allUsernamesSet);

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
  var isJulyOnward = (year > 2026) || (year === 2026 && month >= 7);
  var rowUsers = attUsernames.map(function(uname) {
    var si = state.staffInfo?.[uname];
    var siEmpNo = (si && si.empNo) || _pcEmpNo[uname] || '';
    var fu = state.users.find(function(u) { return u.username === uname; });
    if (fu) return Object.assign({}, fu, { empNo: fu.empNo || siEmpNo });
    return si ? { username: uname, name: si.name || uname, role: si.role || '', team: si.team || '', empNo: siEmpNo, id: null } : null;
  }).filter(Boolean);

  if (isJulyOnward) {
    rowUsers = rowUsers.filter(function(u) {
      var emp = (u.empNo || '').trim().toUpperCase();
      return !emp.startsWith('AG');
    });
  }
  rowUsers.sort(function(a, b) { return _roleSort(a, b); });

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
  if (_saFilterDk && _saShiftFilter !== 'All') {
    filteredUsers = filteredUsers.filter(u => {
      return (_getSched(u.username, _saFilterDk) || '').charAt(0) === _saShiftFilter;
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


      const hoverAttr = `onmouseover="_attHoveredCell={username:'${u.username}',monthKey:'${monthKey}',dk:'${dk}',code:'${(rawCode||'').replace(/'/g,"\\'")}'}"`;
      const cellInteract = `onclick="attCellClick('${u.username}','${monthKey}','${dk}')" style="cursor:pointer;"`;
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

  const shiftFilterPicker = (_saFilterDk && _saShiftFilter !== 'All')
    ? `<span style="font-size:11px;color:var(--text3);">Shift <b>${_saShiftFilter}</b> · ${_saFilterDk} <span onclick="_saFilterDk='';_saShiftFilter='All';_navStaff()" style="cursor:pointer;color:var(--err);margin-left:2px;">✕</span></span>`
    : '';

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
      ${shiftFilterPicker}
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
        const code = typeof _getMonthlyAttendanceCode === 'function' ? _getMonthlyAttendanceCode(u.username, dk) : '';
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
  'Data Analyst Leader':3,'Leader':3,
  'Data Analyst Supervisor':4,'Supervisor':4,
  'Sr Data Supervisor':5,'Data Supervisor':6,
  'Sr Data Analyst':7,'Data Analyst':8
};
function _sortStaffUsers(users) {
  var getTeamRank = function(team) {
    if (!team) return 99;
    var t = String(team).toUpperCase();
    if (t.indexOf('DAL') === 0)   return 1;
    if (t.indexOf('DAS') === 0)   return 2;
    if (t.indexOf('SDS') === 0)   return 3;
    if (t.indexOf('I-SDS') === 0) return 4;
    if (t.indexOf('DS') === 0)    return 5;
    if (t.indexOf('SR') === 0)    return 6;
    if (t.indexOf('DA') === 0)    return 7;
    return 99;
  };

  return users.filter(function(u) {
    var _r = u.role || (state.staffInfo[u.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===u.username;})||{}).role||'';
    return !!_resolveRole(_r);
  }).sort(function(a, b) {
    var aRole = a.role || (state.staffInfo[a.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===a.username;})||{}).role||'';
    var bRole = b.role || (state.staffInfo[b.username]||{}).role || ((STAFF_INFO_DB||[]).find(function(x){return x.username===b.username;})||{}).role||'';
    var aRes = _resolveRole(aRole)||aRole, bRes = _resolveRole(bRole)||bRole;
    var aRnk = _STAFF_SORT_RANK[aRes]||99, bRnk = _STAFF_SORT_RANK[bRes]||99;
    if (aRnk !== bRnk) return aRnk - bRnk;

    var teamA = a.team || '';
    var teamB = b.team || '';
    var rA = getTeamRank(teamA);
    var rB = getTeamRank(teamB);
    if (rA !== rB) return rA - rB;

    var matchA = teamA.match(/\d+/);
    var matchB = teamB.match(/\d+/);
    var numA = matchA ? parseInt(matchA[0], 10) : 0;
    var numB = matchB ? parseInt(matchB[0], 10) : 0;
    if (numA !== numB) return numA - numB;

    if (teamA !== teamB) return teamA.localeCompare(teamB);

    return (a.name||'').localeCompare(b.name||'');
  });
}

function _liveFilter() {
  var _lfSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) {
      if (/^\d{2}\/\d{2}$/.test(k) && k.split('/')[1] === _schedMonth) _lfSet[k] = 1;
    });
  });
  const displayDates = _sortDateKeys(Object.keys(_lfSet));

  var _currTrn2 = isTraining(currentUser);
  const filtered = state.users.filter(u => {
    if (u.username === 'tuan.mai' || u.username === 'nhon.bui') return false;
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

  var _lfUsers;
  if (_ssFilterDk && _ssShiftFilter !== 'All') {
    _lfUsers = filtered.filter(function(u) {
      return (_getSched(u.username, _ssFilterDk) || '').charAt(0) === _ssShiftFilter;
    });
  } else {
    _lfUsers = _ssShiftFilter === 'All' ? filtered : filtered.filter(function(u) {
      return displayDates.some(function(d) { return (_getSched(u.username, d) || '').charAt(0) === _ssShiftFilter; });
    });
  }

  const tbody = document.getElementById('staff-tbody');
  if (tbody) tbody.innerHTML = renderStaffRows(_sortStaffUsers(_lfUsers), displayDates);
  const sub = document.querySelector('#staff-subtab-content .page-sub');
  if (sub) sub.textContent = `${_lfUsers.length} staff`;
}

// ═══════════════════════════════════════════════
//  DAY-OFF SWAP REQUEST
// ═══════════════════════════════════════════════

var _POS_MAP = {
  'training manager':        'Agent Training Manager',
  'training assistant':      'Agent Training Assistant',
  'data analyst leader':     'Data Analyst Leader',
  'data analyst supervisor': 'Data Analyst Supervisor',
  'leader':                  'Data Analyst Leader',
  'supervisor':              'Data Analyst Supervisor',
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
