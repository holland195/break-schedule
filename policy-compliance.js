// ═══════════════════════════════════════════════
//  POLICY COMPLIANCE — Full management page
//  Leader-only access (level >= 2)
//
//  Tabs:
//   1. View & Filter  — browse/search all records
//   2. Add Record     — username -> auto-fill -> save
//   3. Policy 2026    — per-employee monthly counts
//   4. Summary 30D    — last-30-day violation table
//   5. Export         — CSV download
//
//  HOW TO INTEGRATE:
//   1. Copy this file to your repo root
//   2. Add to index.html before </body>:
//      <script src="policy-compliance.js"></script>
//   3. In index.html sidebar, add (inside leader-only section):
//      <div class="nav-item leader-only" onclick="nav('policy')" data-page="policy">
//        <span class="nav-ico">📋</span> Policy Compliance
//      </div>
//   4. In nav.js pages object, add:
//      policy: renderPolicyCompliance,
//   5. In nav.js guards section, add:
//      if (page === 'policy' && !isLeader(currentUser)) {
//        content.innerHTML = '<div class="empty">Access denied.</div>'; return;
//      }
// ═══════════════════════════════════════════════

// Leader -> username map from compliance data
const PC_LEADER_MAP = {
  'thanh.ht':'hai.nguyen','thien.nguyen':'thuy.nguyenhong','tho.nh':'tam.to',
  'thien.nguyenthanh':'hai.nguyen','thao.nguyen':'thuy.nguyenhong','tuan.tran':'dung.tran',
  'giau.nguyen':'tam.to','tran.le':'tran.le','nam.nguyendinh':'duy.huynh',
  'anh.dao':'tran.le','nhu.le':'thanh.nguyen','duy.bui':'duy.huynh',
  'linh.ptt':'duy.huynh','bao.phan':'thuy.nguyenhong','phong.nguyen':'thuy.nguyenhong',
  'hien.nhu':'tran.le','thanh.dlq':'tam.to','ngon.nt':'tran.le',
  'tinh.nguyenmaiviet':'hai.nguyen','anh.nguyen':'duy.huynh','triet.le':'thanh.nguyen',
  'que.nguyenthihong':'ngocanh.tran','nguyen.nguyentran':'thuy.nguyenhong','lua.nt':'ngocanh.tran',
  'nhi.le':'thuy.nguyenhong','huyhien.nguyen':'hai.nguyen','anh.le':'thanh.nguyen',
  'bao.vo':'tran.le','quang.nguyenthanh':'tran.le','chi.nguyen':'hoa.nguyen',
  'tuong.nhambon':'thanh.nguyen','tu.lehoang':'tran.le','nhi.huynhtranuyen':'tran.le',
  'hai.cao':'duy.huynh','duy.nguyenquoc':'hai.nguyen','duy.nk':'thanh.nguyen',
  'y.nguyen':'thuy.nguyenhong','hoa.nguyen':'hoa.nguyen','hieu.truong':'duy.huynh',
  'thao.phan':'duy.huynh','anh.bui':'thanh.nguyen','nhan.nguyenthanh':'thuy.nguyenhong',
  'huy.tran':'duy.huynh','phu.nguyenhoang':'hoa.nguyen','huyen.huynh':'tam.to',
  'trang.tran':'dung.tran','thanhha.tran':'anh.tran','khang.nguyen':'tam.to',
  'kien.nguyen':'hoa.nguyen','yen.ho':'tran.le','thuy.ngodiem':'tran.le',
  'uyen.tran':'thuy.nguyenhong','thien.ht':'ngocanh.tran','duy.nguyenhuynhquoc':'thanh.nguyen',
  'anh.trantuan':'thuy.nguyenhong','phuc.ho':'duy.huynh','kien.vu':'dung.tran',
  'nhu.nguyen':'tam.to','vu.nguyen':'cuong.pham','nam.vo':'tam.to',
  'ngoc.nguyen':'thuy.nguyenhong','thinh.nguyen':'tran.le','nam.nguyenthanh':'hai.nguyen',
  'tu.nbt':'tran.le','thinh.phanxuan':'hoa.nguyen','tam.to':'tam.to',
  'danh.phamcong':'thanh.nguyen','luu.nguyendinh':'duy.huynh','vi.votuan':'duy.huynh',
  'khoa.le':'duy.huynh','long.nguyen':'tam.to','minhduy.tran':'thanh.nguyen',
  'tung.dang':'duy.huynh','hoang.nguyentuyen':'hoa.nguyen',
};

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

