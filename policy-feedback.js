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
//  HOW TO INTEGRATE:
//   1. Add to index.html before </body>:
//      <script src="policy-feedback.js"></script>
//
//   2. In index.html sidebar, add for ALL roles:
//      <div class="nav-item" onclick="nav('feedback')" data-page="feedback">
//        <span class="nav-ico">💬</span> My Violations
//        <span class="nav-badge" id="fb-badge" style="display:none">0</span>
//      </div>
//
//   3. In nav.js pages object, add:
//      feedback: renderPolicyFeedback,
//
//   4. Call updateFeedbackBadge() inside updateBadge() in data.js:
//      function updateBadge() {
//        ...existing code...
//        updateFeedbackBadge();
//      }
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
    return _fbData().filter(function(r) { return r.status === 'Need Review' || r.status === 'Need Resolve'; }).length;
  }
  return _fbData().filter(function(r) {
    return (r.agentFeedback || r.agentDone) && !r.feedbackReadByLeader && r.status !== 'Resolved' && r.status !== 'Cancelled';
  }).length;
}

function updateFeedbackBadge() {
  var el = document.getElementById('fb-badge');
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
  var c = _FB_STATUS_COLORS[s] || 'var(--warn)';
  return '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+c+';margin-right:5px;flex-shrink:0;"></span>';
}
function _fbStatusColor(s) {
  return _FB_STATUS_COLORS[s] || 'var(--warn)';
}

// ════════════════════════════════════════════
//  MY VIOLATIONS TAB (agent view)
// ════════════════════════════════════════════
function _fbRenderMine() {
  var records  = _fbMyRecords().slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  if (records.length === 0) {
    return '<div class="empty" style="padding:40px 0;text-align:center;color:var(--text3);">No violations on record. Keep it up!</div>';
  }

  var pending = records.filter(function(r) { return r.status === 'Processing'; }).length;

  var banner = pending > 0
    ? '<div style="background:var(--D-bg);border:1px solid var(--warn);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--warn);">⚠ You have <b>' + pending + '</b> violation(s) awaiting your response.</div>'
    : '<div style="background:var(--C-bg);border:1px solid var(--ok);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--ok);">✓ All violations acknowledged.</div>';

  var cards = records.map(function(r) {
    var realIdx  = _fbData().indexOf(r);
    var hasFb    = !!r.agentFeedback;
    var hasDone  = !!r.agentDone;
    var hasReply = hasFb || hasDone;
    var isResolved  = r.status === 'Resolved';
    var isCancelled = r.status === 'Cancelled';
    var needsReply  = r.status === 'Processing';

    var feedbackSection = hasDone
      ? '<div style="background:var(--C-bg);border:1px solid var(--ok);border-radius:7px;padding:8px 12px;font-size:12px;color:var(--ok);">✓ Acknowledged — no objection.</div>'
      : hasFb
        ? '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:10px 12px;font-size:12px;line-height:1.8;position:relative;">'
          + r.agentFeedback
          + '<div style="font-size:10px;color:var(--text3);margin-top:6px;">' + _fbTimeSince(r.agentFeedbackAt) + '</div>'
          + '<button onclick="_fbOpenFeedback(' + realIdx + ')" style="position:absolute;top:8px;right:8px;font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;">Edit</button>'
          + '</div>'
        : (isResolved || isCancelled)
          ? '<div style="font-size:12px;color:var(--text3);font-style:italic;">'+(isCancelled?'This violation was cancelled.':'This violation has been resolved.')+'</div>'
          : '<div>'
            + '<textarea id="fb-text-' + realIdx + '" placeholder="Write your comment if you disagree or have context to add..." style="width:100%;min-height:70px;padding:9px 12px;font-size:12px;font-family:\'IBM Plex Sans\',sans-serif;border:1px solid var(--border2);border-radius:7px;background:var(--bg);color:var(--text);resize:vertical;line-height:1.7;box-sizing:border-box;"></textarea>'
            + '<div style="display:flex;gap:8px;margin-top:8px;">'
            + '<button class="btn btn-ok" onclick="_fbMarkDone(' + realIdx + ')" style="font-size:12px;padding:6px 16px;">✓ Done — I agree</button>'
            + '<button class="btn btn-accent" onclick="_fbSubmitFeedback(' + realIdx + ')" style="font-size:12px;padding:6px 16px;">💬 Submit comment</button>'
            + '</div>'
            + '<div id="fb-msg-' + realIdx + '" style="font-size:11px;min-height:16px;margin-top:6px;"></div>'
            + '</div>';

    return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;background:rgba(31,102,241,.15);color:var(--accent);padding:2px 9px;border-radius:99px;">' + r.event + '</span>'
      + '<span style="font-size:12px;color:var(--text2);">' + _fbEventLabel(r.event) + '</span>'
      + '<span style="font-size:11px;color:var(--text3);">' + r.date + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:5px;">'
      + _fbStatusDot(r.status)
      + '<span style="font-size:11px;color:' + _fbStatusColor(r.status) + ';">' + r.status + '</span>'
      + '</div>'
      + '</div>'
      + (r.description ? '<div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.6;">' + r.description + '</div>' : '')
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:' + (hasReply ? 'var(--ok)' : isResolved ? 'var(--text3)' : 'var(--warn)') + ';font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px;">'
      + (hasDone ? '✓ You acknowledged — forwarded to training' : hasFb ? '✓ Your response — forwarded to training' : isResolved ? '— Resolved' : isCancelled ? '— Cancelled' : '✏ Your response needed')
      + '</div>'
      + feedbackSection
      + '</div>';
  }).join('');

  return banner + cards;
}

