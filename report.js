// ═══════════════════════════════════════════════
//  MONTHLY REPORT + TRAINING MANAGER DASHBOARD
//  Roles: Agent Training Manager / Agent Training Assistant
//  Access: view-only, all shifts, dashboard + report
// ═══════════════════════════════════════════════

// isTraining() is defined in data.js (level 3 roles)
// isTrainingRole kept as alias for backward compatibility
function isTrainingRole(u) { return isTraining(u); }

// ── Month/date helpers ──
function _monthKey(year, month) { // month: 1-12
  return `${year}-${String(month).padStart(2,'0')}`;
}

function _getAllDatesInMonth(year, month) {
  const days = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const d = date.getDate().toString().padStart(2,'0');
    const m = String(month).padStart(2,'0');
    days.push(`${d}/${m}`);
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function _dateKeyToDate(dk) {
  const [d, m] = dk.split('/');
  return new Date(2026, parseInt(m) - 1, parseInt(d));
}

// ── Compute per-user stats for a given month ──
function _computeUserMonthStats(u, year, month) {
  const dates     = _getAllDatesInMonth(year, month);
  let workDays = 0, lateDays = 0, earlyDays = 0;
  let totalLateMin = 0, totalEarlyMin = 0, noteDays = 0;
  let primaryShift = null;
  const shiftCounts = {};

  dates.forEach(dk => {
    const shift = u.schedule?.[dk];
    if (!shift) return;
    // Skip leave codes
    if (['A','H','0','U','S','L'].includes(shift) && shift.length === 1 && !SHIFT_DEFAULTS[shift]) return;
    workDays++;
    if (shift) shiftCounts[shift.charAt(0)] = (shiftCounts[shift.charAt(0)] || 0) + 1;
    const rec = DB.getAttendance(u.id, dk);
    if (rec?.note) noteDays++;
    const { lateMin, earlyMin } = calcLateEarly(u.id, dk);
    if (lateMin  > 0) { lateDays++;  totalLateMin  += lateMin; }
    if (earlyMin > 0) { earlyDays++; totalEarlyMin += earlyMin; }
  });

  // Determine primary shift (most frequent)
  primaryShift = Object.entries(shiftCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  const avgLateMin  = lateDays  > 0 ? Math.round(totalLateMin  / lateDays)  : 0;
  const avgEarlyMin = earlyDays > 0 ? Math.round(totalEarlyMin / earlyDays) : 0;

  return { workDays, lateDays, earlyDays, avgLateMin, avgEarlyMin, noteDays, primaryShift, totalLateMin, totalEarlyMin };
}

function _fmtAvg(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60).toString().padStart(2,'0');
  const m = (mins % 60).toString().padStart(2,'0');
  return `+${h}:${m}`;
}

// ─────────────────────────────────────────────
//  RENDER: TRAINING MANAGER DASHBOARD
// ─────────────────────────────────────────────
function renderTrainingDashboard() {
  const today    = _todayDateKey();
  const shifts   = ['A','B','C','D','E'];

  // Build per-shift summary
  const shiftCards = shifts.map(sh => {
    const shiftDef  = SHIFTS[sh] || {};
    const onShift   = state.users.filter(u => {
      const s = u.schedule?.[today];
      return s && s.charAt(0) === sh;
    });
    const total    = onShift.length;

    // Breaks
    const assigned = onShift.filter(u => DB.getBreak(u.id, today)).length;

    // Late/Early
    let lateCount = 0, earlyCount = 0;
    onShift.forEach(u => {
      const { lateMin, earlyMin } = calcLateEarly(u.id, today);
      if (lateMin  > 0) lateCount++;
      if (earlyMin > 0) earlyCount++;
    });

    const hasIssue = lateCount > 0 || earlyCount > 0 || (total > 0 && assigned < total);
    const border   = hasIssue ? 'border:2px solid var(--accent);' : 'border:0.5px solid var(--border);';

    return `
    <div class="card" style="padding:14px 16px;${border}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:14px;font-weight:600;color:var(--text1);">Shift ${sh}</span>
        <span style="font-size:10px;padding:2px 7px;background:var(--bg3);border-radius:99px;color:var(--text3);">${shiftDef.start||'—'}</span>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">${total} on shift today</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span style="color:var(--text2);">Breaks</span>
        <span style="color:${assigned===total&&total>0?'var(--ok)':'var(--warn)'};font-weight:600;">${assigned}/${total}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span style="color:var(--text2);">Late</span>
        <span style="color:${lateCount>0?'var(--err)':'var(--ok)'};font-weight:600;">${lateCount}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;">
        <span style="color:var(--text2);">Early out</span>
        <span style="color:${earlyCount>0?'var(--warn)':'var(--ok)'};font-weight:600;">${earlyCount}</span>
      </div>
      ${hasIssue ? `<div style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--border);font-size:10px;color:var(--accent);">Needs attention</div>` : ''}
    </div>`;
  }).join('');

  // Late/early detail table — ALL shifts
  const allLateEarly = [];
  state.users.forEach(u => {
    const shift = u.schedule?.[today];
    if (!shift) return;
    const rec = DB.getAttendance(u.id, today);
    if (!rec) return;
    const { lateMin, earlyMin, late, early } = calcLateEarly(u.id, today);
    if (lateMin > 0 || earlyMin > 0) {
      allLateEarly.push({ u, shift: shift.charAt(0), rec, lateMin, earlyMin, late, early });
    }
  });
  allLateEarly.sort((a,b) => (b.lateMin+b.earlyMin) - (a.lateMin+a.earlyMin));

  const detailRows = allLateEarly.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">No late or early incidents recorded today yet.</td></tr>`
    : allLateEarly.map(({u, shift, rec, lateMin, earlyMin, late, early}) => `
      <tr style="border-top:0.5px solid var(--border);">
        <td style="padding:7px 10px;">
          <div style="font-size:12px;font-weight:600;">${u.name}</div>
          <div style="font-size:10px;color:var(--text3);">${u.username}</div>
        </td>
        <td style="padding:7px 10px;text-align:center;">
          <span style="font-size:11px;padding:1px 7px;background:var(--bg3);border-radius:99px;color:var(--text2);">${shift}</span>
        </td>
        <td style="padding:7px 10px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);">${rec.start||'—'}</td>
        <td style="padding:7px 10px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:${lateMin>0?'var(--err)':'var(--text3)'};">${lateMin>0?late:'—'}</td>
        <td style="padding:7px 10px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);">${rec.end||'—'}</td>
        <td style="padding:7px 10px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:${earlyMin>0?'var(--warn)':'var(--text3)'};">${earlyMin>0?early:'—'}</td>
      </tr>`).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">📊 Overview — All Shifts</div>
    <div class="page-sub">${today} · View only · Agent Training</div>
  </div>
  <button class="btn btn-sm btn-accent" onclick="attendanceTab='report';nav('attendance')">📋 Monthly Report</button>
</div>

<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin:0 0 10px;">All shifts — today ${today}</p>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:1.5rem;">
  ${shiftCards}
</div>

<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin:0 0 10px;">Late / early detail — all shifts today</p>
<div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:8px;">
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:var(--bg3);">
        <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text2);">NAME</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">SHIFT</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">LOGIN</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--err);">LATE BY</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">LOGOUT</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--warn);">EARLY BY</th>
      </tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
</div>`;
}

// ─────────────────────────────────────────────
//  RENDER: MONTHLY REPORT PAGE
// ─────────────────────────────────────────────
let reportYear  = new Date().getFullYear();
let reportMonth = new Date().getMonth() + 1;

function renderReport() {
  if (!isLeader(currentUser)) {
    return '<div class="empty">Access denied.</div>';
  }

  const year  = reportYear;
  const month = reportMonth;
  const dates = _getAllDatesInMonth(year, month);
  const monthLabel = new Date(year, month-1, 1).toLocaleString('en-US', { month:'long', year:'numeric' });

  // Exclude leaders/supervisors/training roles from the report
  // Only track operational staff (Agent/QA/Sr Agent/Sr QA — level 0-1)
  const trackable = state.users.filter(u => {
    const lvl = ROLES[u.role]?.level || 0;
    return lvl <= 1;
  });

  // Compute stats per user
  const stats = trackable.map(u => ({
    u,
    ...(_computeUserMonthStats(u, year, month))
  })).filter(s => s.workDays > 0);

  // Per-shift late counts for bar chart
  const shiftLate = { A:0, B:0, C:0, D:0, E:0 };
  stats.forEach(s => {
    if (shiftLate[s.primaryShift] !== undefined) shiftLate[s.primaryShift] += s.lateDays;
  });
  const maxLate = Math.max(...Object.values(shiftLate), 1);

  // Summary totals
  const totalStaff  = stats.length;
  const totalLate   = stats.reduce((a,s) => a+s.lateDays,  0);
  const totalEarly  = stats.reduce((a,s) => a+s.earlyDays, 0);

  // Breaks assigned this month
  let breaksAssigned = 0, breaksTotal = 0;
  trackable.forEach(u => {
    dates.forEach(dk => {
      const shift = u.schedule?.[dk];
      if (!shift) return;
      breaksTotal++;
      if (DB.getBreak(u.id, dk)) breaksAssigned++;
    });
  });
  const breakPct = breaksTotal > 0 ? Math.round(breaksAssigned/breaksTotal*100) : 0;

  // Top 5 offenders by total incidents
  const top5 = [...stats]
    .sort((a,b) => (b.lateDays+b.earlyDays) - (a.lateDays+a.earlyDays))
    .slice(0, 5)
    .filter(s => s.lateDays+s.earlyDays > 0);

  // Month picker
  const months = [];
  for (let m=1; m<=12; m++) {
    months.push(`<option value="${m}" ${m===month?'selected':''}>${new Date(year,m-1,1).toLocaleString('en-US',{month:'long'})}</option>`);
  }

  // Bar chart rows
  const barRows = ['A','B','C','D','E'].map(sh => {
    const cnt  = shiftLate[sh];
    const pct  = Math.round(cnt/maxLate*100);
    return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="font-size:12px;color:var(--text2);width:16px;">Shift ${sh}</span>
      <div style="flex:1;background:var(--bg3);border-radius:99px;height:8px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:var(--err);border-radius:99px;transition:width .3s;"></div>
      </div>
      <span style="font-size:12px;color:var(--err);font-family:'IBM Plex Mono',monospace;min-width:24px;text-align:right;">${cnt}</span>
    </div>`;
  }).join('');

  // Top 5 rows
  const top5Rows = top5.length === 0
    ? `<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 0;">No incidents this month</div>`
    : top5.map(s => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px;margin-bottom:6px;">
      <div>
        <span style="font-size:12px;color:var(--text1);">${s.u.name}</span>
        <span style="font-size:10px;color:var(--text3);margin-left:6px;">Shift ${s.primaryShift}</span>
      </div>
      <div style="display:flex;gap:6px;">
        ${s.lateDays  > 0 ? `<span style="font-size:11px;padding:1px 7px;background:rgba(220,38,38,.1);color:var(--err);border-radius:99px;">${s.lateDays} late</span>` : ''}
        ${s.earlyDays > 0 ? `<span style="font-size:11px;padding:1px 7px;background:rgba(245,158,11,.1);color:var(--warn);border-radius:99px;">${s.earlyDays} early</span>` : ''}
      </div>
    </div>`).join('');

  // Full detail table
  const detailRows = stats.length === 0
    ? `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">No attendance data for this month.</td></tr>`
    : [...stats]
        .sort((a,b) => (b.lateDays+b.earlyDays) - (a.lateDays+a.earlyDays) || a.u.name.localeCompare(b.u.name))
        .map((s,i) => `
        <tr style="border-top:0.5px solid var(--border);${i%2?'background:var(--bg3);':''}">
          <td style="padding:7px 10px;">
            <div style="font-size:12px;font-weight:600;">${s.u.name}</div>
            <div style="font-size:10px;color:var(--text3);">${s.u.username}</div>
          </td>
          <td style="padding:7px 10px;text-align:center;">
            <span style="font-size:11px;padding:1px 7px;background:var(--bg4);border-radius:99px;color:var(--text2);">${s.primaryShift}</span>
          </td>
          <td style="padding:7px 10px;text-align:center;color:var(--text2);font-size:12px;">${s.workDays}</td>
          <td style="padding:7px 10px;text-align:center;font-size:12px;font-weight:${s.lateDays>0?'600':'400'};color:${s.lateDays>3?'var(--err)':s.lateDays>0?'var(--warn)':'var(--ok)'};">${s.lateDays||'0'}</td>
          <td style="padding:7px 10px;text-align:center;font-size:12px;font-weight:${s.earlyDays>0?'600':'400'};color:${s.earlyDays>3?'var(--warn)':s.earlyDays>0?'rgba(245,158,11,.8)':'var(--ok)'};">${s.earlyDays||'0'}</td>
          <td style="padding:7px 10px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text3);">${_fmtAvg(s.avgLateMin)}</td>
          <td style="padding:7px 10px;text-align:center;font-size:12px;color:var(--text2);">${s.noteDays||'—'}</td>
          <td style="padding:7px 10px;text-align:center;">
            <button class="btn btn-sm" style="font-size:10px;padding:2px 8px;" onclick="exportUserReport(${s.u.id},'${month}','${year}')">CSV</button>
          </td>
        </tr>`).join('');

  return `
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
  <select class="login-input" style="width:auto;font-size:12px;padding:4px 8px;"
    onchange="reportMonth=parseInt(this.value);nav('attendance')">
    ${months.join('')}
  </select>
  <select class="login-input" style="width:auto;font-size:12px;padding:4px 8px;"
    onchange="reportYear=parseInt(this.value);nav('attendance')">
    ${[2025,2026,2027].map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
  </select>
  <button class="btn btn-sm" onclick="exportMonthlyReport(${month},${year})">⬇ Export CSV</button>
</div>

<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin:0 0 10px;">Summary — ${monthLabel}</p>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.5rem;">
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;">
    <p style="font-size:12px;color:var(--text3);margin:0 0 4px;">Total staff tracked</p>
    <p style="font-size:24px;font-weight:600;margin:0;color:var(--text1);">${totalStaff}</p>
  </div>
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;">
    <p style="font-size:12px;color:var(--text3);margin:0 0 4px;">Late incidents</p>
    <p style="font-size:24px;font-weight:600;margin:0;color:var(--err);">${totalLate}</p>
  </div>
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;">
    <p style="font-size:12px;color:var(--text3);margin:0 0 4px;">Early out</p>
    <p style="font-size:24px;font-weight:600;margin:0;color:var(--warn);">${totalEarly}</p>
  </div>
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;">
    <p style="font-size:12px;color:var(--text3);margin:0 0 4px;">Breaks assigned</p>
    <p style="font-size:24px;font-weight:600;margin:0;color:var(--ok);">${breakPct}%</p>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1.5rem;">
  <div class="card" style="padding:14px 16px;">
    <div class="card-title">Late incidents by shift</div>
    ${barRows}
  </div>
  <div class="card" style="padding:14px 16px;">
    <div class="card-title">Top 5 most late / early this month</div>
    ${top5Rows}
  </div>
</div>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
  <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin:0;">Full staff detail</p>
</div>
<div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:8px;">
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:var(--bg3);">
        <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text2);">NAME</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">SHIFT</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">WORK DAYS</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--err);">LATE</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--warn);">EARLY OUT</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">AVG LATE</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);">NOTE DAYS</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text2);"></th>
      </tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
</div>`;
}

