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

// ── Helpers ──
function _fbData() {
  if (typeof _pcInit === 'function') _pcInit();
  return state.policyCompliance || [];
}

function _fbIsAgent(u) {
  // Non-leader roles
  return u && (ROLES[u.role]?.level || 0) < 2;
}

function _fbMyRecords() {
  return _fbData().filter(function(r) {
    return r.username === currentUser.username || r.empNo === (state.staffInfo?.[currentUser.username]?.empNo || '__');
  });
}

function _fbUnreadCount() {
  if (_fbIsAgent(currentUser)) {
    // Only count violations that need a response AND are not yet resolved
    return _fbMyRecords().filter(function(r) {
      return !r.agentFeedback && r.status !== 'Resolved';
    }).length;
  }
  // For leaders: records that have new agent feedback not yet acknowledged
  return _fbData().filter(function(r) {
    return r.agentFeedback && !r.feedbackReadByLeader;
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
    '1b':'Leave notice','1d':'Late / early','2a':'PAVE hours','2b':'Late login',
    '2e':'Break timing','2f':'Break overtime','3a':'PAVE steps','3c':'Performance',
    '3d':'Slack offline','3e':'Slack notify','3i':'Disobedience'
  };
  return map[ev] || ev;
}

function _fbStatusDot(s) {
  return s === 'Resolved'
    ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ok);margin-right:5px;flex-shrink:0;"></span>'
    : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--warn);margin-right:5px;flex-shrink:0;"></span>';
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
  var sub   = isAgent
    ? (_fbMyRecords().length + ' records · ' + _fbMyRecords().filter(function(r){return !r.agentFeedback;}).length + ' awaiting your response')
    : (_fbData().length + ' total · ' + _fbData().filter(function(r){return r.agentFeedback&&!r.feedbackReadByLeader;}).length + ' with new agent feedback');

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
//  MY VIOLATIONS TAB (agent view)
// ════════════════════════════════════════════
function _fbRenderMine() {
  var records = _fbMyRecords().slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });

  if (records.length === 0) {
    return '<div class="empty" style="padding:60px 0;">'
      + '<div style="font-size:32px;margin-bottom:12px;">&#x2705;</div>'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:6px;">No violations on record</div>'
      + '<div style="font-size:12px;color:var(--text3);">You have no policy compliance records.</div>'
      + '</div>';
  }

  var pending = records.filter(function(r){
  return !r.agentFeedback && r.status !== 'Resolved';
}).length;
  var banner  = pending > 0
    ? '<div style="display:flex;align-items:center;gap:10px;padding:11px 16px;background:rgba(251,191,36,.10);border:1px solid var(--warn);border-radius:8px;margin-bottom:16px;font-size:13px;">'
      + '<span style="font-size:20px;">&#x1F4DD;</span>'
      + '<div><b style="color:var(--warn);">' + pending + ' record' + (pending>1?'s':'') + ' awaiting your response.</b>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:1px;">Your feedback is noted by your leader. Be professional and factual.</div></div></div>'
    : '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);border-radius:8px;margin-bottom:16px;font-size:12px;color:var(--ok);">'
      + '&#x2714; All violations have your response on file.</div>';

  var cards = records.map(function(r, i) {
    var realIdx = _fbData().indexOf(r);
    var hasFb   = !!r.agentFeedback;
    var fbNew   = !hasFb;

    return '<div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ' + (fbNew?'var(--warn)':'var(--ok)') + ';border-radius:10px;padding:16px 18px;margin-bottom:12px;">'

      // Header row
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">'
      + '<div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;background:rgba(31,102,241,.15);color:var(--accent);padding:2px 9px;border-radius:99px;">' + r.event + '</span>'
      + '<span style="font-size:12px;color:var(--text2);">' + _fbEventLabel(r.event) + '</span>'
      + '<span style="font-size:11px;color:var(--text3);">&#xb7; ' + r.date + '</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Recorded by <b style="color:var(--text2);">' + r.leader + '</b>'
      + (r.shift ? ' &nbsp;&#xb7;&nbsp; Shift ' + r.shift : '') + '</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">'
      + _fbStatusDot(r.status)
      + '<span style="font-size:11px;color:' + (r.status==='Resolved'?'var(--ok)':'var(--warn)') + ';font-weight:500;">' + r.status + '</span>'
      + '</div></div>'

      // Description
      + '<div style="font-size:12px;background:var(--bg3);border-radius:6px;padding:10px 12px;line-height:1.8;margin-bottom:12px;color:var(--text2);">'
      + (r.description || '—')
      + (r.duration ? '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Duration: <b>' + r.duration + '</b></div>' : '')
      + (r.imageLink ? '<div style="font-size:11px;margin-top:4px;"><a href="' + r.imageLink + '" target="_blank" style="color:var(--accent);text-decoration:none;">&#x1F517; View evidence</a></div>' : '')
      + '</div>'

      // Leader confirm note (if any)
      + (r.leaderConfirm ? '<div style="font-size:11px;background:rgba(31,102,241,.06);border:1px solid rgba(31,102,241,.15);border-radius:6px;padding:8px 12px;margin-bottom:12px;">'
        + '<span style="color:var(--text3);">Leader note: </span>' + r.leaderConfirm + '</div>' : '')

      // Feedback section
      + '<div>'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:' + (hasFb?'var(--ok)':'var(--warn)') + ';font-family:\'IBM Plex Mono\',monospace;margin-bottom:7px;">'
      + (hasFb ? '&#x2714; Your response' : '&#x270F; Your response (pending)')
      + '</div>'

      + (hasFb
        // Show existing feedback + edit button
        ? '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:10px 12px;font-size:12px;line-height:1.8;position:relative;">'
          + r.agentFeedback
          + '<div style="font-size:10px;color:var(--text3);margin-top:6px;">' + _fbTimeSince(r.agentFeedbackAt) + '</div>'
          + '<button onclick="_fbOpenFeedback(' + realIdx + ')" style="position:absolute;top:8px;right:8px;font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;">Edit</button>'
          + '</div>'

        // Show textarea for new feedback
        : '<div>'
          + '<textarea id="fb-text-' + realIdx + '" placeholder="Write your response to this violation record...\n\nBe professional: acknowledge what happened or explain your perspective." style="width:100%;min-height:80px;padding:9px 12px;font-size:12px;font-family:\'IBM Plex Sans\',sans-serif;border:1px solid var(--border2);border-radius:7px;background:var(--bg);color:var(--text);resize:vertical;line-height:1.7;"></textarea>'
          + '<div style="display:flex;gap:8px;margin-top:8px;">'
          + '<button class="btn btn-accent" onclick="_fbSubmitFeedback(' + realIdx + ')" style="font-size:12px;padding:6px 16px;">Submit response</button>'
          + '</div>'
          + '<div id="fb-msg-' + realIdx + '" style="font-size:11px;min-height:16px;margin-top:6px;"></div>'
          + '</div>'
        )
      + '</div>'

      + '</div>';
  }).join('');

  return banner + cards;
}

