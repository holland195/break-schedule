function renderExtBreak() {
  const isFemale = _getUserGender(currentUser) === 'F';
  if (isTraining(currentUser)) {
    if (typeof renderExtBreakTraining === 'function') return renderExtBreakTraining();
    return '<div class="empty">Loading…</div>';
  }
  const canApprove = isLeader(currentUser) || isTraining(currentUser);
  const pendingCount = DB.countPendingExtBreaks ? DB.countPendingExtBreaks() : 0;
  if (!_extBreakFilterYM) _extBreakFilterYM = currentMonthKey();
  const mk = _extBreakFilterYM;
  const [yr, mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr), parseInt(mo) - 1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // For leader: show all female staff who have any ext break entries in the selected month.
  // For agents: only themselves.
  const allFemaleUsers = state.users.filter(u => _getUserGender(u) === 'F');
  const femaleShiftUsers = isLeader(currentUser)
    ? allFemaleUsers.filter(u => {
        const wd = getWeekDates();
        return wd.some(dk => _getSched(u.username, dk) === currentShift);
      })
    : allFemaleUsers;

  // My registrations this month
  const myEntries = DB.getExtBreaks(currentUser.id, mk);
  const myUsed = myEntries.length;
  const myRemaining = Math.max(0, 3 - myUsed);

  // Build registration list for current user (female) or full view (leader)
  const viewUsers = isLeader(currentUser) ? femaleShiftUsers : (isFemale ? [currentUser] : []);

  const userCards = viewUsers.map(u => {
    const entries = DB.getExtBreaks(u.id, mk) || [];
    const used = entries.length;
    const myRemaining = Math.max(0, 3 - used);

    const entryCards = entries.length === 0
      ? '<div style="font-size:11px;color:var(--text3);padding:6px 0;">No registrations this month.</div>'
      : entries.map((e, i) => {
        const status = e.status || 'pending';
        const isPending = status === 'pending';
        const borderCol = status === 'approved' ? 'var(--ok)' : status === 'rejected' ? 'var(--err)' : 'var(--warn)';
        const statusBadge = status === 'approved'
          ? '<span class="req-status approved">APPROVED</span>'
          : status === 'rejected'
            ? '<span class="req-status rejected">REJECTED</span>'
            : '<span class="req-status pending">PENDING</span>';

        const resolvedBy = e.approvedBy
  ? (() => {
      // Try state.users first
      const u = state.users.find(x => x.id === e.approvedBy);
      if (u) return u.name;
      // Fall back to staffInfo by matching hashed ID
      const uname = Object.keys(state.staffInfo || {}).find(k => {
        let h = 0;
        for (let i = 0; i < k.length; i++) h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
        return Math.abs(h) === e.approvedBy;
      });
      return uname ? (state.staffInfo[uname].name || uname) : 'Leader';
    })()
  : null;

        const resolvedBox = (!isPending && resolvedBy)
          ? '<div class="req-resolved ' + status + '" style="margin-top:8px;">'
          + (status === 'approved' ? '✓ ' : '✗ ')
          + (status === 'approved' ? 'Approved' : 'Rejected') + ' by <b>' + resolvedBy + '</b>'
          + (e.rejectedReason ? ' · <span style="opacity:.8">' + e.rejectedReason + '</span>' : '')
          + '</div>'
          : '';

        const actions = (canApprove && isPending)
          ? '<div class="req-actions">'
          + '<button class="btn btn-sm btn-ok" onclick="approveExtBreak(' + u.id + ',\'' + mk + '\',' + i + ')">✓ Approve</button>'
          + '<button class="btn btn-sm btn-err" onclick="rejectExtBreakPrompt(' + u.id + ',\'' + mk + '\',' + i + ')">✗ Reject</button>'
          + '</div>'
          : '';

        const todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
        const dayStr = (e.days && e.days.length > 0) ? e.days[0] : (e.day || '');
        const [_d, _m] = dayStr.split('/').map(Number);
        const isPastDay = dayStr ? ((_m - 1) * 100 + _d) < todayMMDD : false;
        const canCancel = (u.id === currentUser.id || isLeader(currentUser)) && !isPastDay;
        const delBtn = canCancel
          ? '<button class="btn btn-xs" style="margin-top:6px;font-size:11px;color:var(--text3);" '
          + 'onclick="deleteExtBreak(' + u.id + ',\'' + mk + '\',' + i + ',' + currentUser.id + ')">🗑 Cancel</button>'
          : '';

        const daysLabel = (e.days && e.days.length > 1)
          ? e.days.join(', ')
          : (e.day || '—');

        return '<div class="req-card ' + status + '" style="width:240px;">'
          + '<div class="req-card-top">'
          + '<div>'
          + '<div class="req-card-name" style="font-size:12px;">' + daysLabel + '</div>'
          + '<div class="req-card-meta">' + (e.position === 'before' ? '← Before' : 'After →') + ' · ' + timeSince(e.at) + '</div>'
          + '</div>'
          + statusBadge
          + '</div>'
          + '<hr class="req-card-divider">'
          + '<div class="req-card-row"><span class="req-card-lbl">Time</span>'
          + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--A-color);">' + (e.time || '—') + '</span>'
          + '</div>'
          + resolvedBox
          + actions
          + delBtn
          + '</div>';
      }).join('');

    const dots = [0, 1, 2].map(i =>
      '<span style="width:8px;height:8px;border-radius:50%;display:inline-block;'
      + 'background:' + (i < used ? 'var(--A-color)' : 'var(--border2)') + ';'
      + 'border:1px solid ' + (i < used ? 'var(--A-color)' : 'var(--border2)') + ';"></span>'
    ).join('');

    return '<div style="margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      + '<span style="font-weight:600;font-size:13px;color:var(--text);">' + u.name + '</span>'
      + '<span style="color:var(--A-color);font-size:12px;">♀</span>'
      + '<span style="font-size:11px;color:var(--text3);">' + u.team + ' · ' + getRoleInfo(u.role).label + '</span>'
      + '<div style="margin-left:auto;display:flex;align-items:center;gap:6px;">'
      + '<div style="display:flex;gap:3px;">' + dots + '</div>'
      + '<span style="font-size:11px;color:' + (myRemaining === 0 ? 'var(--err)' : 'var(--text3)') + ';">' + used + '/3</span>'
      + (u.id === currentUser.id && isFemale && used < 3
        ? '<button class="btn btn-sm btn-accent" onclick="openExtBreakModal()">Register</button>'
        : '')
      + '</div>'
      + '</div>'
      + '<div class="req-cards-grid">' + entryCards + '</div>'
      + '</div>';
  }).join('');

  const noAccessMsg = !isFemale && !isLeader(currentUser)
    ? `<div class="empty"><div class="empty-ico">🌸</div>
        <div>This menu is for female staff only.</div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">Female staff can register up to 3 extra 30-min breaks per month.</div>
      </div>` : '';

  const myPendingHtml = (!isLeader(currentUser) && isFemale) ? (() => {
    const mk2 = currentMonthKey();
    const myEntries = DB.getExtBreaks(currentUser.id, mk2) || [];
    const myPending = myEntries.filter((e, i) => (e.status || 'pending') === 'pending');
    if (!myPending.length) return '';
    return `
    
    <div style="padding:10px 14px;background:rgba(245,158,11,.10);border:1px solid var(--warn);
      border-radius:8px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
        color:var(--warn);margin-bottom:8px;">⏳ Your pending requests</div>
      ${myPending.map((e, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;
          border-bottom:1px solid var(--border);font-size:12px;">
          <span style="color:var(--text3);">${e.day}</span>
          <span style="color:var(--A-color);font-size:11px;">${e.position === 'before' ? '← Before' : 'After →'}</span>
          <span style="font-family:'IBM Plex Mono',monospace;color:var(--text2);font-size:11px;">${e.time}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--text3);">${timeSince(e.at)}</span>
        </div>`).join('')}
    </div>`;
  })() : '';
  return `
