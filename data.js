// ═══════════════════════════════════════════════
//  CONSTANTS & SEED DATA
// ═══════════════════════════════════════════════
// ── Bin ID is now discovered automatically from sync-config.json ──
// No manual edits to data.js needed. See Cloud Sync page for setup.
const STORAGE  = 'bsched_v6';
const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const STAFF_INFO_DB = [];
  
const SHIFTS = {
  A:{label:'Shift A',start:'15:00',end:'00:00',display:'3:00 PM → 12:00 AM',color:'var(--A-color)',bg:'var(--A-bg)'},
  // B and C hidden — use SHIFT_DEFAULTS for any historical records
  D:{label:'Shift D',start:'00:00',end:'09:00',display:'12:00 AM → 9:00 AM',color:'var(--D-color)',bg:'var(--D-bg)'},
  E:{label:'Shift E',start:'06:00',end:'15:00',display:'6:00 AM → 3:00 PM', color:'var(--E-color)',bg:'var(--E-bg)'},
};

// Visible shifts for UI (login, sidebar, break schedule tabs, arrange)
const VISIBLE_SHIFTS = ['A', 'D', 'E'];

// Ensure currentShift is always a visible shift.
// Called on login, session restore, and sidebar change.
function _guardShift(s) {
  return VISIBLE_SHIFTS.includes(s) ? s : 'E';
}

const BREAK_SLOTS = {
  A:['18:00–19:30','19:30–21:00'],
  B:['22:00–23:30','23:30–01:00'],
  C:['01:00–02:30','02:30–04:00'],
  D:['04:00–05:30','05:30–07:00'],
  E:['09:30–11:00','11:00–12:30'],
};

// Default start/end times per shift code (used for late/early calculation)
// Covers standard (A-E), X variants, split shifts (A1/A2…), U variants
const SHIFT_DEFAULTS = {
  A:{start:'15:00',end:'00:00'}, B:{start:'19:00',end:'04:00'},
  C:{start:'21:00',end:'06:00'}, D:{start:'00:00',end:'09:00'},
  E:{start:'06:00',end:'15:00'},
  XA:{start:'15:00',end:'00:00'}, XB:{start:'19:00',end:'04:00'},
  XC:{start:'21:00',end:'06:00'}, XD:{start:'00:00',end:'09:00'},
  XE:{start:'06:00',end:'15:00'},
  X4A:{start:'15:00',end:'00:00'}, X4B:{start:'19:00',end:'04:00'},
  X4C:{start:'21:00',end:'06:00'}, X4D:{start:'00:00',end:'09:00'},
  X4E:{start:'06:00',end:'15:00'},
  X3A:{start:'15:00',end:'00:00'}, X3B:{start:'19:00',end:'04:00'},
  X3C:{start:'21:00',end:'06:00'}, X3D:{start:'00:00',end:'09:00'},
  X3E:{start:'06:00',end:'15:00'},
  X2A:{start:'15:00',end:'00:00'}, X2B:{start:'19:00',end:'04:00'},
  X2C:{start:'21:00',end:'06:00'}, X2D:{start:'00:00',end:'09:00'},
  X2E:{start:'06:00',end:'15:00'},
  A1:{start:'15:00',end:'19:00'}, A2:{start:'20:00',end:'00:00'},
  B1:{start:'19:00',end:'23:00'}, B2:{start:'00:00',end:'04:00'},
  C1:{start:'21:00',end:'01:00'}, C2:{start:'02:00',end:'06:00'},
  D1:{start:'00:00',end:'04:00'}, D2:{start:'05:00',end:'09:00'},
  E1:{start:'06:00',end:'10:00'}, E2:{start:'11:00',end:'15:00'},
  UA1:{start:'15:00',end:'19:00'}, UA2:{start:'20:00',end:'00:00'},
  UB1:{start:'19:00',end:'23:00'}, UB2:{start:'00:00',end:'04:00'},
  UC1:{start:'21:00',end:'01:00'}, UC2:{start:'02:00',end:'06:00'},
  UD1:{start:'00:00',end:'04:00'}, UD2:{start:'05:00',end:'09:00'},
  UE1:{start:'06:00',end:'10:00'}, UE2:{start:'11:00',end:'15:00'},
};

