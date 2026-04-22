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
  nav(currentPage);
}

function attachPageEvents(page) {
  // Future event wiring per page if needed
}