function _fbMarkDone(realIdx) {
  state.policyCompliance[realIdx].agentDone        = true;
  state.policyCompliance[realIdx].agentDoneAt      = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = false;
  state.policyCompliance[realIdx].status           = 'Need Resolve';
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  updateFeedbackBadge();
  _fbRerender();
}

// ════════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════════
function renderPolicyFeedback() {
  var isAgent = _fbIsAgent(currentUser);

  // Leaders land on team view by default
  if (!isAgent && _fbTab === 'mine') _fbTab = 'team';

  var tabBar = '';
  if (isAgent) {
    var myCount   = _fbMyRecords().length;
    var teamCount = _fbData().length;
    tabBar = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">'
      + _fbTabBtn('mine',  'My Violations', myCount)
      + _fbTabBtn('team',  'My Team',       teamCount)
      + '</div>';
  }

  var content = (_fbTab === 'mine') ? _fbRenderMine() : _fbRenderTeam();

  var title = isAgent ? 'My Violations' : 'Team Violations';
  var sub = isAgent
  ? (_fbMyRecords().length + ' records · ' + _fbMyRecords().filter(function(r){
      return r.status !== 'Resolved' && !r.agentFeedback && !r.agentDone;
    }).length + ' awaiting your response')
  : (_fbData().length + ' total · ' + _fbData().filter(function(r){
      return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved';
    }).length + ' with new agent feedback');
  return '<div class="page-header"><div>'
    + '<div class="page-title">&#x1F4AC; ' + title + '</div>'
    + '<div class="page-sub">' + sub + '</div>'
    + '</div></div>'
    + tabBar
    + '<div id="fb-content">' + content + '</div>';
}

function _fbTabBtn(id, label, count) {
  var on = _fbTab === id;
  return '<button onclick="_fbTab=\'' + id + '\';nav(\'feedback\')" style="padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;white-space:nowrap;transition:all .12s;color:' + (on?'var(--accent)':'var(--text3)') + ';border-bottom:3px solid ' + (on?'var(--accent)':'transparent') + ';margin-bottom:-2px;">'
    + label
    + ' <span style="font-size:10px;padding:1px 6px;border-radius:99px;background:' + (on?'var(--accent)':'var(--bg4)') + ';color:' + (on?'#fff':'var(--text3)') + ';margin-left:4px;">' + count + '</span>'
    + '</button>';
}



// ════════════════════════════════════════════
//  TEAM TAB — split-panel layout
// ════════════════════════════════════════════

function _fbGetGroups() {
  var records = _fbData().slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
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
  return Object.values(byPerson).sort(function(a, b) { return b.records.length - a.records.length; });
}