const ROLES = {
  'Admin':                    {level:4,tag:'role-leader',label:'Admin'},
  'Training Manager':         {level:3,tag:'role-training',label:'Training Manager'},
  'Training Assistant':       {level:3,tag:'role-training',label:'Training Assistant'},
  'Data Analyst Leader':      {level:2,tag:'role-leader',label:'D.A Leader'},
  'Data Analyst Supervisor':  {level:2,tag:'role-leader',label:'D.A Supervisor'},
  'Sr Data Analyst':          {level:1,tag:'role-agent', label:'Sr Data Analyst'},
  'Data Analyst':             {level:0,tag:'role-agent', label:'Data Analyst'},
  'Data Supervisor':          {level:0,tag:'role-qa',    label:'Data Supervisor'},
  'Sr Data Supervisor':       {level:1,tag:'role-qa',    label:'Sr Data Supervisor'},
};

// ═══════════════════════════════════════════════
//  STATE — localStorage flat DB
//  Tables: users, breaks, requests, extBreaks, staffInfo, session
// ═══════════════════════════════════════════════
function load() {
  try { const d = localStorage.getItem(STORAGE); if (d) return JSON.parse(d); } catch(e){}
  return { users:[], breaks:{}, requests:[], extBreaks:{},
           staffInfo:{}, session:null, imported:false,
           _breaksUpdatedAt:0, _usersUpdatedAt:0,
           _policyComplianceUpdatedAt:0,
           attendance:{}, monthlyAttendance:{}, breakSplits:{},
           staffSchedule:{}, workingTime:{} };
}
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch(e){}
}

