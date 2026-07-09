function _countExtBreakDays(entries) {
  return (entries || []).reduce(function(total, e) {
    var days = (e && Array.isArray(e.days) && e.days.length > 0) ? e.days : (e && e.day ? [e.day] : []);
    return total + Math.max(1, days.length);
  }, 0);
}

function renderExtBreak() {
  const isFemale = _getUserGender(currentUser) === 'F';
  const canApprove = isLeader(currentUser) || isTraining(currentUser);
  const showFilters = isLeader(currentUser) || isTraining(currentUser);
  const pendingCount = DB.countPendingExtBreaks ? DB.countPendingExtBreaks() : 0;
  
  if (!_extBreakFilterYM) _extBreakFilterYM = currentMonthKey();
  const mk = _extBreakFilterYM;
  const [yr, mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr), parseInt(mo) - 1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  window._ebShiftFilter = window._ebShiftFilter || 'all';
  window._ebSearchQuery = window._ebSearchQuery || '';
  window._ebPosFilter = window._ebPosFilter || 'all';
  window._ebStatusFilter = window._ebStatusFilter || 'all';

  window._setEbShiftFilter = (val) => { window._ebShiftFilter = val; nav('extbreak'); };
  window._setEbPosFilter = (val) => { window._ebPosFilter = val; window._applyEbFilters(); };
  window._setEbStatusFilter = (val) => { window._ebStatusFilter = val; window._applyEbFilters(); };
  const activeShiftFilter = window._ebShiftFilter;

  // Filter female users based on role and shift
  const allFemaleUsers = state.users.filter(u => {
    if (_getUserGender(u) !== 'F') return false;
    if (isTraining(currentUser) || isLeader(currentUser)) {
      var _ur = u.role || (state.staffInfo[u.username] || {}).role || '';
      var _ut = u.team || (state.staffInfo[u.username] || {}).team || '';
      var _urr = _resolveRole(_ur, _ut) || _ur;
      if ((ROLES[_urr] || {}).level >= 2) return false;
    }
    return true;
  });

  const femaleShiftUsers = showFilters
    ? allFemaleUsers.filter(u => {
        if (activeShiftFilter !== 'all') {
          const wd = getWeekDates();
          return wd.some(dk => _getSched(u.username, dk) === activeShiftFilter);
        }
        const wd = getWeekDates();
        return wd.some(dk => {
          const s = _getSched(u.username, dk);
          if (isTraining(currentUser)) {
            return s === 'A' || s === 'D' || s === 'E';
          } else {
            return s === currentShift;
          }
        });
      })
    : allFemaleUsers;

  // My registrations this month
  const myEntries = DB.getExtBreaks(currentUser.id, mk) || [];
  const myUsed = DB.countExtBreaks ? DB.countExtBreaks(currentUser.id, mk) : _countExtBreakDays(myEntries);
  const myRemaining = Math.max(0, 3 - myUsed);

  // Build registration list for current user (female) or full view (leader/training)
  const viewUsers = showFilters ? femaleShiftUsers : (isFemale ? [currentUser] : []);

  const rows = [];
  let rowIdx = 0;
  
  viewUsers.forEach(u => {
    const entries = DB.getExtBreaks(u.id, mk) || [];
    const used = DB.countExtBreaks ? DB.countExtBreaks(u.id, mk) : _countExtBreakDays(entries);
    const rem = Math.max(0, 3 - used);
    
    entries.forEach((e, i) => {
      const status = e.status || 'pending';
      const isPending = status === 'pending';
      
      const resolvedBy = e.approvedBy
        ? (() => {
            const x = state.users.find(usr => usr.id === e.approvedBy);
            if (x) return x.name;
            const uname = Object.keys(state.staffInfo || {}).find(k => {
              let h = 0;
              for (let j = 0; j < k.length; j++) h = (Math.imul(31, h) + k.charCodeAt(j)) | 0;
              return Math.abs(h) === e.approvedBy;
            });
            return uname ? (state.staffInfo[uname].name || uname) : 'Leader';
          })()
        : null;

      const todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
      const dayStr = (e.days && e.days.length > 0) ? e.days[0] : (e.day || '');
      const [_d, _m] = dayStr.split('/').map(Number);
      const isPastDay = dayStr ? ((_m - 1) * 100 + _d) < todayMMDD : false;
      const canCancel = (u.id === currentUser.id || isLeader(currentUser)) && !isPastDay;

      rows.push({
        user: u,
        entry: e,
        entryIndex: i,
        used,
        rem,
        status,
        isPending,
        resolvedBy,
        canCancel,
        daysLabel: (e.days && e.days.length > 1) ? e.days.join(', ') : (e.day || '—'),
        idx: rowIdx++
      });
    });
  });

  window.toggleEbRow = (idx) => {
    const detailRow = document.getElementById('eb-detail-' + idx);
    const caret = document.getElementById('eb-caret-' + idx);
    if (detailRow) {
      const isHidden = detailRow.style.display === 'none';
      detailRow.style.display = isHidden ? '' : 'none';
      if (caret) {
        caret.textContent = isHidden ? '▼' : '▶';
      }
    }
  };

  window._applyEbFilters = () => {
    const posFilter = window._ebPosFilter || 'all';
    const statusFilter = window._ebStatusFilter || 'all';
    
    let visible = 0;
    document.querySelectorAll('#eb-table-body tr[data-idx]').forEach(row => {
      const pos = row.dataset.position;
      const status = row.dataset.status;
      
      const matchPos = posFilter === 'all' || pos === posFilter;
      const matchStatus = statusFilter === 'all' || status === statusFilter;
      
      const show = matchPos && matchStatus;
      row.style.display = show ? '' : 'none';
      
      const idx = row.dataset.idx;
      const detailRow = document.getElementById('eb-detail-' + idx);
      if (detailRow) {
        if (!show) {
          detailRow.style.display = 'none';
          const caret = document.getElementById('eb-caret-' + idx);
          if (caret) caret.textContent = '▶';
        }
      }
      if (show) visible++;
    });
    
    // Update Position custom dropdown
    const valEbPos = document.getElementById('val-eb-pos');
    if (valEbPos) {
      const labels = { all: '', before: 'Before', after: 'After' };
      valEbPos.textContent = labels[posFilter] !== undefined ? labels[posFilter] : posFilter;
    }
    document.querySelectorAll('#hdr-menu-eb-pos .hdr-filter-item').forEach(item => {
      item.classList.toggle('active', item.dataset.val === posFilter);
    });

    // Update Status custom dropdown
    const valEbStatus = document.getElementById('val-eb-status');
    if (valEbStatus) {
      const labels = { all: '', pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
      valEbStatus.textContent = labels[statusFilter] !== undefined ? labels[statusFilter] : statusFilter;
    }
    document.querySelectorAll('#hdr-menu-eb-status .hdr-filter-item').forEach(item => {
      item.classList.toggle('active', item.dataset.val === statusFilter);
    });
    
    let emp = document.getElementById('eb-filter-empty');
    if (!visible) {
      if (!emp) {
        emp = document.createElement('tr');
        emp.id = 'eb-filter-empty';
        emp.innerHTML = '<td colspan="9" class="empty"><div class="empty-ico">🔍</div>No matching registrations.</td>';
        document.getElementById('eb-table-body').appendChild(emp);
      }
    } else if (emp) {
      emp.remove();
    }
  };

  const renderRow = (r) => {
    const u = r.user;
    const e = r.entry;
    
    // Quota dots
    const dots = [0, 1, 2].map(i =>
      `<span style="width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:2.5px;
        background:${i < r.used ? 'var(--A-color)' : 'var(--border2)'};"></span>`
    ).join('');

    const quotaBadge = `<div style="display:inline-flex;align-items:center;gap:4px;margin-left:6px;background:var(--bg3);padding:2px 6px;border-radius:99px;border:0.5px solid var(--border);">
      <div style="display:flex;gap:2px;">${dots}</div>
      <span style="font-size:9px;color:${r.rem === 0 ? 'var(--err)' : 'var(--text3)'};font-weight:600;">${r.used}/3</span>
    </div>`;

    // Actions
    let actionsHTML = '';
    if (canApprove && r.isPending) {
      actionsHTML = `
        <div class="req-actions">
          <button class="btn btn-xs btn-ok" onclick="approveExtBreak(${u.id},'${mk}',${r.entryIndex})">✓ Approve</button>
          <button class="btn btn-xs btn-err" onclick="rejectExtBreakPrompt(${u.id},'${mk}',${r.entryIndex})">✗ Reject</button>
        </div>`;
    }

    let delBtn = '';
    if (r.canCancel) {
      delBtn = `<button class="btn btn-xs" style="font-size:10px;color:var(--text3);" 
        onclick="deleteExtBreak(${u.id},'${mk}',${r.entryIndex},${currentUser.id})">🗑 Cancel</button>`;
    }

    // Detail/resolved info
    let hasDetails = false;
    let detailContentHTML = '';
    
    if (r.status === 'rejected' && e.rejectedReason) {
      hasDetails = true;
      detailContentHTML += `
        <div class="req-resolved ${r.status}" style="margin-top:0;">
          <b>Rejected Reason</b>: ${e.rejectedReason}
        </div>`;
    }

    const checkedByHTML = (r.status === 'approved' || r.status === 'rejected')
      ? `<span style="font-weight:600;color:var(--text);">${r.resolvedBy || 'Leader'}</span>`
      : `<span style="color:var(--text3);font-family:'IBM Plex Mono',monospace;">N/A</span>`;

    const caretHTML = hasDetails ? `<span id="eb-caret-${r.idx}" style="color:var(--text3);margin-right:4px;display:inline-block;width:10px;font-size:9px;user-select:none;">▶</span>` : '<span style="display:inline-block;width:10px;margin-right:4px;"></span>';
    const expandableClass = hasDetails ? 'expandable-row' : '';
    const onClickAttr = hasDetails ? `onclick="toggleEbRow(${r.idx})"` : '';

    // Group days of this registration entry by their main break slot code directly
    const rDays = (e.days && e.days.length > 0) ? e.days : [e.day];
    const rGroups = {};
    rDays.forEach(dk => {
      const br = getAssigned(u.id, dk) || getAssigned(u.id, getWkDay(dk));
      const slotCode = br ? br.slot : '';
      if (slotCode) {
        if (!rGroups[slotCode]) rGroups[slotCode] = [];
        rGroups[slotCode].push(dk);
      }
    });

    const displayTimes = [];
    if (Object.keys(rGroups).length > 0) {
      function addMins(timeStr, mins) {
        const [h, m] = timeStr.split(':').map(Number);
        const total = h * 60 + m + mins;
        const nh = Math.floor(total / 60) % 24;
        const nm = total % 60;
        return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
      }
      function subMins(timeStr, mins) { return addMins(timeStr, -mins); }

      const numGroups = Object.keys(rGroups).length;
      for (const slotCode in rGroups) {
        const representativeDay = rGroups[slotCode][0];
        const slot = getSlotTime(slotCode, representativeDay);
        if (!slot) continue;

        const parts = slot.split('–');
        if (parts.length !== 2) continue;
        const [start, end] = parts.map(t => t.trim());
        const extraTime = e.position === 'before' ? `${subMins(start, 30)}–${start}` : `${end}–${addMins(end, 30)}`;
        
        if (numGroups > 1) {
          const datesStr = rGroups[slotCode].join(', ');
          displayTimes.push(`${extraTime} (${datesStr}: ${slotCode})`);
        } else {
          displayTimes.push(`${extraTime} (${slotCode})`);
        }
      }
    }

    const timeCellHTML = displayTimes.length > 0 ? displayTimes.join(', ') : (e.time || '—');

    const positionPill = e.position === 'before'
      ? '<span class="req-scope day" style="border-color:var(--border2);color:var(--text2);background:var(--bg3);">← Before</span>'
      : '<span class="req-scope week" style="border-color:var(--B-color);color:var(--B-color);background:var(--B-bg);">After →</span>';

    return `
      <tr class="${expandableClass}" ${onClickAttr} data-name="${u.name}" data-idx="${r.idx}" data-position="${e.position}" data-status="${r.status}">
        <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;text-align:center;color:var(--text3);">${formatDateTime(e.at)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            ${caretHTML}
            <span style="font-weight:600;font-size:12px;color:var(--text);">${u.name}</span>
            <span style="font-size:10px;color:var(--text3);margin-left:4px;">(${u.team})</span>
          </div>
        </td>
        <td style="text-align:center;">${quotaBadge}</td>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;text-align:center;">${r.daysLabel}</td>
        <td style="text-align:center;">${positionPill}</td>
        <td class="req-extra-time-cell" style="text-align:center;">
          <span class="req-extra-time-text" style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--A-color);font-weight:600;">${timeCellHTML}</span>
        </td>
        <td style="text-align:center;">
          <span class="req-status ${r.status}">${r.status.toUpperCase()}</span>
        </td>
        <td style="text-align:center;">${checkedByHTML}</td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
            ${actionsHTML}
            ${delBtn}
          </div>
        </td>
      </tr>
      ${hasDetails ? `
        <tr id="eb-detail-${r.idx}" class="detail-row" style="display:none;">
          <td colspan="9">
            <div class="detail-content">
              ${detailContentHTML}
            </div>
          </td>
        </tr>` : ''}
    `;
  };

  const noAccessMsg = !isFemale && !showFilters
    ? `<div class="empty"><div class="empty-ico">🌸</div>
        <div>This menu is for female staff only.</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">Female staff can register up to 3 extra 30-min breaks per month.</div>
      </div>` : '';

  const myPendingHtml = (!showFilters && isFemale) ? (() => {
    const mk2 = currentMonthKey();
    const myEntries2 = DB.getExtBreaks(currentUser.id, mk2) || [];
    const myPending = myEntries2.filter((e, i) => (e.status || 'pending') === 'pending');
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

  const filterBarHTML = showFilters ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <div style="display:flex;gap:5px;flex-wrap:wrap;">
        ${['all','A','B','C','D','E'].map(val=>{
          const isAct=window._ebShiftFilter===val;
          const c=SHIFT_COLORS[val]||{};
          return `<button onclick="window._ebShiftFilter='${val}';nav('extbreak')"
            class="btn btn-sm"
            style="border-color:${isAct?(val==='all'?'var(--accent)':c.color):'var(--border2)'};
              background:${isAct?(val==='all'?'var(--accent)':c.bg):'var(--bg2)'};
              color:${isAct?(val==='all'?'#fff':c.color):'var(--text2)'};font-weight:600;">
            ${val==='all'?'All shifts':val}
          </button>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  return `
<div class="page-header">
  <div>
    <div class="page-title">🌸 30-Min Extra Break</div>
    <div class="page-sub">${monthLabel} · Shift ${currentShift} · ${isFemale && !showFilters ? `${myRemaining} registration${myRemaining !== 1 ? 's' : ''} remaining` : 'All female staff'}</div>
  </div>
  ${isFemale && !showFilters && myRemaining > 0 ? `
    <div>
      <button class="btn btn-accent" onclick="openExtBreakModal()">+ Register Break</button>
    </div>
  ` : ''}
</div>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
  ${_monthPickerHTML(mk, '_setExtBreakFilterYM', 'extbreak')}
</div>
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

<div class="req-table-container" ${viewUsers.length === 0 && !noAccessMsg ? 'style="display:none;"' : ''}>
  <table class="req-table extbreak-table">
    <colgroup>
      <col class="eb-col-requested">
      <col class="eb-col-requester">
      <col class="eb-col-total">
      <col class="eb-col-registered">
      <col class="eb-col-position">
      <col class="eb-col-extra-time">
      <col class="eb-col-status">
      <col class="eb-col-checked">
      <col class="eb-col-actions">
    </colgroup>
    <thead>
      <tr>
        <th style="text-align: center; white-space: nowrap;">Requested date</th>
        <th style="text-align: center;">Requester</th>
        <th style="text-align: center; white-space: nowrap;">Total times</th>
        <th style="text-align: center; white-space: nowrap;">Registered date(s)</th>
        <th style="text-align: center; position: relative; white-space: nowrap;">
          <div class="hdr-filter-btn" id="hdr-filter-eb-pos" onclick="toggleHdrDropdown(event, 'eb-pos')">
            <span class="hdr-filter-label">Position:</span>
            <span class="hdr-filter-val" id="val-eb-pos"></span>
            <span class="hdr-filter-arrow">▼</span>
          </div>
          <div class="hdr-filter-menu" id="hdr-menu-eb-pos">
            <div class="hdr-filter-item active" data-val="all" onclick="selectHdrFilter(event, 'eb-pos', 'all')">All</div>
            <div class="hdr-filter-item" data-val="before" onclick="selectHdrFilter(event, 'eb-pos', 'before')">Before</div>
            <div class="hdr-filter-item" data-val="after" onclick="selectHdrFilter(event, 'eb-pos', 'after')">After</div>
          </div>
        </th>
        <th style="text-align: center; white-space: nowrap;">Extra time</th>
        <th style="text-align: center; position: relative; white-space: nowrap;">
          <div class="hdr-filter-btn" id="hdr-filter-eb-status" onclick="toggleHdrDropdown(event, 'eb-status')">
            <span class="hdr-filter-label">Status:</span>
            <span class="hdr-filter-val" id="val-eb-status"></span>
            <span class="hdr-filter-arrow">▼</span>
          </div>
          <div class="hdr-filter-menu" id="hdr-menu-eb-status">
            <div class="hdr-filter-item active" data-val="all" onclick="selectHdrFilter(event, 'eb-status', 'all')">All</div>
            <div class="hdr-filter-item" data-val="pending" onclick="selectHdrFilter(event, 'eb-status', 'pending')">Pending</div>
            <div class="hdr-filter-item" data-val="approved" onclick="selectHdrFilter(event, 'eb-status', 'approved')">Approved</div>
            <div class="hdr-filter-item" data-val="rejected" onclick="selectHdrFilter(event, 'eb-status', 'rejected')">Rejected</div>
          </div>
        </th>
        <th style="text-align: center; white-space: nowrap;">Checked by</th>
        <th style="text-align: center; white-space: nowrap;">Actions</th>
      </tr>
    </thead>
    <tbody id="eb-table-body">
      ${rows.length > 0 ? rows.map(r => renderRow(r)).join('') : '<tr><td colspan="9" class="empty"><div class="empty-ico">✅</div>No registrations for this month.</td></tr>'}
    </tbody>
  </table>
</div>

${viewUsers.length === 0 && !noAccessMsg ? `<div class="empty"><div class="empty-ico">👥</div>No female staff on Shift ${currentShift} this week.</div>` : ''}
`;
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
  const remaining = Math.max(0, 3 - used);
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
  const checked = [...document.querySelectorAll('input[name="eb-day-check"]:checked')];
  const pos = document.querySelector('input[name="eb-pos"]:checked')?.value;
  if (!pos || !checked.length) return;

  const target = _ebTargetUser || currentUser;
  const rawShift = Object.values(_getSchedObj(target.username)).find(s => s && s !== '0') || currentShift;
  const targetShift = (rawShift.match(/[A-E]/) || ['E'])[0];

  const groups = {};
  checked.forEach(c => {
    const slot = c.dataset.slot;
    if (!groups[slot]) groups[slot] = [];
    groups[slot].push(c.value);
  });

  function addMins(timeStr, mins) {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + mins;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }
  function subMins(timeStr, mins) { return addMins(timeStr, -mins); }

  let html = '';
  const numGroups = Object.keys(groups).length;
  for (const slot in groups) {
    const parts = slot.split('–');
    if (parts.length !== 2) continue;
    const [start, end] = parts.map(t => t.trim());
    let extraLabel = pos === 'before' ? `${subMins(start, 30)}–${start}` : `${end}–${addMins(end, 30)}`;
    const slotCode = getShortSlot(targetShift, slot);
    
    let innerHTML = '';
    if (numGroups > 1) {
      innerHTML = `${groups[slot].join(', ')}: ${slotCode}`;
    } else {
      innerHTML = slotCode;
    }
    
    html += `
      <div style="margin-top: 6px; font-size: 11px;">
        <span style="color:var(--text3);font-size:10px;font-weight:700;">MAIN (${slotCode})</span>
        <span style="color:var(--accent);margin-left:4px;font-weight:600;">${slot}</span>
        &nbsp;→&nbsp;
        <span style="color:var(--text3);font-size:10px;font-weight:700;">EXTRA 30M</span>
        <span style="color:var(--A-color);margin-left:4px;font-weight:600;">${extraLabel}</span>
        <span style="font-size:10px;color:var(--text3);margin-left:4px;">(${innerHTML})</span>
      </div>`;
  }

  const preview = document.getElementById('eb-preview');
  preview.style.display = 'block';
  preview.innerHTML = html;
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
    const remaining = Math.max(0, 3 - used);
    toast(`Only ${remaining} registration${remaining !== 1 ? 's' : ''} remaining.`, 'err'); return;
  }

  function addMins(t, m) {
    const [h, mi] = t.split(':').map(Number);
    const tot = h * 60 + mi + m;
    return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  }

  const days = checked.map(c => ({ dk: c.value, slot: c.dataset.slot }));
  
  // Group days by their assigned main break slots
  const groups = {};
  days.forEach(d => {
    if (!groups[d.slot]) groups[d.slot] = [];
    groups[d.slot].push(d.dk);
  });

  const rawShift = Object.values(_getSchedObj(target.username)).find(s => s && s !== '0') || currentShift;
  const targetShift = (rawShift.match(/[A-E]/) || ['E'])[0];

  const timesList = [];
  const numGroups = Object.keys(groups).length;
  for (const slot in groups) {
    const parts = slot.split('–');
    if (parts.length !== 2) continue;
    const [start, end] = parts.map(t => t.trim());
    const extraTime = pos === 'before' ? `${addMins(start, -30)}–${start}` : `${end}–${addMins(end, 30)}`;
    const slotCode = getShortSlot(targetShift, slot);
    
    if (numGroups > 1) {
      const datesStr = groups[slot].join(', ');
      timesList.push(`${extraTime} (${datesStr}: ${slotCode})`);
    } else {
      timesList.push(`${extraTime} (${slotCode})`);
    }
  }

  const time = timesList.join(', ');

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

