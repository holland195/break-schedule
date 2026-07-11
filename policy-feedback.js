// ═══════════════════════════════════════════════
//  POLICY FEEDBACK — Agent-facing page
//  All roles can access.
//
//  Agent/Sr Agent/QA/Sr QA:
//   - See their own violations first
//   - Can write a feedback/response on each
//   - Badge on sidebar shows unread count
//   - Can switch to "My Team" tab to view all
//
//  Leader/Supervisor/Admin:
//   - Lands directly on full team view
//   - Can read all agent feedback
//   - Badge shows records with unread feedback
//
//  Embedded inside the unified Policy page.
// ═══════════════════════════════════════════════

// ── Page state ──
let _fbTab = 'mine'; // 'mine' | 'team'
var _fbSelectedUser = '';

// ── Helpers ──
function _fbData() {
  if (typeof _pcInit === 'function') _pcInit();
  return state.policyCompliance || [];
}

function _fbIsAgent(u) {
  return u && (ROLES[_resolveRole(u.role)]?.level || 0) < 2;
}

function _fbRoleMode(user) {
  if (typeof isTraining === 'function' && isTraining(user)) return 'training';
  if (typeof isLeader === 'function' && isLeader(user)) return 'lead';
  return 'personal';
}

function _fbMyRecords() {
  return _fbData().filter(function(r) {
    return r.username === currentUser.username || r.empNo === (state.staffInfo?.[currentUser.username]?.empNo || '__');
  });
}

function _fbUnreadCount() {
  if (_fbIsAgent(currentUser)) {
    return _fbMyRecords().filter(function(r) { return r.status === 'Processing'; }).length;
  }
  if (typeof isTraining === 'function' && isTraining(currentUser)) {
    var reviewCount = _fbData().filter(function(r) { return r.status === 'Need Review' || r.status === 'Need Resolve'; }).length;
    return reviewCount + (typeof _pcTrainingNewCount === 'function' ? _pcTrainingNewCount() : 0);
  }
  var ownActive = _fbMyRecords().filter(function(r) {
    return r.status === 'Processing';
  }).length;
  var teamUnread = _fbData().filter(function(r) {
    return (r.agentFeedback || r.agentDone) && !r.feedbackReadByLeader && r.status !== 'Resolved' && r.status !== 'Cancelled';
  }).length;
  return ownActive + teamUnread;
}

function updateFeedbackBadge() {
  var el = document.getElementById('pc-badge');
  if (!el) return;
  var n = _fbUnreadCount();
  el.textContent = n;
  el.style.display = n > 0 ? '' : 'none';
}

function _fbTimeSince(ts) {
  if (!ts) return '';
  var d = Date.now() - ts;
  if (d < 60000)    return 'just now';
  if (d < 3600000)  return Math.floor(d/60000) + 'm ago';
  if (d < 86400000) return Math.floor(d/3600000) + 'h ago';
  return Math.floor(d/86400000) + 'd ago';
}

function _fbEventLabel(ev) {
  var map = {
    '1a':'Absent w/o notice','1b':'Leave notice','1c':'Leave limit','1d':'Late / early',
    '2a':'PAVE hours','2b':'Late login','2c':'Early logout','2d':'Unauthorized OT',
    '2e':'Break timing','2f':'Break overtime',
    '3a':'PAVE steps','3b':'Left workstation','3c':'Performance','3d':'Slack offline',
    '3e':'Slack notify','3f':'Slow response','3g':'WFH camera','3h':'Incident unreported','3i':'Disobedience',
    '4a':'Property misuse','4b':'Hygiene','4c':'Smoking area','4d':'Noise'
  };
  return map[ev] || ev;
}