<div class="page-header">
  <div>
    <div class="page-title">🌸 30-Min Extra Break</div>
    <div class="page-sub">${monthLabel} · Shift ${currentShift} · ${isFemale && !isLeader(currentUser) ? `${myRemaining} registration${myRemaining !== 1 ? 's' : ''} remaining` : 'All female staff'}</div>
  </div>

</div>

${_monthPickerHTML(mk, '_setExtBreakFilterYM', 'extbreak')}
${noAccessMsg}
${myPendingHtml}

  
 
  ${canApprove && pendingCount > 0 ? `
  <div style="padding:10px 16px;background:rgba(245,158,11,.12);border:1px solid var(--warn);
    border-radius:8px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:20px;">⏳</span>
    <div>
      <div style="font-weight:600;color:var(--warn);">${pendingCount} pending request${pendingCount > 1 ? 's' : ''}</div>
      <div style="font-size:11px;color:var(--text2);">Review below — approve or reject each request</div>
    </div>
  </div>` : ''}
 
  ${viewUsers.length === 0 && !noAccessMsg ? `<div class="empty"><div class="empty-ico">👥</div>No female staff on Shift ${currentShift} this week.</div>` : ''}
 
  ${userCards}

<div class="card" style="background:var(--bg3);border-color:var(--border2);">
  <div class="card-title">Rules</div>
  <div style="font-size:12px;color:var(--text2);line-height:1.8;">
    ✦ Only female staff are eligible for the extra 30-min break.<br>
    ✦ Maximum <b style="color:var(--accent);">3 registrations per calendar month</b>.<br>
    ✦ The extra 30 min is taken immediately <b>before</b> or <b>after</b> your assigned main break window.<br>
    ✦ You must have a main break assigned on that day before registering.<br>
    ✦ Registration can be cancelled at any time before the break occurs.
  </div>
