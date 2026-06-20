// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════

function nav(page) {
  var _prevPage = currentPage; // capture before update for reset logic below
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const content = document.getElementById('main-content');

  // Training roles: redirect default dashboard → their overview
  if (page === 'dashboard' && isTraining(currentUser)) {
    page = 'training_overview';
  }
  // Policy page: reset to "All Records" tab for training users on fresh navigation
  if (page === 'policy' && _prevPage !== 'policy' && typeof isTraining === 'function' && isTraining(currentUser)) {
    if (typeof _pcTab !== 'undefined') _pcTab = 'records';
  }
  // Guard: attendance — leader+ only (level ≥ 2)
  if (page === 'attendance' && !isLeader(currentUser)) {
    content.innerHTML = '<div class="empty">Access denied.</div>';
    return;
  }
  // Guard: arrange — leader/supervisor only (level 2), NOT training (level 3 — they don't arrange breaks)
  if (page === 'arrange' && (!isLeader(currentUser) || isTraining(currentUser))) {
    content.innerHTML = '<div class="empty">Access denied.</div>';
    return;
  }
  // Guard: staff — all authenticated users may view (non-leaders see schedule sub-tab only)
  // Guard: sync — admin only (level 4)
  if (page === 'sync' && !isAdmin(currentUser)) {
    content.innerHTML = '<div class="empty">Access denied.</div>';
    return;
  }
  // Guard: shiftconfig — leader+ (level 2)
  if (page === 'shiftconfig' && !isLeader(currentUser)) {
    content.innerHTML = '<div class="empty">Access denied.</div>';
    return;
  }
  // policy — no guard, all roles can access
  if (page === 'policy' && !isLeader(currentUser)) {
    content.innerHTML = '<div class="empty">Access denied.</div>'; return;
  }


  const pages = {
    dashboard: renderDashboard,
    schedule: renderSchedule,
    requests: renderRequests,
    arrange: renderArrange,
    extbreak: renderExtBreak,
    attendance: renderAttendance,
    staff: renderStaff,
    sync: renderSyncSettings,
    shiftconfig: renderShiftConfig,
    training_overview: renderTrainingDashboard,
    policy: renderPolicyCompliance,
    feedback: renderPolicyFeedback,
  };
  if (page !== currentPage) { window._tShiftFilter = 'all'; window._tSearch = ''; window._tAttDay = undefined; }
  if (pages[page]) content.innerHTML = pages[page]();
  else content.innerHTML = '<div class="empty">Page not found.</div>';
  attachPageEvents(page);
  history.replaceState(null, '', '#' + page);
}

window.addEventListener('hashchange', function() {
  nav(location.hash.slice(1) || 'dashboard');
});

  function changeSidebarShift(v) {
    currentShift = _guardShift(v);
    document.getElementById('sidebar-shift').value = currentShift;
    _updateShiftPills();
    if (typeof scheduleMonday !== 'undefined') scheduleMonday = null;
    nav(currentPage);
  }

function attachPageEvents(page) {
  if (page === 'arrange') {
    const firstTab = document.querySelector('#arrange-day-tabs .tab');
    if (firstTab) firstTab.classList.add('on');
  }
}

// ── Sidebar collapse toggle ──
let _sidebarCollapsed = localStorage.getItem('nav_collapsed') === '1';

function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  localStorage.setItem('nav_collapsed', _sidebarCollapsed ? '1' : '0');
  _applySidebarState();
}

function _applySidebarState() {
  const sidebar = document.getElementById('sidebar');
  const layout  = document.querySelector('.layout');
  if (!sidebar || !layout) return;
  sidebar.classList.toggle('collapsed', _sidebarCollapsed);
  layout.classList.toggle('collapsed', _sidebarCollapsed);
}

// ── Add tooltips to nav items for collapsed state ──
function _initNavTooltips() {
  const tooltips = {
    dashboard: 'Dashboard',
    schedule:  'Break Schedule',
    requests:  'Break Swap',
    extbreak:  '30-min Break',
    feedback:  'My Violations',
    arrange:   'Arrange Breaks',
    attendance:'Logbook',
    policy:    'Policy',
    staff:     'Staff',
    sync:      'Cloud Sync',
    shiftconfig: 'Shift Config',
  };
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    const page = el.dataset.page;
    if (tooltips[page]) el.setAttribute('data-tooltip', tooltips[page]);
  });
  _applySidebarState();
}

// ── Update active shift pill ──
function _updateShiftPills(shift = currentShift) {
  ['A','D','E'].forEach(s => {
    const el = document.getElementById('spill-' + s);
    if (el) el.classList.toggle('active', s === shift);
  });
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  _initNavTooltips();
  _updateShiftPills(currentShift || 'E');
});