var _FB_STATUS_COLORS = {
  'Processing':   '#d97706',
  'Need Review':  'var(--err)',
  'Need Resolve': 'var(--accent)',
  'Resolved':     'var(--ok)',
  'Cancelled':    'var(--text3)',
};
function _fbStatusDot(s) {
  return '<span class="fb-status-dot fb-status-' + _fbStatusClass(s) + '" aria-hidden="true"></span>';
}
function _fbStatusColor(s) {
  return _FB_STATUS_COLORS[s] || 'var(--warn)';
}
function _fbStatusClass(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'processing';
}
function _fbHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
  });
}
function _fbJsArg(v) {
  return JSON.stringify(String(v == null ? '' : v));
}
function _fbInitial(name) {
  var s = String(name || '?').trim();
  return _fbHtml((s.charAt(0) || '?').toUpperCase());
}
function _fbStatusCount(records, status) {
  return records.filter(function(r) { return r.status === status; }).length;
}
function _fbOpenCount(records) {
  return records.filter(function(r) { return r.status !== 'Resolved' && r.status !== 'Cancelled'; }).length;
}

// ════════════════════════════════════════════
//  MY VIOLATIONS TAB (agent view)
// ════════════════════════════════════════════
function _fbRenderMine() {
  var records  = _fbMyRecords().slice().sort(function(a,b){
    var dComp = (b.date||'').localeCompare(a.date||'');
    if (dComp !== 0) return dComp;
    if (a.time && b.time) {
      var tComp = b.time.localeCompare(a.time);
      if (tComp !== 0) return tComp;
    }
    return b.no - a.no;
  });
  if (records.length === 0) {
    return '<div class="fb-empty-state" style="text-align:center;padding:64px 16px;color:var(--text3);">'
      + '<div style="font-size:36px;margin-bottom:12px;">🎉</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">You have a clean record!</div>'
      + '<div style="font-size:12px;">No policy records have been reported. Keep up the great work!</div>'
      + '</div>';
  }

  var pending = records.filter(function(r) { return r.status === 'Processing'; }).length;

  var banner = pending > 0
    ? '<div class="fb-alert fb-alert-warn" role="status">You have <b>' + pending + '</b> policy record(s) awaiting your response.</div>'
    : '<div class="fb-alert fb-alert-ok" role="status">All policy records acknowledged.</div>';

  var cards = records.map(function(r) {
    var realIdx  = _fbData().indexOf(r);
    var hasFb    = !!r.agentFeedback;
    var hasDone  = !!r.agentDone;
    var hasReply = hasFb || hasDone;
    var isResolved  = r.status === 'Resolved';
    var isCancelled = r.status === 'Cancelled';
    var needsReply  = r.status === 'Processing';

    var feedbackSection = hasDone
      ? '<div class="fb-response-box fb-response-ok">Acknowledged - no objection.</div>'
      : hasFb
        ? '<div class="fb-response-box">'
          + '<div class="fb-response-text">' + _fbHtml(r.agentFeedback) + '</div>'
          + '<div class="fb-response-time">' + _fbHtml(_fbTimeSince(r.agentFeedbackAt)) + '</div>'
          + '<button type="button" onclick="_fbOpenFeedback(' + realIdx + ')" class="btn btn-xs fb-response-edit">Edit</button>'
          + '</div>'
        : (isResolved || isCancelled)
          ? '<div class="fb-muted-note">'+(isCancelled?'This violation was cancelled.':'This violation has been resolved.')+'</div>'
          : '<div class="fb-response-form">'
            + '<label class="sr-only" for="fb-text-' + realIdx + '">Response for ' + _fbHtml(r.event) + '</label>'
            + '<textarea id="fb-text-' + realIdx + '" name="violation_response_' + realIdx + '" autocomplete="off" placeholder="Write your comment if you disagree or have context to add&hellip;" class="fb-textarea"></textarea>'
            + '<div class="fb-card-actions">'
            + '<button type="button" class="btn btn-ok" onclick="_fbMarkDone(' + realIdx + ')">Done - I Agree</button>'
            + '<button type="button" class="btn btn-accent" onclick="_fbSubmitFeedback(' + realIdx + ')">Submit Comment</button>'
            + '</div>'
            + '<div id="fb-msg-' + realIdx + '" class="fb-inline-msg" aria-live="polite"></div>'
            + '</div>';

    return '<article class="fb-card">'
      + '<div class="fb-card-top">'
      + '<div class="fb-card-title-row">'
      + '<span class="fb-code-pill">' + _fbHtml(r.event) + '</span>'
      + '<span class="fb-event-label">' + _fbHtml(_fbEventLabel(r.event)) + '</span>'
      + '<span class="fb-date">' + _fbHtml(r.date + (r.time ? ' ' + r.time : '')) + '</span>'
      + '</div>'
      + '<div class="fb-status-line">'
      + _fbStatusDot(r.status)
      + '<span class="fb-status-text fb-status-text-' + _fbStatusClass(r.status) + '">' + _fbHtml(r.status) + '</span>'
      + (r.leader ? '<span class="fb-card-creator" style="margin-left:auto;font-size:11px;color:var(--text3);">Reported by: <span style="color:var(--text2);font-weight:600;">' + _fbHtml(r.leader) + '</span></span>' : '')
      + '</div>'
      + '</div>'
      + (r.description ? '<div class="fb-description">' + _fbHtml(r.description) + '</div>' : '')
      + '<div class="fb-card-state ' + (hasReply ? 'is-ok' : isResolved || isCancelled ? 'is-muted' : 'is-warn') + '">'
      + (hasDone ? 'You acknowledged - forwarded to Training' : hasFb ? 'Your response - forwarded to Training' : isResolved ? 'Resolved' : isCancelled ? 'Cancelled' : 'Your Response Needed')
      + '</div>'
      + feedbackSection
      + '</article>';
  }).join('');

  var metrics = '<div class="fb-metrics">'
    + '<div class="fb-metric"><span>Action Needed</span><b>' + pending + '</b></div>'
    + '<div class="fb-metric"><span>Open</span><b>' + _fbOpenCount(records) + '</b></div>'
    + '<div class="fb-metric"><span>Resolved</span><b>' + _fbStatusCount(records, 'Resolved') + '</b></div>'
    + '</div>';

  return metrics + banner + '<div class="fb-card-stack">' + cards + '</div>';
}