</div>`;
}

// ── ExtBreak Modal ──
function openExtBreakModalFor(targetUser) {
  _ebTargetUser = targetUser;
  openExtBreakModal();
}

function openExtBreakModal() {
  const target = _ebTargetUser || currentUser;
  const isOnBehalf = _ebTargetUser && _ebTargetUser.id !== currentUser.id;
  if (!isOnBehalf && _getUserGender(currentUser) !== 'F') { toast('Only female staff can register.', 'err'); return; }
  const mk = currentMonthKey();
  const used = DB.countExtBreaks(target.id, mk);
  const remaining = 3 - used;
  if (remaining <= 0) { toast(`${isOnBehalf ? target.name + ' has' : 'You have'} used all 3 registrations this month.`, 'err'); return; }

  var _ebSDSet = {};
  Object.values(state.staffSchedule || {}).forEach(function(sc) { Object.keys(sc||{}).forEach(function(k){ if(/\d{2}\/\d{2}/.test(k)) _ebSDSet[k]=1; }); });
  const allDates = Object.keys(_ebSDSet);
  const weekDates = getWeekDates();
  const eligibleDays = [];

  // Past-date check: DD/MM format → compare as (M-1)*100+D vs today
  const _todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
  function _isNotPast(dk) {
    const [d, m] = dk.split('/').map(Number);
    return (m - 1) * 100 + d >= _todayMMDD;
  }

  var _tSched = _getSchedObj(target.username);
  const targetShift = isOnBehalf
    ? (Object.values(_tSched).find(s => s && s !== '0') || currentShift)
    : currentShift;

  allDates.forEach(dk => {
    if (monthKeyFromDate(dk) !== mk) return;
    if (!_isNotPast(dk)) return;
    var sc = _getSched(target.username, dk);
    if (sc !== targetShift) return;
    const br = getAssigned(target.id, dk) || getAssigned(target.id, getWkDay(dk));
    if (br) eligibleDays.push({ dk, slot: getSlotTime(br.slot, dk) });
  });
  if (eligibleDays.length === 0) {
    weekDates.forEach((dk, i) => {
      if (!_isNotPast(dk)) return;
      var sc = _getSched(target.username, dk);
      if (sc !== targetShift) return;
      const br = getAssigned(target.id, dk) || getAssigned(target.id, WEEK_DAYS[i]);
      if (br) eligibleDays.push({ dk, slot: getSlotTime(br.slot, dk) });
    });
  }

  const listEl = document.getElementById('eb-day-list');
  listEl.innerHTML = eligibleDays.length > 0
    ? eligibleDays.map(({ dk, slot }) => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;
        background:var(--bg3);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
        <input type="checkbox" name="eb-day-check" value="${dk}" data-slot="${slot}"
          onchange="_updateEbMultiChange(${remaining})">
        <span style="font-size:12px;font-weight:500;">${dk} <span style="color:var(--text3);">${getWkDay(dk)}</span></span>
        <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent);">${slot}</span>
      </label>`).join('')
    : `<div style="font-size:12px;color:var(--text3);">No days with assigned break found.</div>`;

  document.getElementById('eb-main-slot').value = '';
  document.getElementById('eb-main-slot-wrap').style.display = 'none';
  document.getElementById('eb-preview').style.display = 'none';
  document.getElementById('eb-before').checked = false;
  document.getElementById('eb-after').checked = false;

  const quota = document.getElementById('eb-quota-info');
  quota.innerHTML = `${isOnBehalf ? `<div style="font-size:11px;color:var(--accent);margin-bottom:4px;">Registering for <b>${target.name}</b></div>` : ''}
    <span style="color:${remaining <= 1 ? 'var(--warn)' : 'var(--ok)'};">
    ${remaining} registration${remaining !== 1 ? 's' : ''} remaining this month (${used}/3 used)</span>`;

  document.getElementById('eb-submit-btn').disabled = eligibleDays.length === 0;
  document.getElementById('modal-extbreak').classList.add('show');
}

