// ═══════════════════════════════════════════════
//  TRAINING ROLE — UNIFIED ALL-SHIFTS VIEWS
//  Replaces renderSchedule, renderExtBreak, renderAttendance
//  for users where isTraining(currentUser) === true
//
//  APPLY: In pages.js and attendance.js, wrap the existing
//  render functions with the isTraining() check shown below.
// ═══════════════════════════════════════════════

// ── Shared helpers ──
// Shift color palette (matches existing CSS variables)
const SHIFT_COLORS = {
  A: { bg:'var(--A-bg)', color:'var(--A-color)', border:'var(--A-color)' },
  B: { bg:'var(--B-bg)', color:'var(--B-color)', border:'var(--B-color)' },
  C: { bg:'var(--C-bg)', color:'var(--C-color)', border:'var(--C-color)' },
  D: { bg:'var(--D-bg)', color:'var(--D-color)', border:'var(--D-color)' },
  E: { bg:'var(--E-bg)', color:'var(--E-color)', border:'var(--E-color)' },
};

// Global state for training views
window._tShiftFilter = 'all'; // 'all' | 'A' | 'B' | 'C' | 'D' | 'E'
window._tSearch      = '';

function _shiftBadge(sh, size) {
  const c = SHIFT_COLORS[sh] || {};
  const px = size || 22;
  return `<span style="display:inline-flex;width:${px}px;height:${px}px;align-items:center;justify-content:center;
    border-radius:5px;font-size:${Math.round(px*0.5)}px;font-weight:600;
    background:${c.bg};color:${c.color};">${sh}</span>`;
}

function _shiftTabBar(countFn) {
  const active = window._tShiftFilter;
  const allBtn = `<button onclick="window._tShiftFilter='all';window._tSearch='';nav('${currentPage}')"
    style="padding:5px 14px;border-radius:var(--r);border:1px solid ${active==='all'?'var(--accent)':'var(--border2)'};
    font-size:12px;font-weight:600;cursor:pointer;background:${active==='all'?'var(--accent)':'var(--bg2)'};
    color:${active==='all'?'#fff':'var(--text2)'};transition:all .12s;">All shifts</button>`;
  const shiftBtns = ['A','B','C','D','E'].map(sh => {
    const isAct = active === sh;
    const c = SHIFT_COLORS[sh];
    const cnt = countFn ? countFn(sh) : '';
    return `<button onclick="window._tShiftFilter='${sh}';window._tSearch='';nav('${currentPage}')"
      style="padding:5px 14px;border-radius:var(--r);
        border:1.5px solid ${isAct?c.border:'var(--border2)'};
        font-size:12px;font-weight:600;cursor:pointer;
        background:${isAct?c.bg:'var(--bg2)'};color:${isAct?c.color:'var(--text2)'};transition:all .12s;">
      ${sh}${cnt!==''?` <span style="font-size:10px;opacity:.65;">${cnt}</span>`:''}
    </button>`;
  }).join('');
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;">${allBtn}${shiftBtns}</div>`;
}

