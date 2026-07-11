//  WORKING DAYS (store shift char):
//  XA → shift A working day
//  XB → shift B working day
//  XC → shift C working day
//  XD → shift D working day
//  XE → shift E working day
//  X2A–X2E → working × 2 multiplier (still working)
//  X3A–X3E → working × 3 multiplier (still working)
//  X4A–X4E → working × 4 multiplier (still working)
//
//  HALF-DAY (paid leave, first/second half):
//  A1,B1,C1,D1,E1 → work first half, leave second half
//  A2,B2,C2,D2,E2 → work second half, leave first half
//
//  HALF-DAY (unpaid):
//  UA1,UB1,UC1,UD1,UE1 → same but unpaid
//  UA2,UB2,UC2,UD2,UE2 → same but unpaid
//
//  FULL OFF (all should flag conflict if attendance log exists):
//  A  → annual leave (phép nÄƒm)
//  H  → public holiday (nghá»‰ lá»…)
//  0  → weekly day off (nghá»‰ tuáº§n)
//  U  → unpaid leave
//  S  → sick leave (BHXH)
//  L  → social leave (hiếu hỉ, tang chế hưởng lương)
//
//  SHIFT MISMATCH: XA on shift B day → conflict

// ATT_CODE_MAP and _parseAttCode are now defined globally in data.js

function _excelDateToDk(h, fallbackMonth) {
  if (!h) return null;
  if (h instanceof Date) {
    return String(h.getDate()).padStart(2, '0') + '/' + String(h.getMonth() + 1).padStart(2, '0');
  }
  if (typeof h === 'number' && h > 40000) {
    const dt = new Date(Math.round((h - 25569) * 86400 * 1000));
    return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0');
  }
  if (typeof h === 'string') {
    if (h.match(/^\d{4}-\d{2}-\d{2}/)) {
      const dt = new Date(h);
      if (!isNaN(dt)) return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
    }
    const c = h.replace(/[-–]/g, '/').trim();
    if (/^\d{1,2}\/\d{1,2}$/.test(c)) {
      const [d, m] = c.split('/');
      return d.padStart(2, '0') + '/' + m.padStart(2, '0');
    }
    if (/^\d{1,2}$/.test(c) && fallbackMonth) {
      return c.padStart(2, '0') + '/' + String(fallbackMonth).padStart(2, '0');
    }
  }
  return null;
}