function _updateEbMultiChange(remaining) {
  const checked = [...document.querySelectorAll('input[name="eb-day-check"]:checked')];
  // Enforce max = remaining quota
  if (checked.length > remaining) {
    event.target.checked = false;
    toast(`You can only select up to ${remaining} day${remaining !== 1 ? 's' : ''}.`, 'warn');
    return;
  }
  // Show slot of first checked day
  const slotWrap = document.getElementById('eb-main-slot-wrap');
  if (checked.length > 0) {
    const slots = [...new Set(checked.map(c => c.dataset.slot))];
    document.getElementById('eb-main-slot').value = slots.length === 1 ? slots[0] : 'Multiple slots';
    slotWrap.style.display = '';
    _updateEbPreview();
  } else {
    slotWrap.style.display = 'none';
    document.getElementById('eb-preview').style.display = 'none';
  }
}

function _updateEbDayChange() {
  const sel = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const slot = chosen?.dataset?.slot || '';
  document.getElementById('eb-main-slot').value = slot || '—';
  document.getElementById('eb-preview').style.display = 'none';
  // Reset radio
  document.getElementById('eb-before').checked = false;
  document.getElementById('eb-after').checked = false;
}

function _updateEbPreview() {
  const sel = document.getElementById('eb-day');
  const chosen = sel.options[sel.selectedIndex];
  const slot = chosen?.dataset?.slot || '';
  if (!slot) return;

  const pos = document.querySelector('input[name="eb-pos"]:checked')?.value;
  if (!pos) return;

  // Parse slot times like "09:30–11:00"
  const parts = slot.split('–');
  if (parts.length !== 2) return;
  const [start, end] = parts.map(t => t.trim());

  function addMins(timeStr, mins) {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + mins;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }
  function subMins(timeStr, mins) { return addMins(timeStr, -mins); }

  let extraLabel;
  if (pos === 'before') extraLabel = `${subMins(start, 30)}–${start}`;
  else extraLabel = `${end}–${addMins(end, 30)}`;

  const preview = document.getElementById('eb-preview');
  preview.style.display = 'block';
  preview.innerHTML = `
    <span style="color:var(--text3);font-size:10px;">MAIN BREAK</span>
    <span style="color:var(--accent);margin-left:8px;">${slot}</span>
    &nbsp;+&nbsp;
    <span style="color:var(--text3);font-size:10px;">EXTRA 30 MIN</span>
    <span style="color:var(--A-color);margin-left:8px;">${extraLabel}</span>
    &nbsp;=&nbsp;
    <span style="color:var(--ok);">Total: 90 min window</span>`;
}