// ── CSV Export: full monthly report ──
function exportMonthlyReport(month, year) {
  const monthLabel = new Date(year, month-1, 1).toLocaleString('en-US', { month:'long', year:'numeric' });
  const trackable  = state.users.filter(u => {
    const lvl = ROLES[u.role]?.level || 0;
    return lvl < 2 && !isTrainingRole(u);
  });
  const rows = [['Name','Username','Emp No','Role','Shift','Working Days','Late Days','Early Out Days','Avg Late (min)','Avg Early (min)','Note Days']];
  trackable.forEach(u => {
    const s = _computeUserMonthStats(u, year, month);
    if (s.workDays === 0) return;
    rows.push([u.name, u.username, u.empNo||'', u.role||'', s.primaryShift, s.workDays, s.lateDays, s.earlyDays, s.avgLateMin, s.avgEarlyMin, s.noteDays]);
  });
  _downloadCSV(`Report_${monthLabel.replace(' ','_')}.csv`, rows);
  toast('CSV exported', 'ok');
}

// ── CSV Export: single user detail ──
function exportUserReport(uid, month, year) {
  const u     = state.users.find(x => x.id === uid);
  if (!u) return;
  const dates = _getAllDatesInMonth(year, parseInt(month));
  const rows  = [['Date','Day','Shift','Login','Logout','Late By (min)','Early By (min)','Note']];
  dates.forEach(dk => {
    const shift = u.schedule?.[dk];
    if (!shift) return;
    const rec = DB.getAttendance(uid, dk) || {};
    const { lateMin, earlyMin } = calcLateEarly(uid, dk);
    rows.push([dk, getWkDay(dk), shift, rec.start||'', rec.end||'', lateMin||0, earlyMin||0, rec.note||'']);
  });
  _downloadCSV(`${u.username}_${month}_${year}.csv`, rows);
  toast(`Exported ${u.name}`, 'ok');
}

function _downloadCSV(filename, rows) {
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