function _fbMarkDone(realIdx) {
  state.policyCompliance[realIdx].agentDone        = true;
  state.policyCompliance[realIdx].agentDoneAt      = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = false;
  state.policyCompliance[realIdx].status           = 'Need Resolve';
  state._policyComplianceUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  updateFeedbackBadge();
  _fbRerender();
}

// ════════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════════
function _fbRenderPageShell(isEmbedded) {
  var mode = _fbRoleMode(currentUser);
  var isAgent = mode === 'personal';

  if (!isAgent && _fbTab === 'mine') _fbTab = 'team';
  if (isAgent && !_fbTab) _fbTab = 'mine';

  var tabBar = '';
  if (isAgent) {
    var myCount   = _fbMyRecords().length;
    var teamCount = _fbData().length;
    tabBar = '<div class="fb-subtabs fb-subtabs-personal" role="tablist" aria-label="Policy ownership">'
      + _fbTabBtn('mine',  'My Policy', myCount)
      + _fbTabBtn('team',  'My Team',       teamCount)
      + '</div>';
  }

  var content = (_fbTab === 'mine') ? _fbRenderMine() : _fbRenderTeam();

  var title = mode === 'training' ? 'Training Policy Queue' : isAgent ? 'My Policy' : 'Team Policy';
  var sub = isAgent
  ? (_fbMyRecords().length + ' records &middot; ' + _fbMyRecords().filter(function(r){
      return r.status !== 'Resolved' && !r.agentFeedback && !r.agentDone;
    }).length + ' awaiting your response')
  : mode === 'training'
    ? (_fbData().length + ' total &middot; ' + _fbData().filter(function(r){
        return r.status === 'Need Review' || r.status === 'Need Resolve';
      }).length + ' needing Training action')
    : (_fbData().length + ' total &middot; ' + _fbData().filter(function(r){
        return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved';
      }).length + ' with new employee feedback');
  var roleChip = '<span class="fb-role-chip fb-role-' + mode + '">' + (mode === 'training' ? 'Training' : mode === 'lead' ? 'Lead/Sub' : 'Employee') + '</span>';
  var header = isEmbedded
    ? '<div class="fb-section-head fb-section-' + mode + '"><div><div class="fb-section-title-row"><h2>' + title + '</h2>' + roleChip + '</div><div class="fb-section-sub">' + sub + '</div></div></div>'
    : '<div class="page-header"><div><div class="page-title">' + title + '</div><div class="page-sub">' + sub + '</div></div></div>';
  return '<section class="fb-workspace fb-workspace-' + mode + '">' + header + tabBar + '<div id="fb-content">' + content + '</div></section>';
}

