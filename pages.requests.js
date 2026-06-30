function renderRequests() {
  if (!_reqFilterYM) _reqFilterYM = currentMonthKey();
  const filterYM = _reqFilterYM;

  const allReqs = state.requests.filter(r => {
    // Hide self-cancelled requests from all users
    if (r.respNote === 'Cancelled by requester.') return false;

    const isOwn = r.userId === currentUser.id || r.targetId === currentUser.id || r.swapPartnerId === currentUser.id;

    if (isLeader(currentUser) || isTraining(currentUser)) {
      if (isTraining(currentUser)) return true;
      const requester = state.users.find(u => u.id === r.userId);
      var reqShift = r.shift;
      if (!reqShift && requester) {
        if (r.type === 'dayoff-swap') {
          var weekDates = _dosGetWeekDates(r.myDate);
          for (var i = 0; i < weekDates.length; i++) {
            var s = _getSched(requester.username, weekDates[i]);
            if (s && s !== '0') { reqShift = s; break; }
          }
        } else {
          reqShift = _getSched(requester.username, r.day);
        }
      }
      if (!reqShift) reqShift = 'A';
      return isOwn || (reqShift === currentShift);
    }

    return isOwn;
  });

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
      return '<div class="req-card ' + r.status + '" data-status="' + r.status + '" data-scope="day-off">' +
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
    const _tNowReq = new Date();
    const _todayDkReq = String(_tNowReq.getDate()).padStart(2,'0') + '/' + String(_tNowReq.getMonth()+1).padStart(2,'0');
    const _toNumReq = dk => { const p = dk.split('/'); return parseInt(p[1])*100 + parseInt(p[0]); };
    const _todayNumReq = _toNumReq(_todayDkReq);
    const _futureDays = (r.swapDays || []).filter(dk => _toNumReq(dk) > _todayNumReq);
    const dateLabel = isWeek
      ? (_futureDays.length > 0 ? _futureDays[0] + '–' + _futureDays[_futureDays.length - 1] : 'Week')
      : (r.day || '—');

    // Impact table (week swaps, leader pending view)
    let impactHTML = '';
    if (r.status === 'pending' && isLeader(currentUser) && !isOwn && isWeek && partner) {
      const allDays = r.swapDays || [];
      const weekSet = new Set(getWeekDates(r.day));
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

    return '<div class="req-card ' + r.status + '" data-status="' + r.status + '" data-scope="' + (isWeek ? 'week' : 'day') + '">'
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
      + (r.status === 'pending' && currentUser.id === r.swapPartnerId
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

  const cntScopeAll = myReqs.length;
  const cntScopeDay = myReqs.filter(r => r.type !== 'dayoff-swap' && r.swapWeek !== true).length;
  const cntScopeWeek = myReqs.filter(r => r.type !== 'dayoff-swap' && r.swapWeek === true).length;
  const cntScopeDayoff = myReqs.filter(r => r.type === 'dayoff-swap').length;

  const statusActive = (s) => {
    if (_reqStatusFilter === s) {
      if (s === 'all') return ' f-all';
      if (s === 'pending') return ' f-pending';
      if (s === 'approved') return ' f-approved';
      if (s === 'rejected') return ' f-rejected';
    }
    return '';
  };

  const scopeActiveStyle = (s) => {
    if (_reqScopeFilter === s) {
      if (s === 'all') return 'class="req-filter-btn f-all"';
      if (s === 'day') return 'class="req-filter-btn" style="border-color:var(--text3);color:var(--text);background:var(--bg2);"';
      if (s === 'week') return 'class="req-filter-btn" style="border-color:var(--B-color);color:var(--B-color);background:var(--B-bg);"';
      if (s === 'day-off') return 'class="req-filter-btn" style="border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.13);"';
    }
    return 'class="req-filter-btn"';
  };

  const filterBar = '<div class="req-filter-bar status-filter-bar" style="margin-bottom: 8px;">'
    + '<button class="req-filter-btn' + statusActive('all') + '" onclick="_reqSetFilter(\'all\')">All <span class="req-filter-cnt">' + cntAll + '</span></button>'
    + '<button class="req-filter-btn' + statusActive('pending') + '" onclick="_reqSetFilter(\'pending\')">Pending <span class="req-filter-cnt">' + cntPending + '</span></button>'
    + '<button class="req-filter-btn' + statusActive('approved') + '" onclick="_reqSetFilter(\'approved\')">Approved <span class="req-filter-cnt">' + cntApproved + '</span></button>'
    + '<button class="req-filter-btn' + statusActive('rejected') + '" onclick="_reqSetFilter(\'rejected\')">Rejected <span class="req-filter-cnt">' + cntRejected + '</span></button>'
    + '</div>'
    + '<div class="req-filter-bar scope-filter-bar" style="margin-bottom: 18px;">'
    + '<button ' + scopeActiveStyle('all') + ' onclick="_reqSetScopeFilter(\'all\')">All Types <span class="req-filter-cnt">' + cntScopeAll + '</span></button>'
    + '<button ' + scopeActiveStyle('day') + ' onclick="_reqSetScopeFilter(\'day\')">Single Day <span class="req-filter-cnt">' + cntScopeDay + '</span></button>'
    + '<button ' + scopeActiveStyle('week') + ' onclick="_reqSetScopeFilter(\'week\')">Whole Week <span class="req-filter-cnt">' + cntScopeWeek + '</span></button>'
    + '<button ' + scopeActiveStyle('day-off') + ' onclick="_reqSetScopeFilter(\'day-off\')">Day-Off <span class="req-filter-cnt">' + cntScopeDayoff + '</span></button>'
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
  _reqStatusFilter = f;
  document.querySelectorAll('.status-filter-bar .req-filter-btn').forEach(b => {
    b.className = 'req-filter-btn';
    const t = b.textContent.trim().toLowerCase();
    if (f === 'all' && t.startsWith('al')) b.classList.add('f-all');
    if (f === 'pending' && t.startsWith('pe')) b.classList.add('f-pending');
    if (f === 'approved' && t.startsWith('ap')) b.classList.add('f-approved');
    if (f === 'rejected' && t.startsWith('re')) b.classList.add('f-rejected');
  });
  _applyReqFilters();
}

function _reqSetScopeFilter(f) {
  _reqScopeFilter = f;
  document.querySelectorAll('.scope-filter-bar .req-filter-btn').forEach(b => {
    b.className = 'req-filter-btn';
    b.style.borderColor = '';
    b.style.color = '';
    b.style.background = '';
    const t = b.textContent.trim().toLowerCase();
    if (f === 'all' && t.startsWith('all')) {
      b.classList.add('f-all');
    }
    if (f === 'day' && t.startsWith('single')) {
      b.style.borderColor = 'var(--text3)';
      b.style.color = 'var(--text)';
      b.style.background = 'var(--bg2)';
    }
    if (f === 'week' && t.startsWith('whole')) {
      b.style.borderColor = 'var(--B-color)';
      b.style.color = 'var(--B-color)';
      b.style.background = 'var(--B-bg)';
    }
    if (f === 'day-off' && t.startsWith('day-off')) {
      b.style.borderColor = '#6366f1';
      b.style.color = '#6366f1';
      b.style.background = 'rgba(99,102,241,.13)';
    }
  });
  _applyReqFilters();
}

function _applyReqFilters() {
  let visible = 0;
  document.querySelectorAll('#req-cards-list .req-card').forEach(c => {
    const matchStatus = _reqStatusFilter === 'all' || c.dataset.status === _reqStatusFilter;
    const matchScope = _reqScopeFilter === 'all' || c.dataset.scope === _reqScopeFilter;
    const show = matchStatus && matchScope;
    c.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  let emp = document.getElementById('req-filter-empty');
  if (!visible) {
    if (!emp) {
      emp = document.createElement('div');
      emp.id = 'req-filter-empty';
      emp.className = 'empty';
      emp.style.gridColumn = '1/-1';
      emp.innerHTML = '<div class="empty-ico">🔍</div>No matching requests.';
      document.getElementById('req-cards-list').appendChild(emp);
    }
  } else if (emp) {
    emp.remove();
  }
}

// ═══════════════════════════════════════════════
//  RENDER: ARRANGE (leader only)
//  Tab 1: Arrange Breaks (bulk panel + day tabs)
//  Tab 2: Week Overview (full grid)
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
      localStorage.setItem('_ssActiveMonday', _ssActiveMonday);
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
    resolvedAt: null,
    shift: currentShift
  });
  syncWrite();
  closeModal('modal-dayoff-swap');
  toast('Day-off swap request submitted', 'ok');
  nav('requests');
}

// ═══════════════════════════════════════════════
//  EXCEL IMPORT — Staff Info (SheetJS)
// ═══════════════════════════════════════════════

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
  let optionsHTML = '';
  if (displayDays.length > 0) {
    const sortedDays = _sortDateKeys(displayDays);
    const curWeekDates = getWeekDates();
    const [curMonD, curMonM] = curWeekDates[0].split('/').map(Number);
    const nextMonDate = new Date(2026, curMonM - 1, curMonD + 7);
    const nextMonStr = `${nextMonDate.getDate().toString().padStart(2,'0')}/${(nextMonDate.getMonth()+1).toString().padStart(2,'0')}`;
    const nextWeekDates = getWeekDates(nextMonStr);

    const curWeekDays = sortedDays.filter(d => curWeekDates.includes(d));
    const nextWeekDays = sortedDays.filter(d => nextWeekDates.includes(d));
    const laterDays = sortedDays.filter(d => !curWeekDates.includes(d) && !nextWeekDates.includes(d));

    const buildOptions = (days) => {
      return days.map(d => {
        const br = getAssigned(currentUser.id, d) || getAssigned(currentUser.id, getWkDay(d));
        const slot = br ? ` (${getShortSlot(currentShift, br.slot)})` : ' (no break)';
        return `<option value="${d}">${d} ${getWkDay(d)}${slot}</option>`;
      }).join('');
    };

    if (curWeekDays.length > 0) {
      optionsHTML += `<optgroup label="Current Week">${buildOptions(curWeekDays)}</optgroup>`;
    }
    if (nextWeekDays.length > 0) {
      optionsHTML += `<optgroup label="Next Week">${buildOptions(nextWeekDays)}</optgroup>`;
    }
    if (laterDays.length > 0) {
      optionsHTML += `<optgroup label="Later Weeks">${buildOptions(laterDays)}</optgroup>`;
    }
  }
  daySelect.innerHTML = optionsHTML || `<option value="">No upcoming shift days found</option>`;



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
    // Only use selected week dates
    const weekDates = getWeekDates(day);
    // Build today's dd/MM key to exclude past days from the swap range
    const _now = new Date();
    const _todayKey = String(_now.getDate()).padStart(2,'0') + '/' + String(_now.getMonth()+1).padStart(2,'0');
    const _toNum = dk => { const p = dk.split('/'); return parseInt(p[1])*100 + parseInt(p[0]); };
    const _todayNum = _toNum(_todayKey);
    swapDays = weekDates.filter(dk => {
      if (_toNum(dk) <= _todayNum) return false; // skip past days (including today)
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
    shift: currentShift
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
