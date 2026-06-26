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

  // Check if this is a background/real-time re-render of the same page and view filters
  const isRerender = (page === _prevPage) &&
    (typeof currentShift === 'undefined' || currentShift === window._prevShift) &&
    (page !== 'attendance' || (
      (typeof attendanceTab === 'undefined' || attendanceTab === window._prevAttendanceTab) &&
      (typeof attendanceMonday === 'undefined' || attendanceMonday === window._prevAttendanceMonday) &&
      (typeof _attLogMonth === 'undefined' || _attLogMonth === window._prevAttLogMonth) &&
      (typeof _attLogYear === 'undefined' || _attLogYear === window._prevAttLogYear) &&
      (typeof attendanceLogView === 'undefined' || attendanceLogView === window._prevAttendanceLogView)
    )) &&
    (page !== 'feedback' || (typeof _fbTab === 'undefined' || _fbTab === window._prevFbTab)) &&
    (page !== 'policy' || (typeof _pcTab === 'undefined' || _pcTab === window._prevPcTab)) &&
    (page !== 'requests' || (typeof _reqFilterYM === 'undefined' || _reqFilterYM === window._prevReqFilterYM)) &&
    (page !== 'extbreak' || (typeof _extBreakFilterYM === 'undefined' || _extBreakFilterYM === window._prevExtBreakFilterYM)) &&
    (page !== 'arrange' || (
      (typeof arrangeActiveDay === 'undefined' || arrangeActiveDay === window._prevArrangeActiveDay) &&
      (typeof activeMonday === 'undefined' || activeMonday === window._prevActiveMonday) &&
      (typeof _arrangeMonth === 'undefined' || _arrangeMonth === window._prevArrangeMonth)
    )) &&
    (page !== 'schedule' || (typeof scheduleMonday === 'undefined' || scheduleMonday === window._prevScheduleMonday)) &&
    (typeof window._tShiftFilter === 'undefined' || window._tShiftFilter === window._prevTShiftFilter) &&
    (typeof window._tSearch === 'undefined' || window._tSearch === window._prevTSearch) &&
    (typeof window._tAttDay === 'undefined' || window._tAttDay === window._prevTAttDay);

  let savedInputs = null;
  let savedScrolls = null;

  if (isRerender && content) {
    savedInputs = _saveInputState(content);
    savedScrolls = _saveScrollState(content);
  }

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
  if (page !== _prevPage) { window._tShiftFilter = 'all'; window._tSearch = ''; window._tAttDay = undefined; }
  if (pages[page]) content.innerHTML = pages[page]();
  else content.innerHTML = '<div class="empty">Page not found.</div>';
  attachPageEvents(page);
  history.replaceState(null, '', '#' + page);

  // Restore input focus, selection, values and scrolls
  if (isRerender && content) {
    if (savedInputs) _restoreInputState(content, savedInputs);
    if (savedScrolls) _restoreScrollState(content, savedScrolls);
  }

  // Update tracking filters
  window._prevShift = typeof currentShift !== 'undefined' ? currentShift : null;
  window._prevAttendanceTab = typeof attendanceTab !== 'undefined' ? attendanceTab : null;
  window._prevAttendanceMonday = typeof attendanceMonday !== 'undefined' ? attendanceMonday : null;
  window._prevAttLogMonth = typeof _attLogMonth !== 'undefined' ? _attLogMonth : null;
  window._prevAttLogYear = typeof _attLogYear !== 'undefined' ? _attLogYear : null;
  window._prevAttendanceLogView = typeof attendanceLogView !== 'undefined' ? attendanceLogView : null;
  window._prevFbTab = typeof _fbTab !== 'undefined' ? _fbTab : null;
  window._prevPcTab = typeof _pcTab !== 'undefined' ? _pcTab : null;
  window._prevReqFilterYM = typeof _reqFilterYM !== 'undefined' ? _reqFilterYM : null;
  window._prevExtBreakFilterYM = typeof _extBreakFilterYM !== 'undefined' ? _extBreakFilterYM : null;
  window._prevArrangeActiveDay = typeof arrangeActiveDay !== 'undefined' ? arrangeActiveDay : null;
  window._prevActiveMonday = typeof activeMonday !== 'undefined' ? activeMonday : null;
  window._prevArrangeMonth = typeof _arrangeMonth !== 'undefined' ? _arrangeMonth : null;
  window._prevScheduleMonday = typeof scheduleMonday !== 'undefined' ? scheduleMonday : null;
  window._prevTShiftFilter = typeof window._tShiftFilter !== 'undefined' ? window._tShiftFilter : null;
  window._prevTSearch = typeof window._tSearch !== 'undefined' ? window._tSearch : null;
  window._prevTAttDay = typeof window._tAttDay !== 'undefined' ? window._tAttDay : null;
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

