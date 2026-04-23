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
    staff:     renderStaff,
  };
  if (pages[page]) content.innerHTML = pages[page]();
  else content.innerHTML = '<div class="empty">Page not found.</div>';
  attachPageEvents(page);
}

function changeSidebarShift(v) {
  currentShift = v;
  // Reset schedule week picker when shift changes
  if (typeof scheduleMonday !== 'undefined') scheduleMonday = null;
  nav(currentPage);
}

function attachPageEvents(page) {
  // Activate first arrange tab after render
  if (page === 'arrange') {
    const firstTab = document.querySelector('#arrange-tabs .tab');
    if (firstTab) firstTab.classList.add('on');
  }
}
