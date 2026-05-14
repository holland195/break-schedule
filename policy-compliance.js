// ═══════════════════════════════════════════════
//  POLICY COMPLIANCE v2 — Complete rewrite
//
//  All roles: 3 tabs in order:
//   1. Policy 2026   (General Policy, filter by year/quarter/month)
//   2. All Records   (formerly View & Filter, with Add Record button)
//   3. Summary 30D   (violations per role in last 30 days, with filters)
//
//  Admin: Import button in Policy 2026 tab pushes
//         full dataset directly to Firebase cloud.
//
//  Agent feedback: stored on record, synced via Firebase.
//
//  HOW TO INTEGRATE:
//   1. <script src="policy-compliance-v2.js"></script>  (before </body>)
//   2. Sidebar (all roles):
//      <div class="nav-item" onclick="nav('policy')" data-page="policy">
//        <span class="nav-ico">&#x1F4CB;</span> Policy Compliance
//        <span class="nav-badge" id="pc-badge" style="display:none">0</span>
//      </div>
//   3. nav.js pages object:  policy: renderPolicyCompliance,
//   4. updateBadge() in data.js:
//      if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
// ═══════════════════════════════════════════════

// ── Seed data removed — records live in Firebase cloud ──
// Admin: go to Policy Compliance → Policy 2026 → "Push to Cloud" to re-upload if needed.
// Agents and leaders load records via syncPull() on every page load.
const PC_SEED_DATA = []

const PC_EVENTS = {
  '1b':'Leave notice — not reported on time',
  '1d':'Late arrival / early departure',
  '2a':'Insufficient PAVE hours',
  '2b':'Late login to PAVE',
  '2e':'Break at wrong time slot',
  '2f':'Break duration exceeded',
  '3a':'Wrong PAVE login/logout steps',
  '3c':'Performance not updated',
  '3d':'Slack offline during shift',
  '3e':'Slack notification missed',
  '3i':'Disobedience',
};

// ── Page state ──
let _pcTab    = 'policy'; // 'policy' | 'records' | 'summary'
let _pcPage   = 1;
const _PC_PER = 25;

// Policy tab filters
let _pcPolYear = '2026';
let _pcPolQ    = '';   // '' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
let _pcPolMon  = '';   // '' | '2026-01' etc
let _pcPolPage = 1;    // Policy 2026 pagination
const _PC_POL_PER = 25;

// Records tab filters
let _pcRF = {dateFrom:'',dateTo:'',status:'',role:'',shift:'',event:'',leader:'',search:''};
let _pcFiltered = [];

// Summary 30D filters
let _pcS30Role   = '';
let _pcS30Event  = '';
let _pcS30Leader = '';

// ── Data ──
// PC_SEED_VERSION removed — seeding disabled, data comes from cloud

function _pcInit() {
  if (!state.policyCompliance) {
    state.policyCompliance = [];
    save();
    return;
  }
  // Migrate legacy 'To Be Reviewed' records → 'Cancelled'
  var migrated = false;
  state.policyCompliance.forEach(function(r) {
    if (r.status === 'To Be Reviewed') { r.status = 'Cancelled'; migrated = true; }
  });
  if (migrated) save();
}
function _pcData() { _pcInit(); return state.policyCompliance; }