// ════════════════════════════════════════════
//  TEAM TAB (all records, leader + agent)
// ════════════════════════════════════════════
function _fbRenderTeam() {
  var isAgent  = _fbIsAgent(currentUser);
  var records  = _fbData().slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var myName   = currentUser.name;

  // Search + filter state
  var _search  = window._fbTeamSearch || '';
  var _sfilt   = window._fbTeamStatus || '';

  var filtered = records.filter(function(r) {
    if (_sfilt && r.status !== _sfilt) return false;
    if (_search) {
      var q = _search.toLowerCase();
      if (!(r.name||'').toLowerCase().includes(q) && !(r.username||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  var ss = 'height:30px;padding:0 10px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);';

  var filterBar = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    + '<input type="text" value="' + _search + '" placeholder="Search by name or username..." oninput="window._fbTeamSearch=this.value;_fbRerender()" style="' + ss + 'width:220px;">'
    + '<select style="' + ss + '" onchange="window._fbTeamStatus=this.value;_fbRerender()">'
    + '<option value="">All statuses</option>'
    + '<option value="Resolved"' + (_sfilt==='Resolved'?' selected':'') + '>Resolved</option>'
    + '<option value="To Be Reviewed"' + (_sfilt==='To Be Reviewed'?' selected':'') + '>To Be Reviewed</option>'
    + '</select>'
    + '<span style="font-size:11px;color:var(--text3);">' + filtered.length + ' records</span>'
    + ((_search||_sfilt) ? '<button onclick="window._fbTeamSearch=\'\';window._fbTeamStatus=\'\';_fbRerender()" style="' + ss + 'cursor:pointer;">Clear</button>' : '')
    + '</div>';

  if (filtered.length === 0) {
    return filterBar + '<div class="empty"><div class="empty-ico">&#x1F50D;</div>No records match.</div>';
  }

  // Group by person
  var byPerson = {};
  filtered.forEach(function(r) {
    var key = r.username || r.name;
    if (!byPerson[key]) byPerson[key] = {name:r.name, username:r.username, role:r.role, records:[]};
    byPerson[key].records.push(r);
  });

  var groups = Object.values(byPerson).sort(function(a,b) {
    return b.records.length - a.records.length;
  });

  var html = filterBar;

  groups.forEach(function(g) {
    var isMe = g.username === currentUser.username;
    var hasFeedback = g.records.filter(function(r){return r.agentFeedback;}).length;
    var noFeedback  = g.records.length - hasFeedback;
    var newFb = g.records.filter(function(r){return r.agentFeedback && !r.feedbackReadByLeader;}).length;

    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">'

      // Person header
      + '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg3);border-bottom:1px solid var(--border);cursor:pointer;" onclick="_fbToggleGroup(\'' + g.username + '\')">'
      + '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">' + (g.name||'?').charAt(0) + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;">' + g.name + (isMe ? ' <span style="font-size:10px;color:var(--accent);background:rgba(31,102,241,.1);padding:1px 7px;border-radius:99px;font-weight:500;">you</span>' : '') + '</div>'
      + '<div style="font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + (g.username||'') + ' &nbsp;&#xb7;&nbsp; ' + (g.role||'') + '</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">'
      + '<span style="font-size:11px;background:var(--bg4);color:var(--text2);padding:2px 8px;border-radius:99px;">' + g.records.length + ' violation' + (g.records.length!==1?'s':'') + '</span>'
      + (hasFeedback > 0 ? '<span style="font-size:11px;background:rgba(74,222,128,.12);color:var(--ok);padding:2px 8px;border-radius:99px;">' + hasFeedback + ' responded</span>' : '')
      + (newFb > 0 && isLeader(currentUser) ? '<span style="font-size:11px;background:rgba(31,102,241,.15);color:var(--accent);padding:2px 8px;border-radius:99px;font-weight:600;">&#x1F4AC; ' + newFb + ' new</span>' : '')
      + '</div>'
      + '<span id="fb-grp-ico-' + g.username + '" style="font-size:12px;color:var(--text3);margin-left:6px;">&#x25BC;</span>'
      + '</div>'

      // Records (collapsible)
      + '<div id="fb-grp-' + g.username + '" style="padding:0 16px 12px;">'
      + g.records.map(function(r) {
          var realIdx = _fbData().indexOf(r);
          var hasFb   = !!r.agentFeedback;
          var isNewFb = hasFb && !r.feedbackReadByLeader && isLeader(currentUser);

          var row = '<div style="padding:10px 0;border-bottom:1px solid var(--border);">'
            + '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;">'

            // Event + date
            + '<div style="flex:1;min-width:200px;">'
            + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
            + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;background:rgba(31,102,241,.15);color:var(--accent);padding:1px 8px;border-radius:99px;">' + r.event + '</span>'
            + '<span style="font-size:11px;color:var(--text2);">' + _fbEventLabel(r.event) + '</span>'
            + '<span style="font-size:10px;color:var(--text3);">' + r.date + '</span>'
            + '</div>'
            + '<div style="font-size:11px;color:var(--text3);line-height:1.6;">' + (r.description||'') + '</div>'
            + '</div>'

            // Status
            + '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">'
            + _fbStatusDot(r.status)
            + '<span style="font-size:11px;color:' + (r.status==='Resolved'?'var(--ok)':'var(--warn)') + ';">' + r.status + '</span>'
            + '</div></div>'

            // Feedback display
            + (hasFb
              ? '<div style="margin-top:8px;background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.2);border-radius:6px;padding:9px 12px;">'
                + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ok);font-family:\'IBM Plex Mono\',monospace;margin-bottom:5px;">'
                + '&#x1F4AC; Agent feedback' + (isNewFb ? ' <span style="background:var(--accent);color:#fff;padding:1px 7px;border-radius:99px;font-size:9px;">NEW</span>' : '') + '</div>'
                + '<div style="font-size:12px;line-height:1.7;color:var(--text);">' + r.agentFeedback + '</div>'
                + '<div style="font-size:10px;color:var(--text3);margin-top:5px;">' + _fbTimeSince(r.agentFeedbackAt) + '</div>'
                + (isNewFb && isLeader(currentUser) ? '<button onclick="_fbMarkRead(' + realIdx + ')" style="margin-top:7px;font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;">Mark read</button>' : '')
                + '</div>'
              : '<div style="margin-top:6px;font-size:11px;color:var(--text3);font-style:italic;">No agent response yet.</div>'
            )
            + '</div>';
          return row;
        }).join('')
      + '</div>'
      + '</div>';
  });

  return html;
}

// ════════════════════════════════════════════
//  ACTIONS
// ════════════════════════════════════════════
function _fbSubmitFeedback(realIdx) {
  var el  = document.getElementById('fb-text-' + realIdx);
  var msg = document.getElementById('fb-msg-' + realIdx);
  var txt = (el ? el.value : '').trim();
  if (!txt) { if (msg) msg.innerHTML = '<span style="color:var(--err);">Please write a response first.</span>'; return; }
  state.policyCompliance[realIdx].agentFeedback   = txt;
  state.policyCompliance[realIdx].agentFeedbackAt = Date.now();
  state.policyCompliance[realIdx].feedbackReadByLeader = false;
  save();
  if (typeof syncWrite === 'function') syncWrite();
  updateFeedbackBadge();
  if (msg) msg.innerHTML = '<span style="color:var(--ok);">&#x2714; Response saved.</span>';
  setTimeout(function() { _fbRerender(); }, 600);
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

function _fbToggleGroup(username) {
  var el  = document.getElementById('fb-grp-' + username);
  var ico = document.getElementById('fb-grp-ico-' + username);
  if (!el) return;
  var hidden = el.style.display === 'none';
  el.style.display  = hidden ? '' : 'none';
  if (ico) ico.innerHTML = hidden ? '&#x25BC;' : '&#x25B6;';
}

function _fbRerender() {
  var el = document.getElementById('fb-content');
  if (!el) { nav('feedback'); return; }
  el.innerHTML = (_fbTab === 'mine') ? _fbRenderMine() : _fbRenderTeam();
}