const DB = {
  getUsers:      ()           => state.users,
  getUser:       id           => state.users.find(u=>u.id===id),
  upsertUser:    u            => { const i=state.users.findIndex(x=>x.id===u.id); if(i>=0) state.users[i]={...state.users[i],...u}; else state.users.push(u); save(); },
  getBreak:      (uid,day)    => state.breaks[`${uid}_${day}`],
  setBreak:      (uid,day,d)  => { state.breaks[`${uid}_${day}`]=d; /* async push handled by caller */ },
  getRequests:   ()           => state.requests,
  addRequest:    r            => { state.requests.unshift(r); },
  updateRequest: (i,r)        => { state.requests[i]={...state.requests[i],...r}; },
  getExtBreaks:  (uid,mk)     => (state.extBreaks[`${uid}_${mk}`]||[]),
  addExtBreak:      (uid,mk,e)      => { const k=`${uid}_${mk}`; if(!state.extBreaks[k]) state.extBreaks[k]=[]; state.extBreaks[k].push({...e, status:'pending', at:Date.now()}); },
  deleteExtBreak:   (uid,mk,i)      => { const k=`${uid}_${mk}`; if(state.extBreaks[k]) state.extBreaks[k].splice(i,1); },
  approveExtBreak:  (uid, mk, idx, byId) => {
    const k = `${uid}_${mk}`;
    if (state.extBreaks[k]?.[idx]) {
      state.extBreaks[k][idx].status     = 'approved';
      state.extBreaks[k][idx].approvedBy = byId;
      state.extBreaks[k][idx].approvedAt = Date.now();
      save();
    }
  },
  rejectExtBreak:   (uid, mk, idx, byId, reason) => {
    const k = `${uid}_${mk}`;
    if (state.extBreaks[k]?.[idx]) {
      state.extBreaks[k][idx].status          = 'rejected';
      state.extBreaks[k][idx].rejectedBy      = byId;
      state.extBreaks[k][idx].rejectedReason  = reason || '';
      state.extBreaks[k][idx].rejectedAt      = Date.now();
      save();
    }
    },
  getPendingExtBreaks: () => {
    const pending = [];
    Object.entries(state.extBreaks||{}).forEach(([key, entries]) => {
      const [uid, mk] = key.split('_');
      (entries||[]).forEach((e,i) => {
        if (e.status === 'pending' || !e.status) pending.push({ uid:parseInt(uid), mk, idx:i, ...e });
      });
    });
    return pending;
  },
  countPendingExtBreaks: () => {
    let n = 0;
    Object.values(state.extBreaks || {}).forEach(entries => {
      (entries || []).forEach(e => {
        if (!e.status || e.status === 'pending') n++;
      });
    });
    return n;
  },
  countExtBreaks:(uid,mk)     => (state.extBreaks[`${uid}_${mk}`]||[]).reduce((total, e) => {
    const days = (e && Array.isArray(e.days) && e.days.length > 0) ? e.days : (e && e.day ? [e.day] : []);
    return total + Math.max(1, days.length);
  }, 0),
  // logbook: key = `${uid}_${dateKey}` → { start, end, note, by, at }
  getLogbook: (uid,day)   => {
    const r = state.logbook[`${uid}_${day}`];
    return (r && !r._deleted) ? r : null;
  },
  setLogbook: (uid,day,d) => { state.logbook[`${uid}_${day}`] = d; },
  delLogbook: (uid,day)   => { delete state.logbook[`${uid}_${day}`]; },
  // staffInfo: username → { empNo, dob, gender, name, role, password, mustChangePassword }
  getStaffInfo:  username     => state.staffInfo[username] || null,
  setStaffInfo:  (username,d) => { state.staffInfo[username]=d; save(); },
  // Password stored in staffInfo; default '1234', mustChangePassword:true on first login
  getPassword:   username     => (state.staffInfo[username]?.password) || '1234',
  mustChangePw:  username     => state.staffInfo[username]?.mustChangePassword !== false,
  setPassword:   (username,pw)=> {
    if (!state.staffInfo[username]) state.staffInfo[username] = {};
    state.staffInfo[username].password = pw;
    state.staffInfo[username].mustChangePassword = false;
    save();
  },

  // monthlyAttendance: username → monthKey → dateKey → code ('WD','OFF','HD','WFH')
  getMonthlyAtt:  (username, monthKey)         => state.monthlyAttendance?.[username]?.[monthKey] || {},
  setMonthlyAtt:  (username, monthKey, data)   => {
    if (!state.monthlyAttendance) state.monthlyAttendance = {};
    if (!state.monthlyAttendance[username]) state.monthlyAttendance[username] = {};
    state.monthlyAttendance[username][monthKey] = data;
    save();
  },
  clearMonthlyAtt: (username, monthKey) => {
    if (state.monthlyAttendance?.[username]) {
      delete state.monthlyAttendance[username][monthKey];
      save();
    }
  },

  // workingTime: username → monthKey → { late, early, training, others }  (all numbers, minutes)
  getWorkingTime:  (username, monthKey)       => state.workingTime?.[username]?.[monthKey] || {},
  setWorkingTime:  (username, monthKey, data) => {
    if (!state.workingTime) state.workingTime = {};
    if (!state.workingTime[username]) state.workingTime[username] = {};
    state.workingTime[username][monthKey] = data;
    save();
  },
  
  // session
  saveSession:   s            => { state.session=s; save(); },
  clearSession:  ()           => { state.session=null; save(); },
  getSession:    ()           => state.session,
};

let state = load();
// Migrations
if (!state.extBreaks)  state.extBreaks  = {};
if (!state.logbook) state.logbook = {};
if (!state.staffInfo)  state.staffInfo  = {};
if (!state.session)    state.session    = null;
if (!state.monthlyAttendance) state.monthlyAttendance = {};
if (!state.workingTime)      state.workingTime      = {};
if (!state.breakSplits) state.breakSplits = {};
if (!state.shiftConfig) state.shiftConfig = [];
if (!state.staffSchedule) state.staffSchedule = {};
if (!state.gasConfig) state.gasConfig = {};
if (!state.bulkBreakEnabled) state.bulkBreakEnabled = { A: true, D: true, E: true };
if (state._policyComplianceUpdatedAt === undefined) state._policyComplianceUpdatedAt = 0;
// No more SEED_USERS — users come only from schedule import

