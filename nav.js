// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════

function nav(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const content = document.getElementById('main-content');

  // Training roles: redirect default dashboard → their overview
  if (page === 'dashboard' && isTraining(currentUser)) {
    page = 'training_overview';
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
  // Guard: staff — leader+ (level ≥ 2)
  if (page === 'staff' && !isLeader(currentUser)) {
    content.innerHTML = '<div class="empty">Access denied.</div>';
    return;
  }
  // Guard: sync — admin only (level 4)
  if (page === 'sync' && !isAdmin(currentUser)) {
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
    training_overview: renderTrainingDashboard,
    policy: renderPolicyCompliance,
    feedback: renderPolicyFeedback,
  };
  if (page !== currentPage) { window._tShiftFilter = 'all'; window._tSearch = ''; window._tAttDay = undefined; }
  if (pages[page]) content.innerHTML = pages[page]();
  else content.innerHTML = '<div class="empty">Page not found.</div>';
  attachPageEvents(page);
}

function changeSidebarShift(v) {
  currentShift = v;
  if (typeof scheduleMonday !== 'undefined') scheduleMonday = null;
  nav(currentPage);
}

function attachPageEvents(page) {
  if (page === 'arrange') {
    const firstTab = document.querySelector('#arrange-day-tabs .tab');
    if (firstTab) firstTab.classList.add('on');
  }
}
