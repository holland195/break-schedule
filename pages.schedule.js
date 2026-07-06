let scheduleMonday = null; // null = "use current real week"
var scheduleMonthStr = ''; // 'MM/YYYY'; empty = current month

function renderSchedule() {
  if (isTraining(currentUser)) {
    if (typeof renderScheduleTraining === 'function') return renderScheduleTraining();
    return '<div class="empty">Loading…</div>';
  }

  var shiftToShow = currentShift;
  var schedSearch = window._schedSearch || '';
  var shiftSlots = BREAK_SLOTS[shiftToShow] || [];
  var _tNow = new Date();
  var todayDk = _tNow.getDate().toString().padStart(2,'0') + '/' + (_tNow.getMonth()+1).toString().padStart(2,'0');

  // Determine selected month (MM/YYYY)
  var _curYear = _tNow.getFullYear();
  var _curMonthStr = String(_tNow.getMonth()+1).padStart(2,'0') + '/' + _curYear;

  // Collect available months from schedule keys — aggregate across ALL users
  var _schedKeySet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(k) { _schedKeySet[k] = true; });
  });
  var _allSchedKeys = Object.keys(_schedKeySet);
  var _monthSet = {};
  _allSchedKeys.forEach(function(dk) {
    var _p = dk.split('/');
    if (_p.length === 2) _monthSet[_p[1].padStart(2,'0') + '/' + _curYear] = true;
  });

  // Reset saved month if it's no longer in available months
  var _months = Object.keys(_monthSet).sort(function(a, b) { return parseInt(a) - parseInt(b); });
  if (scheduleMonthStr && _months.length > 0 && !_months.includes(scheduleMonthStr)) {
    scheduleMonthStr = null;
  }
  var activeMonthStr = scheduleMonthStr || _curMonthStr || (_months.length > 0 ? _months[_months.length - 1] : _curMonthStr);
  var _smParts = activeMonthStr.split('/');
  var _selMM = parseInt(_smParts[0]);
  var _selYYYY = parseInt(_smParts[1]);
  var _MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  var monthPickerHTML = _months.length > 0 ? `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">MONTH:</span>
      <select class="login-select" style="padding:4px 8px;font-size:11px;"
        onchange="scheduleMonthStr=this.value;nav('schedule')">
        ${_months.map(function(ms) {
          var _mp = ms.split('/');
          var _mn = _MONTH_NAMES[parseInt(_mp[0])-1] + ' ' + _mp[1];
          return '<option value="' + ms + '"' + (ms === activeMonthStr ? ' selected' : '') + '>' + _mn + '</option>';
        }).join('')}
      </select>
    </div>` : '';

  // Get all date keys for the selected month, sorted by day
  var monthDates = _allSchedKeys
    .filter(function(dk) {
      var _p = dk.split('/');
      return _p.length === 2 && parseInt(_p[1]) === _selMM;
    })
    .sort(function(a, b) { return parseInt(a) - parseInt(b); });

  // Map date key → day name (for schedule day-name fallback lookup)
  var _scheduleDateMeta = {};
  monthDates.forEach(function(dk) {
    var _p = dk.split('/');
    var _d = parseInt(_p[0]);
    var _m = parseInt(_p[1]);
    var dow = new Date(_selYYYY, _m - 1, _d).getDay();
    _scheduleDateMeta[dk] = {
      d: _d,
      m: _m,
      dow: dow,
      dayName: WEEK_DAYS[dow],
      isToday: dk === todayDk,
      isWknd: dow === 0 || dow === 6,
      isSun: dow === 0
    };
  });

  var _schedLookupCache = {};
  function getUserShift(u, dateKey) {
    var cacheKey = u.username + '|' + dateKey;
    if (_schedLookupCache.hasOwnProperty(cacheKey)) return _schedLookupCache[cacheKey];
    var sc = state.staffSchedule[u.username] || {};
    var v = sc[dateKey];
    if (!v && dateKey && dateKey.indexOf('/') !== -1) {
      var meta = _scheduleDateMeta[dateKey];
      v = sc[meta ? meta.dayName : getWkDay(dateKey)];
    }
    _schedLookupCache[cacheKey] = v || '0';
    return _schedLookupCache[cacheKey];
  }

  // All users who work this shift at least once this month (exclude lead/sub/training/viewers)
  var allShiftUsers = state.users.filter(function(u) {
    if (u.username === 'tuan.mai' || u.username === 'nhon.bui') return false;
    var _ur = u.role || (state.staffInfo[u.username]||{}).role || '';
    var _ul = (ROLES[_resolveRole(_ur)||_ur] || {}).level;
    if (_ul >= 2) return false;
    return monthDates.some(function(dk) { return getUserShift(u, dk) === shiftToShow; });
  });

  // Slot totals across the month
  var slot1Count = 0, slot2Count = 0;
  allShiftUsers.forEach(function(u) {
    monthDates.forEach(function(dk) {
      var br = getDisplayAssigned(u.id, dk);
      if (!br) return;
      var code = getShortSlot(shiftToShow, br.slot);
      var idx = code.length === 2 ? parseInt(code[1]) - 1 : shiftSlots.indexOf(br.slot);
      if (idx === 0) slot1Count++;
      else if (idx === 1) slot2Count++;
    });
  });

  // Filtered for display
  var shiftUsers = allShiftUsers.slice();
  if (schedSearch) {
    var _sq = schedSearch.toLowerCase();
    shiftUsers = shiftUsers.filter(function(u) {
      return (u.name || '').toLowerCase().includes(_sq) ||
             (u.username || '').toLowerCase().includes(_sq);
    });
  }

  var _selectedExtMonthKey = _selYYYY + '-' + String(_selMM).padStart(2, '0');
  var _extDaysByUser = {};
  shiftUsers.forEach(function(u) {
    var dayMap = {};
    (DB.getExtBreaks(u.id, _selectedExtMonthKey) || []).forEach(function(e) {
      var days = (e.days && e.days.length > 0) ? e.days : (e.day ? [e.day] : []);
      days.forEach(function(day) { dayMap[day] = true; });
    });
    _extDaysByUser[u.id] = dayMap;
  });

  // Slot totals strip + search bar
  var slotTotalsHTML = shiftSlots.length > 0 ? `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 14px;
      background:var(--bg3);border-radius:8px;border:1px solid var(--border);
      margin-bottom:14px;flex-wrap:wrap;">
      <input class="filter-input" style="flex:1;min-width:160px;max-width:260px;padding:5px 10px;font-size:12px;"
        placeholder="🔍 Search by name…"
        value="${schedSearch}"
        oninput="window._schedSearch=this.value;
          var q=this.value.toLowerCase();
          document.querySelectorAll('#sched-tbody tr').forEach(function(r){
            var nm=(r.querySelector('.sched-name')||{}).textContent||'';
            r.style.display=nm.toLowerCase().includes(q)?'':'none';
          });
          document.getElementById('sched-count').textContent=([...document.querySelectorAll('#sched-tbody tr')].filter(function(r){return r.style.display!=='none';}).length)+' staff';">
      <span style="color:var(--border2);flex-shrink:0;">|</span>
      <span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;">
        Shift ${shiftToShow}
        <span style="color:var(--accent);margin-left:4px;" id="sched-count">${shiftUsers.length}</span>
        <span style="color:var(--text3);font-size:11px;font-weight:400;"> staff</span>
      </span>
      <span style="color:var(--border2);flex-shrink:0;">|</span>
      ${shiftSlots.map(function(time, i) {
        var count = i === 0 ? slot1Count : slot2Count;
        return '<span style="display:flex;align-items:center;gap:5px;white-space:nowrap;">' +
          '<span class="break-slot slot-' + (i+1) + '" style="font-size:10px;padding:2px 7px;">' + shiftToShow + (i+1) + '</span>' +
          '<span style="font-size:12px;color:var(--text);font-weight:600;">' + count + '</span>' +
          '<span style="font-size:11px;color:var(--text3);">assigned</span>' +
          '</span>';
      }).join('<span style="color:var(--border2);">·</span>')}
    </div>` : '';

  // Break slot legend
  var legendItems = shiftSlots.map(function(time, i) {
    return '<div style="display:flex;align-items:center;gap:6px;">' +
      '<span class="break-slot assigned slot-' + (i+1) + '" style="font-size:10px;min-width:28px;text-align:center;">' + shiftToShow + (i+1) + '</span>' +
      '<span style="color:var(--text2);font-size:11px;">' + time + '</span>' +
      '</div>';
  }).join('');

  // Table header — compact, one column per day
  var _WDAY_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var theadCells = monthDates.map(function(dk) {
    var meta = _scheduleDateMeta[dk];
    var dow = meta.dow;
    var isToday = meta.isToday;
    var isWknd = meta.isWknd;
    var isSun = meta.isSun;
    return '<th style="min-width:44px;width:44px;padding:4px 2px;text-align:center;' +
      'font-size:10px;font-weight:600;' +
      'color:' + (isToday ? 'var(--accent)' : isSun ? 'var(--err)' : isWknd ? 'var(--warn)' : 'var(--text2)') + ';' +
      'background:' + (isToday ? 'rgba(31,102,241,.08)' : isWknd ? 'var(--bg4)' : 'var(--bg3)') + ';' +
      'border-bottom:2px solid ' + (isToday ? 'var(--accent)' : isSun ? 'var(--err)' : isWknd ? 'var(--border2)' : 'var(--accent)') + ';' +
      'border-left:' + (isSun ? '2px solid var(--border)' : 'none') + ';' +
      'position:sticky;top:0;z-index:2;white-space:nowrap;">' +
      '<div style="font-size:8px;font-weight:400;opacity:.65;line-height:1.5;">' + _WDAY_SHORT[dow] + '</div>' +
      '<div style="font-size:11px;line-height:1.3;' + (isToday ? 'color:var(--accent);font-weight:700;' : '') + '">' + dk + '</div>' +
      '</th>';
  }).join('');

  // Table body
  var tbodyRows = shiftUsers.map(function(u) {
    var cells = monthDates.map(function(dk) {
      var userShift = getUserShift(u, dk);
      var meta = _scheduleDateMeta[dk];
      var isWknd2 = meta.isWknd;
      var isToday2 = meta.isToday;
      var tdBg = isToday2 ? 'background:rgba(31,102,241,.06);' : isWknd2 ? 'background:var(--bg4);' : '';
      if (userShift !== shiftToShow) {
        return '<td style="text-align:center;padding:3px 1px;' + tdBg + '">' +
          '<span style="font-size:9px;color:var(--text3);">' + (userShift !== '0' ? userShift : '·') + '</span></td>';
      }
      var br = getDisplayAssigned(u.id, dk);
      var hasExt = !!(_extDaysByUser[u.id] && _extDaysByUser[u.id][dk]);
      var slotIdx = br ? getShortSlot(shiftToShow, br.slot) : '';
      var slotNum = slotIdx.length === 2 ? parseInt(slotIdx[1]) : 0;
      var slotCls = slotNum > 0 ? 'slot-' + slotNum : '';
      var shortCode = br ? getShortSlot(shiftToShow, br.slot) : '?';
      var swapTitle = br && br.swapDisplay ? ' (approved swap)' : '';
      return '<td style="text-align:center;padding:3px 1px;' + tdBg + '"' + (hasExt ? ' class="cell-female-ext"' : '') + '>' +
        '<span class="' + (br ? 'break-slot assigned ' + slotCls : '') + '" ' +
        'style="font-size:9px;padding:2px 4px;' + (br ? '' : 'color:var(--text3)') + '" ' +
        'title="' + (br ? br.slot + swapTitle + (hasExt ? ' 🌸+30min' : '') : 'Not assigned') + '">' +
        shortCode + (hasExt ? '🌸' : '') +
        '</span></td>';
    }).join('');
    return '<tr>' +
      '<td class="sched-name-col">' +
        '<div class="sched-name">' + u.name + '</div>' +
        '<div class="sched-meta">' + (u.team || '') + ' · ' + getRoleInfo(u.role).label + '</div>' +
      '</td>' + cells + '</tr>';
  }).join('');

  var monthLabel = _MONTH_NAMES[_selMM-1] + ' ' + _selYYYY;
  var emptyMsg = shiftUsers.length === 0 ? `
    <div class="empty" style="padding:40px;">
      <div class="empty-ico">👥</div>
      ${schedSearch ? `No results for "${schedSearch}"` : `No staff on Shift ${shiftToShow} in ${monthLabel}.`}
    </div>` : '';

  return `
<div class="schedule-title-row">
  <div>
    <div class="page-title">Break Schedule — Shift ${shiftToShow}</div>
    <div class="page-sub">${SHIFTS[shiftToShow]?.display || ''} · ${monthLabel}</div>
  </div>
  <div class="schedule-legend-inline" style="flex-wrap:wrap;gap:8px;">
    ${monthPickerHTML}
    <span style="font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Legend:</span>
    ${legendItems || '<span style="color:var(--text3);font-size:11px">—</span>'}
  </div>
</div>

${slotTotalsHTML}
${emptyMsg}
${shiftUsers.length > 0 ? `
<div class="sched-table-wrap">
  <table class="sched-table">
    <thead><tr>
      <th class="sched-th-name">Name / Group</th>
      ${theadCells}
    </tr></thead>
    <tbody id="sched-tbody">${tbodyRows}</tbody>
  </table>
</div>` : ''}`;
}