// Always ensure system admin exists — password '1234', never forced to change
// Preserve any existing password the admin may have set
state.staffInfo['admin'] = {
  empNo: 'SYS0001', name: 'System Admin', gender: 'M', dob: '', role: 'Admin',
  ...(state.staffInfo['admin'] || {}),   // spread AFTER defaults so existing values win
  mustChangePassword: false,             // admin never forced to change
};
if (!state.staffInfo['admin'].password) state.staffInfo['admin'].password = '1234';


save();

// ── Runtime state ──
let currentUser  = null;
let currentShift = 'E';
let currentPage  = 'dashboard';
let assigningEmp = null;
// Default to current real week's Monday (Mon–Sun weeks)
let activeMonday = (() => {
  const cached = localStorage.getItem('activeMonday');
  if (cached) return cached;
  const now = new Date();
  const mon = new Date(now);
  const dow = now.getDay();
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1)); // Sun → back 6, Mon → 0, Tue → 1, …
  return `${mon.getDate().toString().padStart(2,'0')}/${(mon.getMonth()+1).toString().padStart(2,'0')}`;
})();
var showFullMonth = true;
var _schedMonth   = null; // null = auto-detect from activeMonday
var _ssShiftFilter = 'All'; // staff schedule shift filter (week mode only)
var _ssFilterDk    = '';

// Monday anchor for Staff Schedule (separate from activeMonday which is Monday-based for Arrange)
var _ssActiveMonday = (() => {
  const cached = localStorage.getItem('_ssActiveMonday');
  if (cached) return cached;
  const now = new Date(); const dow = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  return `${mon.getDate().toString().padStart(2,'0')}/${(mon.getMonth()+1).toString().padStart(2,'0')}`;
})();
let staffFilters  = { team:'', name:'', user:'', role:'', search:'' };
let staffSubTab   = 'info'; // 'info' | 'schedule'
let importedUsers = [];

// ── Theme ──
let currentTheme = localStorage.getItem('bsched_theme') || 'dark';
function applyTheme(t) {
  currentTheme = t;
  localStorage.setItem('bsched_theme', t);
  document.documentElement.setAttribute('data-theme', t);
}
applyTheme(currentTheme);

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

// Maps legacy role names (stored in Firebase) to current names
const ROLE_ALIASES = {
  'Agent':                    'Data Analyst',
  'Sr Agent':                 'Sr Data Analyst',
  'QA':                       'Data Supervisor',
  'Sr QA':                    'Sr Data Supervisor',
  'Agent Leader':             'Data Analyst Leader',
  'Agent Supervisor':         'Data Analyst Supervisor',
  'Agent Training Manager':   'Training Manager',
  'Agent Training Assistant': 'Training Assistant',
  'Senior Data Analyst':      'Sr Data Analyst',
  'Senior Data Supervisor':   'Sr Data Supervisor',
  'Senior Data Analyst Leader':    'Data Analyst Leader',
  'Senior Data Analyst Supervisor':'Data Analyst Supervisor',
  'Leader':                   'Data Analyst Leader',
  'Supervisor':               'Data Analyst Supervisor',
};
function _resolveRole(role) { return ROLE_ALIASES[role] || role; }

function isLeader(u)   { return u && (ROLES[_resolveRole(u.role)]?.level||0)>=2; }
function isTraining(u) { return u && (ROLES[_resolveRole(u.role)]?.level||0)===3; }
function isAdmin(u)    { return u && (ROLES[_resolveRole(u.role)]?.level||0)===4; }
function getRoleInfo(r) { const k=_resolveRole(r); return ROLES[k]||{level:0,tag:'role-agent',label:r||'—'}; }

