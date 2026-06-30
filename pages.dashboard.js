function renderDashboard() {
  const weekDates = getWeekDates(); // always real current week
  const todayDk = weekDates[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]; 
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