function _searchBar(page, placeholder, resultCount) {
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
    <input class="filter-input" style="width:280px;padding:7px 12px;font-size:13px;"
      placeholder="${placeholder}"
      value="${window._tSearch||''}"
      oninput="window._tSearch=this.value;
        const q=this.value.toLowerCase();
        let visible=0;
        document.querySelectorAll('.t-shift-block').forEach(block=>{
          let blockVisible=0;
          block.querySelectorAll('tbody tr.t-data-row').forEach(row=>{
            const nm=(row.dataset.name||'').toLowerCase();
            const show=!q||nm.includes(q);
            row.style.display=show?'':'none';
            if(show)blockVisible++;
          });
          block.style.display=blockVisible>0?'':'none';
          visible+=blockVisible;
        });
        document.getElementById('t-result-count').textContent=visible+' staff';">
    <span id="t-result-count" style="font-size:11px;color:var(--text3);">${resultCount} staff</span>
  </div>`;
}

function _shiftBlock(sh, headerExtra, tableHTML, staffCount) {
  if (window._tShiftFilter !== 'all' && window._tShiftFilter !== sh) return '';
  if (staffCount === 0) return '';
  const c = SHIFT_COLORS[sh];
  const shiftDef = SHIFTS[sh] || {};
  return `
<div class="t-shift-block" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px;">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
    background:${c.bg};border-bottom:1px solid var(--border);">
    ${_shiftBadge(sh, 24)}
    <span style="font-size:13px;font-weight:600;color:${c.color};">Shift ${sh}</span>
    <span style="font-size:11px;color:var(--text2);">${shiftDef.display||''}</span>
    <span style="margin-left:auto;font-size:11px;color:var(--text2);">${headerExtra}</span>
  </div>
  ${tableHTML}
</div>`;
}

// ═══════════════════════════════════════════════
//  1. BREAK SCHEDULE — TRAINING VIEW
//  ADD at top of renderSchedule():
//    if (isTraining(currentUser)) return renderScheduleTraining();
// ═══════════════════════════════════════════════

function renderScheduleTraining() {
  const canPickWeek = false; // training: current week only
  let weekDates = getWeekDates();
  const todayDk = weekDates[new Date().getDay()===0?6:new Date().getDay()-1] || weekDates[0];

  const dateToDayName = {};
  WEEK_DAYS.forEach((d,i) => { dateToDayName[weekDates[i]] = d; });

  function getUserShift(u, dk) {
    return u.schedule[dk] || u.schedule[dateToDayName[dk]] || '0';
  }

  // Compute per-shift users and totals
  const shiftData = {};
  ['A','B','C','D','E'].forEach(sh => {
    const slots = BREAK_SLOTS[sh] || [];
    const users = state.users.filter(u => weekDates.some(dk => getUserShift(u,dk)===sh));
    let s1=0, s2=0;
    users.forEach(u => {
      weekDates.forEach(dk => {
        const br = DB.getBreak(u.id, dk);
        if (!br) return;
        const idx = slots.indexOf(br.slot);
        if (idx===0) s1++; else if (idx===1) s2++;
      });
    });
    shiftData[sh] = { users, slots, s1, s2 };
  });

  const totalStaff = Object.values(shiftData).reduce((a,d) => a+d.users.length, 0);
  const filt = window._tShiftFilter;
  const searchQ = (window._tSearch||'').toLowerCase();
  const visCount = filt==='all'
    ? (searchQ ? state.users.filter(u=>u.name.toLowerCase().includes(searchQ)).length : totalStaff)
    : (shiftData[filt]?.users.filter(u=>!searchQ||u.name.toLowerCase().includes(searchQ)).length||0);

  // Totals bar
  const totalsBar = `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 14px;
      background:var(--bg3);border:1px solid var(--border);border-radius:8px;
      margin-bottom:12px;flex-wrap:wrap;font-size:12px;">
      <b style="color:var(--text);">All shifts: <span style="color:var(--accent);">${totalStaff}</span> agents</b>
      <span style="color:var(--border2);">|</span>
      ${['A','B','C','D','E'].map(sh => {
        const d = shiftData[sh];
        return `<span style="color:var(--text2);">${_shiftBadge(sh,16)} <b style="color:var(--text);">${d.users.length}</b></span>`;
      }).join('<span style="color:var(--border2);">·</span>')}
    </div>`;

  // Build each shift block
  const blocks = ['A','B','C','D','E'].map(sh => {
    const d = shiftData[sh];
    if (!d.users.length) return '';
    if (filt!=='all' && filt!==sh) return '';

    const theadCells = weekDates.map((dk,i) => {
      const isToday = dk===todayDk;
      return `<th style="min-width:60px;text-align:center;padding:6px 3px;
        background:${isToday?'rgba(31,102,241,.12)':'var(--bg3)'};
        border-bottom:2px solid ${isToday?'var(--accent)':'var(--border2)'};">
        <div style="font-size:11px;font-weight:700;color:${isToday?'var(--accent)':'var(--text2)'};">${WEEK_DAYS[i]}</div>
        <div style="font-size:10px;color:${isToday?'var(--accent)':'var(--text3)'};">${dk}</div>
      </th>`;
    }).join('');

    const tbodyRows = d.users.map(u => {
      const cells = weekDates.map(dk => {
        const us = getUserShift(u,dk);
        if (us!==sh) return `<td style="text-align:center;padding:5px 3px;${dk===todayDk?'background:rgba(31,102,241,.04);':''}"><span style="font-size:10px;color:var(--text3);">—</span></td>`;
        const br = DB.getBreak(u.id, dk);
        const slotIdx = br ? d.slots.indexOf(br.slot) : -1;
        const slotCls = slotIdx>=0 ? `slot-${slotIdx+1}` : '';
        const code = br ? getShortSlot(sh, br.slot) : '?';
        return `<td style="text-align:center;padding:4px 2px;${dk===todayDk?'background:rgba(31,102,241,.04);':''}">
          <span class="${br?`break-slot assigned ${slotCls}`:''}"
            style="font-size:10px;padding:3px 7px;${br?'':'color:var(--text3);'}"
            title="${br?br.slot:'Not assigned'}">${code}</span>
        </td>`;
      }).join('');
      return `<tr class="t-data-row" data-name="${u.name.toLowerCase()}">
        <td style="padding:6px 10px;white-space:nowrap;">
          <div style="font-size:12px;font-weight:600;">${u.name}</div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>${cells}
      </tr>`;
    }).join('');

    // Slot totals in header
    const s1b = `<span class="break-slot slot-1" style="font-size:10px;padding:2px 6px;margin-left:6px;">${sh}1: ${d.s1}</span>`;
    const s2b = `<span class="break-slot slot-2" style="font-size:10px;padding:2px 6px;margin-left:4px;">${sh}2: ${d.s2}</span>`;
    const hdr = `${d.users.length} agents ${s1b}${s2b}`;

    const tableHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th style="text-align:left;padding:7px 10px;font-size:11px;color:var(--text2);min-width:180px;background:var(--bg3);border-bottom:2px solid var(--border2);">Name / Group</th>
            ${theadCells}
          </tr></thead>
          <tbody>${tbodyRows}</tbody>
        </table>
      </div>`;
    return _shiftBlock(sh, hdr, tableHTML, d.users.length);
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">Break Schedule — All Shifts</div>
    <div class="page-sub">Current week · Read-only</div>
  </div>
</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
  ${_shiftTabBar(sh => shiftData[sh]?.users.length)}
</div>
${_searchBar('schedule','Search by name…', visCount)}
${totalsBar}
${blocks||'<div class="empty">No staff found.</div>'}`;
}


// ═══════════════════════════════════════════════
//  2. 30-MIN BREAK — TRAINING VIEW
//  ADD at top of renderExtBreak():
//    if (isTraining(currentUser)) return renderExtBreakTraining();
// ═══════════════════════════════════════════════

function renderExtBreakTraining() {
  const mk = currentMonthKey();
  const [yr, mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr),parseInt(mo)-1,1)
    .toLocaleString('en-US',{month:'long',year:'numeric'});

  const weekDates = getWeekDates();
  const dateToDayName = {};
  WEEK_DAYS.forEach((d,i)=>{ dateToDayName[weekDates[i]]=d; });

  // All female users grouped by primary shift
  const femaleByShift = {};
  ['A','B','C','D','E'].forEach(sh => { femaleByShift[sh] = []; });

  state.users.forEach(u => {
    if (u.gender !== 'F') return;
    // Find primary shift this week
    const shiftCounts = {};
    weekDates.forEach(dk => {
      const s = u.schedule[dk] || u.schedule[dateToDayName[dk]] || '0';
      if (s && s!=='0') shiftCounts[s] = (shiftCounts[s]||0)+1;
    });
    const primaryShift = Object.entries(shiftCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if (primaryShift && femaleByShift[primaryShift]) {
      femaleByShift[primaryShift].push(u);
    }
  });

  const totalFemale = Object.values(femaleByShift).reduce((a,arr)=>a+arr.length,0);
  const searchQ = (window._tSearch||'').toLowerCase();
  const visCount = Object.values(femaleByShift).flat()
    .filter(u=>!searchQ||u.name.toLowerCase().includes(searchQ)).length;

  const blocks = ['A','B','C','D','E'].map(sh => {
    const users = femaleByShift[sh];
    if (!users.length) return '';
    if (window._tShiftFilter!=='all' && window._tShiftFilter!==sh) return '';

    const rows = users.map(u => {
      const entries = DB.getExtBreaks(u.id, mk);
      const used    = entries.length;
      const rem     = Math.max(0, 3-used);
      const dates   = entries.map(e=>e.day).filter(Boolean).join(', ') || '—';
      const dots    = [0,1,2].map(i=>`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;
        margin-right:3px;background:${i<used?'var(--A-color)':'var(--border2)'};"></span>`).join('');
      return `<tr class="t-data-row" data-name="${u.name.toLowerCase()}"
        style="border-bottom:0.5px solid var(--border);">
        <td style="padding:7px 10px;">
          <div style="font-size:12px;font-weight:600;">${u.name} <span style="color:var(--A-color);font-size:11px;">♀</span></div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>
        <td style="padding:7px 10px;text-align:center;">
          ${dots}
          <span style="font-size:11px;color:var(--text2);margin-left:4px;">${used}/3</span>
        </td>
        <td style="padding:7px 10px;text-align:center;">
          <span style="font-size:12px;font-weight:600;color:${rem===0?'var(--err)':rem===1?'var(--warn)':'var(--ok)'};">${rem} left</span>
        </td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text2);">${dates}</td>
      </tr>`;
    }).join('');

    const tableHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg3);">
          <tr style="border-bottom:2px solid var(--border2);">
            <th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text2);min-width:180px;">NAME</th>
            <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--text2);">USED</th>
            <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--text2);">REMAINING</th>
            <th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text2);">DATES USED</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    return _shiftBlock(sh, `${users.length} female staff`, tableHTML, users.length);
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">🌸 30-Min Extra Break — All Shifts</div>
    <div class="page-sub">${monthLabel} · ${totalFemale} female staff</div>
  </div>
