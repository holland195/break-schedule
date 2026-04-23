// ═══════════════════════════════════════════════
//  AUTH — Login / Logout / Session Persistence
// ═══════════════════════════════════════════════

function restoreSession() {
  const s = DB.getSession();
  if (!s) return false;
  const user = state.users.find(u => u.id === s.userId);
  if (!user) { DB.clearSession(); return false; }
  currentUser  = user;
  currentShift = s.shift || 'E';
  enterApp(true);
  return true;
}

function autoDetectShift() {
  const input = document.getElementById('li-user').value.trim();
  const user  = state.users.find(x => x.username === input);
  if (user) {
    const sch = user.schedule[todayKey()];
    if (sch && sch !== '0') document.getElementById('li-shift').value = sch;
  }
}

function doLogin() {
  const u   = document.getElementById('li-user').value.trim();
  const p   = document.getElementById('li-pass').value.trim();
  const s   = document.getElementById('li-shift').value;
  const err = document.getElementById('login-err');
  if (!u || !p) { err.textContent = 'Enter username and password.'; return; }
  const user = state.users.find(x => x.username === u && x.password === p);
  if (!user)  { err.textContent = 'Invalid credentials.'; return; }
  if (user.role !== 'Admin' && !s) { err.textContent = 'Please select your current shift.'; return; }
  currentUser  = user;
  currentShift = s || 'E';
  err.textContent = '';
  DB.saveSession({ userId: user.id, shift: currentShift });
  enterApp(false);
}

function enterApp(fromSession) {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  const ri = getRoleInfo(currentUser.role);
  document.getElementById('top-avatar').textContent   = currentUser.name.charAt(0);
  document.getElementById('top-name').textContent     = currentUser.name.split(' ').slice(-1)[0];
  document.getElementById('top-role-tag').textContent = ri.label;
  document.getElementById('top-role-tag').className   = 'role-tag ' + ri.tag;
  // Gender badge from staffInfo
  const si     = DB.getStaffInfo(currentUser.username);
  const gender = si?.gender || currentUser.gender || '';
  const tg     = document.getElementById('top-gender');
  if (tg) {
    tg.textContent = gender === 'F' ? '♀' : gender === 'M' ? '♂' : '';
    tg.style.color = gender === 'F' ? 'var(--A-color)' : 'var(--B-color)';
    tg.style.display = gender ? '' : 'none';
  }
  document.querySelectorAll('.leader-only').forEach(el =>
    el.style.display = isLeader(currentUser) ? 'flex' : 'none'
  );
  buildDatalist();
  document.getElementById('sidebar-shift').value = currentShift;
  nav('dashboard');
  updateBadge();
}

function logout() {
  DB.clearSession();
  currentUser = null;
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = currentTheme === 'dark' ? '☀ Light' : '☾ Dark';
}

// ═══════════════════════════════════════════════
//  EXCEL IMPORT (Staff Info)
// ═══════════════════════════════════════════════
function importExcelStaffInfo() {
  const file = document.getElementById('excel-file-input').files[0];
  if (!file) { toast('Select an Excel file first.', 'err'); return; }
  const status = document.getElementById('excel-import-status');
  status.innerHTML = '<span style="color:var(--text2)"><span class="spin" style="display:inline-block;width:12px;height:12px;border-width:2px;vertical-align:middle;margin-right:6px"></span>Reading…</span>';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      if (typeof XLSX === 'undefined') { status.innerHTML='<span style="color:var(--err)">SheetJS not loaded.</span>'; return; }
      const wb   = XLSX.read(data, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      let hi = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('name')));
      if (hi < 0) hi = 0;
      const headers = rows[hi].map(h => String(h).toLowerCase().replace(/[\s\n]/g,''));
      const col = k => headers.findIndex(h => h.includes(k));
      const iName=col('name'), iUser=col('username'), iGender=col('gender');
      const iDob=col('birth')>=0?col('birth'):col('dob');
      const iRole=col('position')>=0?col('position'):col('role');
      const iEmp=col('employee')>=0?col('employee'):col('empno');
      let imported=0;
      rows.slice(hi+1).forEach(row => {
        const username=String(row[iUser]||'').trim(), name=String(row[iName]||'').trim();
        if (!username||!name) return;
        const gender=String(row[iGender]||'').toLowerCase().startsWith('f')?'F':'M';
        DB.setStaffInfo(username,{ empNo:String(row[iEmp]||'').trim(), dob:String(row[iDob]||'').trim(), gender, name, role:String(row[iRole]||'').trim() });
        const su=state.users.find(u=>u.username===username); if(su) su.gender=gender;
        imported++;
      });
      save();
      status.innerHTML=`<span style="color:var(--ok)">✓ Imported ${imported} records. Gender data updated.</span>`;
      nav('staff');
    } catch(err) { status.innerHTML=`<span style="color:var(--err)">Error: ${err.message}</span>`; }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════
