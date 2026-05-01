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
function renderAttendanceTraining() {
// ── Read-only attendance modal for training role ──
function openAttendanceViewModal(uid, dateKey) {
  const u   = state.users.find(x => x.id === uid);
  const rec = DB.getAttendance(uid, dateKey) || {};
  const shift = _getUserShiftOnDate(u, dateKey) || '?';
  const def   = SHIFT_DEFAULTS[shift] || {};
  const {lateMin, earlyMin, late, early} = calcLateEarly(uid, dateKey);

  // Build modal content
  const statusLine = [
    lateMin  > 0 ? `<span style="display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:600;background:var(--D-bg);color:var(--err);">Late +${late}</span>` : '',
    earlyMin > 0 ? `<span style="display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:600;background:rgba(245,158,11,.12);color:var(--warn);">Early out -${early}</span>` : '',
    (!lateMin && !earlyMin && (rec.start||rec.end)) ? `<span style="display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:600;background:var(--C-bg);color:var(--ok);">On time</span>` : '',
  ].filter(Boolean).join(' ');

  const html = `
    <div style="padding:0 2px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:15px;font-weight:700;">${u?.name || '?'}</div>
          <div style="font-size:11px;color:var(--text3);">${u?.team||''} · ${getRoleInfo(u?.role||'').label} · ${dateKey} · Shift ${shift}</div>
        </div>
      </div>

      ${!rec.start && !rec.end && !rec.note
        ? `<div style="text-align:center;padding:24px 0;color:var(--text3);font-size:13px;">No attendance record for this day.</div>`
        : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div style="background:var(--bg3);border-radius:8px;padding:14px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:6px;">Login</div>
              <div style="font-size:22px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:${lateMin>0?'var(--err)':'var(--ok)'};">${rec.start||'—'}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:4px;">Scheduled: ${def.start||'—'}</div>
              ${lateMin>0?`<div style="font-size:12px;color:var(--err);font-weight:600;margin-top:4px;">Late by +${late}</div>`:''}
            </div>
            <div style="background:var(--bg3);border-radius:8px;padding:14px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:6px;">Logout</div>
              <div style="font-size:22px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:${earlyMin>0?'var(--warn)':'var(--ok)'};">${rec.end||'—'}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:4px;">Scheduled: ${def.end||'—'}</div>
              ${earlyMin>0?`<div style="font-size:12px;color:var(--warn);font-weight:600;margin-top:4px;">Early out -${early}</div>`:''}
            </div>
          </div>
          ${statusLine ? `<div style="margin-bottom:12px;">${statusLine}</div>` : ''}
          ${rec.note ? `<div style="padding:10px 14px;background:var(--bg3);border-radius:8px;font-size:12px;color:var(--text2);">
            <span style="color:var(--text3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Note</span><br>
            ${rec.note}
          </div>` : ''}`}

      <div style="margin-top:20px;text-align:right;">
        <button class="btn" onclick="closeModal('modal-att-view')">Close</button>
      </div>
    </div>`;

  // Reuse or create a simple modal
  let modal = document.getElementById('modal-att-view');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-att-view';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal" style="width:480px;"><div id="modal-att-view-body"></div></div>`;
    modal.addEventListener('click', e => { if(e.target===modal) closeModal('modal-att-view'); });
    document.body.appendChild(modal);
  }
  document.getElementById('modal-att-view-body').innerHTML = html;
  modal.classList.add('show');
}