const PC_SEED = [
  {no:1,date:'2026-01-02',leader:'hai.nguyen',empNo:'AGM0257',name:'Ho Tan Thanh',role:'Agent',username:'thanh.ht',shift:'C',event:'3d',description:'Khong mo Slack trong gio lam viec.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:2,date:'2026-01-05',leader:'thuy.nguyenhong',empNo:'AGM0117',name:'Nguyen Huu Thien',role:'QA',username:'thien.nguyen',shift:'D',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:3,date:'2026-01-05',leader:'tam.to',empNo:'AGM0150',name:'Nguyen Thanh Thien',role:'Agent',username:'thien.nguyenthanh',shift:'C',event:'2b',description:'Dang nhap khong dung gio.',duration:'0:02:26',imageLink:'https://drive.google.com/file/d/1VynsgqCuvnCU6bRP9Wyk0xcEX25x7mWe/view',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:4,date:'2026-01-06',leader:'dung.tran',empNo:'AGM0147',name:'Tran Trong Tuan',role:'Agent',username:'tuan.tran',shift:'E',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'To Be Reviewed',leaderConfirm:'Da bo sung BHXH',mailCheck:false,warningMailDate:''},
  {no:5,date:'2026-01-06',leader:'tam.to',empNo:'AGF0097',name:'Nguyen Dang Ngoc Giau',role:'Sr Agent',username:'giau.nguyen',shift:'A',event:'1d',description:'Di tre hoac ve som khong dung thoi gian.',duration:'0:05:13',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:6,date:'2026-01-06',leader:'duy.huynh',empNo:'AGM0185',name:'Nguyen Dinh Nam',role:'Agent',username:'nam.nguyendinh',shift:'E',event:'3i',description:'Khong tuan thu hieu lenh cua cap tren.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:7,date:'2026-01-07',leader:'dung.tran',empNo:'AGM0147',name:'Tran Trong Tuan',role:'Agent',username:'tuan.tran',shift:'E',event:'1d',description:'Di tre hoac ve som khong dung thoi gian.',duration:'0:07:00',imageLink:'',status:'To Be Reviewed',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:8,date:'2026-01-08',leader:'hai.nguyen',empNo:'AGM0150',name:'Nguyen Thanh Thien',role:'Agent',username:'thien.nguyenthanh',shift:'C',event:'1d',description:'Di tre hoac ve som khong dung thoi gian.',duration:'0:40:00',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:9,date:'2026-01-09',leader:'hoa.nguyen',empNo:'AGM0160',name:'Nguyen Tuyen Hoang',role:'QA',username:'hoang.nguyentuyen',shift:'B',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:10,date:'2026-01-10',leader:'hoa.nguyen',empNo:'AGF0078',name:'Le Thi Quynh Nhu',role:'QA',username:'nhu.le',shift:'B',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:11,date:'2026-01-12',leader:'duy.huynh',empNo:'AGM0244',name:'Dang Thanh Tung',role:'Agent',username:'tung.dang',shift:'E',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:12,date:'2026-01-13',leader:'duy.huynh',empNo:'AGM0228',name:'Le Minh Khoa',role:'Agent',username:'khoa.le',shift:'E',event:'1d',description:'Di tre hoac ve som khong dung thoi gian.',duration:'0:10:00',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:13,date:'2026-01-14',leader:'duy.huynh',empNo:'AGM0228',name:'Le Minh Khoa',role:'Agent',username:'khoa.le',shift:'E',event:'2b',description:'Dang nhap khong dung gio.',duration:'0:11:00',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:14,date:'2026-02-03',leader:'hai.nguyen',empNo:'AGM0150',name:'Nguyen Thanh Thien',role:'Agent',username:'thien.nguyenthanh',shift:'C',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:15,date:'2026-03-15',leader:'tam.to',empNo:'AGM0205',name:'Nguyen Thanh Long',role:'Agent',username:'long.nguyen',shift:'A',event:'2a',description:'Khong lam du so gio toi thieu.',duration:'0:45:00',imageLink:'',status:'Resolved',leaderConfirm:'',mailCheck:false,warningMailDate:''},
  {no:16,date:'2026-04-22',leader:'thanh.nguyen',empNo:'AGM0239',name:'Tran Minh Duy',role:'Agent',username:'minhduy.tran',shift:'D',event:'1b',description:'Khong thong bao nghi phep dung thoi gian.',duration:'',imageLink:'',status:'To Be Reviewed',leaderConfirm:'',mailCheck:false,warningMailDate:''},
];

const PC_POLICY_DATA = [
  {empNo:'AGM0043',name:'To Hoai Tam',position:'Agent Leader',username:'tam.to',warnMail:true,all2026:1,Q1:0,Jan:0,Feb:0,Mar:0,Q2:1,Apr:1},
  {empNo:'AGF0116',name:'Le Nguyen Huyen Tran',position:'Agent Supervisor',username:'tran.le',warnMail:false,all2026:1,Q1:1,Jan:1,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0072',name:'Nguyen Duc Hoa',position:'Agent Supervisor',username:'hoa.nguyen',warnMail:false,all2026:3,Q1:2,Jan:0,Feb:1,Mar:1,Q2:1,Apr:1},
  {empNo:'AGM0080',name:'Huynh Minh Duy',position:'Agent Supervisor',username:'duy.huynh',warnMail:false,all2026:2,Q1:1,Jan:1,Feb:0,Mar:0,Q2:1,Apr:1},
  {empNo:'AGF0078',name:'Le Thi Quynh Nhu',position:'QA',username:'nhu.le',warnMail:false,all2026:3,Q1:3,Jan:1,Feb:1,Mar:1,Q2:0,Apr:0},
  {empNo:'AGF0089',name:'Nguyen Ngoc Thuong Thao',position:'Sr Agent',username:'thao.nguyen',warnMail:false,all2026:1,Q1:1,Jan:1,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGF0097',name:'Nguyen Dang Ngoc Giau',position:'Sr Agent',username:'giau.nguyen',warnMail:false,all2026:2,Q1:2,Jan:2,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGF0107',name:'Nguyen Thi Kim Chi',position:'Sr Agent',username:'chi.nguyen',warnMail:false,all2026:2,Q1:2,Jan:1,Feb:1,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0117',name:'Nguyen Huu Thien',position:'QA',username:'thien.nguyen',warnMail:false,all2026:1,Q1:1,Jan:1,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0150',name:'Nguyen Thanh Thien',position:'Agent',username:'thien.nguyenthanh',warnMail:false,all2026:7,Q1:5,Jan:4,Feb:1,Mar:0,Q2:2,Apr:2},
  {empNo:'AGM0147',name:'Tran Trong Tuan',position:'Agent',username:'tuan.tran',warnMail:false,all2026:8,Q1:5,Jan:4,Feb:1,Mar:0,Q2:3,Apr:3},
  {empNo:'AGM0185',name:'Nguyen Dinh Nam',position:'Agent',username:'nam.nguyendinh',warnMail:false,all2026:6,Q1:5,Jan:5,Feb:0,Mar:0,Q2:1,Apr:1},
  {empNo:'AGM0205',name:'Nguyen Thanh Long',position:'Agent',username:'long.nguyen',warnMail:false,all2026:2,Q1:2,Jan:2,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0228',name:'Le Minh Khoa',position:'Agent',username:'khoa.le',warnMail:false,all2026:6,Q1:6,Jan:5,Feb:1,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0232',name:'Le Viet Hai',position:'Agent',username:'hai.le',warnMail:false,all2026:5,Q1:5,Jan:5,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0237',name:'Tran Huu Duy',position:'Agent',username:'duy.tran',warnMail:false,all2026:4,Q1:4,Jan:4,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0239',name:'Tran Minh Duy',position:'Agent',username:'minhduy.tran',warnMail:false,all2026:5,Q1:5,Jan:5,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGF0240',name:'Do Thi Anh Suong',position:'Agent',username:'suong.do',warnMail:false,all2026:5,Q1:5,Jan:5,Feb:0,Mar:0,Q2:0,Apr:0},
  {empNo:'AGM0244',name:'Dang Thanh Tung',position:'Agent',username:'tung.dang',warnMail:false,all2026:4,Q1:4,Jan:4,Feb:0,Mar:0,Q2:0,Apr:0},
];

const PC_SUMMARY = {
  agents:[
    {total:4,username:'triet.le','1b':0,'1d':3,'2a':0,'2b':1,'3e':0},
    {total:2,username:'chi.nguyen','1b':1,'1d':1,'2a':0,'2b':0,'3e':0},
    {total:2,username:'tinh.nguyenmaiviet','1b':2,'1d':0,'2a':0,'2b':0,'3e':0},
    {total:1,username:'anh.nguyen','1b':1,'1d':0,'2a':0,'2b':0,'3e':0},
    {total:1,username:'danh.phamcong','1b':0,'1d':1,'2a':0,'2b':0,'3e':0},
    {total:1,username:'duy.bui','1b':0,'1d':1,'2a':0,'2b':0,'3e':0},
    {total:1,username:'luu.nguyendinh','1b':1,'1d':0,'2a':0,'2b':0,'3e':0},
    {total:1,username:'nam.nguyendinh','1b':0,'1d':1,'2a':0,'2b':0,'3e':0},
    {total:1,username:'nhu.nguyen','1b':0,'1d':0,'2a':0,'2b':0,'3e':1},
    {total:1,username:'thanhha.tran','1b':0,'1d':0,'2a':1,'2b':0,'3e':0},
    {total:1,username:'thao.nguyen','1b':1,'1d':0,'2a':0,'2b':0,'3e':0},
    {total:1,username:'vi.votuan','1b':0,'1d':1,'2a':0,'2b':0,'3e':0},
  ],
  qa:[
    {total:3,username:'nhu.le','1b':1,'2a':2,'2b':0,'2e':0},
    {total:1,username:'duy.nguyenhuynhquoc','1b':1,'2a':0,'2b':0,'2e':0},
    {total:1,username:'hien.nhu','1b':1,'2a':0,'2b':0,'2e':0},
    {total:1,username:'huyhien.nguyen','1b':0,'2a':0,'2b':1,'2e':0},
    {total:1,username:'thinh.phanxuan','1b':0,'2a':1,'2b':0,'2e':0},
    {total:1,username:'yen.ho','1b':1,'2a':0,'2b':0,'2e':0},
  ],
  leaders:[{total:1,username:'tam.to','1d':1}],
};

// Page state
let _pcTab = 'view';
let _pcPage = 1;
const _PC_PER = 20;
let _pcFilters = {dateFrom:'',dateTo:'',status:'',role:'',shift:'',event:'',leader:'',search:''};
let _pcFiltered = [];
let _pcAddShift = null;
let _pcPolicySearch = '';
let _pcPolicyPos = '';
let _pcPolicyFilter = '';

function _pcInit() {
  if (!state.policyCompliance) {
    state.policyCompliance = PC_SEED.map(r => Object.assign({},r));
    save();
  }
}

function _pcData() { _pcInit(); return state.policyCompliance; }

function _pcApplyFilters() {
  const f = _pcFilters;
  _pcFiltered = _pcData().filter(r => {
    if (f.dateFrom && r.date < f.dateFrom) return false;
    if (f.dateTo   && r.date > f.dateTo)   return false;
    if (f.status   && r.status !== f.status) return false;
    if (f.role     && r.role   !== f.role)   return false;
    if (f.shift    && r.shift  !== f.shift)  return false;
    if (f.event    && r.event  !== f.event)  return false;
    if (f.leader   && r.leader !== f.leader) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!(r.name||'').toLowerCase().includes(q) && !(r.empNo||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  _pcPage = 1;
}

function _pcStatusBadge(s) {
  return s === 'Resolved'
    ? '<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(74,222,128,.12);color:var(--ok);border:1px solid rgba(74,222,128,.3);font-weight:600;">Resolved</span>'
    : '<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(251,191,36,.12);color:var(--warn);border:1px solid rgba(251,191,36,.3);font-weight:600;">To Review</span>';
}

function _pcHeat(n) {
  if (!n) return 'color:var(--text3)';
  if (n <= 2) return 'color:var(--accent);font-weight:600';
  if (n <= 4) return 'color:var(--warn);font-weight:600';
  return 'color:var(--err);font-weight:700';
}

// ════════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════════
function renderPolicyCompliance() {
  if (!isLeader(currentUser)) return '<div class="empty">Access denied.</div>';
  _pcInit();

  const T = (id, ico, lbl) => {
    const on = _pcTab === id;
    return '<button onclick="_pcTab=\'' + id + '\';nav(\'policy\')" style="padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;white-space:nowrap;transition:all .12s;color:' + (on?'var(--accent)':'var(--text3)') + ';border-bottom:3px solid ' + (on?'var(--accent)':'transparent') + ';margin-bottom:-2px;">' + ico + ' ' + lbl + '</button>';
  };

  const tabs = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto;">'
    + T('view','<span style="font-size:13px;">&#x1F4CB;</span>','View & Filter')
    + T('add','<span style="font-size:13px;">&#x2795;</span>','Add Record')
    + T('policy','<span style="font-size:13px;">&#x1F4CA;</span>','Policy 2026')
    + T('summary','<span style="font-size:13px;">&#x1F4C5;</span>','Summary 30D')
    + T('export','<span style="font-size:13px;">&#x2B07;</span>','Export')
    + '</div>';

  let content = '';
  if (_pcTab==='view')    content = _pcRenderView();
  else if (_pcTab==='add')     content = _pcRenderAdd();
  else if (_pcTab==='policy')  content = _pcRenderPolicy2026();
  else if (_pcTab==='summary') content = _pcRenderSummary30D();
  else if (_pcTab==='export')  content = _pcRenderExport();

  return '<div class="page-header"><div><div class="page-title">Policy Compliance</div><div class="page-sub">Violation records 2026 &nbsp;&middot;&nbsp; Leader access only</div></div></div>'
    + tabs
    + '<div id="pc-content">' + content + '</div>';
}

// ════════════════════════════════════════════
//  VIEW & FILTER
// ════════════════════════════════════════════
function _pcRenderView() {
  _pcApplyFilters();
  const all = _pcData();
  const res = all.filter(r=>r.status==='Resolved').length;
  const rev = all.filter(r=>r.status==='To Be Reviewed').length;
  const f = _pcFilters;

  const stats = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">'
    + '<div class="stat"><div class="stat-label">Total</div><div class="stat-num" style="color:var(--accent);">' + all.length + '</div></div>'
    + '<div class="stat"><div class="stat-label">Resolved</div><div class="stat-num" style="color:var(--ok);">' + res + '</div></div>'
    + '<div class="stat"><div class="stat-label">To review</div><div class="stat-num" style="color:var(--warn);">' + rev + '</div></div>'
    + '<div class="stat"><div class="stat-label">Filtered</div><div class="stat-num">' + _pcFiltered.length + '</div></div>'
    + '</div>';

  const ss = 'height:30px;padding:0 8px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);';

  const mkSel = (fld, val, opts, ph) => '<select style="' + ss + '" onchange="_pcFilters.' + fld + '=this.value;_pcApplyFilters();_pcRerender()">'
    + '<option value="">' + ph + '</option>'
    + opts.map(o => '<option value="' + (o.v||o) + '"' + ((o.v||o)===val?' selected':'') + '>' + (o.l||o) + '</option>').join('')
    + '</select>';

  const leaders = [...new Set(_pcData().map(r=>r.leader).filter(Boolean))].sort();

  const fRow = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:10px;">Filters</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Date from</div><input type="date" value="' + f.dateFrom + '" onchange="_pcFilters.dateFrom=this.value;_pcApplyFilters();_pcRerender()" style="' + ss + '"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Date to</div><input type="date" value="' + f.dateTo + '" onchange="_pcFilters.dateTo=this.value;_pcApplyFilters();_pcRerender()" style="' + ss + '"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Status</div>' + mkSel('status',f.status,['Resolved','To Be Reviewed'],'All statuses') + '</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Role</div>' + mkSel('role',f.role,['Agent','Agent Leader','Agent Supervisor','QA','Sr Agent','Sr QA'],'All roles') + '</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Shift</div>' + mkSel('shift',f.shift,['A','B','C','D','E'],'All') + '</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Event</div>' + mkSel('event',f.event,Object.keys(PC_EVENTS).map(k=>({v:k,l:k+' — '+PC_EVENTS[k].split('/')[0].trim()})),'All events') + '</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Leader</div>' + mkSel('leader',f.leader,leaders,'All leaders') + '</div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Search</div><input type="text" value="' + (f.search||'') + '" placeholder="Name / emp no" oninput="_pcFilters.search=this.value;_pcApplyFilters();_pcRerender()" style="' + ss + 'width:160px;"></div>'
    + '<button onclick="_pcFilters={dateFrom:\'\',dateTo:\'\',status:\'\',role:\'\',shift:\'\',event:\'\',leader:\'\',search:\'\'};_pcApplyFilters();_pcRerender()" style="' + ss + 'cursor:pointer;margin-top:13px;">Reset</button>'
    + '</div></div>';

  const start = (_pcPage-1)*_PC_PER;
  const slice = _pcFiltered.slice(start, start+_PC_PER);
  const totalPages = Math.max(1, Math.ceil(_pcFiltered.length/_PC_PER));

  const rows = slice.length === 0
    ? '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3);">No matching records.</td></tr>'
    : slice.map(function(r,i) {
        return '<tr style="border-bottom:1px solid var(--border);">'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);">' + r.no + '</td>'
          + '<td style="padding:7px 10px;font-size:12px;font-family:\'IBM Plex Mono\',monospace;">' + r.date + '</td>'
          + '<td style="padding:7px 10px;font-weight:600;font-size:12px;white-space:nowrap;">' + r.name + '</td>'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + r.empNo + '</td>'
          + '<td style="padding:7px 10px;font-size:11px;">' + r.role + '</td>'
          + '<td style="padding:7px 10px;text-align:center;"><span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:4px;font-size:11px;font-weight:700;background:var(--bg4);color:var(--text2);">' + (r.shift||'—') + '</span></td>'
          + '<td style="padding:7px 10px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-weight:700;font-size:12px;color:var(--accent);">' + r.event + '</td>'
          + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + r.leader + '</td>'
          + '<td style="padding:7px 10px;">' + _pcStatusBadge(r.status) + '</td>'
          + '<td style="padding:7px 10px;"><button class="btn btn-sm" style="font-size:10px;padding:3px 10px;" onclick="_pcOpenEdit(' + (start+i) + ')">Edit</button></td>'
          + '</tr>';
      }).join('');

  const pagination = '<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;margin-top:10px;">'
    + '<span style="font-size:11px;color:var(--text3);">Page ' + _pcPage + ' / ' + totalPages + ' &nbsp;(' + _pcFiltered.length + ' records)</span>'
    + '<button class="btn btn-sm" onclick="_pcPage=Math.max(1,_pcPage-1);_pcRerender()" ' + (_pcPage<=1?'disabled':'') + '>Prev</button>'
    + '<button class="btn btn-sm" onclick="_pcPage=Math.min(' + totalPages + ',_pcPage+1);_pcRerender()" ' + (_pcPage>=totalPages?'disabled':'') + '>Next</button>'
    + '</div>';

  const editModal = '<div id="pc-edit-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:600;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:22px;width:520px;max-width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<span style="font-size:15px;font-weight:600;" id="pc-edit-title">Edit Record</span>'
    + '<button onclick="_pcCloseEdit()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text3);">&#x2715;</button>'
    + '</div><div id="pc-edit-body"></div></div></div>';

  return stats + fRow
    + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px;">'
    + '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + ['#','DATE','NAME','EMP NO.','ROLE','SFT','EVENT','LEADER','STATUS',''].map(function(h){
        return '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + h + '</th>';
      }).join('')
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    + pagination + editModal;
}

function _pcOpenEdit(idx) {
  const r = _pcFiltered[idx];
  const realIdx = _pcData().indexOf(r);
  document.getElementById('pc-edit-title').textContent = 'Edit — ' + r.name;
  document.getElementById('pc-edit-body').innerHTML = ''
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:12px;">'
    + '<div><span style="color:var(--text3);">Employee</span><br><b>' + r.name + '</b> · ' + r.empNo + '</div>'
    + '<div><span style="color:var(--text3);">Date / Event</span><br>' + r.date + ' — <b style="color:var(--accent);">' + r.event + '</b></div>'
    + '<div><span style="color:var(--text3);">Role / Shift</span><br>' + r.role + ' / Shift ' + (r.shift||'—') + '</div>'
    + '<div><span style="color:var(--text3);">Leader</span><br>' + r.leader + '</div>'
    + '</div>'
    + '<div style="font-size:12px;background:var(--bg3);border-radius:6px;padding:10px;margin-bottom:14px;line-height:1.7;">' + (r.description||'—') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
    + '<div class="fg"><label>Status</label><select id="pce-status"><option ' + (r.status==='Resolved'?'selected':'') + '>Resolved</option><option ' + (r.status==='To Be Reviewed'?'selected':'') + '>To Be Reviewed</option></select></div>'
    + '<div class="fg"><label>Mail check</label><select id="pce-mail"><option value="false" ' + (!r.mailCheck?'selected':'') + '>No</option><option value="true" ' + (r.mailCheck?'selected':'') + '>Yes</option></select></div>'
    + '</div>'
    + '<div class="fg" style="margin-bottom:14px;"><label>Leader confirm note</label><textarea id="pce-confirm" style="min-height:52px;">' + (r.leaderConfirm||'') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button class="btn btn-accent" onclick="_pcSaveEdit(' + realIdx + ')">Save changes</button>'
    + '<button class="btn" onclick="_pcCloseEdit()">Cancel</button>'
    + '</div><div id="pce-msg" style="font-size:12px;margin-top:8px;min-height:18px;"></div>';
  document.getElementById('pc-edit-modal').style.display = 'flex';
}

function _pcSaveEdit(idx) {
  state.policyCompliance[idx].status        = document.getElementById('pce-status').value;
  state.policyCompliance[idx].leaderConfirm = document.getElementById('pce-confirm').value;
  state.policyCompliance[idx].mailCheck     = document.getElementById('pce-mail').value === 'true';
  save();
  document.getElementById('pce-msg').innerHTML = '<span style="color:var(--ok);">Saved</span>';
  setTimeout(_pcCloseEdit, 700);
  _pcApplyFilters(); _pcRerender();
}

function _pcCloseEdit() {
  const el = document.getElementById('pc-edit-modal');
  if (el) el.style.display = 'none';
}

// ════════════════════════════════════════════
//  ADD RECORD
// ════════════════════════════════════════════
function _pcRenderAdd() {
  const SHIFT_TIMES = {A:'3PM→12AM',B:'7PM→4AM',C:'9PM→6AM',D:'12AM→9AM',E:'6AM→3PM'};
  const today = (function() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  })();
  const usernames = state.users.map(function(u){return u.username;}).filter(Boolean).sort();
  const shiftBadges = ['A','B','C','D','E'].map(function(s) {
    const on = _pcAddShift === s;
    return '<span id="pc-sb-' + s + '" onclick="_pcSelectShift(\'' + s + '\')" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;border:2px solid ' + (on?'var(--'+s+'-color)':'transparent') + ';background:var(--'+s+'-bg);color:var(--'+s+'-color);">' + s + '</span>';
  }).join('');

  const evOpts = Object.keys(PC_EVENTS).map(function(k){
    return '<option value="' + k + '">' + k + ' — ' + PC_EVENTS[k] + '</option>';
  }).join('');

  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">'

    /* ── Left: leader fills ── */
    + '<div><div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:12px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:14px;">Leader / Sub-Admin fills in</div>'

    /* Username */
    + '<div class="fg"><label>Employee username *</label>'
    + '<input type="text" id="pc-add-username" list="pc-user-list" placeholder="e.g. thien.nguyenthanh" oninput="_pcAutoFill()" style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;">'
    + '<datalist id="pc-user-list">' + usernames.map(function(u){return '<option value="' + u + '">';}).join('') + '</datalist>'
    + '<div id="pc-user-status" style="font-size:11px;min-height:16px;margin-top:4px;"></div></div>'

    /* Date */
    + '<div class="fg"><label>Date <span style="font-size:10px;background:rgba(31,102,241,.15);color:var(--accent);padding:1px 7px;border-radius:99px;margin-left:4px;">today</span></label>'
    + '<input type="text" id="pc-add-date" value="' + today + '" readonly style="background:var(--bg4);color:var(--text2);cursor:default;font-family:\'IBM Plex Mono\',monospace;font-size:12px;"></div>'

    /* Shift */
    + '<div class="fg"><label>Shift <span style="font-size:10px;background:rgba(31,102,241,.15);color:var(--accent);padding:1px 7px;border-radius:99px;margin-left:4px;">from schedule</span></label>'
    + '<div style="display:flex;gap:6px;margin-top:2px;">' + shiftBadges + '</div>'
    + '<div id="pc-shift-note" style="font-size:11px;color:var(--text3);margin-top:4px;">' + (_pcAddShift ? 'Shift ' + _pcAddShift + ' · ' + SHIFT_TIMES[_pcAddShift] : '—') + '</div></div>'

    /* Event */
    + '<div class="fg"><label>Event *</label><select id="pc-add-event"><option value="">Select violation event</option>' + evOpts + '</select></div>'

    /* Duration */
    + '<div class="fg"><label>Duration <span style="font-size:10px;background:var(--bg4);color:var(--text3);padding:1px 7px;border-radius:99px;margin-left:4px;">optional</span></label>'
    + '<input type="text" id="pc-add-duration" placeholder="e.g. 0:15:00"></div>'

    /* Image link */
    + '<div class="fg"><label>Image link <span style="font-size:10px;background:var(--bg4);color:var(--text3);padding:1px 7px;border-radius:99px;margin-left:4px;">optional</span></label>'
    + '<input type="url" id="pc-add-imglink" placeholder="https://drive.google.com/..."></div>'

    /* Description */
    + '<div class="fg"><label>Description <span style="font-size:10px;background:var(--bg4);color:var(--text3);padding:1px 7px;border-radius:99px;margin-left:4px;">optional</span></label>'
    + '<textarea id="pc-add-desc" style="min-height:60px;" placeholder="Additional notes..."></textarea></div>'

    + '</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:8px;">'
    + '<button class="btn btn-accent" onclick="_pcSaveRecord()">Save record</button>'
    + '<button class="btn" onclick="_pcClearAdd()">Clear</button>'
    + '</div><div id="pc-add-msg" style="font-size:12px;min-height:18px;"></div></div>'

    /* ── Right: auto-filled ── */
    + '<div><div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:14px;">Auto-retrieved <span style="background:rgba(31,102,241,.15);color:var(--accent);padding:1px 7px;border-radius:99px;font-size:10px;margin-left:4px;">read only</span></div>'
    + '<div class="fg"><label>Full name</label><input type="text" id="pc-add-name" readonly style="background:var(--bg4);color:var(--text2);cursor:default;" placeholder="—"></div>'
    + '<div class="fg"><label>Employee number</label><input type="text" id="pc-add-empno" readonly style="background:var(--bg4);color:var(--text2);cursor:default;font-family:\'IBM Plex Mono\',monospace;" placeholder="—"></div>'
    + '<div class="fg"><label>Role</label><input type="text" id="pc-add-role" readonly style="background:var(--bg4);color:var(--text2);cursor:default;" placeholder="—"></div>'
    + '<div class="fg"><label>Leader / Sub-Admin</label><input type="text" id="pc-add-leader" readonly style="background:var(--bg4);color:var(--text2);cursor:default;font-family:\'IBM Plex Mono\',monospace;" placeholder="—"></div>'
    + '<div class="fg"><label>Status</label><select id="pc-add-status"><option>To Be Reviewed</option><option>Resolved</option></select></div>'
    + '</div><div id="pc-recent-records" style="margin-top:12px;"></div></div>'

    + '</div>';
}

function _pcAutoFill() {
  var val = (document.getElementById('pc-add-username').value||'').trim().toLowerCase();
  var status = document.getElementById('pc-user-status');
  if (!val) { _pcClearAutoFields(); return; }
  var user = state.users.find(function(u){return u.username===val;});
  if (user) {
    document.getElementById('pc-add-name').value   = user.name || '';
    document.getElementById('pc-add-empno').value  = user.empNo || (state.staffInfo && state.staffInfo[val] ? state.staffInfo[val].empNo||'' : '');
    document.getElementById('pc-add-role').value   = user.role || '';
    document.getElementById('pc-add-leader').value = PC_LEADER_MAP[val] || '';
    var d = new Date();
    var dk = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
    var sch = user.schedule && (user.schedule[dk] || user.schedule[WEEK_DAYS[d.getDay()===0?6:d.getDay()-1]]) || null;
    var sh = sch && sch !== '0' ? sch.charAt(0) : null;
    if (sh && 'ABCDE'.indexOf(sh) >= 0) {
      _pcSelectShift(sh);
      status.innerHTML = '<span style="color:var(--ok);">Found: ' + user.name + ' &middot; ' + user.role + ' &middot; Shift ' + sh + ' today</span>';
    } else {
      _pcClearShiftBadges();
      status.innerHTML = '<span style="color:var(--ok);">Found: ' + user.name + ' &middot; ' + user.role + ' &mdash; no shift today, select manually</span>';
    }
  } else {
    var si = state.staffInfo && state.staffInfo[val];
    if (si && si.name) {
      document.getElementById('pc-add-name').value   = si.name;
      document.getElementById('pc-add-empno').value  = si.empNo||'';
      document.getElementById('pc-add-role').value   = si.role||'';
      document.getElementById('pc-add-leader').value = PC_LEADER_MAP[val]||'';
      _pcClearShiftBadges();
      status.innerHTML = '<span style="color:var(--warn);">Found in staff info &mdash; select shift manually</span>';
    } else {
      _pcClearAutoFields();
      status.innerHTML = '<span style="color:var(--err);">Username "' + val + '" not found</span>';
    }
  }
}

function _pcSelectShift(s) {
  var TIMES = {A:'3PM→12AM',B:'7PM→4AM',C:'9PM→6AM',D:'12AM→9AM',E:'6AM→3PM'};
  _pcAddShift = s;
  ['A','B','C','D','E'].forEach(function(x) {
    var el = document.getElementById('pc-sb-'+x);
    if (!el) return;
    el.style.border = (x===s) ? '2px solid var(--'+s+'-color)' : '2px solid transparent';
  });
  var note = document.getElementById('pc-shift-note');
  if (note) note.textContent = 'Shift ' + s + ' · ' + TIMES[s];
}

function _pcClearShiftBadges() {
  _pcAddShift = null;
  ['A','B','C','D','E'].forEach(function(x){
    var el = document.getElementById('pc-sb-'+x);
    if (el) el.style.border = '2px solid transparent';
  });
  var note = document.getElementById('pc-shift-note');
  if (note) note.textContent = '—';
}

function _pcClearAutoFields() {
  ['pc-add-name','pc-add-empno','pc-add-role','pc-add-leader'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  _pcClearShiftBadges();
  var s = document.getElementById('pc-user-status'); if (s) s.innerHTML = '';
}

function _pcSaveRecord() {
  var username = (document.getElementById('pc-add-username').value||'').trim();
  var event    = (document.getElementById('pc-add-event').value||'').trim();
  var msg      = document.getElementById('pc-add-msg');
  if (!username) { msg.innerHTML='<span style="color:var(--err);">Enter employee username.</span>'; return; }
  if (!event)    { msg.innerHTML='<span style="color:var(--err);">Select a violation event.</span>'; return; }
  if (!_pcAddShift){ msg.innerHTML='<span style="color:var(--err);">Select the shift.</span>'; return; }
  var d = _pcData();
  var maxNo = d.reduce(function(m,r){return Math.max(m,r.no||0);},0);
  var rec = {
    no: maxNo+1,
    date:      document.getElementById('pc-add-date').value,
    leader:    document.getElementById('pc-add-leader').value,
    empNo:     document.getElementById('pc-add-empno').value,
    name:      document.getElementById('pc-add-name').value || username,
    role:      document.getElementById('pc-add-role').value,
    username:  username,
    shift:     _pcAddShift,
    event:     event,
    description: document.getElementById('pc-add-desc').value,
    duration:  document.getElementById('pc-add-duration').value,
    imageLink: document.getElementById('pc-add-imglink').value,
    status:    document.getElementById('pc-add-status').value,
    leaderConfirm:'', mailCheck:false, warningMailDate:'',
  };
  d.push(rec); save();
  msg.innerHTML = '<span style="color:var(--ok);">Record #' + rec.no + ' saved for ' + rec.name + '</span>';
  var recent = document.getElementById('pc-recent-records');
  if (recent) {
    recent.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">Last saved</div>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span style="background:rgba(74,222,128,.12);color:var(--ok);padding:1px 8px;border-radius:99px;font-size:10px;font-weight:600;">#' + rec.no + '</span>'
      + '<span style="font-weight:600;">' + rec.name + '</span>'
      + '<span style="background:var(--bg4);padding:1px 8px;border-radius:99px;font-size:10px;margin-left:auto;">Shift ' + rec.shift + '</span>'
      + '<span style="background:rgba(31,102,241,.15);color:var(--accent);padding:1px 8px;border-radius:99px;font-size:10px;">' + rec.event + '</span>'
      + '</div></div>';
  }
  _pcClearAdd();
}

function _pcClearAdd() {
  ['pc-add-username','pc-add-desc','pc-add-duration','pc-add-imglink'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  var ev=document.getElementById('pc-add-event'); if(ev) ev.value='';
  var st=document.getElementById('pc-add-status'); if(st) st.value='To Be Reviewed';
  _pcClearAutoFields();
}

// ════════════════════════════════════════════
//  POLICY 2026
// ════════════════════════════════════════════
function _pcRenderPolicy2026() {
  var data = PC_POLICY_DATA.slice();
  if (_pcPolicyPos)    data = data.filter(function(r){return r.position===_pcPolicyPos;});
  if (_pcPolicyFilter==='warn')       data = data.filter(function(r){return r.warnMail;});
  if (_pcPolicyFilter==='violations') data = data.filter(function(r){return r.all2026>0;});
  if (_pcPolicySearch) {
    var q=_pcPolicySearch.toLowerCase();
    data = data.filter(function(r){return r.name.toLowerCase().includes(q)||r.empNo.toLowerCase().includes(q);});
  }
  data.sort(function(a,b){return b.all2026-a.all2026;});

  var ss = 'height:30px;padding:0 8px;font-size:12px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);';
  var cell = function(v) { return '<td style="text-align:center;padding:6px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;' + _pcHeat(v) + '">' + (v||0) + '</td>'; };

  var rows = data.map(function(r,i) {
    return '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);">' + (i+1) + '</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + r.empNo + '</td>'
      + '<td style="padding:7px 10px;font-weight:600;">' + r.name + '</td>'
      + '<td style="padding:7px 10px;font-size:11px;">' + r.position + '</td>'
      + '<td style="padding:7px 10px;text-align:center;">'
        + (r.warnMail ? '<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(251,191,36,.15);color:var(--warn);border:1px solid rgba(251,191,36,.3);">Mail</span>'
                      : '<span style="color:var(--text3);font-size:11px;">—</span>') + '</td>'
      + cell(r.all2026) + cell(r.Q1) + cell(r.Jan) + cell(r.Feb) + cell(r.Mar) + cell(r.Q2) + cell(r.Apr)
      + '</tr>';
  }).join('');

  return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Position</div>'
    + '<select style="' + ss + '" onchange="_pcPolicyPos=this.value;_pcRerender()">'
    + '<option value="">All positions</option>'
    + ['Agent Leader','Agent Supervisor','Sr QA','QA','Sr Agent','Agent'].map(function(p){return '<option value="' + p + '"' + (p===_pcPolicyPos?' selected':'') + '>' + p + '</option>';}).join('')
    + '</select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Show</div>'
    + '<select style="' + ss + '" onchange="_pcPolicyFilter=this.value;_pcRerender()">'
    + '<option value="">All</option><option value="warn"' + (_pcPolicyFilter==='warn'?' selected':'') + '>Has warning mail</option>'
    + '<option value="violations"' + (_pcPolicyFilter==='violations'?' selected':'') + '>Has violations</option></select></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Search</div>'
    + '<input type="text" value="' + _pcPolicySearch + '" placeholder="Name or emp no..." oninput="_pcPolicySearch=this.value;_pcRerender()" style="' + ss + 'width:180px;"></div>'
    + '<span style="font-size:11px;color:var(--text3);align-self:center;margin-top:13px;">' + data.length + ' employees</span></div>'
    + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px;">'
    + '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + ['#','EMP NO.','NAME','POSITION','WARNING','2026','Q1','JAN','FEB','MAR','Q2','APR'].map(function(h,i){
        return '<th style="padding:8px 10px;text-align:' + (i>4?'center':'left') + ';font-size:10px;color:' + (h==='2026'?'var(--accent)':'var(--text3)') + ';font-family:\'IBM Plex Mono\',monospace;">' + h + '</th>';
      }).join('')
    + '</tr></thead><tbody>' + (rows||'<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text3);">No records.</td></tr>') + '</tbody></table></div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:6px;">Heat: <span style="color:var(--accent);font-weight:600;">1–2</span> · <span style="color:var(--warn);font-weight:600;">3–4</span> · <span style="color:var(--err);font-weight:700;">5+</span></div>';
}

// ════════════════════════════════════════════
//  SUMMARY 30D
// ════════════════════════════════════════════
function _pcRenderSummary30D() {
  var hc = function(v) { return '<td style="text-align:center;padding:5px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;' + _pcHeat(v) + '">' + (v||'—') + '</td>'; };

  var mkTbl = function(title, color, headers, dataArr) {
    var sortedRows = dataArr.slice().sort(function(a,b){return b.total-a.total;}).map(function(r,i) {
      return '<tr style="border-bottom:1px solid var(--border);">'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text3);">' + (i+1) + '</td>'
        + '<td style="padding:6px 10px;font-weight:600;font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:' + color + ';">' + r.username + '</td>'
        + headers.slice(2).map(function(h){ return hc(r[h.k]); }).join('')
        + '</tr>';
    }).join('');
    return '<div style="margin-bottom:18px;">'
      + '<div style="font-size:13px;font-weight:600;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);color:' + color + ';">' + title + '</div>'
      + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
      + headers.map(function(h){ return '<th style="padding:7px 8px;text-align:' + (h.c?'center':'left') + ';font-size:10px;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;">' + h.l + '</th>'; }).join('')
      + '</tr></thead><tbody>' + (sortedRows||'<tr><td colspan="' + headers.length + '" style="text-align:center;padding:20px;color:var(--text3);">No violations in last 30 days.</td></tr>') + '</tbody></table></div></div>';
  };

  var legend = Object.entries(PC_EVENTS).map(function(e){ return '<div><b style="font-family:\'IBM Plex Mono\',monospace;color:var(--accent);">' + e[0] + '</b> — ' + e[1] + '</div>'; }).join('');

  return mkTbl('Agents — 30-day violations','var(--accent)',
    [{l:'#'},{l:'Username'},{l:'Total',c:true,k:'total'},{l:'1b',c:true,k:'1b'},{l:'1d',c:true,k:'1d'},{l:'2a',c:true,k:'2a'},{l:'2b',c:true,k:'2b'},{l:'3e',c:true,k:'3e'}],
    PC_SUMMARY.agents)
  + mkTbl('QA — 30-day violations','var(--E-color)',
    [{l:'#'},{l:'Username'},{l:'Total',c:true,k:'total'},{l:'1b',c:true,k:'1b'},{l:'2a',c:true,k:'2a'},{l:'2b',c:true,k:'2b'},{l:'2e',c:true,k:'2e'}],
    PC_SUMMARY.qa)
  + mkTbl('Leader / Sub-Admin — 30-day violations','var(--warn)',
    [{l:'#'},{l:'Username'},{l:'Total',c:true,k:'total'},{l:'1d',c:true,k:'1d'}],
    PC_SUMMARY.leaders)
  + '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">'
  + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:8px;">Event code reference</div>'
  + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;font-size:12px;">' + legend + '</div></div>';
}

// ════════════════════════════════════════════
//  EXPORT
// ════════════════════════════════════════════
function _pcRenderExport() {
  _pcApplyFilters();
  var all = _pcData();
  var counts = {};
  all.forEach(function(r){ if(!counts[r.event]) counts[r.event]={total:0,res:0,rev:0}; counts[r.event].total++; if(r.status==='Resolved') counts[r.event].res++; else counts[r.event].rev++; });
  var sumRows = Object.entries(counts).sort(function(a,b){return b[1].total-a[1].total;}).map(function(e) {
    return '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:7px 10px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;color:var(--accent);">' + e[0] + '</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);">' + (PC_EVENTS[e[0]]||'') + '</td>'
      + '<td style="text-align:center;padding:7px 10px;font-weight:600;">' + e[1].total + '</td>'
      + '<td style="text-align:center;padding:7px 10px;"><span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(74,222,128,.12);color:var(--ok);">' + e[1].res + '</span></td>'
      + '<td style="text-align:center;padding:7px 10px;"><span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(251,191,36,.12);color:var(--warn);">' + e[1].rev + '</span></td>'
      + '</tr>';
  }).join('');

  return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:14px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:10px;">Export compliance records</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button class="btn btn-accent" onclick="_pcExportCSV(false)">Export filtered (' + _pcFiltered.length + ')</button>'
    + '<button class="btn" onclick="_pcExportCSV(true)">Export all (' + all.length + ')</button>'
    + '</div><div id="pc-export-msg" style="font-size:11px;color:var(--text3);margin-top:8px;min-height:16px;"></div></div>'
    + '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:12px;">Violation breakdown by event</div>'
    + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">'
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<thead><tr style="background:var(--bg3);border-bottom:2px solid var(--border2);">'
    + ['EVENT','DESCRIPTION','TOTAL','RESOLVED','TO REVIEW'].map(function(h,i){
        return '<th style="padding:8px 10px;font-size:10px;text-align:' + (i>1?'center':'left') + ';color:' + (i===3?'var(--ok)':i===4?'var(--warn)':'var(--text3)') + ';font-family:\'IBM Plex Mono\',monospace;">' + h + '</th>';
      }).join('')
    + '</tr></thead><tbody>' + sumRows + '</tbody></table></div></div>';
}

function _pcExportCSV(all) {
  var src = all ? _pcData() : _pcFiltered;
  var cols = ['no','date','leader','empNo','name','role','username','shift','event','description','duration','imageLink','status','leaderConfirm','mailCheck','warningMailDate'];
  var hdrs = ['No.','Date','Leader - Sub-Admin','Employee Number','Name','Role','User Name','Shift','Event','Description','Duration (minutes)','Image Link','Status','Leader - Sub-Admin Confirm','Mail Check','Warning Mail Date'];
  var rows = [hdrs.join(',')];
  src.forEach(function(r){ rows.push(cols.map(function(c){ var v=String(r[c]===undefined?'':r[c]).replace(/"/g,'""'); return (v.indexOf(',')>=0||v.indexOf('"')>=0)?'"'+v+'"':v; }).join(',')); });
  var blob = new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
  var a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='policy_compliance_export.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  var el = document.getElementById('pc-export-msg');
  if (el) el.textContent = 'Exported ' + src.length + ' records.';
}

// ── Partial re-render (replaces #pc-content only) ──
function _pcRerender() {
  var el = document.getElementById('pc-content');
  if (!el) { nav('policy'); return; }
  var c = '';
  if (_pcTab==='view')         c = _pcRenderView();
  else if (_pcTab==='add')     c = _pcRenderAdd();
  else if (_pcTab==='policy')  c = _pcRenderPolicy2026();
  else if (_pcTab==='summary') c = _pcRenderSummary30D();
  else if (_pcTab==='export')  c = _pcRenderExport();
  el.innerHTML = c;
}