function submitExtBreak() {
  const checked = [...document.querySelectorAll('input[name="eb-day-check"]:checked')];
  const pos = document.querySelector('input[name="eb-pos"]:checked')?.value;

  if (!checked.length) { toast('Select at least one day.', 'err'); return; }
  if (!pos) { toast('Choose Before or After.', 'err'); return; }

  const target = _ebTargetUser || currentUser;
  const mk = currentMonthKey();
  const used = DB.countExtBreaks(target.id, mk);
  if (used + checked.length > 3) {
    toast(`Only ${3 - used} registration${3 - used !== 1 ? 's' : ''} remaining.`, 'err'); return;
  }

  function addMins(t, m) {
    const [h, mi] = t.split(':').map(Number);
    const tot = h * 60 + mi + m;
    return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  }

  const days = checked.map(c => ({ dk: c.value, slot: c.dataset.slot }));
  const firstSlot = days[0].slot;
  const parts = firstSlot.split('–');
  if (parts.length !== 2) { toast('Could not parse slot time.', 'err'); return; }
  const [start, end] = parts.map(t => t.trim());
  const time = pos === 'before' ? `${addMins(start, -30)}–${start}` : `${end}–${addMins(end, 30)}`;

  // Store as one request with days array
  DB.addExtBreak(target.id, mk, {
    days: days.map(d => d.dk),
    day: days[0].dk,
    mk,
    time, position: pos,
    status: 'pending',
    at: Date.now(), registeredBy: currentUser.id
  });
  _ebTargetUser = null;
  if (typeof syncWrite === 'function') syncWrite(); else save();
  closeModal('modal-extbreak');
  toast(`Extra break registered for ${days.length} day${days.length > 1 ? 's' : ''} 🌸`, 'ok');
  nav('extbreak');
}

function deleteExtBreak(uid, mk, idx, cancelledById) {
  // mk may be wrong if entry is from a past month — try to resolve from the entry's stored 'at'
  let entries = DB.getExtBreaks(uid, mk);
  let entry = entries[idx];

  // Fallback: scan all months for this user to find the right entry
  if (!entry) {
    // Block cancellation for past dates
    const dayStr = (entry.days && entry.days.length > 0) ? entry.days[0] : (entry.day || '');
    if (dayStr) {
      const [d, m] = dayStr.split('/').map(Number);
      const todayMMDD = new Date().getMonth() * 100 + new Date().getDate();
      if ((m - 1) * 100 + d < todayMMDD && cancelledById === uid) {
        toast('Cannot cancel a past registration.', 'err');
        return;
      }
    }
    const allKeys = Object.keys(state.extBreaks || {})
      .filter(k => k.startsWith(uid + '_'));
    for (const key of allKeys) {
      const [, entryMk] = key.split('_');
      const arr = DB.getExtBreaks(uid, entryMk);
      if (arr[idx] !== undefined) {
        mk = entryMk;
        entries = arr;
        entry = arr[idx];
        break;
      }
    }
  }

  if (!entry) { toast('Entry not found.', 'err'); return; }

  const u = state.users.find(x => x.id === uid);
  const cancelledBy = cancelledById && cancelledById !== uid
    ? state.users.find(x => x.id === cancelledById)
    : null;
  const msg = cancelledBy
    ? `Cancel this extra break for ${u?.name || '?'} (cancelled by ${cancelledBy.name})?`
    : 'Cancel this extra break registration?';
  if (!confirm(msg)) return;
  DB.deleteExtBreak(uid, mk, idx);
  if (typeof syncWrite === 'function') syncWrite(); else save();
  toast('Registration cancelled.', 'warn');
  nav('extbreak');
}

function approveExtBreak(uid, mk, idx) {
  DB.approveExtBreak(uid, mk, idx, currentUser.id);
  if (typeof syncWrite === 'function') syncWrite(); else save();
  updateBadge();
  toast('✓ Extra break approved.', 'ok');
  nav('extbreak');
}