function _fbRenderPersonList(groups) {
  if (groups.length === 0) {
    return '<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px;">No records match.</div>';
  }
  return groups.map(function(g) {
    var isActive  = g.username === _fbSelectedUser;
    var isMe      = g.username === currentUser.username;
    var newFb     = g.records.filter(function(r) { return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved'; }).length;
    var responded = g.records.filter(function(r) { return r.agentFeedback || r.agentDone; }).length;
    return '<div data-fb-person="' + g.username + '" onclick="_fbSelectPerson(\'' + g.username + '\')" '
      + 'style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-left:3px solid ' + (isActive ? 'var(--accent)' : 'transparent') + ';background:' + (isActive ? 'rgba(31,102,241,.07)' : '') + ';transition:background .1s;">'
      + '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">' + (g.name||'?').charAt(0) + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + g.name + (isMe ? ' <span style="font-size:9px;color:var(--accent);background:rgba(31,102,241,.1);padding:1px 5px;border-radius:99px;">you</span>' : '') + '</div>'
      + '<div style="font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (_resolveRole(g.role)||g.role||'') + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">'
      + '<span style="font-size:10px;background:var(--bg4);color:var(--text2);padding:1px 6px;border-radius:99px;">' + g.records.length + '</span>'
      + (newFb > 0 && isLeader(currentUser) ? '<span style="font-size:10px;background:rgba(31,102,241,.15);color:var(--accent);padding:1px 6px;border-radius:99px;font-weight:600;">&#x1F4AC; ' + newFb + '</span>' : '')
      + (responded > 0 && newFb === 0 ? '<span style="font-size:10px;background:rgba(74,222,128,.12);color:var(--ok);padding:1px 6px;border-radius:99px;">&#x2713;</span>' : '')
      + '</div>'
      + '</div>';
  }).join('');
}

function _fbRenderPersonDetail(username, groups) {
  if (!username) {
    return '<div class="empty" style="padding:60px 0;">Select a person from the list to view their violations.</div>';
  }
  var g = null;
  for (var gi = 0; gi < groups.length; gi++) { if (groups[gi].username === username) { g = groups[gi]; break; } }
  if (!g) {
    return '<div class="empty" style="padding:60px 0;">No records for this person match the current filter.</div>';
  }
  var newFb = g.records.filter(function(r) { return r.agentFeedback && !r.feedbackReadByLeader && r.status !== 'Resolved'; }).length;
  var header = '<div style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--bg3);">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
    + '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0;">' + (g.name||'?').charAt(0) + '</div>'
    + '<div style="flex:1;min-width:0;">'
    + '<div style="font-size:14px;font-weight:700;">' + g.name + '</div>'
    + '<div style="font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + (g.username||'') + ' &nbsp;&#xb7;&nbsp; ' + (_resolveRole(g.role)||g.role||'') + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'
    + '<span style="font-size:11px;background:var(--bg4);color:var(--text2);padding:2px 8px;border-radius:99px;">' + g.records.length + ' violation' + (g.records.length !== 1 ? 's' : '') + '</span>'
    + (newFb > 0 && isLeader(currentUser) ? '<span style="font-size:11px;background:rgba(31,102,241,.15);color:var(--accent);padding:2px 8px;border-radius:99px;font-weight:600;">&#x1F4AC; ' + newFb + ' new</span>' : '')
    + '</div>'
    + '</div>'
    + '</div>';
  var recordsHtml = g.records.map(function(r) {
    var realIdx = _fbData().indexOf(r);
    var hasFb   = !!r.agentFeedback;
    var isNewFb = hasFb && !r.feedbackReadByLeader && isLeader(currentUser) && r.status !== 'Resolved';
    return '<div style="padding:12px 16px;border-bottom:1px solid var(--border);">'
      + '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px;">'
      + '<div style="flex:1;min-width:180px;">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">'
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;background:rgba(31,102,241,.15);color:var(--accent);padding:1px 8px;border-radius:99px;">' + r.event + '</span>'
      + '<span style="font-size:11px;color:var(--text2);">' + _fbEventLabel(r.event) + '</span>'
      + '<span style="font-size:10px;color:var(--text3);">' + r.date + '</span>'
      + '</div>'
      + (r.description ? '<div style="font-size:11px;color:var(--text3);line-height:1.6;">' + r.description + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">'
      + _fbStatusDot(r.status)
      + '<span style="font-size:11px;color:' + _fbStatusColor(r.status) + ';">' + r.status + '</span>'
      + '</div>'
      + '</div>'
      + (hasFb
        ? '<div style="background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.2);border-radius:6px;padding:9px 12px;">'
          + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ok);font-family:\'IBM Plex Mono\',monospace;margin-bottom:5px;">&#x1F4AC; Agent feedback' + (isNewFb ? ' <span style="background:var(--accent);color:#fff;padding:1px 7px;border-radius:99px;font-size:9px;">NEW</span>' : '') + '</div>'
          + '<div style="font-size:12px;line-height:1.7;color:var(--text);">' + r.agentFeedback + '</div>'
          + '<div style="font-size:10px;color:var(--text3);margin-top:5px;">' + _fbTimeSince(r.agentFeedbackAt) + '</div>'
          + (isNewFb && !isTraining(currentUser) ? '<button onclick="_fbMarkRead(' + realIdx + ')" style="margin-top:7px;font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;">Mark read</button>' : '')
          + (isTraining(currentUser) && hasFb ? '<div style="display:flex;gap:6px;margin-top:8px;"><button onclick="_fbResolveRecord(' + realIdx + ')" class="btn btn-sm btn-ok">&#x2713; Mark Resolved</button></div>' : '')
          + '</div>'
        : '<div style="font-size:11px;color:var(--text3);font-style:italic;">No agent response yet.</div>'
      )
      + '</div>';
  }).join('');
  return header + recordsHtml;
}

function _fbSelectPerson(username) {
  _fbSelectedUser = username;
  var groups = _fbGetGroups();
  var dp = document.getElementById('fb-detail-panel');
  if (dp) dp.innerHTML = _fbRenderPersonDetail(username, groups);
  document.querySelectorAll('[data-fb-person]').forEach(function(el) {
    var active = el.dataset.fbPerson === username;
    el.style.borderLeft = active ? '3px solid var(--accent)' : '3px solid transparent';
    el.style.background = active ? 'rgba(31,102,241,.07)' : '';
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
  var groups  = _fbGetGroups();
  var selMatch = null;
  for (var si = 0; si < groups.length; si++) { if (groups[si].username === _fbSelectedUser) { selMatch = groups[si]; break; } }
  if (!selMatch) _fbSelectedUser = groups.length > 0 ? groups[0].username : '';
  var totalRecs = 0;
  for (var ti = 0; ti < groups.length; ti++) totalRecs += groups[ti].records.length;
  var ss = 'height:30px;padding:0 10px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);';
  var filterBar = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    + '<input type="text" id="fb-team-search" value="' + _search + '" placeholder="Search by name or username..." oninput="window._fbTeamSearch=this.value;_fbRefreshSplit();" style="' + ss + 'width:220px;">'
    + '<select style="' + ss + '" onchange="window._fbTeamStatus=this.value;_fbRerender()">'
    + '<option value="">All statuses</option>'
    + ['Processing','Need Review','Need Resolve','Resolved','Cancelled'].map(function(s){ return '<option value="'+s+'"'+(_sfilt===s?' selected':'')+'>'+s+'</option>'; }).join('')
    + '</select>'
    + '<span id="fb-team-count" style="font-size:11px;color:var(--text3);">' + totalRecs + ' records</span>'
    + ((_search || _sfilt) ? '<button onclick="window._fbTeamSearch=\'\';window._fbTeamStatus=\'\';_fbRerender()" style="' + ss + 'cursor:pointer;">Clear</button>' : '')
    + '</div>';
  var leftPanel = '<div id="fb-person-list" style="width:260px;flex-shrink:0;background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow-y:auto;max-height:calc(100vh - 260px);">'
    + _fbRenderPersonList(groups)
    + '</div>';
  var rightPanel = '<div id="fb-detail-panel" style="flex:1;min-width:0;background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow-y:auto;max-height:calc(100vh - 260px);">'
    + _fbRenderPersonDetail(_fbSelectedUser, groups)
    + '</div>';
  return filterBar + '<div style="display:flex;gap:12px;align-items:flex-start;">' + leftPanel + rightPanel + '</div>';
}

function _fbResolveRecord(realIdx) {
  if (!isTraining(currentUser)) { toast('Only Training can resolve violations.', 'err'); return; }
  state.policyCompliance[realIdx].status              = 'Resolved';
  state.policyCompliance[realIdx].resolvedBy          = currentUser.username;
  state.policyCompliance[realIdx].resolvedAt          = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = true;
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
  save();
  if (typeof syncWrite === 'function') syncWrite();
  updateFeedbackBadge();
  _fbRerender();
}

function _fbMarkRead(realIdx) {
  state.policyCompliance[realIdx].feedbackReadByLeader = true;
  save();
  if (typeof syncWrite === 'function') syncWrite();
  updateFeedbackBadge();
  _fbRerender();
}


function _fbRerender() {
  var el = document.getElementById('fb-content');
  if (!el) { nav('feedback'); return; }

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
