let arrangeMainTab = 'assign'; // 'assign' | 'overview' | 'month'
let arrangeActiveDay = null;   // set on first render
var _arrangeMonth = '';        // 'MM/YYYY' filter for week picker; '' = show all
let _arrangeMonthTab = new Date().getMonth() + 1; // 1-12
let _collapsedTiers = new Set();
var _arrMonthYear  = new Date().getFullYear();
var _arrMonthMonth = new Date().getMonth() + 1; // 1–12
let arrangeViewMode = localStorage.getItem('arrange_view_mode') || 'edit'; // 'edit' | 'overview'
// Persisted bulk-panel state — survives re-renders and sync polls
let _bulkGroups = new Set(); // selected group checkboxes
let _bulkDays = new Set(); // selected day checkboxes
let _bulkSlotIdx = 0;         // slot dropdown index
// Persisted paste area content — survives re-renders
let _pasteContent = '';

function renderArrange() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';

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
    localStorage.setItem('activeMonday', activeMonday);
    arrangeActiveDay = null;
  }

  const weekRange = getWeekRange(activeMonday);
  if (!arrangeActiveDay || !weekRange.includes(arrangeActiveDay)) arrangeActiveDay = weekRange[0];

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
      '<select class="login-select" style="padding:4px 8px;font-size:11px;" onchange="activeMonday=this.value;localStorage.setItem(\'activeMonday\',this.value);arrangeActiveDay=null;nav(\'arrange\')">' +
      mondays.map(function(s) {
        var p = s.split('/');
        var end = new Date(2026, parseInt(p[1])-1, parseInt(p[0])+6);
        var endStr = String(end.getDate()).padStart(2,'0') + '/' + String(end.getMonth()+1).padStart(2,'0');
        return '<option value="' + s + '"' + (s === activeMonday ? ' selected' : '') + '>' + s + ' – ' + endStr + '</option>';
      }).join('') + '</select></div>'
    : '';

  var _canToggleBulk = typeof currentUser !== 'undefined' && currentUser &&
    (typeof isLeader === 'function' && isLeader(currentUser) ||
     typeof isTraining === 'function' && isTraining(currentUser));

  var autoAssignToggleHTML = '';
  if (_canToggleBulk && VISIBLE_SHIFTS.includes(currentShift)) {
    var on = typeof getBulkBreakEnabled === 'function' ? getBulkBreakEnabled(currentShift) : true;
    var _rgbMap = { A: '225,29,122', D: '14,165,233', E: '124,58,237' };
    var _shiftColors = { A: '#e11d7a', D: '#0ea5e9', E: '#7c3aed' };
    var sc = _shiftColors[currentShift] || 'var(--accent)';
    var rgb = _rgbMap[currentShift] || '31,102,241';
    
    autoAssignToggleHTML = '<div style="display:flex;align-items:center;gap:6px;">' +
      '<span style="' + _monoLbl + '">AUTO ASSIGN:</span>' +
      '<button onclick="toggleBulkBreak(\'' + currentShift + '\')"' +
        ' title="Toggle auto break assignment for Shift ' + currentShift + '"' +
        ' style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;' +
          'border:1.5px solid ' + (on ? sc : 'var(--border2)') + ';' +
          'background:' + (on ? sc : 'var(--bg3)') + ';' +
          'color:' + (on ? '#fff' : 'var(--text3)') + ';transition:all .15s;">' +
        (on ? 'ON' : 'OFF') +
      '</button>' +
      '</div>';
  }

  return `
<div class="page-header">
  <div class="page-title">Arrange Breaks — Shift ${currentShift}</div>
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    ${arrangeMainTab !== 'month' ? monthPickerHTML : ''}
    ${arrangeMainTab !== 'month' ? weekPickerHTML : ''}
    ${arrangeMainTab !== 'month' ? autoAssignToggleHTML : ''}
    ${arrangeMainTab !== 'month' ? `
    <button id="save-breaks-btn" class="btn btn-accent"
      onclick="saveBreaksToCloud()"
      style="display:flex;align-items:center;gap:7px;font-size:12px;padding:7px 16px;">
      <span id="save-breaks-ico">☁</span>
      <span id="save-breaks-lbl">Save Breaks</span>
    </button>
    ` : ''}
  </div>
</div>

<!-- Top-level tabs -->
<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--border); margin-bottom:20px; flex-wrap:wrap; gap:12px;">
  <div style="display:flex; gap:0;">
    <button onclick="switchArrangeMainTab('assign')"
      style="padding:9px 24px; font-size:13px; font-weight:600; cursor:pointer; border:none;
        background:none; color:${arrangeMainTab === 'assign' ? 'var(--accent)' : 'var(--text2)'};
        border-bottom:3px solid ${arrangeMainTab === 'assign' ? 'var(--accent)' : 'transparent'};
        margin-bottom:-2px; transition:all .12s;">
      ✏️ Arrange Breaks
    </button>
    <button onclick="switchArrangeMainTab('month')"
      style="padding:9px 24px; font-size:13px; font-weight:600; cursor:pointer; border:none;
        background:none; color:${arrangeMainTab === 'month' ? 'var(--accent)' : 'var(--text2)'};
        border-bottom:3px solid ${arrangeMainTab === 'month' ? 'var(--accent)' : 'transparent'};
        margin-bottom:-2px; transition:all .12s;">
      📅 Month Overview
    </button>
  </div>

  ${arrangeMainTab === 'assign' ? `
  <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; background:var(--bg3); padding:3px; border-radius:8px; border:1px solid var(--border);">
    <button onclick="switchArrangeViewMode('edit')"
      style="padding:5px 12px; font-size:11px; font-weight:600; cursor:pointer; border:none; border-radius:6px;
        background:${arrangeViewMode === 'edit' ? 'var(--accent)' : 'transparent'};
        color:${arrangeViewMode === 'edit' ? '#fff' : 'var(--text2)'}; transition:all .15s;">
      ✏️ Edit Mode
    </button>
    <button onclick="switchArrangeViewMode('overview')"
      style="padding:5px 12px; font-size:11px; font-weight:600; cursor:pointer; border:none; border-radius:6px;
        background:${arrangeViewMode === 'overview' ? 'var(--accent)' : 'transparent'};
        color:${arrangeViewMode === 'overview' ? '#fff' : 'var(--text2)'}; transition:all .15s;">
      👁️ Overview Mode
    </button>
  </div>
  ` : ''}
</div>

<div id="arrange-main-content">
  ${arrangeMainTab === 'assign' ? _renderArrangeAssignTab(weekRange)
    : _renderArrangeMonthOverview()}
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

  if (!confirm("Are you sure you want to save the break schedule to the cloud?")) {
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

function switchArrangeViewMode(mode) {
  arrangeViewMode = mode;
  localStorage.setItem('arrange_view_mode', mode);
  nav('arrange');
}

// ── Break Split Settings tab ──

function _renderBreakSplitTab() {
  var _tierDefs = [
    ['agent', 'D.A',    '#f97316', 'rgba(249,115,22,.15)', 67],
    ['qa',    'D.S',    '#0ea5e9', 'rgba(14,165,233,.15)', 67],
    ['sr_qa', 'Sr D.S', '#a855f7', 'rgba(168,85,247,.15)', 50],
  ];

  const rows = VISIBLE_SHIFTS.map(shift => {
    const slots  = BREAK_SLOTS[shift] || [];
    const slot1  = slots[0] || '';
    const slot2  = slots[1] || '';

    const tierRows = _tierDefs.map(([tier, label, color, bg, def]) => {
      const saved = getBreakSplitPct(shift, tier);
      const p1 = saved !== null ? saved : def;
      const p2 = 100 - p1;
      return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:${bg};color:${color};min-width:50px;text-align:center;">${label}</span>
        ${saved !== null
          ? `<span style="font-size:10px;font-weight:700;background:var(--accent);color:#fff;padding:2px 8px;border-radius:10px;white-space:nowrap;">${p1}%/${p2}%</span>`
          : `<span style="font-size:10px;background:var(--bg3);color:var(--text3);padding:2px 8px;border-radius:10px;white-space:nowrap;">default</span>`}
        <span style="font-size:11px;color:var(--text2);margin-left:4px;">${shift}1</span>
        <input type="number" id="split-slider-${shift}-${tier}" min="0" max="100" value="${p1}"
          style="width:54px;padding:3px 6px;font-size:11px;font-weight:600;border:1px solid var(--border2);border-radius:4px;background:var(--bg3);color:var(--text);text-align:center;"
          oninput="onBreakSplitSlide('${shift}',this.value,'${tier}')">
        <span id="split-lbl-${shift}-${tier}-1" style="display:none;">${p1}%</span>
        <span style="font-size:11px;color:var(--text2);">%</span>
        <span style="font-size:11px;color:var(--text2);margin-left:8px;">${shift}2</span>
        <span id="split-lbl-${shift}-${tier}-2" style="font-size:12px;font-weight:700;color:${color};min-width:26px;">${p2}%</span>
      </div>`;
    }).join('');

    return `
<div class="card" style="padding:18px 20px;margin-bottom:14px;">
  <div style="display:flex;justify-content:open;align-items:center;margin-bottom:14px;gap:8px;">
    <span style="font-size:14px;font-weight:700;">Shift ${shift}</span>
  </div>
  <div style="margin-bottom:12px;">
    ${tierRows}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <button onclick="resetBreakSplit('${shift}')"
      style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;"
      title="Clear custom % and go back to default rotation">
      ↩ Reset to rotation
    </button>
  </div>
</div>`;
  }).join('');

  return `
<div style="max-width:560px;">
  <div style="font-size:11px;color:var(--text2);margin-bottom:16px;line-height:1.7;">
    Set how the team is split across break slots for each shift and position tier.
    Rotation still applies — each week the groups swap which slot they get, keeping the set percentage.
  </div>
  ${rows}
  <button class="btn btn-accent" onclick="saveBreakSplits()" style="margin-top:4px;">
    Save Distribution Settings
  </button>
</div>`;
}