function _getMondayOfWeek(dk) {
  // Given a DD/MM dateKey, return the Monday of that week as DD/MM
  // Week is Sun–Sat in the attendance view, but we need the Sunday
  const [d, m] = dk.split('/');
  const dt = new Date(new Date().getFullYear(), parseInt(m) - 1, parseInt(d));
  // Go back to Sunday (start of attendance week)
  const day = dt.getDay(); // 0=Sun
  dt.setDate(dt.getDate() - day);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function _checkAttConflict(u, dk, parsedCode) {
  if (!parsedCode) return null;
  const weekRec = DB.getLogbook(u.id, dk);
  // Auto-synced records (note='auto') haven't been reviewed by a leader — skip
  if (weekRec?.note === 'auto') return null;
  var schedShift = _getSched(u.username, dk).charAt(0);
  const conflicts = [];
  // Only flag if start or end is a non-empty, non-dash string
  const hasRealRecord = weekRec &&
    ((weekRec.start && weekRec.start.trim() !== '' && weekRec.start !== '—') ||
      (weekRec.end && weekRec.end.trim() !== '' && weekRec.end !== '—'));

  if (parsedCode.type === 'OFF') {
    if (hasRealRecord) {
      conflicts.push(`Attendance logged on ${parsedCode.reason || 'off day'}`);
    }
  } else if (parsedCode.type === 'WD') {
    if (schedShift && parsedCode.shift && schedShift !== parsedCode.shift) {
      conflicts.push(`Attendance: Shift ${parsedCode.shift}, Schedule: Shift ${schedShift}`);
    }
  }
  return conflicts.length > 0 ? conflicts : null;
}

// Always read gender from staffInfo first, fall back to user object
function _getUserGender(u) {
  if (!u) return '';
  return DB.getStaffInfo(u.username)?.gender || u.gender || '';
}

// ═══════════════════════════════════════════════
//  Role sort order for Staff Info tab
// ─────────────────────────────────────────────

const ROLE_SORT_ORDER = {
  'Training Manager':         0,
  'Training Assistant':       1,
  'Data Analyst Leader':      2,
  'Leader':                   2,
  'Data Analyst Supervisor':  3,
  'Supervisor':               3,
  'Sr Data Supervisor':       4,
  'Data Supervisor':          5,
  'Sr Data Analyst':          6,
  'Data Analyst':             7,
  'Admin': 99,
};

function _roleSort(a, b) {
  const ra = ROLE_SORT_ORDER[_resolveRole(a.role, a.team)] ?? 9;
  const rb = ROLE_SORT_ORDER[_resolveRole(b.role, b.team)] ?? 9;
  if (ra !== rb) return ra - rb;
  return (a.name || '').localeCompare(b.name || '');
}

var _ROLE_COLOR = {
  'Training Manager':        '#34d399',
  'Training Assistant':      '#34d399',
  'Data Analyst Leader':     '#f59e0b',
  'Data Analyst Supervisor': '#38bdf8',
  'Sr Data Supervisor':      '#c084fc',
  'Data Supervisor':         '#818cf8',
  'Sr Data Analyst':         '#fb923c',
  'Data Analyst':            '#60a5fa',
};
function _roleColor(role, team) {
  return _ROLE_COLOR[_resolveRole(role, team)||role] || 'var(--text2)';
}

//  RENDER: DASHBOARD
// ═══════════════════════════════════════════════

// ── Month filter helpers (shared by requests + ext break pages) ──
let _reqFilterYM      = null; // null = current month
let _reqStatusFilter  = 'all';
let _reqScopeFilter   = 'all';
let _extBreakFilterYM = null; // null = current month
let _ebTargetUser = null;    // training manager registering on behalf of

function _prevMonthKey(ym) {
  const [y,m] = ym.split('-').map(Number);
  return m===1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
}
function _nextMonthKey(ym) {
  const [y,m] = ym.split('-').map(Number);
  return m===12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
}
function _monthLabel(ym) {
  const [y,m] = ym.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleString('en-US',{month:'long',year:'numeric'});
}
function _monthPickerHTML(ym, setterFn, page) {
  const prev = _prevMonthKey(ym);
  const next = _nextMonthKey(ym);
  const curMk = currentMonthKey();
  const isCur = ym === curMk;
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
    <button class="btn btn-sm" style="padding:4px 10px;font-size:15px;line-height:1;" onclick="${setterFn}('${prev}');nav('${page}')">&#8249;</button>
    <span style="font-size:13px;font-weight:600;min-width:140px;text-align:center;">${_monthLabel(ym)}</span>
    <button class="btn btn-sm" style="padding:4px 10px;font-size:15px;line-height:1;" onclick="${setterFn}('${next}');nav('${page}')">&#8250;</button>
    ${!isCur ? `<button class="btn btn-sm" style="font-size:11px;" onclick="${setterFn}('${curMk}');nav('${page}')">Current</button>` : ''}
  </div>`;
}
function _setReqFilterYM(ym)      { _reqFilterYM      = ym; }
function _setExtBreakFilterYM(ym) { _extBreakFilterYM = ym; }

// ═══════════════════════════════════════════════
//  RENDER: REQUESTS
//  Agent/QA/Sr roles: pick day OR whole-week swap
//  Conflict detection: 2nd request for same partner
//  Visual impact preview before approval
// ═══════════════════════════════════════════════

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  if (id === 'modal-extbreak') _ebTargetUser = null;
}