function todayKey() {
  const d=new Date(); return WEEK_DAYS[d.getDay()===0?6:d.getDay()-1];
}
function _getSched(username, dk) {
  var sc = state.staffSchedule[username] || {};
  var v = sc[dk];
  if (v) return v;
  if (dk && dk.indexOf('/') !== -1) return sc[getWkDay(dk)] || '0';
  return '0';
}
function _getSchedObj(username) {
  return state.staffSchedule[username] || {};
}
function getShiftMates(shift,day) {
  return state.users.filter(u => {
    return _getSched(u.username, day||todayKey())===shift;
  });
}
function getBreakKey(uid,day)  { return `${uid}_${day||todayKey()}`; }
function getAssigned(uid,day)  { return DB.getBreak(uid, day||todayKey()); }
function getDisplayAssigned(uid,day) {
  var dk = day || todayKey();
  var base = getAssigned(uid, dk);
  var requests = state.requests || [];
  for (var i = 0; i < requests.length; i++) {
    var r = requests[i];
    if (!r || r.status !== 'approved' || r.type === 'dayoff-swap') continue;
    var days = r.swapDays || [r.day];
    if (days.indexOf(dk) === -1) continue;
    var slot = '';
    if (r.userId === uid) slot = r.requested;
    else if (r.swapPartnerId === uid) slot = r.current;
    if (!slot || slot === 'Not assigned') continue;
    var display = Object.assign({}, base || {});
    display.slot = slot;
    display.swapDisplay = true;
    display.swapRequestId = r.id;
    return display;
  }
  return base;
}

function assign(uid, day, slot, note) {
  const now = Date.now();
  const normSlot = slot ? slot.replace(/[\u2012\u2013\u2014\u002D]/g, '\u2013') : slot;
  DB.setBreak(uid, day || todayKey(), { slot: normSlot, note: note || '', by: currentUser?.id, at: now });
  state._breaksUpdatedAt = now;
  save(); // local only — cloud push via "Save Breaks" button
}

function currentMonthKey() {
  const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}
function monthKeyFromDate(ds) {
  const [,m]=ds.split('/'); return `2026-${m.padStart(2,'0')}`;
}

function getShortSlot(shift, fullTime) {
  if (!fullTime || fullTime === '\u2014') return '';
  // Already a short code (e.g., 'A1', 'E2') — return as-is
  if (fullTime.length === 2 && fullTime[0] === shift && !isNaN(parseInt(fullTime[1]))) return fullTime;
  function nd(s) {
    return (s || '').replace(/[\u2012\u2013\u2014\u002D\u2212\uFE58\uFE63\uFF0D]/g, '-').replace(/\s/g, '');
  }
  const idx = (BREAK_SLOTS[shift] || []).findIndex(s => nd(s) === nd(fullTime));
  return idx !== -1 ? `${shift}${idx + 1}` : fullTime;
}

// ── Shift config versioning helpers ──
// Date-versioned shift config lives in state.shiftConfig (synced via Firebase).
// Each entry: { effectiveFrom: 'DD/MM' | null, breakSlots: { A:[...], E:[...] } }
// null effectiveFrom = baseline (always applies). Later entries win.

function _parseDateKey(dk) {
  if (!dk) return 0;
  var parts = dk.split('/');
  var d = parseInt(parts[0]) || 1;
  var m = parseInt(parts[1]) || 1;
  var y = parseInt(parts[2]) || 2026;
  return new Date(y, m - 1, d).getTime();
}

function getConfigForDate(dateStr) {
  var configs = state.shiftConfig || [];
  var merged = { breakSlots: Object.assign({}, BREAK_SLOTS) };
  if (!configs.length) return merged;
  var dateTs = dateStr ? _parseDateKey(dateStr) : 0;
  var sorted = configs.slice().sort(function(a, b) {
    if (!a.effectiveFrom) return -1;
    if (!b.effectiveFrom) return 1;
    return _parseDateKey(a.effectiveFrom) - _parseDateKey(b.effectiveFrom);
  });
  sorted.forEach(function(entry) {
    if (!entry.effectiveFrom || (dateStr && _parseDateKey(entry.effectiveFrom) <= dateTs)) {
      if (entry.breakSlots) Object.assign(merged.breakSlots, entry.breakSlots);
    }
  });
  return merged;
}

