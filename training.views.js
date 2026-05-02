// ═══════════════════════════════════════════════
//  TRAINING ROLE — UNIFIED ALL-SHIFTS VIEWS
//  v2 — fixes:
//    - Break schedule: slot totals per-day (today), day picker
//    - Attendance: full month table + month picker
// ═══════════════════════════════════════════════

const SHIFT_COLORS = {
  A:{bg:'var(--A-bg)',color:'var(--A-color)'},
  B:{bg:'var(--B-bg)',color:'var(--B-color)'},
  C:{bg:'var(--C-bg)',color:'var(--C-color)'},
  D:{bg:'var(--D-bg)',color:'var(--D-color)'},
  E:{bg:'var(--E-bg)',color:'var(--E-color)'},
};

// Global state
if (window._tState === undefined) window._tState = {
  shiftFilter: 'all',
  search:      '',
  attYear:     new Date().getFullYear(),
  attMonth:    new Date().getMonth() + 1,
  schedDay:    null, // null = today
};
const TS = window._tState;

// ── Shared UI helpers ──
function _shBadge(sh, px) {
  const c = SHIFT_COLORS[sh]||{};
  px = px||22;
  return `<span style="display:inline-flex;width:${px}px;height:${px}px;align-items:center;
    justify-content:center;border-radius:5px;font-size:${Math.round(px*.5)}px;font-weight:600;
    background:${c.bg};color:${c.color};">${sh}</span>`;
}

function _tabBar(countFn, page) {
  const act = TS.shiftFilter;
  const btn = (val, lbl) => {
    const isAct = act===val;
    const c = SHIFT_COLORS[val]||{};
    const cnt = (val!=='all' && countFn) ? countFn(val) : '';
    return `<button onclick="window._tState.shiftFilter='${val}';window._tState.search='';nav('${page}')"
      style="padding:5px 14px;border-radius:var(--r);font-size:12px;font-weight:600;cursor:pointer;
        border:1.5px solid ${isAct?(val==='all'?'var(--accent)':c.color):'var(--border2)'};
        background:${isAct?(val==='all'?'var(--accent)':c.bg):'var(--bg2)'};
        color:${isAct?(val==='all'?'#fff':c.color):'var(--text2)'};transition:all .12s;">
      ${lbl}${cnt!==''?` <span style="font-size:10px;opacity:.65;">${cnt}</span>`:''}
    </button>`;
  };
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;">
    ${btn('all','All shifts')}
    ${['A','B','C','D','E'].map(sh=>btn(sh,`Shift ${sh}`)).join('')}
  </div>`;
}

function _searchBar(page, placeholder, cnt) {
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
    <input class="filter-input" style="width:280px;padding:7px 12px;font-size:13px;"
      placeholder="${placeholder}" value="${TS.search||''}"
      oninput="window._tState.search=this.value;
        const q=this.value.toLowerCase();let v=0;
        document.querySelectorAll('.t-sb').forEach(b=>{
          let bv=0;
          b.querySelectorAll('tr.tdr').forEach(r=>{
            const show=!q||(r.dataset.name||'').toLowerCase().includes(q);
            r.style.display=show?'':'none';if(show)bv++;
          });
          b.style.display=bv>0?'':'none';v+=bv;
        });
        document.getElementById('t-rc').textContent=v+' staff';">
    <span id="t-rc" style="font-size:11px;color:var(--text3);">${cnt} staff</span>
  </div>`;
}

function _shiftBlock(sh, hdrExtra, tableHTML, cnt) {
  if (TS.shiftFilter!=='all' && TS.shiftFilter!==sh) return '';
  if (!cnt) return '';
  const c = SHIFT_COLORS[sh]||{};
  const def = SHIFTS[sh]||{};
  return `<div class="t-sb" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px;">
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
      background:${c.bg};border-bottom:1px solid var(--border);">
      ${_shBadge(sh,24)}
      <span style="font-size:13px;font-weight:600;color:${c.color};">Shift ${sh}</span>
      <span style="font-size:11px;color:var(--text2);">${def.display||''}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--text2);">${hdrExtra}</span>
    </div>
    ${tableHTML}
  </div>`;
}