function onBreakSplitSlide(shift, rawVal, tier) {
  var pct1 = parseInt(rawVal, 10);
  if (isNaN(pct1)) pct1 = 0;
  pct1 = Math.max(0, Math.min(100, pct1));
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
  if (!confirm("Are you sure you want to save the new break split settings and re-assign breaks?")) {
    return;
  }
  var changedShifts  = new Set();
  var shiftsToProcess = new Set();
  VISIBLE_SHIFTS.forEach(function(shift) {
    var _sA = document.getElementById('split-slider-' + shift + '-agent');
    var _sQ = document.getElementById('split-slider-' + shift + '-qa');
    var _sS = document.getElementById('split-slider-' + shift + '-sr_qa');
    if (!_sA && !_sQ && !_sS) return;
    shiftsToProcess.add(shift);
    var _nA = _sA ? parseInt(_sA.value) : (getBreakSplitPct(shift,'agent') ?? 67);
    var _nQ = _sQ ? parseInt(_sQ.value) : (getBreakSplitPct(shift,'qa') ?? 67);
    var _nS = _sS ? parseInt(_sS.value) : (getBreakSplitPct(shift,'sr_qa') ?? 50);
    var _oA = getBreakSplitPct(shift,'agent');
    var _oQ = getBreakSplitPct(shift,'qa');
    var _oS = getBreakSplitPct(shift,'sr_qa');
    if (_nA !== _oA || _nQ !== _oQ || _nS !== _oS) changedShifts.add(shift);
    var _sp = _loadBreakSplit();
    _sp[shift] = { agent: _nA, qa: _nQ, sr_qa: _nS };
    _saveBreakSplit(_sp);
  });

  if (shiftsToProcess.size > 0) {
    // 1. Clear break records: auto-only for this week, all for next week onward
    var _nextWeek = _nextWeekMonday(activeMonday);
    _clearAutoBreaksFromWeek(activeMonday, shiftsToProcess, false);
    _clearAutoBreaksFromWeek(_nextWeek, shiftsToProcess, true);

    // 2. Reset rotation so knownList is rebuilt
    var rot = _loadRotation();
    shiftsToProcess.forEach(function(shift) {
      ['agent', 'qa', 'sr_qa'].forEach(function(tier) {
        delete rot[shift + '_' + tier];
      });
    });
    _saveRotation(rot);

    // 3. Re-assign with fresh rotation
    var result = autoAssignBreaks(state.users);
    await syncWrite();
    toast('Distribution saved. Re-assigned ' + result.assigned + ' break(s) from week ' + activeMonday + '.', 'ok');
  } else {
    await syncWrite();
    toast('Break distribution settings saved (no changes).', 'ok');
  }
  nav('arrange');
}