function rejectExtBreakPrompt(uid, mk, idx) {
  const reason = prompt('Rejection reason (optional):');
  if (reason === null) return; // user cancelled prompt
  DB.rejectExtBreak(uid, mk, idx, currentUser.id, reason || '');
  if (typeof syncWrite === 'function') syncWrite(); else save();
  updateBadge();
  toast('Extra break rejected.', 'warn');
  nav('extbreak');
}


// ═══════════════════════════════════════════════
//  RENDER: AUTO-ASSIGN ROTATION STATUS (admin)
//  Shown inside Cloud Sync page
// ═══════════════════════════════════════════════
function renderRotationPanel() {
  const summary = typeof getRotationSummary === 'function' ? getRotationSummary() : [];
  const tierLabels = { agent: 'Data Analyst + Sr Data Analyst', qa: 'Data Supervisor', sr_qa: 'Sr Data Supervisor' };

  if (summary.length === 0) {
    return `<div class="card" style="max-width:740px;margin-top:0;">
      <div class="card-title">🔄 Break Auto-Assign Rotation</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.8;">
        No rotation history yet. Import a schedule to start auto-assignment.<br>
        <b>How the rotation works:</b><br>
        ✦ <b>Current/past week re-import</b> → keeps existing phase (idempotent, no flip)<br>
        ✦ <b>Future week import</b> → flips phase once per new future Monday found<br>
        ✦ Importing this week + next week in one paste → this week keeps phase, next week flips
      </div>
    </div>`;
  }

  const rows = summary.map(s => {
    const phaseLabel = s.phase === 0
      ? `<span style="color:var(--ok);font-weight:600;">Phase 0</span> <span style="color:var(--text3);font-size:10px;">first half → Slot 1</span>`
      : `<span style="color:var(--B-color);font-weight:600;">Phase 1</span> <span style="color:var(--text3);font-size:10px;">first half → Slot 2</span>`;
    const weekBadge = s.isFuture
      ? `<span style="background:var(--B-bg);color:var(--B-color);border:1px solid var(--B-color);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'IBM Plex Mono',monospace;margin-left:6px;">future</span>`
      : `<span style="background:var(--bg4);color:var(--text3);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:9px;font-family:'IBM Plex Mono',monospace;margin-left:6px;">current</span>`;
    const nextPhase = s.phase === 0 ? 'Phase 1 (first half → Slot 2)' : 'Phase 0 (first half → Slot 1)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:9px 12px;font-weight:700;font-size:12px;">Shift ${s.shift}</td>
      <td style="padding:9px 12px;color:var(--text2);font-size:12px;">${tierLabels[s.tier] || s.tier}</td>
      <td style="padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
        ${s.lastWeek}${weekBadge}
      </td>
      <td style="padding:9px 12px;font-size:12px;">${phaseLabel}</td>
      <td style="padding:9px 12px;font-size:11px;color:var(--text3);">→ ${nextPhase}</td>
      <td style="padding:9px 12px;">
        <button class="btn btn-xs btn-warn"
          onclick="resetRotation('${s.shift}','${s.tier}');nav('sync');"
          title="Delete history — next import will restart at Phase 0">↺ Reset</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="card" style="max-width:860px;margin-top:0;">
    <div class="card-title">🔄 Break Auto-Assign Rotation</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.9;">
      <b>Rotation rule (Option C):</b><br>
      ✦ <b>Current or past week re-imported</b> → phase unchanged (safe to re-import corrections)<br>
      ✦ <b>New future week imported</b> → phase flips exactly once per new future Monday<br>
      ✦ Importing this week + next week together → this week keeps phase, next week gets flipped phase<br>
      ✦ "Next phase" shown below is what the <b>next new future import</b> will use for that tier
    </div>
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:var(--bg3);">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">SHIFT</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">ROLE TIER</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">LAST IMPORTED WEEK</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">CURRENT PHASE</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">NEXT FUTURE IMPORT</th>
            <th style="padding:8px 12px;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