// ═══════════════════════════════════════════════
//  1. BREAK SCHEDULE — TRAINING VIEW
// ═══════════════════════════════════════════════
function renderScheduleTraining() {
  const weekDates = getWeekDates();
  const todayDk   = (() => {
    const n=new Date(); const d=n.getDay();
    return weekDates[d===0?6:d-1] || weekDates[0];
  })();

  // Selected day for totals (defaults to today)
  const selDay = TS.schedDay && weekDates.includes(TS.schedDay)
    ? TS.schedDay : todayDk;

  const dateToDayName = {};
  WEEK_DAYS.forEach((d,i)=>{ dateToDayName[weekDates[i]]=d; });
  const getUS = (u,dk) => u.schedule[dk]||u.schedule[dateToDayName[dk]]||'0';

  // Per-shift data
  const SD = {};
  ['A','B','C','D','E'].forEach(sh => {
    const slots = BREAK_SLOTS[sh]||[];
    const users = state.users.filter(u=>weekDates.some(dk=>getUS(u,dk)===sh));
    // Count slots for SELECTED DAY only
    let s1=0,s2=0,total=0;
    users.forEach(u => {
      if (getUS(u,selDay)!==sh) return; // only count if on shift that day
      total++;
      const br = DB.getBreak(u.id, selDay);
      if (!br) return;
      const idx = slots.indexOf(br.slot);
      if (idx===0) s1++; else if (idx===1) s2++;
    });
    SD[sh] = {users, slots, s1, s2, total};
  });

  const totalStaff  = Object.values(SD).reduce((a,d)=>a+d.users.length,0);
  const totalOnDay  = Object.values(SD).reduce((a,d)=>a+d.total,0);
  const searchQ     = (TS.search||'').toLowerCase();

  // ── Row 1: title ──
  const titleRow = `
    <div style="margin-bottom:14px;">
      <div class="page-title">Break Schedule</div>
      <div class="page-sub">Current week · Read-only · ${totalStaff} staff</div>
    </div>`;

  // ── Row 2: shift tabs + search on same line ──
  const topRow = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['all','A','B','C','D','E'].map(val=>{
          const isAct = TS.shiftFilter===val;
          const c = SHIFT_COLORS[val]||{};
          const cnt = val!=='all' ? SD[val]?.users.length : '';
          const lbl = val==='all' ? 'All shifts' : val;
          return `<button onclick="window._tState.shiftFilter='${val}';window._tState.search='';nav('schedule')"
            style="padding:5px 14px;border-radius:var(--r);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;
              border:1.5px solid ${isAct?(val==='all'?'var(--accent)':c.color):'var(--border2)'};
              background:${isAct?(val==='all'?'var(--accent)':c.bg):'var(--bg2)'};
              color:${isAct?(val==='all'?'#fff':c.color):'var(--text2)'};">
            ${lbl}${cnt!==''?` <span style="font-size:10px;opacity:.65;">${cnt}</span>`:''}
          </button>`;
        }).join('')}
      </div>
      <input class="filter-input" style="width:220px;padding:6px 12px;font-size:13px;margin-left:4px;"
        placeholder="Search by name…"
        value="${TS.search||''}"
        oninput="window._tState.search=this.value;
          const q=this.value.toLowerCase();let v=0;
          document.querySelectorAll('.t-sb').forEach(b=>{
            let bv=0;
            b.querySelectorAll('tr.tdr').forEach(r=>{
              const show=!q||(r.dataset.name||'').toLowerCase().includes(q);
              r.style.display=show?'':'none';if(show)bv++;
            });
            b.style.display=bv>0?'':'none';v+=bv;
          });
          document.getElementById('t-rc').textContent=v+' staff';">
      <span id="t-rc" style="font-size:11px;color:var(--text3);">${totalStaff} staff</span>
    </div>`;

  // ── Row 3: day picker (compact, no "TOTALS FOR" label) ──
  const dayPicker = `
    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
      <span style="font-size:11px;color:var(--text3);margin-right:2px;">Slot totals for:</span>
      ${weekDates.map((dk,i)=>{
        const isAct=dk===selDay, isTod=dk===todayDk;
        return `<button onclick="window._tState.schedDay='${dk}';nav('schedule')"
          style="padding:4px 10px;border-radius:var(--r);font-size:11px;cursor:pointer;
            border:1.5px solid ${isAct?'var(--accent)':isTod?'rgba(31,102,241,.4)':'var(--border2)'};
            background:${isAct?'var(--accent)':'var(--bg2)'};
            color:${isAct?'#fff':isTod?'var(--accent)':'var(--text2)'};
            font-weight:${isAct||isTod?600:400};">
          ${WEEK_DAYS[i]} ${dk}${isTod?' · today':''}
        </button>`;
      }).join('')}
    </div>`;

  // ── Row 4: totals bar (compact inline format) ──
  const totalsBar = `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;
      background:var(--bg3);border:1px solid var(--border);border-radius:8px;
      margin-bottom:14px;flex-wrap:wrap;font-size:12px;">
      <span style="font-weight:600;">On ${selDay}:
        <span style="color:var(--accent);margin-left:2px;">${totalOnDay}</span>
        <span style="color:var(--text3);font-size:11px;margin-left:2px;">agents</span>
      </span>
      <span style="color:var(--border2);">|</span>
      ${['A','B','C','D','E'].map(sh=>{
        const d=SD[sh];
        if (!d.users.length) return '';
        const c=SHIFT_COLORS[sh]||{};
        if (!d.total) return `<span style="color:var(--text3);font-size:11px;">${_shBadge(sh,16)} 0</span>`;
        return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;">
          ${_shBadge(sh,16)}
          <span style="color:var(--text);font-weight:500;">${d.total}</span>
          <span class="break-slot slot-1" style="font-size:9px;padding:1px 5px;">${sh}1: ${d.s1}</span>
          <span class="break-slot slot-2" style="font-size:9px;padding:1px 5px;">${sh}2: ${d.s2}</span>
        </span>`;
      }).filter(Boolean).join('<span style="color:var(--border2);">·</span>')}
    </div>`;

  // ── Shift blocks ──
  const blocks = ['A','B','C','D','E'].map(sh=>{
    const d=SD[sh];
    if (!d.users.length) return '';
    if (TS.shiftFilter!=='all'&&TS.shiftFilter!==sh) return '';
    const c=SHIFT_COLORS[sh]||{};
    const def=SHIFTS[sh]||{};

    // Column headers
    const thead = weekDates.map((dk,i)=>{
      const isTod=dk===todayDk, isSel=dk===selDay;
      return `<th style="min-width:60px;text-align:center;padding:5px 2px;
        background:${isSel?'rgba(31,102,241,.08)':isTod?'rgba(31,102,241,.04)':'var(--bg3)'};
        border-bottom:2px solid ${isSel?'var(--accent)':isTod?'rgba(31,102,241,.4)':'var(--border2)'};
        position:sticky;top:0;z-index:2;">
        <div style="font-size:11px;font-weight:${isSel||isTod?700:500};color:${isSel||isTod?'var(--accent)':'var(--text2)'};">${WEEK_DAYS[i]}</div>
        <div style="font-size:10px;color:${isSel||isTod?'var(--accent)':'var(--text3)'};">${dk}</div>
        ${isTod?`<div style="font-size:8px;color:var(--accent);font-weight:700;">today</div>`:''}
      </th>`;
    }).join('');

    // Data rows
    const rows = d.users.map(u=>{
      const cells = weekDates.map(dk=>{
        const us=getUS(u,dk);
        const isSel=dk===selDay;
        if (us!==sh) return `<td style="text-align:center;padding:5px 2px;${isSel?'background:rgba(31,102,241,.03);':''}"><span style="font-size:10px;color:var(--text3);">—</span></td>`;
        const br=DB.getBreak(u.id,dk);
        const idx=br?d.slots.indexOf(br.slot):-1;
        const cls=idx>=0?`slot-${idx+1}`:'';
        const code=br?getShortSlot(sh,br.slot):'?';
        return `<td style="text-align:center;padding:4px 2px;${isSel?'background:rgba(31,102,241,.03);':''}">
          <span class="${br?`break-slot assigned ${cls}`:''}"
            style="font-size:10px;padding:3px 7px;${br?'':'color:var(--text3);'}"
            title="${br?br.slot:'Not assigned'}">${code}</span>
        </td>`;
      }).join('');
      return `<tr class="tdr" data-name="${u.name.toLowerCase()}">
        <td style="padding:6px 10px;white-space:nowrap;position:sticky;left:0;z-index:1;background:var(--bg2);">
          <div style="font-size:12px;font-weight:600;">${u.name}</div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>${cells}
      </tr>`;
    }).join('');

    // Slot totals in block header (right side)
    const s1b=`<span class="break-slot slot-1" style="font-size:10px;padding:2px 7px;">${sh}1: ${d.s1}</span>`;
    const s2b=`<span class="break-slot slot-2" style="font-size:10px;padding:2px 7px;margin-left:4px;">${sh}2: ${d.s2}</span>`;

    // Legend row (slot times)
    const legendHTML = d.slots.length > 0
      ? d.slots.map((time,i)=>
          `<span class="break-slot slot-${i+1}" style="font-size:10px;padding:2px 7px;">${sh}${i+1}</span>
           <span style="font-size:11px;color:var(--text2);margin-right:10px;">${time}</span>`
        ).join('')
      : '';

    return `<div class="t-sb" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:${c.bg};border-bottom:1px solid var(--border);">
        ${_shBadge(sh,24)}
        <span style="font-size:13px;font-weight:600;color:${c.color};">Shift ${sh}</span>
        <span style="font-size:11px;color:var(--text2);">${def.display||''}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text2);">
          ${d.users.length} agents · ${selDay}: ${d.total} on-shift
        </span>
        ${s1b}${s2b}
      </div>
      ${legendHTML ? `<div style="display:flex;align-items:center;gap:4px;padding:5px 14px;background:var(--bg3);border-bottom:1px solid var(--border);">
        <span style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-right:6px;">Legend</span>
        ${legendHTML}
      </div>` : ''}
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;background:var(--bg3);border-bottom:2px solid var(--border2);min-width:180px;font-size:11px;color:var(--text2);position:sticky;top:0;left:0;z-index:3;">Name / Group</th>
            ${thead}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  return `
${titleRow}
${topRow}
${dayPicker}
${totalsBar}
${blocks||'<div class="empty">No staff found.</div>'}`;
}


// ═══════════════════════════════════════════════
//  2. 30-MIN BREAK — TRAINING VIEW
//  Clean card layout + approve/reject per entry
// ═══════════════════════════════════════════════
function renderExtBreakTraining() {
  const mk = currentMonthKey();
  const [yr,mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr),parseInt(mo)-1,1)
    .toLocaleString('en-US',{month:'long',year:'numeric'});
  const weekDates = getWeekDates();
  const dateToDayName = {};
  WEEK_DAYS.forEach((d,i)=>{dateToDayName[weekDates[i]]=d;});

  // Group all female staff by primary shift
  const femaleByShift = {A:[],B:[],C:[],D:[],E:[]};
  state.users.forEach(u=>{
    if (u.gender!=='F') return;
    const sc={};
    weekDates.forEach(dk=>{
      const s=u.schedule[dk]||u.schedule[dateToDayName[dk]]||'0';
      if(s&&s!=='0') sc[s]=(sc[s]||0)+1;
    });
    const ps=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(ps&&femaleByShift[ps]) femaleByShift[ps].push(u);
  });

  const totalF = Object.values(femaleByShift).reduce((a,arr)=>a+arr.length,0);
  const pendingCount = DB.countPendingExtBreaks ? DB.countPendingExtBreaks() : 0;
  const q = (TS.search||'').toLowerCase();

  // Status badge helper
  function _statusBadge(status, reason) {
    if (status==='approved') return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--C-bg);color:var(--ok);font-weight:500;">✓ Approved</span>`;
    if (status==='rejected') return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--D-bg);color:var(--err);font-weight:500;" title="${reason||''}">✗ Rejected${reason?' — '+reason:''}</span>`;
    return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(245,158,11,.15);color:var(--warn);font-weight:500;">⏳ Pending</span>`;
  }

  const blocks = ['A','B','C','D','E'].map(sh=>{
    const users = femaleByShift[sh].filter(u=>!q||u.name.toLowerCase().includes(q));
    if (!users.length) return '';
    if (TS.shiftFilter!=='all'&&TS.shiftFilter!==sh) return '';
    const c = SHIFT_COLORS[sh]||{};

    const userCards = users.map(u=>{
      const entries = DB.getExtBreaks(u.id, mk);
      const used = entries.length;
      const rem = Math.max(0,3-used);
      const dots = [0,1,2].map(i=>
        `<span style="width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:2px;
          background:${i<used?c.color||'var(--accent)':'var(--border2)'};"></span>`
      ).join('');

      const entryList = entries.length===0
        ? `<div style="font-size:11px;color:var(--text3);padding:8px 0;">No registrations this month.</div>`
        : entries.map((e,i)=>{
            const status = e.status||'pending';
            const isPending = status==='pending';
            return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;
              border-top:0.5px solid var(--border);flex-wrap:wrap;font-size:12px;">
              <span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);min-width:58px;">${e.day||'—'}</span>
              <span style="color:var(--text2);">${e.day?getWkDay(e.day):''}</span>
              <span style="background:${c.bg};color:${c.color};border:0.5px solid ${c.color};
                border-radius:4px;padding:2px 8px;font-size:11px;">
                ${e.position==='before'?'← Before':'After →'}
              </span>
              <span style="font-size:11px;color:var(--text2);">${e.time||''}</span>
              ${_statusBadge(status, e.rejectedReason)}
              <div style="margin-left:auto;display:flex;gap:5px;align-items:center;">
                ${isPending?`
                  <button class="btn btn-xs" style="background:var(--C-bg);color:var(--ok);border-color:var(--ok);padding:2px 8px;font-size:11px;"
                    onclick="approveExtBreak(${u.id},'${mk}',${i})">✓</button>
                  <button class="btn btn-xs btn-err" style="padding:2px 8px;font-size:11px;"
                    onclick="rejectExtBreakPrompt(${u.id},'${mk}',${i})">✗</button>`:''}
                <button class="btn btn-xs" style="padding:2px 6px;font-size:11px;color:var(--text3);"
                  onclick="deleteExtBreak(${u.id},'${mk}',${i},${u.id})">🗑</button>
              </div>
            </div>`;
          }).join('');

      return `<div style="border:0.5px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg3);">
          <span style="font-size:12px;font-weight:600;">${u.name}</span>
          <span style="color:${c.color};font-size:11px;">♀</span>
          <span style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</span>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
            <div>${dots}</div>
            <span style="font-size:11px;color:${rem===0?'var(--err)':rem===1?'var(--warn)':'var(--text2)'};">${used}/3</span>
          </div>
        </div>
        <div style="padding:0 12px 8px;">
          ${entryList}
        </div>
      </div>`;
    }).join('');

    return `<div class="t-sb" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:${c.bg};border-bottom:1px solid var(--border);">
        ${_shBadge(sh,22)}
        <span style="font-size:13px;font-weight:600;color:${c.color};">Shift ${sh}</span>
        <span style="font-size:11px;color:var(--text2);margin-left:auto;">${users.length} female staff</span>
      </div>
      <div style="padding:10px 14px;">${userCards}</div>
    </div>`;
  }).join('');

  return `
<div style="margin-bottom:14px;">
  <div class="page-title">30-Min Extra Break</div>
  <div class="page-sub">${monthLabel} · ${totalF} female staff</div>
</div>

${pendingCount>0?`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
  background:rgba(245,158,11,.10);border:1px solid var(--warn);border-radius:8px;margin-bottom:12px;">
  <span style="font-size:16px;">⏳</span>
  <div>
    <div style="font-weight:600;color:var(--warn);font-size:13px;">${pendingCount} pending request${pendingCount>1?'s':''}</div>
    <div style="font-size:11px;color:var(--text2);">Review entries below — approve ✓ or reject ✗</div>
  </div>
</div>`:''}

<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
  <div style="display:flex;gap:5px;flex-wrap:wrap;">
    ${['all','A','B','C','D','E'].map(val=>{
      const isAct=TS.shiftFilter===val;
      const c=SHIFT_COLORS[val]||{};
      const cnt=val!=='all'?femaleByShift[val]?.length:'';
      return `<button onclick="window._tState.shiftFilter='${val}';window._tState.search='';nav('extbreak')"
        style="padding:5px 12px;border-radius:var(--r);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;
          border:1.5px solid ${isAct?(val==='all'?'var(--accent)':c.color):'var(--border2)'};
          background:${isAct?(val==='all'?'var(--accent)':c.bg):'var(--bg2)'};
          color:${isAct?(val==='all'?'#fff':c.color):'var(--text2)'};">
        ${val==='all'?'All shifts':val}${cnt!==''?` <span style="font-size:10px;opacity:.65;">${cnt}</span>`:''}
      </button>`;
    }).join('')}
  </div>
  <input class="filter-input" style="width:200px;padding:6px 12px;font-size:13px;"
    placeholder="Search by name…" value="${TS.search||''}"
    oninput="window._tState.search=this.value;
      const q=this.value.toLowerCase();
      document.querySelectorAll('.t-sb').forEach(b=>{
        let v=0;
        b.querySelectorAll('.tdr').forEach(r=>{
          const show=!q||(r.dataset.name||'').toLowerCase().includes(q);
          r.style.display=show?'':'none';if(show)v++;
        });
        b.style.display=v>0?'':'none';
      });">
</div>

${blocks||'<div class="empty">No female staff found.</div>'}`;
}


// ═══════════════════════════════════════════════
//  3. LOGBOOK — TRAINING VIEW
//  Full month calendar, edit enabled all shifts
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  3. LOGBOOK — TRAINING VIEW
//  Single merged table, all shifts, full month
// ═══════════════════════════════════════════════
function renderAttendanceTraining() {
  const year  = TS.attYear;
  const month = TS.attMonth;
  const prevM = month===1?12:month-1;
  const prevY = month===1?year-1:year;
  const monthLabel = `${new Date(prevY,prevM-1,25).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${new Date(year,month-1,24).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
  const dates   = _getAllDatesInMonth(year, month);
  const todayDk = _todayDateKey();
  const q       = (TS.search||'').toLowerCase();
  const shF     = TS.shiftFilter; // 'all' | 'A'..'E'

  // Month picker
  const selStyle = `padding:5px 10px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg2);color:var(--text);cursor:pointer;font-size:13px;font-weight:500;`;
  const monthPicker = `
    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
      <button onclick="let m=${month===1?12:month-1},y=${month===1?year-1:year};window._tState.attMonth=m;window._tState.attYear=y;nav('attendance')"
        style="${selStyle}padding:5px 12px;">‹</button>
      <select style="${selStyle}min-width:120px;" onchange="window._tState.attMonth=+this.value;nav('attendance')">
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>
          `<option value="${m}" ${m===month?'selected':''}>${new Date(year,m-1,1).toLocaleString('en-US',{month:'long'})}</option>`
        ).join('')}
      </select>
      <select style="${selStyle}min-width:75px;" onchange="window._tState.attYear=+this.value;nav('attendance')">
        ${[2024,2025,2026,2027].map(y=>
          `<option value="${y}" ${y===year?'selected':''}>${y}</option>`
        ).join('')}
      </select>
      <button onclick="let m=${month===12?1:month+1},y=${month===12?year+1:year};window._tState.attMonth=m;window._tState.attYear=y;nav('attendance')"
        style="${selStyle}padding:5px 12px;">›</button>
      <span style="font-size:12px;color:var(--text2);">${monthLabel}</span>
    </div>`;

  // Collect ALL users, determine their primary shift for this month
  const allUsers = state.users.map(u=>{
    const sc={};
    dates.forEach(dk=>{
      const s=u.schedule?.[dk];
      if(s&&s!=='0'&&SHIFT_DEFAULTS[s]) sc[s.charAt(0)]=(sc[s.charAt(0)]||0)+1;
    });
    const ps=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0]?.[0]||'?';
    return {...u, _primaryShift: ps};
  }).filter(u=>u._primaryShift!=='?');

  // Apply filters
  const visUsers = allUsers.filter(u=>{
    if (shF!=='all' && u._primaryShift!==shF) return false;
    if (q && !(u.name||'').toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>{
    // Sort: by shift A→E, then by name
    const so = {A:0,B:1,C:2,D:3,E:4};
    return (so[a._primaryShift]??9)-(so[b._primaryShift]??9) || (a.name||'').localeCompare(b.name||'');
  });

  const totalStaff = allUsers.length;

  // Date column headers
  const WDAY = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const theadDates = dates.map(dk=>{
    const [_d,_m] = dk.split('/');
    const cellY = parseInt(_m)===month ? year : (month===1?year-1:year);
    const dow = new Date(cellY, parseInt(_m)-1, parseInt(_d)).getDay();
    const isToday = dk===todayDk;
    const isWknd = dow===0||dow===6;
    return `<th style="min-width:100px;width:100px;padding:4px 1px;text-align:center;
      font-size:10px;font-weight:500;position:sticky;top:0;z-index:2;
      color:${isToday?'var(--accent)':isWknd?'var(--warn)':'var(--text2)'};
      background:${isToday?'rgba(31,102,241,.08)':isWknd?'var(--bg4)':'var(--bg3)'};
      border-bottom:2px solid ${isToday?'var(--accent)':'var(--border2)'};
      border-left:${dow===0&&dk!==dates[0]?'1px solid var(--border2)':'none'};">
      <div style="opacity:.7;">${WDAY[dow]}</div>
      <div style="font-size:11px;font-weight:${isToday?700:400};">${parseInt(_d)}<span style="font-size:8px;opacity:.55;">/${_m}</span></div>
    </th>`;
  }).join('');

  // Keep track of current shift group for divider rows
  let lastShift = null;
  let totalLate=0, totalEarly=0;

  const rows = visUsers.map(u=>{
    const c = SHIFT_COLORS[u._primaryShift]||{};
    let uLate=0, uEarly=0;

    const cells = dates.map(dk=>{
      const [_d,_m] = dk.split('/');
      const cellY = parseInt(_m)===month ? year : (month===1?year-1:year);
      const dow = new Date(cellY, parseInt(_m)-1, parseInt(_d)).getDay();
      const isWknd = dow===0||dow===6;
      const isToday = dk===todayDk;
      const isSunDiv = dow===0&&dk!==dates[0];
      const shift = u.schedule?.[dk];

      // Off day
      if (!shift||shift==='0'||!SHIFT_DEFAULTS[shift]) {
        const rec = DB.getAttendance(u.id, dk);
        return `<td style="text-align:center;padding:2px 1px;
          ${isWknd?'background:var(--bg4);opacity:.65;':''}
          ${isToday?'outline:1px solid var(--accent);outline-offset:-1px;':''}
          ${isSunDiv?'border-left:1px solid var(--border2);':''}
          cursor:${rec?'pointer':'default'};"
          ${rec?`onclick="openAttendanceModal(${u.id},'${dk}')"`:''}>
          <span style="font-size:10px;color:${rec?'var(--warn)':'var(--border2)'};">${rec?'!':'—'}</span>
        </td>`;
      }

      const rec = DB.getAttendance(u.id, dk);
      const {lateMin,earlyMin} = calcLateEarly(u.id, dk);
      const hasRec = rec&&(rec.start||rec.end);
      const isLate = lateMin>0, isEarly = earlyMin>0;
      if(isLate)  { uLate++; totalLate++; }
      if(isEarly) { uEarly++; totalEarly++; }

      const _def = SHIFT_DEFAULTS[shift]||{};
      const lateTxt  = typeof _fmtDiffFull==='function' ? _fmtDiffFull(lateMin, rec?.start, _def.start) : '00:00';
      const earlyTxt = typeof _fmtDiffFull==='function' ? _fmtDiffFull(earlyMin, _def.end, rec?.end) : '00:00';
      const bg = isLate ? 'background:var(--D-bg);' : isEarly ? 'background:rgba(245,158,11,.08);' : hasRec ? 'background:rgba(74,222,128,.06);' : '';

      const content = !hasRec
        ? `<span style="font-size:11px;color:var(--text3);">·</span>`
        : `<div style="font-size:10px;font-family:'IBM Plex Mono',monospace;color:${isLate?'var(--err)':'var(--ok)'};line-height:1.5;">${rec.start||'—'}</div>
           <div style="font-size:9px;font-family:'IBM Plex Mono',monospace;color:${isLate?'var(--err)':'var(--ok)'};">
             <b>${isLate?'(-)':'(+)'}</b> ${lateTxt}
           </div>
           <div style="font-size:10px;font-family:'IBM Plex Mono',monospace;color:${isEarly?'var(--warn)':'var(--ok)'};line-height:1.5;">${rec.end||'—'}</div>
           <div style="font-size:9px;font-family:'IBM Plex Mono',monospace;color:${isEarly?'var(--warn)':'var(--ok)'};">
             <b>${isEarly?'(-)':'(+)'}</b> ${earlyTxt}
           </div>`;

      return `<td style="text-align:center;padding:3px 1px;cursor:pointer;vertical-align:top;
        min-width:100px;width:100px;${bg}
        ${isToday?'outline:1.5px solid var(--accent);outline-offset:-1px;':''}
        ${isSunDiv?'border-left:1px solid var(--border2);':''}"
        onclick="openAttendanceModal(${u.id},'${dk}')"
        title="${hasRec?`${rec?.start||'—'} → ${rec?.end||'—'}`:'No record — click to add'}">
        ${content}
      </td>`;
    }).join('');

    const sumTxt = uLate>0||uEarly>0
      ? [uLate>0?`<span style="color:var(--err);font-size:10px;font-weight:600;">${uLate}L</span>`:'',
         uEarly>0?`<span style="color:var(--warn);font-size:10px;font-weight:600;">${uEarly}E</span>`:'']
         .filter(Boolean).join(' ')
      : `<span style="color:var(--ok);font-size:11px;">✓</span>`;

    // Shift divider row when shift changes
    let divider = '';
    if (shF==='all' && u._primaryShift !== lastShift) {
      lastShift = u._primaryShift;
      const shiftUsers = visUsers.filter(x=>x._primaryShift===u._primaryShift);
      divider = `<tr style="background:${c.bg};">
        <td colspan="2" style="padding:4px 10px;position:sticky;left:0;z-index:1;background:${c.bg};">
          <div style="display:flex;align-items:center;gap:6px;">
            ${_shBadge(u._primaryShift,18)}
            <span style="font-size:11px;font-weight:600;color:${c.color};">Shift ${u._primaryShift}</span>
            <span style="font-size:10px;color:${c.color};opacity:.7;">${shiftUsers.length} staff</span>
          </div>
        </td>
        <td colspan="${dates.length}" style="background:${c.bg};"></td>
      </tr>`;
    }

    return divider + `<tr data-name="${u.name.toLowerCase()}" data-shift="${u._primaryShift}"
      style="border-bottom:0.5px solid var(--border);">
      <td style="padding:5px 10px;white-space:nowrap;position:sticky;left:0;z-index:1;background:var(--bg2);border-right:0.5px solid var(--border);">
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="width:4px;height:32px;border-radius:2px;background:${c.color||'var(--border2)'};flex-shrink:0;display:inline-block;"></span>
          <div>
            <div style="font-size:12px;font-weight:600;">${u.name}</div>
            <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
          </div>
        </div>
      </td>
      <td style="padding:5px 6px;text-align:center;white-space:nowrap;border-right:1px solid var(--border);">
        ${sumTxt}
      </td>
      ${cells}
    </tr>`;
  }).join('');

  const emptyMsg = `<tr><td colspan="${dates.length+2}" style="text-align:center;padding:48px;color:var(--text3);">No staff found.</td></tr>`;

  // Tab state (reuse attendanceTab shared variable)
  const tabs = `
<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);">
  <button onclick="attendanceTab='log';nav('attendance')"
    style="padding:8px 20px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
      color:${attendanceTab==='log'?'var(--accent)':'var(--text3)'};
      border-bottom:${attendanceTab==='log'?'2px solid var(--accent)':'2px solid transparent'};
      margin-bottom:-2px;">
    ⏱ Monthly Log
  </button>
  <button onclick="attendanceTab='report';nav('attendance')"
    style="padding:8px 20px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;
      color:${attendanceTab==='report'?'var(--accent)':'var(--text3)'};
      border-bottom:${attendanceTab==='report'?'2px solid var(--accent)':'2px solid transparent'};
      margin-bottom:-2px;">
    📋 Monthly Report
  </button>
</div>`;

  if (attendanceTab === 'report') {
    return `
<div style="margin-bottom:12px;">
  <div class="page-title">⏱ Logbook & Reports</div>
  <div class="page-sub">${monthLabel} · ${totalStaff} staff · Click any cell to edit</div>
</div>
${tabs}

<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
  ${monthPicker}
</div>

<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
  <div style="display:flex;gap:5px;flex-wrap:wrap;">
    ${['all','A','B','C','D','E'].map(val=>{
      const isAct=shF===val;
      const c=SHIFT_COLORS[val]||{};
      const cnt=val!=='all'?allUsers.filter(u=>u._primaryShift===val).length:'';
      return `<button onclick="window._tState.shiftFilter='${val}';nav('attendance')"
        style="padding:5px 12px;border-radius:var(--r);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;
          border:1.5px solid ${isAct?(val==='all'?'var(--accent)':c.color):'var(--border2)'};
          background:${isAct?(val==='all'?'var(--accent)':c.bg):'var(--bg2)'};
          color:${isAct?(val==='all'?'#fff':c.color):'var(--text2)'};">
        ${val==='all'?'All':val}${cnt!==''?` <span style="font-size:10px;opacity:.65;">${cnt}</span>`:''}
      </button>`;
    }).join('')}
  </div>
  <input class="filter-input" style="width:200px;padding:6px 12px;font-size:13px;"
    placeholder="Search by name…" value="${q}"
    oninput="window._tState.search=this.value;
      const q=this.value.toLowerCase();
      document.querySelectorAll('tr[data-name]').forEach(r=>{
        const matchName=!q||(r.dataset.name||'').toLowerCase().includes(q);
        const matchShift=window._tState.shiftFilter==='all'||(r.dataset.shift||'')===(window._tState.shiftFilter||'all');
        r.style.display=(matchName&&matchShift)?'':'none';
      });">
  <span style="font-size:11px;color:var(--text3);">${visUsers.length} / ${totalStaff} staff</span>
  ${totalLate>0||totalEarly>0?`
    <span style="font-size:11px;color:var(--err);">${totalLate} late</span>
    <span style="font-size:11px;color:var(--warn);">${totalEarly} early</span>`:''}
</div>

<div style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 260px);border:1px solid var(--border);border-radius:8px;">
  <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 10px;background:var(--bg3);border-bottom:2px solid var(--border2);
          min-width:200px;position:sticky;top:0;left:0;z-index:4;font-size:11px;color:var(--text2);border-right:0.5px solid var(--border2);">Name</th>
        <th style="text-align:center;padding:6px 6px;background:var(--bg3);border-bottom:2px solid var(--border2);
          min-width:36px;position:sticky;top:0;z-index:2;font-size:10px;color:var(--text2);border-right:1px solid var(--border);">Sum</th>
        ${theadDates}
      </tr>
    </thead>
    <tbody>
      ${rows||emptyMsg}
    </tbody>
  </table>
</div>

<div style="padding:6px 14px 0;font-size:11px;color:var(--text3);">
  Click any cell to edit &nbsp;·&nbsp;
  <span style="color:var(--err);">red</span> = late &nbsp;·&nbsp;
  <span style="color:var(--warn);">amber</span> = early out &nbsp;·&nbsp;
  <span style="color:var(--ok);">green</span> = on time
</div>`;
}