// ── Helper utilities for input and scroll preservation ──

function _saveInputState(container) {
  const state = [];
  container.querySelectorAll('input, textarea, select, [contenteditable]').forEach(el => {
    const id = el.id;
    const name = el.name;
    const selector = id ? '#' + id : _getUniqueSelector(el);
    
    let value = null;
    let checked = null;
    let contentHtml = null;
    
    if (el.hasAttribute('contenteditable') || el.isContentEditable) {
      contentHtml = el.innerHTML;
    } else if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      checked = el.checked;
    } else {
      value = el.value;
    }
    
    state.push({
      selector,
      id,
      name,
      value,
      checked,
      contentHtml,
      isFocused: (document.activeElement === el),
      selectionStart: (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.selectionStart : null,
      selectionEnd: (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.selectionEnd : null
    });
  });
  return state;
}

function _restoreInputState(container, savedState) {
  savedState.forEach(item => {
    let el = null;
    if (item.id) {
      el = document.getElementById(item.id);
    } else {
      try {
        el = container.querySelector(item.selector);
      } catch(e) {}
    }
    
    if (!el && item.name) {
      el = container.querySelector(`[name="${item.name}"]`);
    }
    
    if (el) {
      if (item.contentHtml !== null) {
        el.innerHTML = item.contentHtml;
      } else if (item.checked !== null) {
        el.checked = item.checked;
      } else if (item.value !== null) {
        el.value = item.value;
      }
      
      if (item.isFocused) {
        el.focus();
        if (item.selectionStart !== null && item.selectionEnd !== null) {
          try {
            el.setSelectionRange(item.selectionStart, item.selectionEnd);
          } catch(e) {}
        }
      }
    }
  });
}

function _saveScrollState(container) {
  const state = [];
  state.push({
    selector: '#main-content',
    scrollTop: container.scrollTop,
    scrollLeft: container.scrollLeft
  });
  
  container.querySelectorAll('*').forEach(el => {
    if (el.scrollTop > 0 || el.scrollLeft > 0) {
      state.push({
        selector: _getUniqueSelector(el),
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft
      });
    }
  });
  return state;
}

function _restoreScrollState(container, savedScrolls) {
  savedScrolls.forEach(item => {
    let el = null;
    if (item.selector === '#main-content') {
      el = container;
    } else {
      try {
        el = container.querySelector(item.selector);
      } catch(e) {}
    }
    if (el) {
      el.scrollTop = item.scrollTop;
      el.scrollLeft = item.scrollLeft;
    }
  });
}

function _getUniqueSelector(el) {
  if (el.id) return '#' + el.id;
  const path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    if (el.id) {
      path.unshift('#' + el.id);
      break;
    }
    if (el === document.getElementById('main-content')) {
      path.unshift('#main-content');
      break;
    }
    let selector = el.nodeName.toLowerCase();
    let sibling = el;
    let sibIndex = 1;
    while (sibling = sibling.previousElementSibling) {
      if (sibling.nodeName === el.nodeName) {
        sibIndex++;
      }
    }
    path.unshift(selector + ':nth-of-type(' + sibIndex + ')');
    el = el.parentNode;
  }
  return path.join(' > ');
}
