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
    const cnt = countFn ? countFn(val) : '';
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

  const totalStaff = Object.values(SD).reduce((a,d)=>a+d.users.length,0);
  const visCount   = Object.values(SD).flat
    ? TS.search
      ? state.users.filter(u=>u.name.toLowerCase().includes(TS.search.toLowerCase())).length
      : totalStaff
    : totalStaff;

  // Day picker (for totals reference)
  const dayPicker = `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
      <span style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;white-space:nowrap;">TOTALS FOR:</span>
      ${weekDates.map((dk,i)=>{
        const isAct = dk===selDay;
        const isTod = dk===todayDk;
        return `<button onclick="window._tState.schedDay='${dk}';nav('schedule')"
          style="padding:4px 12px;border-radius:var(--r);font-size:12px;font-weight:${isAct?700:400};cursor:pointer;
            border:1.5px solid ${isAct?'var(--accent)':isTod?'rgba(31,102,241,.35)':'var(--border2)'};
            background:${isAct?'var(--accent)':'var(--bg2)'};
            color:${isAct?'#fff':isTod?'var(--accent)':'var(--text2)'};">
          ${WEEK_DAYS[i]} ${dk}${isTod?' ·today':''}
        </button>`;
      }).join('')}
    </div>`;

  // Totals summary bar
  const totalsBar = `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 14px;
      background:var(--bg3);border:1px solid var(--border);border-radius:8px;
      margin-bottom:12px;flex-wrap:wrap;font-size:12px;">
      <b>All shifts on ${selDay}: <span style="color:var(--accent);">${
        Object.values(SD).reduce((a,d)=>a+d.total,0)
      }</span> agents</b>
      <span style="color:var(--border2);">|</span>
      ${['A','B','C','D','E'].map(sh=>{
        const d=SD[sh];
        const c=SHIFT_COLORS[sh]||{};
        if (!d.total) return `<span style="color:var(--text3);font-size:11px;">${_shBadge(sh,16)} 0</span>`;
        return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;">
          ${_shBadge(sh,16)}
          <span style="color:var(--text);">${d.total}</span>
          <span class="break-slot slot-1" style="font-size:9px;padding:1px 5px;">${sh}1:${d.s1}</span>
          <span class="break-slot slot-2" style="font-size:9px;padding:1px 5px;">${sh}2:${d.s2}</span>
        </span>`;
      }).join('<span style="color:var(--border2);">·</span>')}
    </div>`;

  // Shift blocks
  const blocks = ['A','B','C','D','E'].map(sh=>{
    const d=SD[sh];
    if (!d.users.length) return '';
    if (TS.shiftFilter!=='all'&&TS.shiftFilter!==sh) return '';

    const thead = weekDates.map((dk,i)=>{
      const isTod=dk===todayDk, isSel=dk===selDay;
      return `<th style="min-width:58px;text-align:center;padding:6px 2px;
        background:${isSel?'rgba(31,102,241,.10)':isTod?'rgba(31,102,241,.05)':'var(--bg3)'};
        border-bottom:2px solid ${isSel?'var(--accent)':isTod?'rgba(31,102,241,.3)':'var(--border2)'};">
        <div style="font-size:11px;font-weight:700;color:${isSel?'var(--accent)':isTod?'var(--accent)':'var(--text2)'};">${WEEK_DAYS[i]}</div>
        <div style="font-size:10px;color:${isSel?'var(--accent)':'var(--text3)'};">${dk}</div>
        ${isSel&&!isTod?'<div style="font-size:9px;color:var(--accent);">▼</div>':''}
        ${isTod?'<div style="font-size:9px;color:var(--accent);">today</div>':''}
      </th>`;
    }).join('');

    const rows = d.users.map(u=>{
      const cells = weekDates.map(dk=>{
        const us=getUS(u,dk);
        const isSel=dk===selDay;
        if (us!==sh) return `<td style="text-align:center;padding:5px 2px;${isSel?'background:rgba(31,102,241,.04);':''}"><span style="font-size:10px;color:var(--text3);">—</span></td>`;
        const br=DB.getBreak(u.id,dk);
        const idx=br?d.slots.indexOf(br.slot):-1;
        const cls=idx>=0?`slot-${idx+1}`:'';
        const code=br?getShortSlot(sh,br.slot):'?';
        return `<td style="text-align:center;padding:4px 2px;${isSel?'background:rgba(31,102,241,.04);':''}">
          <span class="${br?`break-slot assigned ${cls}`:''}"
            style="font-size:10px;padding:3px 7px;${br?'':'color:var(--text3);'}"
            title="${br?br.slot:'Not assigned'}">${code}</span>
        </td>`;
      }).join('');
      return `<tr class="tdr" data-name="${u.name.toLowerCase()}">
        <td style="padding:6px 10px;white-space:nowrap;">
          <div style="font-size:12px;font-weight:600;">${u.name}</div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>${cells}
      </tr>`;
    }).join('');

    // Slot totals in header — show for selected day
    const s1b=`<span class="break-slot slot-1" style="font-size:10px;padding:2px 6px;margin-left:6px;">${sh}1: ${d.s1}</span>`;
    const s2b=`<span class="break-slot slot-2" style="font-size:10px;padding:2px 6px;margin-left:4px;">${sh}2: ${d.s2}</span>`;
    const hdr=`${d.users.length} agents · ${selDay} on-shift: ${d.total} ${s1b}${s2b}`;

    return _shiftBlock(sh, hdr, `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th style="text-align:left;padding:7px 10px;background:var(--bg3);border-bottom:2px solid var(--border2);min-width:180px;font-size:11px;color:var(--text2);">Name / Group</th>
            ${thead}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`, d.users.length);
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">Break Schedule — All Shifts</div>
    <div class="page-sub">Current week · Read-only · ${totalStaff} staff</div>
  </div>
</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
  ${_tabBar(sh=>SD[sh]?.users.length,'schedule')}
</div>
${_searchBar('schedule','Search by name…',totalStaff)}
${dayPicker}
${totalsBar}
${blocks||'<div class="empty">No staff found.</div>'}`;
}


