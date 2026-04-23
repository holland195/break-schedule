// ═══════════════════════════════════════════════
//  CONSTANTS & SEED DATA
// ═══════════════════════════════════════════════

const STORAGE = 'bsched_v4';
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SEED_USERS = [
  { id: 999,  username: 'admin',           name: 'System Admin',                     gender: 'M', team: 'HQ', role: 'Admin',            password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  // Leaders
  { id: 1001, username: 'cuong.pham',      name: 'Phạm Minh Cường',                  gender: 'M', team: 'L1', role: 'Agent Leader',      password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 1002, username: 'hongthuy.nguyen', name: 'Nguyễn Thị Phương Hồng Thuỷ',      gender: 'F', team: 'L2', role: 'Agent Leader',      password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 1003, username: 'dung.tran',       name: 'Trần Quốc Dũng',                   gender: 'M', team: 'L3', role: 'Agent Leader',      password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 1004, username: 'ngocanh.tran',    name: 'Trần Thị Ngọc Ánh',                gender: 'F', team: 'L4', role: 'Agent Leader',      password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 1005, username: 'tam.to',          name: 'Tô Hoài Tâm',                      gender: 'F', team: 'L5', role: 'Agent Leader',      password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  // Supervisors
  { id: 2001, username: 'hai.nguyen',      name: 'Nguyễn Hồ Giang Hải',              gender: 'M', team: 'S1', role: 'Agent Supervisor',  password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 2002, username: 'thanh.nguyen',    name: 'Nguyễn Đức Thanh',                 gender: 'M', team: 'S2', role: 'Agent Supervisor',  password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 2003, username: 'duy.huynh',       name: 'Huỳnh Minh Duy',                   gender: 'M', team: 'S3', role: 'Agent Supervisor',  password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 2004, username: 'tran.le',         name: 'Lê Nguyễn Huyền Trân',             gender: 'F', team: 'S4', role: 'Agent Supervisor',  password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
  { id: 2005, username: 'hoa.nguyen',      name: 'Nguyễn Đức Hòa',                   gender: 'M', team: 'S5', role: 'Agent Supervisor',  password: '1234', schedule: { Mon: 'E', Tue: 'E', Wed: 'E', Thu: 'E', Fri: 'E', Sat: '0', Sun: '0' } },
];

const SHIFTS = {
  A: { label: 'Shift A', start: '15:00', end: '00:00', display: '3:00 PM → 12:00 AM', color: 'var(--A-color)', bg: 'var(--A-bg)' },
  B: { label: 'Shift B', start: '19:00', end: '04:00', display: '7:00 PM → 4:00 AM',  color: 'var(--B-color)', bg: 'var(--B-bg)' },
  C: { label: 'Shift C', start: '21:00', end: '06:00', display: '9:00 PM → 6:00 AM',  color: 'var(--C-color)', bg: 'var(--C-bg)' },
  D: { label: 'Shift D', start: '00:00', end: '09:00', display: '12:00 AM → 9:00 AM', color: 'var(--D-color)', bg: 'var(--D-bg)' },
  E: { label: 'Shift E', start: '06:00', end: '15:00', display: '6:00 AM → 3:00 PM',  color: 'var(--E-color)', bg: 'var(--E-bg)' },
};

// Break slots per shift (30 min windows)
const BREAK_SLOTS = {
  A: ['18:00–19:30', '19:30–21:00'],
  B: ['22:00–23:30', '23:30–01:00'],
  C: ['01:00–02:30', '02:30–04:00'],
  D: ['04:00–05:30', '05:30–07:00'],
  E: ['09:30–11:00', '11:00–12:30'],
};

const ROLES = {
  'Admin':            { level: 3, tag: 'role-leader', label: 'Admin' },
  'Agent Leader':     { level: 2, tag: 'role-leader', label: 'Leader' },
  'Agent Supervisor': { level: 2, tag: 'role-leader', label: 'Supervisor' },
  'Sr Agent':         { level: 1, tag: 'role-agent',  label: 'Sr Agent' },
  'Agent':            { level: 1, tag: 'role-agent',  label: 'Agent' },
  'QA':               { level: 1, tag: 'role-qa',     label: 'QA' },
  'Sr QA':            { level: 1, tag: 'role-qa',     label: 'Sr QA' },
};

// ═══════════════════════════════════════════════
//  STATE — localStorage as simple flat DB
//  Tables: users, breaks, requests, extBreaks
//  extBreaks: { "userId_YYYY-MM": [{ day, time, position, at }] }
//  (position = 'before' | 'after' main break)
// ═══════════════════════════════════════════════
function load() {
  try {
    const d = localStorage.getItem(STORAGE);
    if (d) return JSON.parse(d);
  } catch (e) {}
  return { users: [], breaks: {}, requests: [], extBreaks: {}, imported: false };
}
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) {}
}

// ── Simple DB API (wrappers over state tables) ──
const DB = {
  // Users
  getUsers: ()           => state.users,
  getUser:  id           => state.users.find(u => u.id === id),
  upsertUser: u          => {
    const idx = state.users.findIndex(x => x.id === u.id);
    if (idx >= 0) state.users[idx] = { ...state.users[idx], ...u };
    else state.users.push(u);
    save();
  },
  // Breaks
  getBreak:  (uid, day)  => state.breaks[`${uid}_${day}`],
  setBreak:  (uid, day, data) => { state.breaks[`${uid}_${day}`] = data; save(); },
  // Requests
  getRequests: ()        => state.requests,
  addRequest:  r         => { state.requests.unshift(r); save(); },
  updateRequest: (idx,r) => { state.requests[idx] = { ...state.requests[idx], ...r }; save(); },
  // Extended 30-min breaks
  // key: userId_YYYY-MM  → array of { day, time, position, at }
  getExtBreaks: (uid, monthKey) => (state.extBreaks[`${uid}_${monthKey}`] || []),
  addExtBreak:  (uid, monthKey, entry) => {
    const key = `${uid}_${monthKey}`;
    if (!state.extBreaks[key]) state.extBreaks[key] = [];
    state.extBreaks[key].push(entry);
    save();
  },
  deleteExtBreak: (uid, monthKey, idx) => {
    const key = `${uid}_${monthKey}`;
    if (state.extBreaks[key]) {
      state.extBreaks[key].splice(idx, 1);
      save();
    }
  },
  countExtBreaks: (uid, monthKey) => (state.extBreaks[`${uid}_${monthKey}`] || []).length,
};

let state = load();
// Migrate: ensure extBreaks table exists
if (!state.extBreaks) { state.extBreaks = {}; save(); }
if (state.users.length === 0) { state.users = SEED_USERS; save(); }

let currentUser  = null;
let currentShift = 'E';
let currentPage  = 'dashboard';
let assigningEmp = null;

// Staff page state
let activeMonday  = '20/04';
let showFullMonth = false;
let staffFilters = { team: '', name: '', gender: '', user: '', role: '' };

// Google Sheets import buffer
let importedUsers = [];
let dateDayMap    = {};

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function isLeader(u) { return u && (ROLES[u.role]?.level || 0) >= 2; }
function isAdmin(u)  { return u && (ROLES[u.role]?.level || 0) === 3; }
function getRoleInfo(r) { return ROLES[r] || { level: 0, tag: 'role-agent', label: r || '—' }; }

function todayKey() {
  const d = new Date();
  return WEEK_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

function getShiftMates(shift, day) {
  return state.users.filter(u => {
    const s = u.schedule[day || todayKey()];
    return s === shift;
  });
}

function getBreakKey(userId, day)    { return `${userId}_${day || todayKey()}`; }
function getAssigned(userId, day)    { return DB.getBreak(userId, day || todayKey()); }
function assign(userId, day, slot, note) {
  DB.setBreak(userId, day || todayKey(), { slot, note: note || '', by: currentUser?.id, at: Date.now() });
}

// Returns 'YYYY-MM' for the current calendar month
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
}

// Returns 'YYYY-MM' from a 'DD/MM' date string (assumes year 2026)
function monthKeyFromDate(dateStr) {
  const [, m] = dateStr.split('/');
  return `2026-${m.padStart(2,'0')}`;
}

function getShortSlot(shift, fullTime) {
  if (!fullTime || fullTime === '—') return '';
  const slots = BREAK_SLOTS[shift] || [];
  const index = slots.indexOf(fullTime);
  return index !== -1 ? `${shift}${index + 1}` : fullTime;
}

function getWeekRange(monStr) {
  const [d, m] = monStr.split('/');
  const range = [];
  const start = new Date(2026, parseInt(m) - 1, parseInt(d));
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const dd = dt.getDate().toString().padStart(2, '0');
    const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
    range.push(`${dd}/${mm}`);
  }
  return range;
}

function getWkDay(dateStr) {
  const [d, m] = dateStr.split('/');
  const dateObj = new Date(2026, parseInt(m) - 1, parseInt(d));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
}

function getWeekDates() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return WEEK_DAYS.map((d, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  });
}

function buildDatalist() {
  const dl = document.getElementById('user-list');
  if (dl) dl.innerHTML = state.users.map(u => `<option value="${u.username}">${u.name} (${u.team})</option>`).join('');
}

function updateBadge() {
  const pending = state.requests.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('req-badge');
  if (badge) { badge.style.display = pending > 0 ? '' : 'none'; badge.textContent = pending; }
}

function timeSince(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)   return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000)return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

let toastTimer;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  const ico = { ok: '✓', err: '✕', warn: '⚡' }[type] || '';
  el.innerHTML = `<span>${ico}</span> ${msg}`;
  el.className = `msg-bar show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function makeUsername(name) {
  const parts = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').split(' ').filter(Boolean);
  return (parts[parts.length - 1] || 'user') + '.' + (parts[0] || 'x');
}

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

function renderPage(page) {
  nav(page);
}

// Init datalist on load
buildDatalist();