// Does NOT reset _pcPage — callers that need page reset do it explicitly
function _pcApplyFilters() {
  var f = _pcRF;
  _pcFiltered = _pcData().filter(function(r) {
    if (f.dateFrom && r.date < f.dateFrom) return false;
    if (f.dateTo   && r.date > f.dateTo)   return false;
    if (f.status   && r.status !== f.status) return false;
    if (f.role     && r.role   !== f.role)   return false;
    if (f.shift    && r.shift  !== f.shift)  return false;
    if (f.event    && r.event  !== f.event)  return false;
    if (f.leader   && r.leader !== f.leader) return false;
    if (f.search) {
      var q = f.search.toLowerCase();
      if (!(r.name||'').toLowerCase().includes(q) &&
          !(r.empNo||'').toLowerCase().includes(q) &&
          !(r.username||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ── Helpers ──
var _PC_STATUS_STYLES = {
  'Processing':   'background:rgba(251,191,36,.15);color:#d97706;border:1px solid rgba(251,191,36,.4);',
  'Need Review':  'background:rgba(239,68,68,.12);color:var(--err);border:1px solid rgba(239,68,68,.3);',
  'Need Resolve': 'background:rgba(31,102,241,.12);color:var(--accent);border:1px solid rgba(31,102,241,.3);',
  'Resolved':     'background:rgba(74,222,128,.12);color:var(--ok);border:1px solid rgba(74,222,128,.3);',
  'Cancelled':    'background:rgba(148,163,184,.12);color:var(--text3);border:1px solid rgba(148,163,184,.3);',
};
function _pcStatusBadge(s) {
  var style = _PC_STATUS_STYLES[s] || _PC_STATUS_STYLES['Processing'];
  return '<span style="font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;'+style+'">'+s+'</span>';
}

function _pcHeat(n) {
  if (!n) return 'color:var(--text3)';
  if (n<=2) return 'color:var(--accent);font-weight:600';
  if (n<=5) return 'color:var(--warn);font-weight:600';
  return 'color:var(--err);font-weight:700';
}

function _pcToday() {
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function _pcCutoff30() {
  var d=new Date(); d.setDate(d.getDate()-30);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function _pcUpdateBadge() {
  var data = _pcData();
  var n;
  if (isTraining(currentUser)) {
    // Training sees records that need their decision
    n = data.filter(function(r) { return r.status === 'Need Review' || r.status === 'Need Resolve'; }).length;
  } else {
    // Leaders/agents see all active (not yet resolved/cancelled) records
    n = data.filter(function(r) { return r.status === 'Processing'; }).length;
  }
  var el = document.getElementById('pc-badge');
  if (el) { el.textContent = n; el.style.display = n > 0 ? '' : 'none'; }
}

// ════════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════════
function renderPolicyCompliance() {
  _pcInit();
  var isAdm = isAdmin(currentUser);
  var isLdr = isLeader(currentUser);

  var T = function(id, ico, lbl) {
    var on = _pcTab === id;
    return '<button onclick="_pcTab=\''+id+'\';_pcPage=1;nav(\'policy\')" style="padding:9px 20px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;white-space:nowrap;transition:all .12s;color:'+(on?'var(--accent)':'var(--text3)')+';border-bottom:3px solid '+(on?'var(--accent)':'transparent')+';margin-bottom:-2px;">'+ico+' '+lbl+'</button>';
  };

  var tabs = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto;">'
    + T('policy', '&#x1F4CA;', 'Policy 2026')
    + T('records','&#x1F4CB;', 'All Records')
    + T('summary','&#x1F4C5;', 'Summary 30D')
    + '</div>';

  var content = '';
  if      (_pcTab==='policy')  content = _pcRenderPolicy();
  else if (_pcTab==='records') content = _pcRenderRecords();
  else if (_pcTab==='summary') content = _pcRenderSummary();

  return '<div class="page-header"><div>'
    + '<div class="page-title">&#x1F4CB; Policy Compliance</div>'
    + '<div class="page-sub">'+_pcData().length+' records &nbsp;&middot;&nbsp; Jan – May 2026</div>'
    + '</div></div>'
    + tabs
    + '<div id="pc-content">'+content+'</div>'
    + _pcEditModalHTML();
}

// ════════════════════════════════════════════
//  TAB 1: POLICY 2026
// ════════════════════════════════════════════
function _pcRenderPolicy() {
  var all  = _pcData();
  var ss   = 'height:30px;padding:0 10px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer;';

  // ── Filter panel ──
  var years   = ['2026'];
  var quarters= ['Q1','Q2','Q3','Q4'];
  var months  = ['2026-01','2026-02','2026-03','2026-04','2026-05'];
  var mLabels = {'2026-01':'Jan 2026','2026-02':'Feb 2026','2026-03':'Mar 2026','2026-04':'Apr 2026','2026-05':'May 2026'};

  var filterBar = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Year</div>'
    + '<select style="'+ss+'" onchange="_pcPolYear=this.value;_pcPolQ=\'\';_pcPolMon=\'\';_pcRerender()">'
    + years.map(function(y){return '<option value="'+y+'"'+(y===_pcPolYear?' selected':'')+'>'+y+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Quarter</div>'
    + '<select style="'+ss+'" onchange="_pcPolQ=this.value;_pcPolMon=\'\';_pcRerender()">'
    + '<option value="">All quarters</option>'
    + quarters.map(function(q){return '<option value="'+q+'"'+(q===_pcPolQ?' selected':'')+'>'+q+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Month</div>'
    + '<select style="'+ss+'" onchange="_pcPolMon=this.value;_pcPolQ=\'\';_pcRerender()">'
    + '<option value="">All months</option>'
    + months.map(function(m){return '<option value="'+m+'"'+(m===_pcPolMon?' selected':'')+'>'+(mLabels[m]||m)+'</option>';}).join('')
    + '</select></div>'
    + '<button onclick="_pcPolYear=\'2026\';_pcPolQ=\'\';_pcPolMon=\'\';_pcRerender()" style="'+ss+'margin-top:13px;color:var(--text2);">Reset</button>';

  // Admin import button
  if (isAdmin(currentUser)) {
    filterBar += '<button onclick="_pcAdminImport()" class="btn btn-accent btn-sm" style="margin-top:13px;font-size:12px;">&#x2601; Push to Cloud</button>'
      + '<div id="pc-import-msg" style="font-size:11px;color:var(--text3);align-self:center;margin-top:13px;min-height:16px;"></div>';
  }
  filterBar += '</div>';

  // ── Filter records by year/Q/month ──
  function inScope(r) {
    if (!r.date) return false;
    if (_pcPolYear && !r.date.startsWith(_pcPolYear)) return false;
    if (_pcPolMon  && !r.date.startsWith(_pcPolMon))  return false;
    if (_pcPolQ) {
      var m = parseInt(r.date.split('-')[1]);
      var qmap = {Q1:[1,2,3],Q2:[4,5,6],Q3:[7,8,9],Q4:[10,11,12]};
      if (!qmap[_pcPolQ].includes(m)) return false;
    }
    return true;
  }

  var scoped = all.filter(inScope);
  var res    = scoped.filter(function(r){return r.status==='Resolved';}).length;
  var rev    = scoped.filter(function(r){return r.status==='Processing'||r.status==='Need Review'||r.status==='Need Resolve';}).length;

  // ── Stats row ──
  var stats = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">'
    + '<div class="stat"><div class="stat-label">Violations</div><div class="stat-num" style="color:var(--accent);">'+scoped.length+'</div></div>'
    + '<div class="stat"><div class="stat-label">Resolved</div><div class="stat-num" style="color:var(--ok);">'+res+'</div></div>'
    + '<div class="stat"><div class="stat-label">To review</div><div class="stat-num" style="color:var(--warn);">'+rev+'</div></div>'
    + '<div class="stat"><div class="stat-label">Employees</div><div class="stat-num">'+[...new Set(scoped.map(function(r){return r.username;}))].length+'</div></div>'
    + '</div>';

  // ── Per-employee summary table ──
  var byEmp = {};
  scoped.forEach(function(r) {
    var k = r.username||r.name;
    if (!byEmp[k]) byEmp[k] = {name:r.name,empNo:r.empNo,role:r.role,username:r.username,leader:r.leader,
      total:0,events:{},months:{}};
    byEmp[k].total++;
    byEmp[k].events[r.event] = (byEmp[k].events[r.event]||0)+1;
    var mon = r.date.slice(0,7);
    byEmp[k].months[mon] = (byEmp[k].months[mon]||0)+1;
  });

  var empList = Object.values(byEmp).sort(function(a,b){return b.total-a.total;});

  // Month columns to show
  var shownMonths = _pcPolMon ? [_pcPolMon]
    : _pcPolQ ? months.filter(function(m){
        var mo=parseInt(m.split('-')[1]);
        var qmap={Q1:[1,2,3],Q2:[4,5,6],Q3:[7,8,9],Q4:[10,11,12]};
        return qmap[_pcPolQ].includes(mo);
      })
    : months;

  var thead = '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:50px;">#</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:70px;">EMP NO.</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:160px;">NAME</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">ROLE</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">LEADER</th>'
    + '<th style="padding:8px 10px;text-align:center;font-size:10px;color:var(--accent);font-family:\'IBM Plex Mono\',monospace;min-width:50px;">TOTAL</th>'
    + shownMonths.map(function(m){
        var lbl = (mLabels[m]||m).replace(' 2026','');
        return '<th style="padding:8px 6px;text-align:center;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:44px;">'+lbl+'</th>';
      }).join('')
    + '</tr></thead>';

  var rows = empList.map(function(e,i) {
    return '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);">'+(i+1)+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+e.empNo+'</td>'
      + '<td style="padding:7px 10px;font-weight:600;font-size:12px;">'+e.name+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;">'+e.role+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+e.leader+'</td>'
      + '<td style="padding:7px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:13px;'+_pcHeat(e.total)+'">'+e.total+'</td>'
      + shownMonths.map(function(m){
          var n = e.months[m]||0;
          return '<td style="padding:7px 6px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:12px;'+_pcHeat(n)+'">'+(n||'—')+'</td>';
        }).join('')
      + '</tr>';
  }).join('');

  // Pagination for Policy 2026
  var polTotal = empList.length;
  var polPages = Math.max(1, Math.ceil(polTotal / _PC_POL_PER));
  if (_pcPolPage > polPages) _pcPolPage = polPages;
  var polStart = (_pcPolPage - 1) * _PC_POL_PER;
  var polSlice = empList.slice(polStart, polStart + _PC_POL_PER);

  // Rebuild rows for current page slice only
  rows = polSlice.map(function(e,i) {
    return '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);">'+(polStart+i+1)+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+e.empNo+'</td>'
      + '<td style="padding:7px 10px;font-weight:600;font-size:12px;">'+e.name+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;">'+e.role+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+e.leader+'</td>'
      + '<td style="padding:7px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:13px;'+_pcHeat(e.total)+'">'+e.total+'</td>'
      + shownMonths.map(function(m){
          var n = e.months[m]||0;
          return '<td style="padding:7px 6px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:12px;'+_pcHeat(n)+'">'+(n||'—')+'</td>';
        }).join('')
      + '</tr>';
  }).join('');

  var polPager = polTotal > _PC_POL_PER
    ? '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:8px;">'
      + '<span style="font-size:11px;color:var(--text3);">Page '+_pcPolPage+'/'+polPages+' ('+polTotal+' employees)</span>'
      + '<button class="btn btn-sm" onclick="_pcPolPage=Math.max(1,_pcPolPage-1);_pcRerender()" '+(_pcPolPage<=1?'disabled':'')+'>Prev</button>'
      + '<button class="btn btn-sm" onclick="_pcPolPage=Math.min('+polPages+',_pcPolPage+1);_pcRerender()" '+(_pcPolPage>=polPages?'disabled':'')+'>Next</button>'
      + '</div>'
    : '';

  var table = empList.length===0
    ? '<div class="empty"><div class="empty-ico">&#x1F4CB;</div>No records for the selected period.</div>'
    : '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px;">'
      + thead + '<tbody>'+rows+'</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:6px;">Heat: <span style="color:var(--accent);font-weight:600;">1–2</span> &nbsp;&middot;&nbsp; <span style="color:var(--warn);font-weight:600;">3–5</span> &nbsp;&middot;&nbsp; <span style="color:var(--err);font-weight:700;">6+</span></div>'
      + polPager;

  return filterBar + stats + table;
}

// Admin: push seed data to Firebase
async function _pcAdminImport() {
  var msg = document.getElementById('pc-import-msg');
  if (msg) msg.innerHTML = '<span style="color:var(--text3);">&#x23F3; Pushing to cloud...</span>';
  _pcInit();
  state._pcUpdatedAt = Date.now();
  save();
  var ok = false;
  if (typeof syncWrite === 'function') {
    try { await syncWrite(); ok = true; } catch(e) { ok = false; }
  }
  if (msg) msg.innerHTML = ok
    ? '<span style="color:var(--ok);">&#x2714; '+_pcData().length+' records pushed to cloud.</span>'
    : '<span style="color:var(--err);">&#x26A0; Push failed — check Cloud Sync.</span>';
}

// ════════════════════════════════════════════
//  TAB 2: ALL RECORDS
// ════════════════════════════════════════════
function _pcRenderRecords() {
  // Only re-apply filters if _pcFiltered is empty (first load or filter changed)
  // Pagination buttons call _pcRerender() directly without resetting filters
  if (!_pcFiltered || _pcFiltered.length === 0) _pcApplyFilters();
  var all = _pcData();
  var res  = all.filter(function(r){return r.status==='Resolved';}).length;
  var proc = all.filter(function(r){return r.status==='Processing';}).length;
  var pend = all.filter(function(r){return r.status==='Need Review'||r.status==='Need Resolve';}).length;
  var f   = _pcRF;
  var ss  = 'height:30px;padding:0 8px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);';

  var leaders = [...new Set(all.map(function(r){return r.leader;}).filter(Boolean))].sort();

  var mkSel = function(fld, val, opts, ph) {
    return '<select style="'+ss+'" onchange="_pcRF.'+fld+'=this.value;_pcPage=1;_pcApplyFilters();_pcRerender()">'
      + '<option value="">'+ph+'</option>'
      + opts.map(function(o){
          var v=o.v||o, l=o.l||o;
          return '<option value="'+v+'"'+(v===val?' selected':'')+'>'+l+'</option>';
        }).join('')
      + '</select>';
  };

  var stats = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">'
    + '<div class="stat"><div class="stat-label">Total</div><div class="stat-num" style="color:var(--accent);">'+all.length+'</div></div>'
    + '<div class="stat"><div class="stat-label">Resolved</div><div class="stat-num" style="color:var(--ok);">'+res+'</div></div>'
    + '<div class="stat"><div class="stat-label">Processing</div><div class="stat-num" style="color:#d97706;">'+proc+'</div></div>'
    + '<div class="stat"><div class="stat-label">Need action</div><div class="stat-num" style="color:var(--err);">'+pend+'</div></div>'
    + '</div>';

  var filterRow = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:12px;">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px;">'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">From</div><input type="date" value="'+(f.dateFrom||'')+'" onchange="_pcRF.dateFrom=this.value;_pcPage=1;_pcApplyFilters();_pcRerender()" style="'+ss+'"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">To</div><input type="date" value="'+(f.dateTo||'')+'" onchange="_pcRF.dateTo=this.value;_pcPage=1;_pcApplyFilters();_pcRerender()" style="'+ss+'"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Status</div>'+mkSel('status',f.status,['Processing','Need Review','Need Resolve','Resolved','Cancelled'],'All statuses')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Role</div>'+mkSel('role',f.role,['Agent','Agent Leader','Agent Supervisor','QA','Sr Agent','Sr QA'],'All roles')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Shift</div>'+mkSel('shift',f.shift,['A','B','C','D','E'],'All')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Event</div>'+mkSel('event',f.event,Object.keys(PC_EVENTS).map(function(k){return {v:k,l:k+' — '+PC_EVENTS[k].split('—')[0].trim()};}), 'All events')+'</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Leader</div>'+mkSel('leader',f.leader,leaders,'All leaders')+'</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
    + '<input type="text" value="'+(f.search||'')+'" placeholder="Search name / emp no / username..." oninput="_pcRF.search=this.value;_pcPage=1;_pcApplyFilters();_pcRerender()" style="'+ss+'width:250px;">'
    + '<button onclick="_pcRF={dateFrom:\'\',dateTo:\'\',status:\'\',role:\'\',shift:\'\',event:\'\',leader:\'\',search:\'\'};_pcPage=1;_pcApplyFilters();_pcRerender()" style="'+ss+'color:var(--text2);">Reset</button>'
    + '<button onclick="_pcOpenAddModal()" class="btn btn-accent btn-sm" style="margin-left:auto;font-size:12px;padding:5px 14px;">+ Add Record</button>'
    + '</div></div>';

  var start = (_pcPage-1)*_PC_PER;
  var slice = _pcFiltered.slice(start, start+_PC_PER);
  var totalPages = Math.max(1, Math.ceil(_pcFiltered.length/_PC_PER));

  var rows = slice.length===0
    ? '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3);">No matching records.</td></tr>'
    : slice.map(function(r,i) {
        
        return '<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="_pcOpenEditModalByNo('+r.no+')">'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+r.no+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;font-family:\'IBM Plex Mono\',monospace;">'+r.date+'</td>'
          + '<td style="padding:7px 10px;font-weight:600;font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.name+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+r.empNo+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;">'+r.role+'</td>'
          + '<td style="padding:7px 10px;text-align:center;"><span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:4px;font-size:11px;font-weight:700;background:var(--bg4);color:var(--text2);">'+(r.shift||'—')+'</span></td>'
          + '<td style="padding:7px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-weight:700;font-size:12px;color:var(--accent);">'+r.event+'</td>'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.leader+'</td>'
          + '<td style="padding:7px 10px;">'+_pcStatusBadge(r.status)+'</td>'
          + '<td style="padding:7px 10px;">'+(r.agentFeedback?'<span style="font-size:11px;color:var(--ok);">&#x1F4AC;</span>':'')+'</td>'
          + (isTraining(currentUser)
            ? '<td style="padding:5px 8px;white-space:nowrap;">'
              + ((r.status==='Need Review'||r.status==='Need Resolve')
                ? '<button class="btn btn-sm btn-ok" style="font-size:11px;padding:3px 10px;margin-right:4px;" onclick="event.stopPropagation();_pcTrainingAction('+r.no+',\'Resolved\')">✓ Resolve</button>'
                  + '<button class="btn btn-sm" style="font-size:11px;padding:3px 10px;background:var(--bg4);color:var(--text2);" onclick="event.stopPropagation();_pcTrainingAction('+r.no+',\'Cancelled\')">✕ Cancel</button>'
                : '<span style="font-size:11px;color:var(--text3);">—</span>')
              + '</td>'
            : '')
          + '</tr>';
      }).join('');

  var pager = '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:8px;">'
    + '<span style="font-size:11px;color:var(--text3);">Page '+_pcPage+'/'+totalPages+' ('+_pcFiltered.length+')</span>'
    + '<button class="btn btn-sm" onclick="_pcPage=Math.max(1,_pcPage-1);_pcRerender()" '+(_pcPage<=1?'disabled':'')+'>Prev</button>'
    + '<button class="btn btn-sm" onclick="_pcPage=Math.min('+totalPages+',_pcPage+1);_pcRerender()" '+(_pcPage>=totalPages?'disabled':'')+'>Next</button>'
    + '</div>';

  return stats + filterRow
    + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px;">'
    + '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + ['#','DATE','NAME','EMP NO.','ROLE','SFT','EVENT','LEADER','STATUS','FB', isTraining(currentUser)?'ACTIONS':''].filter(Boolean).map(function(h){
        return '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">'+h+'</th>';
      }).join('')
    + '</tr></thead><tbody>'+rows+'</tbody></table></div>'
    + pager;
}

function _pcOpenEditModalByNo(no) {
  var idx = _pcData().findIndex(function(r) { return r.no === no; });
  if (idx === -1) { toast('Record not found — page may have refreshed.', 'warn'); return; }
  _pcOpenEditModal(idx);
}

// ════════════════════════════════════════════
//  TAB 3: SUMMARY 30D
// ════════════════════════════════════════════
function _pcRenderSummary() {
  var cutoff = _pcCutoff30();
  var today  = _pcToday();
  var all    = _pcData();
  var base   = all.filter(function(r){ return r.date >= cutoff && r.date <= today; });

  var leaders = [...new Set(all.map(function(r){return r.leader;}).filter(Boolean))].sort();
  var ss = 'height:30px;padding:0 10px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer;';

  // Apply filters
  var filtered = base.filter(function(r){
    if (_pcS30Role   && r.role   !== _pcS30Role)   return false;
    if (_pcS30Event  && r.event  !== _pcS30Event)  return false;
    if (_pcS30Leader && r.leader !== _pcS30Leader) return false;
    return true;
  });

  var filterBar = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">'
    + '<div style="font-size:12px;color:var(--text2);font-weight:500;align-self:center;">Last 30 days &nbsp;<span style="color:var(--text3);font-size:11px;">'+cutoff+' → '+today+'</span></div>'
    + '<div style="margin-left:8px;"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Role</div>'
    + '<select style="'+ss+'" onchange="_pcS30Role=this.value;_pcRerender()">'
    + '<option value="">All roles</option>'
    + ['Agent','Agent Leader','Agent Supervisor','QA','Sr Agent','Sr QA'].map(function(r){return '<option value="'+r+'"'+(_pcS30Role===r?' selected':'')+'>'+r+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Event</div>'
    + '<select style="'+ss+'" onchange="_pcS30Event=this.value;_pcRerender()">'
    + '<option value="">All events</option>'
    + Object.keys(PC_EVENTS).map(function(k){return '<option value="'+k+'"'+(_pcS30Event===k?' selected':'')+'>'+k+' — '+PC_EVENTS[k].split('—')[0].trim()+'</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Leader</div>'
    + '<select style="'+ss+'" onchange="_pcS30Leader=this.value;_pcRerender()">'
    + '<option value="">All leaders</option>'
    + leaders.map(function(l){return '<option value="'+l+'"'+(_pcS30Leader===l?' selected':'')+'>'+l+'</option>';}).join('')
    + '</select></div>'
    + '<button onclick="_pcS30Role=\'\';_pcS30Event=\'\';_pcS30Leader=\'\';_pcRerender()" style="'+ss+'color:var(--text2);margin-top:13px;">Reset</button>'
    + '<span style="font-size:11px;color:var(--text3);align-self:center;margin-top:13px;">'+filtered.length+' violations</span>'
    + '</div>';

  if (filtered.length===0) {
    return filterBar + '<div class="empty"><div class="empty-ico">&#x2705;</div>No violations in the last 30 days matching the selected filters.</div>';
  }

  // ── Stats cards ──
  var roles   = ['Agent','Sr Agent','QA','Sr QA','Agent Leader','Agent Supervisor'];
  var statRow = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:16px;">'
    + roles.map(function(role) {
        var n = filtered.filter(function(r){return r.role===role;}).length;
        return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center;">'
          + '<div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-family:\'IBM Plex Mono\',monospace;">'+role.replace('Agent ','').replace('Sr ','Sr ')+'</div>'
          + '<div style="font-size:22px;font-weight:600;'+_pcHeat(n)+'">'+n+'</div>'
          + '</div>';
      }).join('')
    + '</div>';

  // ── Warning card: repeat violators (≥2 in 30 days, non-cancelled) ──
  // Built from unfiltered base so filters don't hide the alert.
  var byPersonAll = {};
  base.forEach(function(r) {
    if (r.status === 'Cancelled') return;
    var k = r.username || r.name;
    if (!byPersonAll[k]) byPersonAll[k] = { name: r.name, username: r.username, role: r.role, records: [] };
    byPersonAll[k].records.push(r);
  });
  var warned = Object.values(byPersonAll)
    .filter(function(p) { return p.records.length >= 2; })
    .sort(function(a, b) { return b.records.length - a.records.length; });

  var warningCard = '';
  if (warned.length > 0 && (isTraining(currentUser) || isAdmin(currentUser))) {
    var warningRows = warned.map(function(p) {
      var emailSentRec = p.records.filter(function(r) { return r.mailCheck && r.warningMailDate; })
        .sort(function(a, b) { return (b.warningMailDate || '').localeCompare(a.warningMailDate || ''); })[0];
      var emailSent = !!emailSentRec;
      var emailAddr = p.username + '@discoveryloft.com';
      return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid rgba(239,68,68,.12);">'
        + '<div style="flex:1;min-width:200px;">'
        + '<span style="font-size:13px;font-weight:700;">' + p.name + '</span>'
        + '<span style="font-size:11px;color:var(--text3);margin-left:8px;">' + p.role + '</span>'
        + '<span style="font-size:11px;font-weight:700;margin-left:8px;color:var(--err);">' + p.records.length + ' violations</span>'
        + '<div style="font-size:11px;color:var(--text3);margin-top:2px;font-family:\'IBM Plex Mono\',monospace;">' + emailAddr + '</div>'
        + '</div>'
        + (emailSent
          ? '<div style="font-size:11px;color:var(--ok);background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);border-radius:6px;padding:4px 10px;white-space:nowrap;">'
            + '✓ Email sent ' + emailSentRec.warningMailDate + (emailSentRec.warningEmailSentBy ? ' by ' + emailSentRec.warningEmailSentBy : '') + '</div>'
          : '<div style="display:flex;gap:6px;flex-shrink:0;">'
            + '<button class="btn btn-sm" style="font-size:11px;padding:4px 12px;background:var(--err);color:#fff;border:none;" '
            + 'onclick="_pcSendWarningEmail(\'' + p.username + '\',\'' + p.name.replace(/'/g,"\\'") + '\')">📧 Send Email</button>'
            + '<button class="btn btn-sm" style="font-size:11px;padding:4px 12px;" '
            + 'onclick="_pcMarkEmailSent(\'' + p.username + '\',\'' + p.name.replace(/'/g,"\\'") + '\')">✓ Mark as Sent</button>'
            + '</div>'
        )
        + '</div>';
    }).join('');

    warningCard = '<div style="border:1px solid rgba(239,68,68,.35);border-radius:8px;background:rgba(239,68,68,.04);padding:14px 16px;margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
      + '<span style="font-size:13px;font-weight:700;color:var(--err);">⚠ Repeat Violators — Email Warning Needed</span>'
      + '<span style="font-size:11px;background:var(--err);color:#fff;padding:2px 8px;border-radius:99px;font-weight:600;">' + warned.length + '</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.6;">'
      + 'These staff members have ≥2 violations in the last 30 days. Send a warning email, then mark it as sent to track it.'
      + '</div>'
      + warningRows
      + '</div>';
  }

  // ── Group by role → per-person table ──
  var byPerson = {};
  filtered.forEach(function(r) {
    var k = r.username||r.name;
    if (!byPerson[k]) byPerson[k]={name:r.name,empNo:r.empNo,role:r.role,username:r.username,leader:r.leader,records:[]};
    byPerson[k].records.push(r);
  });

  var eventKeys = [...new Set(filtered.map(function(r){return r.event;}))].sort();

  // Group persons by role
  var roleOrder = ['Agent','Sr Agent','QA','Sr QA','Agent Leader','Agent Supervisor'];
  var sections  = '';
  roleOrder.forEach(function(role) {
    var persons = Object.values(byPerson).filter(function(p){return p.role===role;});
    if (!persons.length) return;
    persons.sort(function(a,b){return b.records.length-a.records.length;});

    var ROLE_COLORS = {
      'Agent':'var(--accent)','Sr Agent':'var(--B-color)','QA':'var(--E-color)',
      'Sr QA':'var(--C-color)','Agent Leader':'var(--warn)','Agent Supervisor':'var(--A-color)'
    };
    var color = ROLE_COLORS[role]||'var(--text2)';

    var thead = '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">#</th>'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;min-width:130px;">NAME</th>'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">LEADER</th>'
      + '<th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--accent);font-family:\'IBM Plex Mono\',monospace;">TOTAL</th>'
      + '<th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">VIOLATIONS</th>'
      + '</tr></thead>';

    var rows = persons.map(function(p,i) {
      var evCounts = {};
      p.records.forEach(function(r){ evCounts[r.event]=(evCounts[r.event]||0)+1; });
      var nonCancelledCount = p.records.filter(function(r){ return r.status !== 'Cancelled'; }).length;
      var emailSentForPerson = p.records.some(function(r){ return r.mailCheck && r.warningMailDate; });
      var repeatBadge = nonCancelledCount >= 2
        ? (emailSentForPerson
            ? '<span title="Warning email sent" style="font-size:10px;margin-left:6px;color:var(--ok);">✉✓</span>'
            : '<span title="≥2 violations — email recommended" style="font-size:10px;margin-left:6px;color:var(--err);font-weight:700;">⚠</span>')
        : '';
      var evBadges = Object.entries(evCounts).sort(function(a,b){return b[1]-a[1];}).map(function(e){
        return '<span title="'+( PC_EVENTS[e[0]]||e[0])+'" style="display:inline-flex;align-items:center;gap:3px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:1px 6px;border-radius:4px;background:var(--bg4);color:var(--text2);margin:1px;">'
          + e[0]+(e[1]>1?'<b style="color:var(--accent);margin-left:2px;">×'+e[1]+'</b>':'')+'</span>';
      }).join('');
      return '<tr style="border-bottom:1px solid var(--border);">'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text3);">'+(i+1)+'</td>'
        + '<td style="padding:6px 10px;font-weight:600;font-size:12px;">'+p.name+repeatBadge+'</td>'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text3);">'+p.leader+'</td>'
        + '<td style="padding:6px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:13px;'+_pcHeat(p.records.length)+'">'+p.records.length+'</td>'
        + '<td style="padding:6px 10px;">'+evBadges+'</td>'
        + '</tr>';
    }).join('');

    sections += '<div style="margin-bottom:16px;">'
      + '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:'+color+';padding-bottom:6px;border-bottom:1px solid var(--border);">'
      + role+' <span style="font-size:11px;color:var(--text3);font-weight:400;">'+persons.length+' staff · '+persons.reduce(function(s,p){return s+p.records.length;},0)+' violations</span></div>'
      + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + thead + '<tbody>'+rows+'</tbody></table></div></div>';
  });

  // ── Event reference ──
  var ref = '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-top:4px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">Event code reference</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;font-size:12px;">'
    + Object.entries(PC_EVENTS).map(function(e){return '<div><b style="font-family:\'IBM Plex Mono\',monospace;color:var(--accent);">'+e[0]+'</b> — '+e[1]+'</div>';}).join('')
    + '</div></div>';

  return filterBar + statRow + warningCard + sections + ref;
}

// ════════════════════════════════════════════
//  EDIT MODAL
// ════════════════════════════════════════════
function _pcEditModalHTML() {
  return '<div id="pc-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:600;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:22px;width:560px;max-width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<span style="font-size:15px;font-weight:600;" id="pc-modal-title">Record</span>'
    + '<button onclick="_pcCloseModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);line-height:1;">&#x2715;</button>'
    + '</div><div id="pc-modal-body"></div></div></div>';
}

function _pcCloseModal() {
  var el = document.getElementById('pc-modal');
  if (el) el.style.display = 'none';
}

function _pcOpenEditModal(idx) {
  var r   = _pcData()[idx];
  var ldr = isLeader(currentUser);
  var agentView = !ldr && r.username === currentUser.username;

  document.getElementById('pc-modal-title').textContent = 'Record #'+r.no+' — '+r.name;
  document.getElementById('pc-modal-body').innerHTML = ''
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:12px;background:var(--bg3);border-radius:8px;padding:12px;">'
    + '<div><span style="color:var(--text3);">Date</span><br><b>'+r.date+'</b></div>'
    + '<div><span style="color:var(--text3);">Event</span><br><b style="font-family:\'IBM Plex Mono\',monospace;color:var(--accent);">'+r.event+'</b> — '+PC_EVENTS[r.event]+'</div>'
    + '<div><span style="color:var(--text3);">Employee</span><br><b>'+r.name+'</b> · '+r.empNo+'</div>'
    + '<div><span style="color:var(--text3);">Role / Shift</span><br>'+r.role+' / Shift '+(r.shift||'—')+'</div>'
    + '<div><span style="color:var(--text3);">Leader</span><br>'+r.leader+'</div>'
    + '<div><span style="color:var(--text3);">Status</span><br>'+_pcStatusBadge(r.status)+'</div>'
    + '</div>'
    + (r.description ? '<div style="font-size:12px;background:var(--bg3);border-radius:6px;padding:10px;margin-bottom:12px;line-height:1.8;color:var(--text2);">'+r.description+'</div>' : '')
    + (r.duration    ? '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Duration: <b>'+r.duration+'</b></div>' : '')
    + (r.imageLink   ? '<div style="font-size:11px;margin-bottom:8px;"><a href="'+r.imageLink+'" target="_blank" style="color:var(--accent);">&#x1F517; View evidence</a></div>' : '')
    + (r.leaderConfirm ? '<div style="font-size:11px;background:rgba(31,102,241,.06);border:1px solid rgba(31,102,241,.15);border-radius:6px;padding:8px 12px;margin-bottom:12px;">Leader note: '+r.leaderConfirm+'</div>' : '')

    // Agent feedback section (visible to all)
    + '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px;">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">&#x1F4AC; Agent Feedback</div>'
    + (r.agentFeedback
        ? '<div style="font-size:12px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:7px;padding:10px 12px;line-height:1.7;">'+r.agentFeedback+'</div>'
        : '<div style="font-size:12px;color:var(--text3);font-style:italic;">No feedback yet.</div>')
    + '</div>'

    // Leader edit section
    + (ldr ? '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px;">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:10px;">Leader edit</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
      + (isTraining(currentUser)
  ? '<div class="fg"><label>Status</label><select id="pce-status">'
    + ['Processing','Need Review','Need Resolve','Resolved','Cancelled'].map(function(s){
        return '<option value="'+s+'"'+(r.status===s?' selected':'')+'>'+s+'</option>';
      }).join('')
    + '</select></div>'
  : '<div class="fg"><label>Status</label><div style="font-size:12px;padding:8px 10px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);">'+_pcStatusBadge(r.status)+'</div></div>')
      + '<div class="fg"><label>Mail check</label><select id="pce-mail"><option value="false" '+(!r.mailCheck?'selected':'')+'>No</option><option value="true" '+(r.mailCheck?'selected':'')+'>Yes</option></select></div>'
      + '</div>'
      + '<div class="fg" style="margin-bottom:12px;"><label>Leader confirm note</label><textarea id="pce-confirm" style="min-height:50px;">'+(r.leaderConfirm||'')+'</textarea></div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button class="btn btn-accent" onclick="_pcSaveEdit('+r.no+')">Save</button>'
      + '<button class="btn" onclick="_pcCloseModal()">Cancel</button>'
      + '</div><div id="pce-msg" style="font-size:11px;margin-top:6px;min-height:16px;"></div>'
      + '</div>' : '')
    ;

  document.getElementById('pc-modal').style.display = 'flex';
}

function _pcSaveEdit(no) {
  var idx = state.policyCompliance.findIndex(function(r) { return r.no === no; });
  if (idx === -1) { toast('Record not found.', 'err'); _pcCloseModal(); return; }
  var r = state.policyCompliance[idx];

  // Only Training can update status
  if (isTraining(currentUser)) {
    r.status = document.getElementById('pce-status').value;
    r.mailCheck = document.getElementById('pce-mail').value === 'true';
  }
  // Leader can update confirm note
  r.leaderConfirm = document.getElementById('pce-confirm').value;

  save();
  if (typeof syncWrite === 'function') syncWrite();
  var msg = document.getElementById('pce-msg');
  if (msg) msg.innerHTML = '<span style="color:var(--ok);">&#x2714; Saved</span>';
  setTimeout(_pcCloseModal, 600);
  _pcApplyFilters(); _pcRerender();
}

// ════════════════════════════════════════════
//  ADD RECORD MODAL (leader only)
// ════════════════════════════════════════════
function _pcOpenAddModal() {
  if (!isLeader(currentUser)) return;
  var today = _pcToday();
  var usernames = state.users.map(function(u){return u.username;}).filter(Boolean).sort();
  var SHIFT_TIMES = {A:'3PM→12AM',B:'7PM→4AM',C:'9PM→6AM',D:'12AM→9AM',E:'6AM→3PM'};

  document.getElementById('pc-modal-title').textContent = 'Add Violation Record';
  document.getElementById('pc-modal-body').innerHTML = ''
  
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'

    // Username
    + '<div class="fg"><label>Username * <span style="font-size:10px;color:var(--text3);">(auto-fills below)</span></label>'
    + '<input type="text" id="pca-user" list="pca-user-list" placeholder="e.g. thien.nguyenthanh" oninput="_pcaAutoFill()" style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;">'
    + '<datalist id="pca-user-list">'+usernames.map(function(u){return '<option value="'+u+'">';}).join('')+'</datalist>'
    + '<div id="pca-status" style="font-size:11px;min-height:14px;margin-top:3px;"></div></div>'

    // Date
    + '<div class="fg"><label>Date *</label><input type="date" id="pca-date" value="'+today+'"></div>'

    // Shift (badge picker)
    + '<div class="fg"><label>Shift <span style="font-size:10px;color:var(--accent);background:rgba(31,102,241,.1);padding:1px 6px;border-radius:99px;margin-left:3px;">from schedule</span></label>'
    + '<div style="display:flex;gap:5px;margin-top:2px;" id="pca-shifts">'
    + ['A','B','C','D','E'].map(function(s){
        return '<span id="pca-sb-'+s+'" onclick="window._pcaShift=\''+s+'\';_pcaSelectShift(\''+s+'\');" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid transparent;background:var(--'+s+'-bg);color:var(--'+s+'-color);">'+s+'</span>';
      }).join('')
    + '</div>'
    + '<div id="pca-shift-note" style="font-size:11px;color:var(--text3);margin-top:3px;">—</div></div>'

    // Event
    + '<div class="fg"><label>Event *</label>'
    + '<select id="pca-event"><option value="">Select event</option>'
    + Object.keys(PC_EVENTS).map(function(k){return '<option value="'+k+'">'+k+' — '+PC_EVENTS[k]+'</option>';}).join('')
    + '</select></div>'

    // Duration + Image
    + '<div class="fg"><label>Duration <span style="font-size:10px;color:var(--text3);">optional</span></label><input type="text" id="pca-dur" placeholder="0:15:00"></div>'
    + '<div class="fg"><label>Image link <span style="font-size:10px;color:var(--text3);">optional</span></label><input type="url" id="pca-img" placeholder="https://drive.google.com/..."></div>'
    + '</div>'

    // Description
    + '<div class="fg" style="margin-bottom:10px;"><label>Description</label><textarea id="pca-desc" style="min-height:52px;"></textarea></div>'

    // Auto-filled row
    + '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">Auto-retrieved <span style="color:var(--accent);font-size:9px;">read only</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px;">'
    + '<div><span style="color:var(--text3);font-size:11px;">Name</span><br><b id="pca-name" style="font-size:12px;">—</b></div>'
    + '<div><span style="color:var(--text3);font-size:11px;">Emp No.</span><br><span id="pca-empno" style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;">—</span></div>'
    + '<div><span style="color:var(--text3);font-size:11px;">Role</span><br><span id="pca-role" style="font-size:11px;">—</span></div>'
    + '<div><span style="color:var(--text3);font-size:11px;">Leader</span><br><span id="pca-leader" style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;">—</span></div>'
    + '</div></div>'

    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
    + '<div style="font-size:11px;color:#d97706;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:6px;padding:5px 12px;align-self:center;">Status: Processing</div>'
    + '<button class="btn btn-accent" onclick="_pcaSaveRecord()" style="margin-top:0;">Save record</button>'
    + '<button class="btn" onclick="_pcCloseModal()">Cancel</button>'
    + '</div>'
    + '<div id="pca-msg" style="font-size:11px;margin-top:8px;min-height:16px;"></div>';
// ADD THIS after innerHTML is set:
setTimeout(function() {
  var leaderEl = document.getElementById('pca-leader');
  if (leaderEl) leaderEl.textContent = currentUser.name;
}, 10);
  window._pcaShift = null;
  document.getElementById('pc-modal').style.display = 'flex';

  // Try to auto-detect shift for today
  setTimeout(function() {
    var u = state.users.find(function(u){return u.username===currentUser.username;});
    if (u && u.schedule) {
      var d = new Date();
      var dk = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
      var sch = u.schedule[dk];
      if (sch && sch!=='0') _pcaSelectShift(sch.charAt(0));
    }
  }, 50);
}

// Leader→username map
var _PC_LEADER_MAP = {
  'thanh.ht':'hai.nguyen','thien.nguyen':'thuy.nguyenhong','tho.nh':'tam.to',
  'thien.nguyenthanh':'hai.nguyen','thao.nguyen':'thuy.nguyenhong','tuan.tran':'dung.tran',
  'giau.nguyen':'tam.to','tran.le':'tran.le','nam.nguyendinh':'duy.huynh',
  'nhu.le':'thanh.nguyen','duy.bui':'duy.huynh','tinh.nguyenmaiviet':'hai.nguyen',
  'anh.nguyen':'duy.huynh','triet.le':'thanh.nguyen','chi.nguyen':'hoa.nguyen',
  'y.nguyen':'thuy.nguyenhong','hoa.nguyen':'hoa.nguyen','anh.bui':'thanh.nguyen',
  'huy.tran':'duy.huynh','phu.nguyenhoang':'hoa.nguyen','huyen.huynh':'tam.to',
  'trang.tran':'dung.tran','khang.nguyen':'tam.to','kien.nguyen':'hoa.nguyen',
  'yen.ho':'tran.le','uyen.tran':'thuy.nguyenhong','duy.nguyenhuynhquoc':'thanh.nguyen',
  'anh.trantuan':'thuy.nguyenhong','phuc.ho':'duy.huynh','kien.vu':'dung.tran',
  'nhu.nguyen':'tam.to','vu.nguyen':'cuong.pham','nam.vo':'tam.to',
  'ngoc.nguyen':'thuy.nguyenhong','thinh.nguyen':'tran.le','nam.nguyenthanh':'hai.nguyen',
  'tu.nbt':'tran.le','thinh.phanxuan':'hoa.nguyen','tam.to':'tam.to',
  'danh.phamcong':'thanh.nguyen','luu.nguyendinh':'duy.huynh','vi.votuan':'duy.huynh',
  'khoa.le':'duy.huynh','long.nguyen':'tam.to','minhduy.tran':'thanh.nguyen',
  'tung.dang':'duy.huynh','hoang.nguyentuyen':'hoa.nguyen','linh.ptt':'duy.huynh',
  'bao.phan':'thuy.nguyenhong','phong.nguyen':'thuy.nguyenhong','hien.nhu':'tran.le',
  'nhi.le':'thuy.nguyenhong','huyhien.nguyen':'hai.nguyen','anh.le':'thanh.nguyen',
  'bao.vo':'tran.le','quang.nguyenthanh':'tran.le','duy.nguyenquoc':'hai.nguyen',
  'duy.nk':'thanh.nguyen','hai.cao':'duy.huynh','hieu.truong':'duy.huynh',
  'thao.phan':'duy.huynh','nhan.nguyenthanh':'thuy.nguyenhong','thuy.ngodiem':'tran.le',
  'thien.ht':'ngocanh.tran','anh.dao':'tran.le','nguyen.nguyentran':'thuy.nguyenhong',
  'lua.nt':'ngocanh.tran','que.nguyenthihong':'ngocanh.tran',
};

function _pcaAutoFill() {
  var val = (document.getElementById('pca-user').value||'').trim().toLowerCase();
  var st  = document.getElementById('pca-status-line')||document.getElementById('pca-status');
  var status = document.getElementById('pca-status');
  var pst    = document.getElementById('pca-status-line')||document.getElementById('pca-status');

  var setField = function(id, v) { var el=document.getElementById(id); if(el) el.textContent=v||'—'; };

  if (!val) { setField('pca-name','—'); setField('pca-empno','—'); setField('pca-role','—'); setField('pca-leader','—'); return; }

  var user = state.users.find(function(u){return u.username===val;});
  var si   = state.staffInfo&&state.staffInfo[val];

  if (user || si) {
    setField('pca-name',   (user&&user.name)   || (si&&si.name)   || val);
    setField('pca-empno',  (user&&user.empNo)   || (si&&si.empNo)  || '');
    setField('pca-role',   (user&&user.role)    || (si&&si.role)   || '');
    

    // Auto-fill shift from today's schedule
    if (user && user.schedule) {
      var d  = new Date();
      var dk = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
      var sch = user.schedule[dk] || user.schedule[WEEK_DAYS[d.getDay()===0?6:d.getDay()-1]] || null;
      if (sch && sch!=='0' && 'ABCDE'.indexOf(sch.charAt(0))>=0) {
        _pcaSelectShift(sch.charAt(0));
        window._pcaShift = sch.charAt(0);
      }
    }
    var msg = document.getElementById('pca-status');
    // no-op: name displayed
  }
}

function _pcaSelectShift(s) {
  var TIMES = {A:'3PM→12AM',B:'7PM→4AM',C:'9PM→6AM',D:'12AM→9AM',E:'6AM→3PM'};
  window._pcaShift = s;
  ['A','B','C','D','E'].forEach(function(x){
    var el=document.getElementById('pca-sb-'+x);
    if (el) el.style.border=(x===s)?'2px solid var(--'+s+'-color)':'2px solid transparent';
  });
  var note=document.getElementById('pca-shift-note');
  if (note) note.textContent='Shift '+s+' · '+(TIMES[s]||'');
}

function _pcaSaveRecord() {
  var user    = (document.getElementById('pca-user').value||'').trim();
  var event   = (document.getElementById('pca-event').value||'').trim();
  var msg     = document.getElementById('pca-msg');
  if (!user)  { if(msg) msg.innerHTML='<span style="color:var(--err);">Enter username.</span>'; return; }
  if (!event) { if(msg) msg.innerHTML='<span style="color:var(--err);">Select event.</span>'; return; }
  if (!window._pcaShift) { if(msg) msg.innerHTML='<span style="color:var(--err);">Select shift.</span>'; return; }

  var d  = _pcData();
  var no = d.reduce(function(m,r){return Math.max(m,r.no||0);},0)+1;
  var nameEl   = document.getElementById('pca-name');
  var empnoEl  = document.getElementById('pca-empno');
  var roleEl   = document.getElementById('pca-role');
  var leaderEl = document.getElementById('pca-leader');

  d.push({
    no: no,
    date:    document.getElementById('pca-date').value,
    leader: currentUser.name,
    empNo:   empnoEl  ? empnoEl.textContent.replace('—','')  : '',
    name:    nameEl   ? nameEl.textContent.replace('—','')   : user,
    role:    roleEl   ? roleEl.textContent.replace('—','')   : '',
    username: user,
    shift:   window._pcaShift,
    event:   event,
    description: (document.getElementById('pca-desc').value||'').trim(),
    duration:    (document.getElementById('pca-dur').value||'').trim(),
    imageLink:   (document.getElementById('pca-img').value||'').trim(),
    agentFeedback: '',
    status: 'Processing',
    leaderConfirm:'', mailCheck:false, warningMailDate:'',
  });
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (msg) msg.innerHTML = '<span style="color:var(--ok);">&#x2714; Record #'+no+' saved.</span>';
  setTimeout(function(){ _pcCloseModal(); _pcApplyFilters(); _pcRerender(); }, 700);
}

// Training: resolve or cancel a record directly from All Records
function _pcTrainingAction(no, newStatus) {
  if (!isTraining(currentUser)) { toast('Only Training can do this.', 'err'); return; }
  var idx = state.policyCompliance.findIndex(function(r) { return r.no === no; });
  if (idx === -1) { toast('Record not found.', 'err'); return; }
  state.policyCompliance[idx].status = newStatus;
  if (newStatus === 'Resolved') {
    state.policyCompliance[idx].resolvedBy = currentUser.username;
    state.policyCompliance[idx].resolvedAt = Date.now();
  } else {
    state.policyCompliance[idx].cancelledBy = currentUser.username;
    state.policyCompliance[idx].cancelledAt = Date.now();
  }
  state.policyCompliance[idx].feedbackReadByLeader = true;
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  if (typeof updateFeedbackBadge === 'function') updateFeedbackBadge();
  toast(newStatus === 'Resolved' ? '✓ Marked as Resolved — violation confirmed.' : '✕ Violation cancelled.', newStatus === 'Resolved' ? 'ok' : 'warn');
  _pcApplyFilters();
  _pcRerender();
}

// ════════════════════════════════════════════
//  WARNING EMAIL FUNCTIONS (Training only)
// ════════════════════════════════════════════

function _pcSendWarningEmail(username, name) {
  if (!isTraining(currentUser) && !isAdmin(currentUser)) return;
  var cutoff  = _pcCutoff30();
  var today   = _pcToday();
  var records = _pcData().filter(function(r) {
    return r.username === username && r.date >= cutoff && r.date <= today && r.status !== 'Cancelled';
  }).sort(function(a, b) { return a.date.localeCompare(b.date); });

  var email   = username + '@discoveryloft.com';
  var subject = encodeURIComponent('Policy Violation Warning — ' + name);
  var violationList = records.map(function(r) {
    return '- ' + r.date + ': [' + r.event + '] ' + (PC_EVENTS[r.event] || r.event)
      + (r.description ? ' — ' + r.description : '');
  }).join('\n');

  var body = encodeURIComponent(
    'Dear ' + name + ',\n\n'
    + 'This is a formal warning regarding the following policy violation(s) recorded in the past 30 days:\n\n'
    + violationList + '\n\n'
    + 'Please ensure full compliance with company policies going forward.\n'
    + 'If you have any questions, please speak with your team leader or contact Training.\n\n'
    + 'Regards,\n' + currentUser.name + '\nTraining Team'
  );

  window.open('mailto:' + email + '?subject=' + subject + '&body=' + body);
}

function _pcMarkEmailSent(username, name) {
  if (!isTraining(currentUser) && !isAdmin(currentUser)) return;
  var cutoff = _pcCutoff30();
  var today  = _pcToday();
  var marked = 0;
  state.policyCompliance.forEach(function(r) {
    if (r.username !== username) return;
    if (r.date < cutoff || r.date > today) return;
    if (r.status === 'Cancelled') return;
    r.mailCheck           = true;
    r.warningMailDate     = today;
    r.warningEmailSentBy  = currentUser.name;
    r.warningEmailSentAt  = Date.now();
    marked++;
  });
  if (marked === 0) { toast('No violations to mark.', 'warn'); return; }
  save();
  if (typeof syncWrite === 'function') syncWrite();
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  toast('✓ Warning email marked as sent for ' + (name || username) + ' (' + marked + ' violation' + (marked > 1 ? 's' : '') + ').', 'ok');
  _pcApplyFilters();
  _pcRerender();
}

// ── Re-render helper ──
function _pcRerender() {
  var el = document.getElementById('pc-content');
  if (!el) { nav('policy'); return; }
  var c = '';
  if      (_pcTab==='policy')  c = _pcRenderPolicy();
  else if (_pcTab==='records') c = _pcRenderRecords();
  else if (_pcTab==='summary') c = _pcRenderSummary();
  el.innerHTML = c;
}