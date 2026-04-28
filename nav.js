// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════

function nav(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const content = document.getElementById('main-content');
  const pages = {
    dashboard: renderDashboard,
    schedule:  renderSchedule,
    requests:  renderRequests,
    arrange:   renderArrange,
    extbreak:  renderExtBreak,
    staff:     renderStaff,
    sync:      renderSyncSettings,
  };
  // Guard: sync page is admin-only
  if (page === 'sync' && !isAdmin(currentUser)) {
    content.innerHTML = '<div class="empty">Access denied.</div>';
    return;
  }
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