</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
  ${_shiftTabBar(sh => femaleByShift[sh]?.length)}
</div>
${_searchBar('extbreak','Search by name…', visCount)}
${blocks||'<div class="empty">No female staff found.</div>'}`;
}


// ═══════════════════════════════════════════════
//  3. ATTENDANCE LOG — TRAINING VIEW
//  ADD at top of renderAttendance() inside tab='log':
//    if (isTraining(currentUser)) return renderAttendanceTraining();
//  (inside the weekly log section, not the report section)
// ═══════════════════════════════════════════════

function renderAttendanceTraining() {
  const weekDates = _getAttendanceWeek();
  const todayDk   = _todayDateKey();

  // Day picker — show all days in the week
  const dayIdx = window._tAttDay !== undefined ? window._tAttDay
    : weekDates.indexOf(todayDk) >= 0 ? weekDates.indexOf(todayDk) : 0;
  const selectedDk = weekDates[dayIdx] || weekDates[0];

  const dayPicker = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
      ${weekDates.map((dk,i) => {
        const isToday = dk===todayDk;
        const isAct   = i===dayIdx;
        return `<button onclick="window._tAttDay=${i};window._tSearch='';nav('attendance')"
          style="padding:5px 12px;border-radius:var(--r);font-size:12px;font-weight:${isAct?700:400};
            cursor:pointer;border:1.5px solid ${isAct?'var(--accent)':isToday?'rgba(31,102,241,.4)':'var(--border2)'};
            background:${isAct?'var(--accent)':'var(--bg2)'};color:${isAct?'#fff':isToday?'var(--accent)':'var(--text2)'};">
          ${getWkDay(dk)} ${dk}${isToday?' ·today':''}
        </button>`;
      }).join('')}
    </div>`;

  // Collect all users with attendance on the selected day, grouped by shift
  const shiftData = {};
  ['A','B','C','D','E'].forEach(sh => { shiftData[sh] = []; });

  state.users.forEach(u => {
    const shift = _getUserShiftOnDate(u, selectedDk);
    if (!shift) return;
    const sh = shift.charAt(0);
    if (!shiftData[sh]) return;
    const rec = DB.getAttendance(u.id, selectedDk);
    const {lateMin, earlyMin, late, early} = calcLateEarly(u.id, selectedDk);
    shiftData[sh].push({u, rec, lateMin, earlyMin, late, early, shift});
  });

  // Sort each shift: late/early first, then alpha
  ['A','B','C','D','E'].forEach(sh => {
    shiftData[sh].sort((a,b) =>
      (b.lateMin+b.earlyMin)-(a.lateMin+a.earlyMin) ||
      (a.u.name||'').localeCompare(b.u.name||'')
    );
  });

  const totalEntries = Object.values(shiftData).reduce((a,arr)=>a+arr.length,0);
  const searchQ = (window._tSearch||'').toLowerCase();
  const visCount = Object.values(shiftData).flat()
    .filter(e=>!searchQ||e.u.name.toLowerCase().includes(searchQ)).length;

  const blocks = ['A','B','C','D','E'].map(sh => {
    const entries = shiftData[sh];
    if (!entries.length) return '';
    if (window._tShiftFilter!=='all' && window._tShiftFilter!==sh) return '';

    const rows = entries.map(({u, rec, lateMin, earlyMin, late, early}) => {
      const hasRec    = rec && (rec.start || rec.end);
      const isLate    = lateMin > 0;
      const isEarly   = earlyMin > 0;
      const lateChip  = isLate  ? `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:var(--D-bg);color:var(--err);">+${late}</span>` : `<span style="font-size:10px;color:var(--text3);">—</span>`;
      const earlyChip = isEarly ? `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(245,158,11,.12);color:var(--warn);">-${early}</span>` : `<span style="font-size:10px;color:var(--text3);">—</span>`;
      const startTxt  = rec?.start ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${isLate?'var(--err)':'var(--ok)'};">${rec.start}</span>` : `<span style="font-size:10px;color:var(--text3);">—</span>`;
      const endTxt    = rec?.end   ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${isEarly?'var(--warn)':'var(--ok)'};">${rec.end}</span>`  : `<span style="font-size:10px;color:var(--text3);">—</span>`;
      const rowBg = isLate ? 'background:rgba(248,113,113,.04);' : isEarly ? 'background:rgba(251,191,36,.04);' : '';
      return `<tr class="t-data-row" data-name="${u.name.toLowerCase()}"
        style="border-bottom:0.5px solid var(--border);${rowBg}">
        <td style="padding:7px 10px;">
          <div style="font-size:12px;font-weight:600;">${u.name}</div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>
        <td style="padding:7px 10px;text-align:center;">${startTxt}</td>
        <td style="padding:7px 10px;text-align:center;">${lateChip}</td>
        <td style="padding:7px 10px;text-align:center;">${endTxt}</td>
        <td style="padding:7px 10px;text-align:center;">${earlyChip}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text3);">${rec?.note||'—'}</td>
      </tr>`;
    }).join('');

    const lateCount  = entries.filter(e=>e.lateMin>0).length;
    const earlyCount = entries.filter(e=>e.earlyMin>0).length;
    const hdrExtra = `${entries.length} staff` +
      (lateCount  ? ` · <span style="color:var(--err);font-size:11px;">${lateCount} late</span>` : '') +
      (earlyCount ? ` · <span style="color:var(--warn);font-size:11px;">${earlyCount} early out</span>` : '');

    const tableHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg3);">
          <tr style="border-bottom:2px solid var(--border2);">
            <th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text2);min-width:180px;">NAME</th>
            <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--text2);">LOGIN</th>
            <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--err);">LATE BY</th>
            <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--text2);">LOGOUT</th>
            <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--warn);">EARLY BY</th>
            <th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text2);">NOTE</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    return _shiftBlock(sh, hdrExtra, tableHTML, entries.length);
  }).join('');

  const noData = !blocks.trim();

  return `
<div class="page-header">
  <div>
    <div class="page-title">Attendance Log — All Shifts</div>
    <div class="page-sub">${selectedDk} · ${totalEntries} staff on schedule</div>
  </div>
</div>
${dayPicker}
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
  ${_shiftTabBar(sh => shiftData[sh]?.length)}
</div>
${_searchBar('attendance','Search by name…', visCount)}
${noData
  ? `<div class="empty" style="padding:48px;"><div class="empty-ico">📋</div>No attendance recorded for ${selectedDk} yet.</div>`
  : blocks}`;
}