function renderPolicyFeedback() {
  return _fbRenderPageShell(false);
}

function _fbRenderEmbedded() {
  return _fbRenderPageShell(true);
}

function _fbTabBtn(id, label, count) {
  var on = _fbTab === id;
  return '<button type="button" role="tab" aria-selected="' + (on ? 'true' : 'false') + '" onclick="_fbTab=\'' + id + '\';_pcTab=\'violations\';nav(\'policy\')" class="fb-tab' + (on ? ' on' : '') + '">'
    + _fbHtml(label)
    + ' <span class="fb-tab-count">' + count + '</span>'
    + '</button>';
}



// ════════════════════════════════════════════
//  TEAM TAB — split-panel layout
// ════════════════════════════════════════════

function _fbGetGroups() {
  var records = _fbData().slice().sort(function(a,b){
    var dComp = (b.date||'').localeCompare(a.date||'');
    if (dComp !== 0) return dComp;
    if (a.time && b.time) {
      var tComp = b.time.localeCompare(a.time);
      if (tComp !== 0) return tComp;
    }
    return b.no - a.no;
  });
  var _search = window._fbTeamSearch || '';
  var _sfilt  = window._fbTeamStatus || '';
  var filtered = records.filter(function(r) {
    if (_sfilt && r.status !== _sfilt) return false;
    if (_search) {
      var q = _search.toLowerCase();
      if (!(r.name||'').toLowerCase().includes(q) && !(r.username||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  var byPerson = {};
  filtered.forEach(function(r) {
    var key = r.username || r.name;
    if (!byPerson[key]) byPerson[key] = { name: r.name, username: r.username, role: r.role, records: [] };
    byPerson[key].records.push(r);
  });
  return Object.values(byPerson).sort(function(a, b) {
    var newFbA = a.records.filter(function(r) { return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved' && r.status !== 'Cancelled'; }).length;
    var newFbB = b.records.filter(function(r) { return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved' && r.status !== 'Cancelled'; }).length;
    if (newFbA !== newFbB) return newFbB - newFbA;

    var activeA = a.records.filter(function(r) { return r.status !== 'Resolved' && r.status !== 'Cancelled'; }).length;
    var activeB = b.records.filter(function(r) { return r.status !== 'Resolved' && r.status !== 'Cancelled'; }).length;
    if (activeA !== activeB) return activeB - activeA;

    return b.records.length - a.records.length;
  });
}

function _fbRenderPersonList(groups) {
  if (groups.length === 0) {
    return '<div class="fb-empty fb-empty-compact">No records match.</div>';
  }
  return groups.map(function(g) {
    var isActive  = g.username === _fbSelectedUser;
    var isMe      = g.username === currentUser.username;
    var newFb     = g.records.filter(function(r) { return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved'; }).length;
    var responded = g.records.filter(function(r) { return r.agentFeedback || r.agentDone; }).length;
    return '<button type="button" data-fb-person="' + _fbHtml(g.username) + '" onclick="_fbSelectPerson(' + _fbJsArg(g.username) + ')" class="fb-person' + (isActive ? ' is-active' : '') + '">'
      + '<span class="fb-avatar" aria-hidden="true">' + _fbInitial(g.name) + '</span>'
      + '<span class="fb-person-main">'
      + '<span class="fb-person-name">' + _fbHtml(g.name) + (isMe ? ' <span class="fb-you">you</span>' : '') + '</span>'
      + '<span class="fb-person-role">' + _fbHtml(_resolveRole(g.role)||g.role||'') + '</span>'
      + '</span>'
      + '<span class="fb-person-meta">'
      + '<span class="fb-count-pill">' + g.records.length + '</span>'
      + (newFb > 0 && isLeader(currentUser) ? '<span class="fb-count-pill is-new">' + newFb + ' new</span>' : '')
      + (responded > 0 && newFb === 0 ? '<span class="fb-count-pill is-ok">Done</span>' : '')
      + '</span>'
      + '</button>';
  }).join('');
}

function _fbRenderPersonDetail(username, groups) {
  if (!username) {
    return '<div class="fb-empty">Select a person from the list to view their policy records.</div>';
  }
  var g = null;
  for (var gi = 0; gi < groups.length; gi++) { if (groups[gi].username === username) { g = groups[gi]; break; } }
  if (!g) {
    return '<div class="fb-empty">No records for this person match the current filter.</div>';
  }
  var newFb = g.records.filter(function(r) { return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved'; }).length;
  var header = '<div class="fb-detail-head">'
    + '<div class="fb-detail-person">'
    + '<span class="fb-avatar fb-avatar-lg" aria-hidden="true">' + _fbInitial(g.name) + '</span>'
    + '<span class="fb-person-main">'
    + '<span class="fb-detail-name">' + _fbHtml(g.name) + '</span>'
    + '<span class="fb-person-role">' + _fbHtml(g.username||'') + ' &middot; ' + _fbHtml(_resolveRole(g.role)||g.role||'') + '</span>'
    + '</span>'
    + '</div>'
    + '<div class="fb-detail-badges">'
    + '<span class="fb-count-pill">' + g.records.length + ' policy record' + (g.records.length !== 1 ? 's' : '') + '</span>'
    + (newFb > 0 && isLeader(currentUser) ? '<span class="fb-count-pill is-new">' + newFb + ' new</span>' : '')
    + '</div>'
    + '</div>';

  function renderCard(r) {
    var realIdx = _fbData().indexOf(r);
    var hasFb   = !!r.agentFeedback;
    var isNewFb = hasFb && !r.feedbackReadByLeader && isLeader(currentUser) && r.status !== 'Resolved';

    var responseBadge = '';
    if (r.status === 'Resolved' || r.status === 'Cancelled') {
      responseBadge = '';
    } else if (r.agentFeedback) {
      responseBadge = '<span class="fb-mini-badge is-feedback">Feedback</span>';
    } else if (r.agentDone) {
      responseBadge = '<span class="fb-mini-badge is-ok">Acknowledged</span>';
    } else {
      responseBadge = '<span class="fb-mini-badge is-warn">Awaiting Reply</span>';
    }

    var responseHtml = '';
    if (r.agentFeedback) {
      responseHtml = '<div class="fb-response-box is-feedback">'
        + '<div class="fb-response-label">Employee Feedback' + (isNewFb ? ' <span class="fb-new-tag">New</span>' : '') + '</div>'
        + '<div class="fb-response-text">' + _fbHtml(r.agentFeedback) + '</div>'
        + '<div class="fb-response-time">' + _fbHtml(_fbTimeSince(r.agentFeedbackAt)) + '</div>'
        + (isNewFb && !isTraining(currentUser) ? '<button type="button" onclick="_fbMarkRead(' + realIdx + ')" class="btn btn-xs">Mark Read</button>' : '')
        + (isTraining(currentUser) && r.status !== 'Resolved' ? '<div class="fb-card-actions"><button type="button" onclick="_fbResolveRecord(' + realIdx + ')" class="btn btn-sm btn-ok">Mark Resolved</button></div>' : '')
        + '</div>';
    } else if (r.agentDone) {
      responseHtml = '<div class="fb-response-box fb-response-ok">'
        + '<div class="fb-response-label">Employee Acknowledged</div>'
        + '<div class="fb-response-time">' + _fbHtml(_fbTimeSince(r.agentDoneAt)) + '</div>'
        + (isTraining(currentUser) && r.status !== 'Resolved' ? '<div class="fb-card-actions"><button type="button" onclick="_fbResolveRecord(' + realIdx + ')" class="btn btn-sm btn-ok">Mark Resolved</button></div>' : '')
        + '</div>';
    } else {
      responseHtml = r.status === 'Processing'
        ? '<div class="fb-muted-note is-warn">Awaiting employee response.</div>'
        : '<div class="fb-muted-note">No response submitted.</div>';
    }

    return '<article class="fb-detail-card">'
      + '<div class="fb-detail-card-top">'
      + '<div class="fb-card-title-row">'
      + '<span class="fb-code-pill">' + _fbHtml(r.event) + '</span>'
      + '<span class="fb-event-label">' + _fbHtml(_fbEventLabel(r.event)) + '</span>'
      + '<span class="fb-date">' + _fbHtml(r.date + (r.time ? ' ' + r.time : '')) + '</span>'
      + responseBadge
      + '</div>'
      + '<div class="fb-status-line">'
      + _fbStatusDot(r.status)
      + '<span class="fb-status-text fb-status-text-' + _fbStatusClass(r.status) + '">' + _fbHtml(r.status) + '</span>'
      + (r.leader ? '<span class="fb-card-creator" style="margin-left:auto;font-size:11px;color:var(--text3);">Reported by: <span style="color:var(--text2);font-weight:600;">' + _fbHtml(r.leader) + '</span></span>' : '')
      + '</div>'
      + '</div>'
      + (r.description ? '<div class="fb-description">' + _fbHtml(r.description) + '</div>' : '')
      + responseHtml
      + '</article>';
  }

  var activeRecords = [];
  var historyRecords = [];
  g.records.forEach(function(r) {
    if (r.status === 'Resolved' || r.status === 'Cancelled') {
      historyRecords.push(r);
    } else {
      activeRecords.push(r);
    }
  });

  var activeHtml = activeRecords.length > 0
    ? activeRecords.map(renderCard).join('')
    : '<div class="fb-empty fb-empty-compact">No active policy records.</div>';

  var historyHtml = '';
  if (historyRecords.length > 0) {
    var collapsed = window._fbHistoryCollapsed !== false;
    historyHtml = '<div class="fb-history-head">'
      + '<span>Resolved &amp; Cancelled History (' + historyRecords.length + ')</span>'
      + '<button type="button" onclick="_fbToggleHistory()" class="btn btn-xs">' + (collapsed ? 'Show' : 'Hide') + '</button>'
      + '</div>'
      + (!collapsed ? historyRecords.map(renderCard).join('') : '');
  }

  var activeHeader = '<div class="fb-list-head">'
    + 'Active Policy Records (' + activeRecords.length + ')'
    + '</div>';

  return header + activeHeader + activeHtml + historyHtml;
}

function _fbToggleHistory() {
  window._fbHistoryCollapsed = !window._fbHistoryCollapsed;
  _fbRerender();
}

function _fbSelectPerson(username) {
  _fbSelectedUser = username;
  var groups = _fbGetGroups();
  var dp = document.getElementById('fb-detail-panel');
  if (dp) dp.innerHTML = _fbRenderPersonDetail(username, groups);
  document.querySelectorAll('[data-fb-person]').forEach(function(el) {
    var active = el.dataset.fbPerson === username;
    el.classList.toggle('is-active', active);
  });
}

function _fbRefreshSplit() {
  var groups = _fbGetGroups();
  var selMatch = null;
  for (var si = 0; si < groups.length; si++) { if (groups[si].username === _fbSelectedUser) { selMatch = groups[si]; break; } }
  if (!selMatch) _fbSelectedUser = groups.length > 0 ? groups[0].username : '';
  var lp = document.getElementById('fb-person-list');
  if (lp) lp.innerHTML = _fbRenderPersonList(groups);
  var dp = document.getElementById('fb-detail-panel');
  if (dp) dp.innerHTML = _fbRenderPersonDetail(_fbSelectedUser, groups);
  var totalRecs = 0;
  for (var ti = 0; ti < groups.length; ti++) totalRecs += groups[ti].records.length;
  var ct = document.getElementById('fb-team-count');
  if (ct) ct.textContent = totalRecs + ' records';
}

function _fbRenderTeam() {
  var _search = window._fbTeamSearch || '';
  var _sfilt  = window._fbTeamStatus || '';
  var mode    = _fbRoleMode(currentUser);
  var groups  = _fbGetGroups();
  var selMatch = null;
  for (var si = 0; si < groups.length; si++) { if (groups[si].username === _fbSelectedUser) { selMatch = groups[si]; break; } }
  if (!selMatch) _fbSelectedUser = groups.length > 0 ? groups[0].username : '';
  var totalRecs = 0;
  for (var ti = 0; ti < groups.length; ti++) totalRecs += groups[ti].records.length;
  var quickFilters = '';
  if (mode === 'training') {
    quickFilters = '<div class="fb-quick-filters" aria-label="Training status shortcuts">'
      + '<button type="button" class="fb-filter-chip' + (_sfilt === 'Need Review' ? ' on' : '') + '" onclick="window._fbTeamStatus=\'Need Review\';_fbRerender()">Need Review</button>'
      + '<button type="button" class="fb-filter-chip' + (_sfilt === 'Need Resolve' ? ' on' : '') + '" onclick="window._fbTeamStatus=\'Need Resolve\';_fbRerender()">Need Resolve</button>'
      + '<button type="button" class="fb-filter-chip' + (_sfilt === '' ? ' on' : '') + '" onclick="window._fbTeamStatus=\'\';_fbRerender()">All</button>'
      + '</div>';
  }
  var filterBar = '<div class="fb-toolbar fb-toolbar-' + mode + '" role="search">'
    + '<label class="sr-only" for="fb-team-search">Search by Name or Username</label>'
    + '<input type="search" id="fb-team-search" name="violation_team_search" autocomplete="off" value="' + _fbHtml(_search) + '" placeholder="Search by name or username&hellip;" oninput="window._fbTeamSearch=this.value;_fbRefreshSplit();" class="fb-control fb-search">'
    + '<label class="sr-only" for="fb-team-status">Filter by Status</label>'
    + '<select id="fb-team-status" name="violation_team_status" autocomplete="off" class="fb-control" onchange="window._fbTeamStatus=this.value;_fbRerender()">'
    + '<option value="">All statuses</option>'
    + ['Processing','Need Review','Need Resolve','Resolved','Cancelled'].map(function(s){ return '<option value="'+s+'"'+(_sfilt===s?' selected':'')+'>'+s+'</option>'; }).join('')
    + '</select>'
    + '<span id="fb-team-count" class="fb-toolbar-count">' + totalRecs + ' records</span>'
    + ((_search || _sfilt) ? '<button type="button" onclick="window._fbTeamSearch=\'\';window._fbTeamStatus=\'\';_fbRerender()" class="btn btn-sm">Clear</button>' : '')
    + '</div>';
  var summary = '<div class="fb-metrics fb-team-metrics fb-team-metrics-' + mode + '">'
    + (mode === 'training'
      ? '<div class="fb-metric is-hot"><span>Need Review</span><b>' + _fbStatusCount(_fbData(), 'Need Review') + '</b></div>'
        + '<div class="fb-metric is-action"><span>Need Resolve</span><b>' + _fbStatusCount(_fbData(), 'Need Resolve') + '</b></div>'
        + '<div class="fb-metric"><span>Open</span><b>' + _fbOpenCount(_fbData()) + '</b></div>'
        + '<div class="fb-metric"><span>Resolved</span><b>' + _fbStatusCount(_fbData(), 'Resolved') + '</b></div>'
      : '<div class="fb-metric"><span>Open</span><b>' + _fbOpenCount(_fbData()) + '</b></div>'
        + '<div class="fb-metric is-hot"><span>Need Review</span><b>' + _fbStatusCount(_fbData(), 'Need Review') + '</b></div>'
        + '<div class="fb-metric is-action"><span>Need Resolve</span><b>' + _fbStatusCount(_fbData(), 'Need Resolve') + '</b></div>'
        + '<div class="fb-metric"><span>Resolved</span><b>' + _fbStatusCount(_fbData(), 'Resolved') + '</b></div>')
    + '</div>';
  var leftPanel = '<aside id="fb-person-list" class="fb-person-list" aria-label="Employees with violations">'
    + _fbRenderPersonList(groups)
    + '</aside>';
  var rightPanel = '<section id="fb-detail-panel" class="fb-detail-panel" aria-live="polite">'
    + _fbRenderPersonDetail(_fbSelectedUser, groups)
    + '</section>';
  return summary + quickFilters + filterBar + '<div class="fb-split fb-split-' + mode + '">' + leftPanel + rightPanel + '</div>';
}

function _fbResolveRecord(realIdx) {
  if (!isTraining(currentUser)) { toast('Only Training can resolve violations.', 'err'); return; }
  state.policyCompliance[realIdx].status              = 'Resolved';
  state.policyCompliance[realIdx].resolvedBy          = currentUser.username;
  state.policyCompliance[realIdx].resolvedAt          = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = true;
  state._policyComplianceUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  updateFeedbackBadge();
  toast('✓ Violation marked as Resolved', 'ok');
  _fbRerender();
}

// ════════════════════════════════════════════
//  ACTIONS
// ════════════════════════════════════════════
function _fbSubmitFeedback(realIdx) {
  var el  = document.getElementById('fb-text-' + realIdx);
  var msg = document.getElementById('fb-msg-' + realIdx);
  var txt = (el ? el.value : '').trim();
  if (!txt) { if (msg) msg.innerHTML = '<span style="color:var(--err);">Please write a response first.</span>'; return; }
  state.policyCompliance[realIdx].agentFeedback        = txt;
  state.policyCompliance[realIdx].agentFeedbackAt      = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = false;
  state.policyCompliance[realIdx].status               = 'Need Review';
  state._policyComplianceUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  updateFeedbackBadge();
  if (msg) msg.innerHTML = '<span style="color:var(--ok);">&#x2714; Response saved. Forwarded to training.</span>';
  setTimeout(function() { _fbRerender(); }, 800);
}

function _fbOpenFeedback(realIdx) {
  var r   = state.policyCompliance[realIdx];
  var txt = prompt('Edit your response:', r.agentFeedback || '');
  if (txt === null) return;
  txt = txt.trim();
  if (!txt) return;
  state.policyCompliance[realIdx].agentFeedback   = txt;
  state.policyCompliance[realIdx].agentFeedbackAt = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = false;
  state._policyComplianceUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  updateFeedbackBadge();
  _fbRerender();
}

function _fbMarkRead(realIdx) {
  state.policyCompliance[realIdx].feedbackReadByLeader = true;
  state._policyComplianceUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  updateFeedbackBadge();
  _fbRerender();
}


function _fbRerender() {
  var el = document.getElementById('fb-content');
  if (!el) { _pcTab = 'violations'; nav('policy'); return; }

  // Save focused input state before rerender
  var activeId    = document.activeElement?.id || null;
  var activeVal   = document.activeElement?.value || '';
  var activeCaret = document.activeElement?.selectionStart ?? null;

  el.innerHTML = (_fbTab === 'mine') ? _fbRenderMine() : _fbRenderTeam();

  // Restore focus if it was inside fb-content
  if (activeId) {
    var restored = document.getElementById(activeId);
    if (restored) {
      restored.focus();
      if (activeCaret !== null) {
        try { restored.setSelectionRange(activeCaret, activeCaret); } catch(e) {}
      }
    }
  }
}