// Returns the slot index (0 or 1) for a break record slot value.
// Handles both short codes ('A1' → 0) and legacy time strings ('18:00–19:30' → 0).
function _slotIndex(slot, shift) {
  if (!slot) return -1;
  if (slot.length === 2 && slot[0] === shift && !isNaN(parseInt(slot[1]))) {
    return parseInt(slot[1]) - 1;
  }
  function nd(s) { return (s || '').replace(/[\u2012\u2013\u2014\u002D\u2212]/g, '-').replace(/\s/g, ''); }
  return (BREAK_SLOTS[shift] || []).findIndex(function(s) { return nd(s) === nd(slot); });
}

// Resolves a slot code to its display time string for the given date context.
// Short codes ('E1') → '09:30–11:00'; legacy time strings pass through unchanged.
function getSlotTime(code, dateStr) {
  if (!code) return '';
  // Legacy time string — 5+ chars containing a digit-dash-digit pattern
  if (code.length > 4 && /\d/.test(code) && (code.includes('–') || code.includes('-') || code.includes('—'))) return code;
  var shift = code[0];
  var idx = parseInt(code[1]) - 1;
  if (isNaN(idx) || idx < 0) return code;
  var slots = getConfigForDate(dateStr || '').breakSlots[shift] || BREAK_SLOTS[shift] || [];
  return slots[idx] !== undefined ? slots[idx] : code;
}


function getWeekRange(monStr) {
  const [d,m]=monStr.split('/'), range=[];
  const start=new Date(2026,parseInt(m)-1,parseInt(d));
  for(let i=0;i<7;i++){
    const dt=new Date(start); dt.setDate(start.getDate()+i);
    range.push(`${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`);
  }
  return range;
}

// Sort DD/MM dateKeys chronologically — handles cross-year correctly
function _sortDateKeys(keys) {
  const now = new Date();
  const curM = now.getMonth() + 1;
  return [...keys].sort((a, b) => {
    const [da, ma] = a.split('/').map(Number);
    const [db, mb] = b.split('/').map(Number);
    const ya = ma - curM > 6 ? now.getFullYear() - 1 : ma - curM < -6 ? now.getFullYear() + 1 : now.getFullYear();
    const yb = mb - curM > 6 ? now.getFullYear() - 1 : mb - curM < -6 ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
  });
}