async function resetBreakSplit(shift) {
  if (!confirm("Are you sure you want to reset the break split for shift " + shift + " to the default 50/50 rotation? This will re-assign breaks.")) {
    return;
  }
  setBreakSplitPct(shift, null);
  var rot = _loadRotation ? _loadRotation() : {};
  ['agent', 'qa', 'sr_qa'].forEach(function(tier) { delete rot[shift + '_' + tier]; });
  if (typeof _saveRotation === 'function') _saveRotation(rot);
  
  var _nextWeek = _nextWeekMonday(activeMonday);
  _clearAutoBreaksFromWeek(activeMonday, new Set([shift]), false);
  _clearAutoBreaksFromWeek(_nextWeek, new Set([shift]), true);
  
  var result = autoAssignBreaks(state.users);
  await syncWrite();
  toast('Shift ' + shift + ' reset to 50/50 rotation. Re-assigned ' + result.assigned + ' break(s).', 'warn');
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

function _getArrangeSummaryBarHTML(allMates, weekRange) {
  const assignedCount = allMates.reduce((acc, u) =>
    acc + weekRange.filter(d => getAssigned(u.id, d) || getAssigned(u.id, getWkDay(d))).length, 0);
  const totalSlots = allMates.reduce((acc, u) =>
    acc + weekRange.filter(d => _getSched(u.username, d) === currentShift).length, 0);

  return `
    <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-weight:600;">
      📊 WEEK STATUS: ${allMates.length} members · ${assignedCount}/${totalSlots} assigned (${Math.round((assignedCount/totalSlots)*100 || 0)}%)
    </span>
    ${arrangeViewMode === 'overview' ? `
    <span style="color:var(--ok);font-size:10px;font-weight:600;margin-left:8px;">■ Assigned</span>
    <span style="color:var(--warn);font-size:10px;font-weight:600;margin-left:8px;">■ Pending</span>
    <span style="color:var(--accent);font-size:10px;opacity:0.85;font-weight:600;margin-left:8px;">💡 Click cell to cycle: Slot 1 ➔ Slot 2 ➔ Unassigned</span>
    ` : ''}`;
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

  const splitRow = slots.length >= 2 ? `
  <div style="padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:10px;">
    <span class="bulk-panel-label" style="display:block;margin-bottom:8px;">Split per Position</span>
    ${_tierDefs.map(([tier, label, color, bg, def]) => {
      const saved = getBreakSplitPct(currentShift, tier);
      const p1 = saved !== null ? saved : def;
      const p2 = 100 - p1;
      return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:${bg};color:${color};min-width:46px;text-align:center;">${label}</span>
        ${saved !== null
          ? `<span style="font-size:10px;font-weight:700;background:var(--accent);color:#fff;padding:1px 7px;border-radius:10px;white-space:nowrap;">${p1}%/${p2}%</span>`
          : `<span style="font-size:10px;background:var(--bg3);color:var(--text3);padding:1px 7px;border-radius:10px;white-space:nowrap;">default</span>`}
        <span style="font-size:10px;color:var(--text2);">${currentShift}1</span>
        <input type="number" id="split-slider-${currentShift}-${tier}" min="0" max="100" value="${p1}"
          style="width:54px;padding:3px 6px;font-size:11px;font-weight:600;border:1px solid var(--border2);border-radius:4px;background:var(--bg3);color:var(--text);text-align:center;"
          oninput="onBreakSplitSlide('${currentShift}',this.value,'${tier}')">
        <span id="split-lbl-${currentShift}-${tier}-1" style="display:none;">${p1}%</span>
        <span style="font-size:10px;color:var(--text2);">%</span>
        <span style="font-size:10px;color:var(--text2);margin-left:8px;">${currentShift}2</span>
        <span id="split-lbl-${currentShift}-${tier}-2" style="font-size:12px;font-weight:700;color:${color};min-width:26px;">${p2}%</span>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button onclick="saveBreakSplits()" class="btn btn-accent" style="font-size:11px;padding:3px 12px;white-space:nowrap;">Save</button>
      <button onclick="resetBreakSplit('${currentShift}')" style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:3px 6px;border-radius:4px;white-space:nowrap;">&#8617; Reset all</button>
    </div>
  </div>` : '';

  // ── Break distribution display ──
  var _distPanel = '';
  if (slots.length >= 2) {
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
      // Read actual break assignments for this week - don't infer from percentage
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
        '<span style="font-size:11px;"><b>' + n1 + '</b> group' + (n1 !== 1 ? 's' : '') + ' → <span class="break-slot assigned slot-1" style="font-size:9px;padding:1px 5px;">' + currentShift + '1</span>' +
        (t1.length ? '<span style="font-size:10px;color:var(--text3);margin-left:4px;">(' + t1.join(', ') + ')</span>' : '') + '</span>' +
        '<span style="font-size:11px;"><b>' + n2 + '</b> group' + (n2 !== 1 ? 's' : '') + ' → <span class="break-slot assigned slot-2" style="font-size:9px;padding:1px 5px;">' + currentShift + '2</span>' +
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
  <div class="bulk-panel-cols">

    <!-- COL 1: Split per Position -->
    <div class="bulk-panel-col">
      ${splitRow || '<span style="color:var(--text3);font-size:11px;">—</span>'}
    </div>

    <!-- COL 2: Break Distribution (Shift A only) -->
    ${_distPanel ? `<div class="bulk-panel-col">${_distPanel}</div>` : ''}

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

  const allMates = state.users.filter(u => {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul == null || _ul >= 2) return false;
    return weekRange.some(d => _getSched(u.username, d) === currentShift);
  });

  const summaryBar = `<div id="arrange-summary-bar" style="display:flex;align-items:center;gap:16px;margin-bottom:8px;margin-top:4px;flex-wrap:wrap;">
    ${_getArrangeSummaryBarHTML(allMates, weekRange)}
  </div>`;

  const weekTable = getArrangeDayMemberList(null);
  // Disconnect previous observer so it doesn't fire on stale elements
  if (_arrResizeObs) { _arrResizeObs.disconnect(); _arrResizeObs = null; }
  requestAnimationFrame(function() { _initArrResize(); });
  return collapsePanel + summaryBar + weekTable;
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
  var allMonths = [];
  for (var _mi = 5; _mi <= endMonth; _mi++) { allMonths.push(_mi); }
  
  if (!allMonths.includes(_arrangeMonthTab)) {
    _arrangeMonthTab = curMonth;
  }
  var months = [_arrangeMonthTab];

  var _arrTierKey = {
    'Data Analyst': 'analyst', 'Sr Data Analyst': 'analyst',
    'Data Supervisor': 'supervisor', 'Sr Data Supervisor': 'sr_supervisor'
  };
  var _arrTierOrder = ['analyst', 'supervisor', 'sr_supervisor'];
  var _arrTierLabel = { 'analyst': 'Data Analyst', 'supervisor': 'Data Supervisor', 'sr_supervisor': 'Sr Data Supervisor' };
  var _tierIcon = { 'analyst': '◆', 'supervisor': '▲', 'sr_supervisor': '★' };
  var _monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function getFullTeamName(team) {
    if (!team) return '';
    if (team.startsWith('SDS')) return 'Sr Data Supervisor ' + team.substring(3);
    if (team.startsWith('DS')) return 'Data Supervisor ' + team.substring(2);
    if (team.startsWith('DA')) return 'Data Analyst ' + team.substring(2);
    if (team.startsWith('Sr QA')) return 'Sr Data Supervisor ' + team.substring(5);
    if (team.startsWith('QA')) return 'Data Supervisor ' + team.substring(2);
    if (team.startsWith('Agent')) return 'Data Analyst ' + team.substring(5);
    return team;
  }

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
      var borderLeft = dayName === 'Mon' ? 'border-left: 2px solid var(--border2);' : '';
      return '<th style="text-align:center;min-width:34px;padding:5px 2px;font-size:10px;font-weight:700;' +
        'background:' + bg + ';color:' + col + ';opacity:' + (isPast ? '.35' : '1') + ';' +
        borderLeft +
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

      var teamMembers = state.users.filter(function(u) { return u.team === team; });
      var memberNames = teamMembers.map(function(u) { return u.name; }).join(', ');

      // Stronger tier separator: full-band with icon + left accent border
      var out = '';
      if (tierKey !== prevTier) {
        prevTier = tierKey;
        rowIndex = 0;
        var tierColor = _roleColor(resolvedRole);
        var icon = _tierIcon[tierKey] || '◆';
        var isCollapsed = _collapsedTiers.has(tierKey);
        var chevron = isCollapsed ? '►' : '▼';
        out += '<tr onclick="if(_collapsedTiers.has(\'' + tierKey + '\')) _collapsedTiers.delete(\'' + tierKey + '\'); else _collapsedTiers.add(\'' + tierKey + '\'); nav(\'arrange\');" style="cursor:pointer;" title="Click to collapse/expand"><td colspan="' + (dates.length + 1) + '" style="' +
          'padding:10px 12px 6px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;' +
          'color:' + tierColor + ';background:var(--bg2);' +
          'border-top:2px solid var(--border);border-left:3px solid ' + tierColor + ';">' +
          '<span style="display:inline-block;width:12px;font-size:8px;vertical-align:middle;">' + chevron + '</span> ' + tierLabel + '</td></tr>';
      }

      if (_collapsedTiers.has(tierKey)) {
        return out;
      }

      var isEven = rowIndex % 2 === 0;
      rowIndex++;
      var rowBaseBg = isEven ? 'transparent' : 'rgba(0,0,0,.025)';

      var count1 = 0, count2 = 0;

      var cells = dates.map(function(dk) {
        var isToday = dk === todayDk;
        var isMon = getWkDay(dk) === 'Mon';
        var isWeekend = getWkDay(dk) === 'Sat' || getWkDay(dk) === 'Sun';
        var isPast = _movIsPast(dk, year);
        var borderLeft = isMon ? 'border-left: 2px solid var(--border2);' : '';

        // Past cells: blank + dimmed
        if (isPast) {
          return '<td style="padding:4px 1px;opacity:.2;background:var(--bg4);' + borderLeft + '"></td>';
        }

        var onShiftCount = teamMembers.filter(function(u) {
          return _getSched(u.username, dk) === currentShift;
        }).length;

        // Not on shift this day: blank cell
        if (onShiftCount === 0) {
          var emptyBg = isToday ? 'rgba(31,102,241,.06)' : isWeekend ? 'rgba(0,0,0,.04)' : '';
          return '<td style="padding:4px 1px;background:' + emptyBg + ';' + borderLeft + '"></td>';
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
          count1++;
          badgeStyle = 'background:rgba(31,102,241,.18);color:#1F66F1;border:1.5px solid #1F66F1;box-shadow:0 0 6px rgba(31,102,241,.25);width:20px;height:20px;border-radius:50%;';
          badgeText = '1';
        } else if (slotCode === currentShift + '2') {
          count2++;
          badgeStyle = 'background:rgba(245,158,11,.18);color:#f59e0b;border:1.5px solid #f59e0b;box-shadow:0 0 6px rgba(245,158,11,.25);width:20px;height:20px;border-radius:50%;';
          badgeText = '2';
        } else {
          badgeStyle = 'background:transparent;color:var(--text3);border:1.5px dashed var(--border2);width:20px;height:20px;border-radius:50%;opacity:0.55;';
          badgeText = '?';
        }

        var todayColBg = isToday ? 'rgba(31,102,241,.06)' : isWeekend ? 'rgba(0,0,0,.04)' : '';
        return '<td style="text-align:center;padding:4px 1px;background:' + todayColBg + ';' + borderLeft + '">' +
          '<span style="display:inline-flex;align-items:center;justify-content:center;' +
            'font-size:10px;font-weight:700;' +
            'font-family:monospace;' + badgeStyle + '">' + badgeText + '</span></td>';
      }).join('');

      var balanceBarHTML = '';
      if (count1 + count2 > 0) {
        var pct1 = Math.round((count1 / (count1 + count2)) * 100);
        balanceBarHTML = '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;" title="Rotation Balance: Slot 1 (' + count1 + ' days) vs Slot 2 (' + count2 + ' days)">' +
          '<span style="font-size:9px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;white-space:nowrap;">1:<b>' + count1 + 'd</b> vs 2:<b>' + count2 + 'd</b></span>' +
          '<div style="width:40px;height:4px;background:rgba(245,158,11,.2);border-radius:2px;overflow:hidden;display:flex;border:0.5px solid var(--border2);">' +
            '<div style="width:' + pct1 + '%;background:#1f66f1;height:100%;"></div>' +
          '</div>' +
        '</div>';
      }

      var stickyCell = '<td style="padding:6px 12px;white-space:nowrap;' +
        'position:sticky;left:0;z-index:5;' +
        'background:' + (isEven ? 'var(--bg2)' : 'var(--bg3)') + ';' +
        'box-shadow:3px 0 8px -2px rgba(0,0,0,.18);' +
        'border-right:1px solid var(--border);">' +
          '<div style="font-weight:600;font-size:12px;">' + team + '</div>' +
          (memberNames ? '<div style="font-size:10px;color:var(--text3);font-weight:400;margin-top:1px;max-width:240px;overflow:hidden;text-overflow:ellipsis;" title="' + memberNames + '">' + memberNames + '</div>' : '') +
          balanceBarHTML +
        '</td>';

      out += '<tr style="background:' + rowBaseBg + ';" ' +
        'onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'' + rowBaseBg + '\'">' +
        stickyCell + cells + '</tr>';
        
      return out;
    }).join('');

    return '<div id="mov-m' + month + '-' + year + '" style="margin-bottom:32px;scroll-margin-top:52px;">' +
      '<div style="overflow-x:auto;border-radius:6px;border:1px solid var(--border);box-shadow:0 1px 6px rgba(0,0,0,.07);">' +
      '<table style="border-collapse:collapse;width:max-content;min-width:100%;">' +
      '<thead><tr>' +
        '<th style="position:sticky;left:0;z-index:11;background:var(--bg3);padding:5px 12px 5px 10px;' +
          'font-size:10px;font-weight:700;color:var(--text3);text-align:left;letter-spacing:.06em;' +
          'box-shadow:3px 0 8px -2px rgba(0,0,0,.18);border-right:1px solid var(--border);">TEAM (' + teams.length + ')</th>' +
        theadCols +
      '</tr></thead>' +
      '<tbody>' + tbodyRows + '</tbody>' +
      '</table></div></div>';
  }).join('');

  // Month-nav bar: quick-jump tabs for each month
  var navChips = allMonths.map(function(m) {
    var isCur = m === _arrangeMonthTab;
    return '<button onclick="_arrangeMonthTab=' + m + ';nav(\'arrange\')" ' +
      'style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;' +
        'font-size:11px;font-weight:' + (isCur ? '700' : '500') + ';text-decoration:none;' +
        'background:' + (isCur ? 'var(--accent)' : 'var(--bg4)') + ';' +
        'color:' + (isCur ? '#fff' : 'var(--text2)') + ';' +
        'border:1px solid ' + (isCur ? 'var(--accent)' : 'var(--border)') + ';' +
        'transition:opacity .15s;cursor:pointer;" ' +
      'onmouseover="this.style.opacity=\'.75\'" onmouseout="this.style.opacity=\'1\'">' +
      _monthNames[m-1].substring(0,3) + '</button>';
  }).join('');

  var navBar = '<div style="position:sticky;top:0;z-index:20;background:var(--bg1);' +
    'padding:8px 0 8px;margin-bottom:16px;' +
    'border-bottom:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;">' +
    navChips + '</div>';

  var content = sections || '<div class="empty" style="padding:40px; text-align:center; color:var(--text3);">No staff scheduled for this month.</div>';

  return navBar + content;
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
    return `<th class="arr-th-day${isToday ? ' arr-th-today' : ''}" style="min-width:98px;text-align:center;padding:8px 4px;vertical-align:middle;">
      <div style="font-size:11px;font-weight:700;">${dayLabel}</div>
      <div style="font-size:9px;opacity:0.6;font-weight:400;margin-bottom:4px;">${d}</div>
      <button class="btn" onclick="openCopyDayModal('${d}')" title="Copy assignments for this day" style="padding:2px 6px;font-size:9px;line-height:1;border-radius:4px;background:var(--bg3);color:var(--text2);border:1px solid var(--border);cursor:pointer;display:inline-flex;align-items:center;gap:3px;margin:0 auto;">
        <span>📋</span><span>Copy</span>
      </button>
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
      var arrIsHalfDay = arrAttParsed && (arrAttParsed.type === 'HD1' || arrAttParsed.type === 'HD2');

      if (arrIsOff || arrIsHalfDay) {
        var _offBg = {'A':'rgba(234,179,8,.13)','H':'rgba(220,38,38,.13)','0':'rgba(22,163,74,.13)','U':'rgba(225,29,72,.12)','S':'rgba(234,88,12,.12)','L':'rgba(8,145,178,.12)'};
        var _offFg = {'A':'#ca8a04','H':'#dc2626','0':'#16a34a','U':'#e11d48','S':'#ea580c','L':'#0891b2'};
        var _ck = String(arrAttCode).replace(/\.0$/,'').toUpperCase();
        var _cbg = _offBg[_ck] || 'rgba(59,130,246,.13)';
        var _cfg = _offFg[_ck] || '#3b82f6';
        return `<td class="arr-cell${isToday ? ' arr-cell-today' : ''}" style="background:${_cbg};pointer-events:none;text-align:center;vertical-align:middle;">
          <span style="font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:${_cfg};">${_ck}</span>
        </td>`;
      }

      const br = getAssigned(u.id, d) || getAssigned(u.id, dn);
      const br_idx = br ? _slotIndex(br.slot, currentShift) : -1;

      function _nd(s) { return (s || '').replace(/[\u2012\u2013\u2014\u002D]/g, '-').replace(/\s/g, ''); }

      if (arrangeViewMode === 'overview') {
        let badgeStyle, badgeText, badgeClass;
        if (br_idx === 0) {
          badgeClass = 'arr-slot arr-slot-1 arr-slot-on';
          badgeStyle = 'min-width:32px;height:20px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;';
          badgeText = `${currentShift}1`;
        } else if (br_idx === 1) {
          badgeClass = 'arr-slot arr-slot-2 arr-slot-on';
          badgeStyle = 'min-width:32px;height:20px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;';
          badgeText = `${currentShift}2`;
        } else if (br_idx >= 2) {
          badgeClass = `arr-slot arr-slot-${br_idx + 1} arr-slot-on`;
          badgeStyle = 'min-width:32px;height:20px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;';
          badgeText = `${currentShift}${br_idx + 1}`;
        } else {
          badgeClass = 'arr-slot arr-slot-off';
          badgeStyle = 'min-width:32px;height:20px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;opacity:0.55;';
          badgeText = '?';
        }

        return `<td class="arr-cell${isToday ? ' arr-cell-today' : ''}">
          <div style="display:flex;justify-content:center;align-items:center;">
            <span class="${badgeClass}" style="${badgeStyle}" onclick="cycleAssignSlot(${u.id},'${d}')" title="${br ? br.slot : 'Not assigned — click to cycle'}">
              ${badgeText}
            </span>
          </div>
        </td>`;
      }

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
  
  // Dynamic summary bar update
  const weekRange = getWeekRange(activeMonday);
  const allMates = state.users.filter(u => {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul == null || _ul >= 2) return false;
    return weekRange.some(d => _getSched(u.username, d) === currentShift);
  });
  const summaryEl = document.getElementById('arrange-summary-bar');
  if (summaryEl) {
    summaryEl.innerHTML = _getArrangeSummaryBarHTML(allMates, weekRange);
  }

  updateBadge();
}

// New: uses slot index instead of raw slot string in onclick — avoids en-dash encoding issues
function quickAssignByIndex(uid, day, slotIdx) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  const slots = BREAK_SLOTS[currentShift] || [];
  if (slotIdx < 0 || slotIdx >= slots.length) { toast('Invalid slot.', 'err'); return; }
  quickAssign(uid, day, currentShift + (slotIdx + 1));
}

function cycleAssignSlot(uid, day) {
  if (!isLeader(currentUser)) { toast('Only leaders can assign breaks.', 'err'); return; }
  const slots = BREAK_SLOTS[currentShift] || [];
  const br = getAssigned(uid, day);
  const curIdx = br ? _slotIndex(br.slot, currentShift) : -1;
  
  let nextIdx = curIdx + 1;
  if (nextIdx >= slots.length) {
    // Unassign break
    delete state.breaks[`${uid}_${day}`];
    save();
    if (syncEnabled()) syncPush();
    toast('Break removed');
  } else {
    // Assign next slot
    const slot = currentShift + (nextIdx + 1);
    assign(uid, day, slot, '');
    toast(`Break assigned: ${getShortSlot(currentShift, slot) || slot}`);
  }
  
  var wrap = document.querySelector('.arr-table-wrap');
  var _sT = wrap ? wrap.scrollTop : 0;
  var _sL = wrap ? wrap.scrollLeft : 0;
  if (wrap) { wrap.outerHTML = getArrangeDayMemberList(null); }
  else { const c = document.getElementById('arrange-day-content'); if (c) c.innerHTML = getArrangeDayMemberList(null); }
  var newWrap = document.querySelector('.arr-table-wrap');
  if (newWrap) { newWrap.scrollTop = _sT; newWrap.scrollLeft = _sL; }
  
  // Dynamic summary bar update
  const weekRange = getWeekRange(activeMonday);
  const allMates = state.users.filter(u => {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul == null || _ul >= 2) return false;
    return weekRange.some(d => _getSched(u.username, d) === currentShift);
  });
  const summaryEl = document.getElementById('arrange-summary-bar');
  if (summaryEl) {
    summaryEl.innerHTML = _getArrangeSummaryBarHTML(allMates, weekRange);
  }

  updateBadge();
}

function _selectBulkGroups(type) {
  var inputs = document.querySelectorAll('input[name="bulk-group"]');
  inputs.forEach(function(input) {
    if (type === 'all') {
      input.checked = true;
    } else if (type === 'none') {
      input.checked = false;
    } else if (type === 'da') {
      input.checked = input.getAttribute('data-da') === '1';
    } else if (type === 'ds') {
      input.checked = input.getAttribute('data-ds') === '1';
    }
  });
  _saveBulkGroups();
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

  if (!confirm("Are you sure you want to apply this break slot to all selected groups and days?")) {
    return;
  }

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

let _copySourceDay = null;

function openCopyDayModal(sourceDay) {
  _copySourceDay = sourceDay;
  const weekRange = getWeekRange(activeMonday);
  const dayLabel = getWkDay(sourceDay);
  
  // Set modal title
  document.getElementById('copy-day-title').innerHTML = `📋 Copy Breaks from ${dayLabel} (${sourceDay})`;
  
  // Generate checkable target days list (excluding source day)
  const targetList = document.getElementById('copy-day-target-list');
  if (targetList) {
    targetList.innerHTML = weekRange
      .filter(d => d !== sourceDay)
      .map(d => {
        const dl = getWkDay(d);
        return `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;margin:0;">
          <input type="checkbox" name="copy-target-day" value="${d}" style="margin:0;cursor:pointer;width:16px;height:16px;">
          <div style="display:flex;flex-direction:column;gap:1px;cursor:pointer;">
            <span style="font-size:12px;font-weight:600;color:var(--text);">${dl}</span>
            <span style="font-size:10px;color:var(--text3);">${d}</span>
          </div>
        </label>`;
      }).join('');
  }
  
  document.getElementById('modal-copy-day').classList.add('show');
}

function confirmCopyDay() {
  if (!_copySourceDay) return;
  
  // Get selected target days
  const checkedEls = document.querySelectorAll('input[name="copy-target-day"]:checked');
  if (checkedEls.length === 0) {
    toast('Please select at least one target day.', 'err');
    return;
  }
  
  const targetDays = Array.from(checkedEls).map(el => el.value);
  
  // Get all visible mates (analysts/supervisors level 0-1)
  const allMates = state.users.filter(u => {
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    return _ul != null && _ul < 2;
  });
  
  let copiedCount = 0;
  
  targetDays.forEach(td => {
    allMates.forEach(u => {
      // Get source day break assignment
      const srcBrk = getAssigned(u.id, _copySourceDay);
      if (srcBrk && srcBrk.slot) {
        // Only assign if the user is scheduled on target day for the current shift
        const onShift = _getSched(u.username, td) === currentShift;
        if (onShift) {
          assign(u.id, td, srcBrk.slot, `Copied from ${_copySourceDay} by ${currentUser.name}`);
          copiedCount++;
        }
      }
    });
  });
  
  closeModal('modal-copy-day');
  toast(`Successfully applied break assignments to ${targetDays.length} day(s).`, 'ok');
  nav('arrange');
}

// ═══════════════════════════════════════════════
//  RENDER: STAFF — 2 sub-tabs
//  Tab 1: Staff Info (from Excel import)
//  Tab 2: Staff Schedule (shift grid, no gender col)
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