//  SCHEDULE IMPORT (Staff Schedule tab — paste)
// ═══════════════════════════════════════════════
function importFromPaste() {
  const rawData = document.getElementById('paste-area').value.trim();
  const status  = document.getElementById('paste-status');
  if (!rawData) { status.textContent='Paste something first!'; return; }
  const csv = rawData.split('\n').map(line =>
    line.split('\t').map(cell=>`"${cell.replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  parseSheetCSV(csv);
}

function parseSheetCSV(csv) {
  const status = document.getElementById('paste-status');
  try {
    const lines   = csv.split('\n').map(l=>parseCSVLine(l));
    const dateRow = lines.find(l=>l.some(c=>/^\d{2}\/\d{2}$/.test(c.trim())));
    if (!dateRow) throw new Error('No DD/MM date headers found.');
    const pureDates=[];
    dateRow.forEach((cell,i)=>{ if(i>=4&&/^\d{2}\/\d{2}$/.test(cell.trim())) pureDates.push({date:cell.trim(),index:i}); });
    importedUsers=[];
    lines.forEach(row=>{
      const id0=row[0]?.trim()||'';
      if (!id0||isNaN(parseInt(id0))||id0.includes('/')) return;
      const username=row[3]?.trim()||'';
      const si=DB.getStaffInfo(username)||{};
      const schedule={};
      pureDates.forEach(item=>{ schedule[item.date]=row[item.index]?.trim()||'0'; });
      importedUsers.push({ id:Date.now()+importedUsers.length, team:row[1]?.trim()||'', name:row[2]?.trim()||'', username, role:si.role||row[4]?.trim()||'', gender:si.gender||'M', empNo:si.empNo||'', dob:si.dob||'', password:'1234', schedule });
    });
    if(status) status.innerHTML=`<span style="color:var(--ok)">✓ Parsed ${importedUsers.length} staff (${pureDates.length} dates).</span>`;
    renderScheduleImportPreview(pureDates);
  } catch(e) {
    if(status) status.innerHTML=`<span style="color:var(--err)">Error: ${e.message}</span>`;
  }
}

function renderScheduleImportPreview(pureDates) {
  const container=document.getElementById('sched-preview-list');
  if(!container) return;
  document.getElementById('sched-preview-section').style.display='block';
  document.getElementById('sched-preview-count').textContent=importedUsers.length;
  const gl=`grid-template-columns:60px 200px 120px 100px 1fr;`;
  container.innerHTML=`
  <div style="display:grid;${gl}gap:12px;padding:10px 16px;background:var(--bg3);font-size:10px;font-weight:700;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20;">
    <div>GROUP</div><div>NAME</div><div>USER</div><div>ROLE</div>
    <div style="display:flex;gap:5px;overflow-x:auto;">${pureDates.map(d=>`<div style="min-width:30px;text-align:center;"><div style="color:var(--accent)">${d.date}</div><div style="opacity:.5;font-size:8px;">${getWkDay(d.date)}</div></div>`).join('')}</div>
  </div>
  ${importedUsers.map(u=>`<div style="display:grid;${gl}gap:12px;padding:8px 16px;border-bottom:1px solid var(--border);align-items:center;">
    <div style="font-size:10px;color:var(--text3)">${u.team}</div>
    <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name}</div>
    <div style="font-size:11px;color:var(--accent)">${u.username}</div>
    <div style="font-size:11px;color:var(--text2)">${u.role}</div>
    <div style="display:flex;gap:4px;overflow-x:auto;">${pureDates.map(d=>{const s=u.schedule[d.date]||'0';return`<span class="sh sh-${s}" style="min-width:26px;height:18px;font-size:9px;flex-shrink:0;">${s==='0'?'—':s}</span>`}).join('')}</div>
  </div>`).join('')}`;
}

function confirmScheduleImport() {
  const merged=importedUsers.map((u,i)=>({...u,id:Date.now()+i}));
  state.users=[...SEED_USERS,...merged];
  save(); buildDatalist();
  document.getElementById('sched-preview-section').style.display='none';
  document.getElementById('paste-area').value='';
  document.getElementById('paste-status').innerHTML=`<span style="color:var(--ok)">✓ ${merged.length} schedules imported.</span>`;
  toast(`${merged.length} schedules loaded!`,'ok');
  nav('staff');
}

function factoryReset() {
  if(confirm('This will permanently erase ALL data. Are you sure?')){
    localStorage.removeItem(STORAGE); window.location.reload();
  }
}