function getWkDay(ds) {
  const [d,m]=ds.split('/');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(2026,parseInt(m)-1,parseInt(d)).getDay()];
}
// AFTER — return Mon–Sun:
function getWeekDates(refDateStr) {
  var baseDate = new Date();
  if (refDateStr) {
    var parts = refDateStr.split('/').map(Number);
    baseDate = new Date(2026, parts[1] - 1, parts[0]);
  }
  const mon = new Date(baseDate);
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
  mon.setDate(diff);
  return WEEK_DAYS.map(function(_, i) {
    var dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
  });
}
function buildDatalist() {
  const dl = document.getElementById('user-datalist');
  if (!dl || !state.users?.length) return;
  dl.innerHTML = state.users.map(u =>
    `<option value="${u.username}">${u.name}</option>`
  ).join('');
}
function updateBadge() {
  const p=state.requests.filter(r=>r.status==='pending').length;
  const b=document.getElementById('req-badge');
  if(b){b.style.display=p>0?'':'none';b.textContent=p;}
  // Pending ext breaks badge
  const extBadge = document.getElementById('ext-badge');
  if (extBadge) {
    const pend = DB.countPendingExtBreaks ? DB.countPendingExtBreaks() : 0;
    extBadge.textContent = pend;
    extBadge.style.display = (isLeader(currentUser) || isTraining(currentUser)) && pend > 0 ? '' : 'none';
  }
  if (typeof _pcUpdateBadge === 'function') _pcUpdateBadge();
  if (typeof updateFeedbackBadge === 'function') updateFeedbackBadge();
}
function timeSince(ts) {
  const d=Date.now()-ts;
  if(d<60000) return 'just now';
  if(d<3600000) return Math.floor(d/60000)+'m ago';
  if(d<86400000) return Math.floor(d/3600000)+'h ago';
  return Math.floor(d/86400000)+'d ago';
}
function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hr}:${min}`;
}
let toastTimer;
function toast(msg,type='ok') {
  const el=document.getElementById('toast');
  el.innerHTML=`<span>${{ok:'✓',err:'✕',warn:'⚡'}[type]||''}</span> ${msg}`;
  el.className=`msg-bar show ${type}`;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
}
function parseCSVLine(line) {
  const r=[];let c='',q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}
    else if(ch===','&&!q){r.push(c);c='';}
    else c+=ch;
  }
  r.push(c); return r;
}
function renderPage(p){nav(p);}
buildDatalist();

const ATT_CODE_MAP = (() => {
  const map = {};
  ['A', 'B', 'C', 'D', 'E'].forEach(sh => {
    map[`X${sh}`] = { type: 'WD', shift: sh };
    map[`X2${sh}`] = { type: 'WD', shift: sh };
    map[`X3${sh}`] = { type: 'WD', shift: sh };
    map[`X4${sh}`] = { type: 'WD', shift: sh };
    map[`${sh}1`] = { type: 'HD1', shift: sh };
    map[`${sh}2`] = { type: 'HD2', shift: sh };
    map[`U${sh}1`] = { type: 'HD1', shift: sh };
    map[`U${sh}2`] = { type: 'HD2', shift: sh };
  });
  map['A'] = { type: 'OFF', reason: 'Annual leave' };
  map['H'] = { type: 'OFF', reason: 'Public holiday' };
  map['U'] = { type: 'OFF', reason: 'Unpaid leave' };
  map['S'] = { type: 'OFF', reason: 'Sick leave' };
  map['L'] = { type: 'OFF', reason: 'Personal leave' };
  map['0'] = { type: 'OFF', reason: 'Day off' };
  map['0.0'] = { type: 'OFF', reason: 'Day off' };
  return map;
})();

function _parseAttCode(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(typeof raw === 'number' ? Math.round(raw) : raw).trim().toUpperCase();
  return ATT_CODE_MAP[s] || null;
}

function _getMonthlyAttendanceCode(username, dateKey) {
  if (!username || !dateKey) return '';
  if (!state || !state.monthlyAttendance || !state.monthlyAttendance[username]) return '';

  const parts = dateKey.split('/');
  if (parts.length < 2) return '';
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = typeof TS !== 'undefined' && TS.attYear ? TS.attYear : new Date().getFullYear();

  // 1. Try calendar month key (e.g., "2026-06" for "25/06")
  const calMk = year + '-' + String(month).padStart(2, '0');
  let code = state.monthlyAttendance[username][calMk]?.[dateKey];
  if (code !== undefined && code !== null && code !== '') return code;

  // 2. Try working month key (e.g., "2026-07" for "25/06" if day >= 25)
  let workMon = day >= 25 ? month + 1 : month;
  let workYr = year;
  if (workMon > 12) { workMon = 1; workYr++; }
  const workMk = workYr + '-' + String(workMon).padStart(2, '0');
  code = state.monthlyAttendance[username][workMk]?.[dateKey];
  if (code !== undefined && code !== null && code !== '') return code;

  // 3. Fallback: Search all month keys for this user
  const userMonths = state.monthlyAttendance[username];
  for (const mk in userMonths) {
    if (userMonths[mk] && userMonths[mk][dateKey] !== undefined && userMonths[mk][dateKey] !== null && userMonths[mk][dateKey] !== '') {
      return userMonths[mk][dateKey];
    }
  }
  return '';
}

function _getMondayAnchor(dateStr) {
  var parts = dateStr.split('/');
  var dt = new Date(2026, parseInt(parts[1]) - 1, parseInt(parts[0]));
  var day = dt.getDay();
  var diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  var sd = String(dt.getDate()).padStart(2, '0');
  var sm = String(dt.getMonth() + 1).padStart(2, '0');
  return sd + '/' + sm;
}