// ═══════════════════════════════════════════════
//  2. 30-MIN BREAK — TRAINING VIEW (unchanged)
// ═══════════════════════════════════════════════
function renderExtBreakTraining() {
  const mk = currentMonthKey();
  const [yr,mo] = mk.split('-');
  const monthLabel = new Date(parseInt(yr),parseInt(mo)-1,1)
    .toLocaleString('en-US',{month:'long',year:'numeric'});
  const weekDates = getWeekDates();
  const dateToDayName = {};
  WEEK_DAYS.forEach((d,i)=>{dateToDayName[weekDates[i]]=d;});

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
  const q = (TS.search||'').toLowerCase();
  const vc = Object.values(femaleByShift).flat()
    .filter(u=>!q||u.name.toLowerCase().includes(q)).length;

  const blocks = ['A','B','C','D','E'].map(sh=>{
    const users=femaleByShift[sh];
    if(!users.length) return '';
    if(TS.shiftFilter!=='all'&&TS.shiftFilter!==sh) return '';
    const rows=users.map(u=>{
      const entries=DB.getExtBreaks(u.id,mk);
      const used=entries.length;
      const rem=Math.max(0,3-used);
      const dates=entries.map(e=>e.day).filter(Boolean).join(', ')||'—';
      const dots=[0,1,2].map(i=>`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;
        margin-right:3px;background:${i<used?'var(--A-color)':'var(--border2)'};"></span>`).join('');
      return `<tr class="tdr" data-name="${u.name.toLowerCase()}"
        style="border-bottom:0.5px solid var(--border);">
        <td style="padding:7px 10px;">
          <div style="font-size:12px;font-weight:600;">${u.name} <span style="color:var(--A-color);font-size:11px;">♀</span></div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>
        <td style="padding:7px 10px;text-align:center;">${dots}<span style="font-size:11px;color:var(--text2);margin-left:4px;">${used}/3</span></td>
        <td style="padding:7px 10px;text-align:center;font-size:12px;font-weight:600;color:${rem===0?'var(--err)':rem===1?'var(--warn)':'var(--ok)'};">${rem} left</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text2);">${dates}</td>
      </tr>`;
    }).join('');
    return _shiftBlock(sh,`${users.length} female staff`,`
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg3);"><tr style="border-bottom:2px solid var(--border2);">
          <th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text2);min-width:180px;">NAME</th>
          <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--text2);">USED</th>
          <th style="text-align:center;padding:7px 10px;font-size:10px;color:var(--text2);">REMAINING</th>
          <th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text2);">DATES USED</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`,users.length);
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">🌸 30-Min Extra Break — All Shifts</div>
    <div class="page-sub">${monthLabel} · ${totalF} female staff</div>
  </div>
</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
  ${_tabBar(sh=>femaleByShift[sh]?.length,'extbreak')}
</div>
${_searchBar('extbreak','Search by name…',vc)}
${blocks||'<div class="empty">No female staff found.</div>'}`;
}


// ═══════════════════════════════════════════════
//  3. ATTENDANCE — TRAINING VIEW
//  Full month table: staff × days
//  Month picker + prev/next navigation
// ═══════════════════════════════════════════════
function renderAttendanceTraining() {
  const year  = TS.attYear;
  const month = TS.attMonth;
  const mk    = `${year}-${String(month).padStart(2,'0')}`;
  const monthLabel = new Date(year,month-1,1).toLocaleString('en-US',{month:'long',year:'numeric'});
  const dates = _getAllDatesInMonth(year, month);
  const todayDk = _todayDateKey();

  // Month navigation
  function prevMonth() {
    let m=month-1,y=year;
    if(m<1){m=12;y--;}
    return `window._tState.attMonth=${m};window._tState.attYear=${y};window._tState.shiftFilter='all';nav('attendance')`;
  }
  function nextMonth() {
    let m=month+1,y=year;
    if(m>12){m=1;y++;}
    return `window._tState.attMonth=${m};window._tState.attYear=${y};window._tState.shiftFilter='all';nav('attendance')`;
  }

  const monthPicker = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button onclick="${prevMonth()}" style="padding:5px 12px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;font-size:13px;">‹</button>
      <select class="login-select" style="padding:5px 10px;font-size:13px;font-weight:600;"
        onchange="window._tState.attMonth=+this.value;nav('attendance')">
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>
          `<option value="${m}" ${m===month?'selected':''}>${new Date(year,m-1,1).toLocaleString('en-US',{month:'long'})}</option>`
        ).join('')}
      </select>
      <select class="login-select" style="padding:5px 10px;font-size:13px;font-weight:600;"
        onchange="window._tState.attYear=+this.value;nav('attendance')">
        ${[2024,2025,2026,2027].map(y=>
          `<option value="${y}" ${y===year?'selected':''}>${y}</option>`
        ).join('')}
      </select>
      <button onclick="${nextMonth()}" style="padding:5px 12px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;font-size:13px;">›</button>
      <span style="font-size:12px;color:var(--text2);">${monthLabel} · ${dates.length} days</span>
    </div>`;

  // Group users by primary shift this month
  const byShift = {A:[],B:[],C:[],D:[],E:[]};
  state.users.forEach(u=>{
    const sc={};
    dates.forEach(dk=>{
      const s=u.schedule?.[dk];
      if(s&&s!=='0'&&SHIFT_DEFAULTS[s]) sc[s.charAt(0)]=(sc[s.charAt(0)]||0)+1;
    });
    const ps=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(ps&&byShift[ps]) byShift[ps].push(u);
  });

  const totalStaff = Object.values(byShift).reduce((a,arr)=>a+arr.length,0);
  const q = (TS.search||'').toLowerCase();
  const vc = Object.values(byShift).flat()
    .filter(u=>!q||u.name.toLowerCase().includes(q)).length;

  // Date column headers — show day number only (compact)
  // Group into weeks visually with subtle dividers every 7 days
  const theadDates = dates.map((dk,i)=>{
    const day = parseInt(dk.split('/')[0]);
    const dow = new Date(year,month-1,day).getDay(); // 0=Sun
    const isToday = dk===todayDk;
    const isSun = dow===0;
    return `<th style="min-width:28px;max-width:32px;padding:3px 1px;text-align:center;
      font-size:10px;font-weight:${isToday?700:500};
      color:${isToday?'var(--accent)':'var(--text3)'};
      border-left:${isSun&&i>0?'1px solid var(--border2)':'none'};
      background:${isToday?'rgba(31,102,241,.08)':'var(--bg3)'};
      border-bottom:2px solid ${isToday?'var(--accent)':'var(--border2)'};">
      <div>${['S','M','T','W','T','F','S'][dow]}</div>
      <div style="font-weight:${isToday?700:400}">${day}</div>
    </th>`;
  }).join('');

  // Build shift blocks
  const blocks = ['A','B','C','D','E'].map(sh=>{
    const users=byShift[sh];
    if(!users.length) return '';
    if(TS.shiftFilter!=='all'&&TS.shiftFilter!==sh) return '';

    // Sort: most incidents first
    const sorted=[...users].sort((a,b)=>{
      const la=dates.filter(dk=>{const {lateMin}=calcLateEarly(a.id,dk);return lateMin>0;}).length;
      const lb=dates.filter(dk=>{const {lateMin}=calcLateEarly(b.id,dk);return lateMin>0;}).length;
      return lb-la||(a.name||'').localeCompare(b.name||'');
    });

    let shiftLate=0,shiftEarly=0;

    const rows = sorted.map(u=>{
      let uLate=0,uEarly=0;
      const cells = dates.map((dk,i)=>{
        const day=parseInt(dk.split('/')[0]);
        const dow=new Date(year,month-1,day).getDay();
        const shift = u.schedule?.[dk];
        const isToday = dk===todayDk;
        const isSun = dow===0&&i>0;

        if(!shift||shift==='0'||!SHIFT_DEFAULTS[shift]) {
          // Off day
          return `<td style="text-align:center;padding:2px 1px;
            ${isSun?'border-left:1px solid var(--border2);':''}
            ${isToday?'background:rgba(31,102,241,.04);':''}">
            <span style="font-size:9px;color:var(--border2);">—</span>
          </td>`;
        }

        const rec = DB.getAttendance(u.id, dk);
        const {lateMin,earlyMin,late,early} = calcLateEarly(u.id, dk);
        const hasRec = rec&&(rec.start||rec.end);
        const isLate  = lateMin>0;
        const isEarly = earlyMin>0;
        if(isLate)  { uLate++;  shiftLate++;  }
        if(isEarly) { uEarly++; shiftEarly++; }

        let bg='',content='';
        if(isLate&&isEarly) {
          bg='background:var(--D-bg);';
          content=`<span style="font-size:9px;font-weight:700;color:var(--err);">L</span><span style="font-size:9px;color:var(--warn);">E</span>`;
        } else if(isLate) {
          bg='background:var(--D-bg);';
          content=`<span style="font-size:9px;font-weight:700;color:var(--err);" title="Late: ${late}">L</span>`;
        } else if(isEarly) {
          bg='background:rgba(245,158,11,.10);';
          content=`<span style="font-size:9px;font-weight:700;color:var(--warn);" title="Early: ${early}">E</span>`;
        } else if(hasRec) {
          bg='background:rgba(74,222,128,.08);';
          content=`<span style="font-size:9px;color:var(--ok);">✓</span>`;
        } else {
          content=`<span style="font-size:9px;color:var(--text3);">·</span>`;
        }

        return `<td style="text-align:center;padding:2px 1px;cursor:pointer;${bg}
          ${isSun?'border-left:1px solid var(--border2);':''}
          ${isToday?'outline:1.5px solid var(--accent);outline-offset:-1px;':''}">
          ${content}
        </td>`;
      }).join('');

      const sumTxt = [
        uLate  >0?`<span style="font-size:10px;font-weight:600;color:var(--err);">${uLate}L</span>`:'',
        uEarly >0?`<span style="font-size:10px;font-weight:600;color:var(--warn);">${uEarly}E</span>`:'',
      ].filter(Boolean).join(' ') || `<span style="font-size:10px;color:var(--ok);">✓</span>`;

      return `<tr class="tdr" data-name="${u.name.toLowerCase()}"
        style="border-bottom:0.5px solid var(--border);">
        <td style="padding:5px 10px;white-space:nowrap;position:sticky;left:0;z-index:1;background:var(--bg2);">
          <div style="font-size:12px;font-weight:600;">${u.name}</div>
          <div style="font-size:10px;color:var(--text3);">${u.team||''} · ${getRoleInfo(u.role).label}</div>
        </td>
        <td style="padding:5px 8px;text-align:center;white-space:nowrap;">${sumTxt}</td>
        ${cells}
      </tr>`;
    }).join('');

    const hdr = `${users.length} staff · <span style="color:var(--err);">${shiftLate} late</span> · <span style="color:var(--warn);">${shiftEarly} early</span>`;

    return _shiftBlock(sh, hdr, `
      <div style="overflow-x:auto;max-height:480px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead style="position:sticky;top:0;z-index:3;">
            <tr>
              <th style="text-align:left;padding:7px 10px;background:var(--bg3);border-bottom:2px solid var(--border2);min-width:180px;position:sticky;left:0;z-index:4;font-size:11px;color:var(--text2);">NAME</th>
              <th style="text-align:center;padding:7px 8px;background:var(--bg3);border-bottom:2px solid var(--border2);min-width:40px;font-size:10px;color:var(--text2);">SUM</th>
              ${theadDates}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:8px 14px;background:var(--bg3);border-top:1px solid var(--border);font-size:11px;color:var(--text3);">
        <b style="color:var(--err);">L</b> = late &nbsp;
        <b style="color:var(--warn);">E</b> = early out &nbsp;
        <span style="color:var(--ok);">✓</span> = on time &nbsp;
        <b>·</b> = no record &nbsp;
        <b>—</b> = off / not on shift
      </div>`, users.length);
  }).join('');

  return `
<div class="page-header">
  <div>
    <div class="page-title">Attendance Log — All Shifts</div>
    <div class="page-sub">${monthLabel} · ${totalStaff} staff</div>
  </div>
</div>
${monthPicker}
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
  ${_tabBar(sh=>byShift[sh]?.length,'attendance')}
</div>
${_searchBar('attendance','Search by name…',vc)}
${blocks||'<div class="empty" style="padding:48px;"><div class="empty-ico">📋</div>No staff found for ${monthLabel}.</div>'}`;
}