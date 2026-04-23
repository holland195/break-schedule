// ═══════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════

function setLoginMode(m) {
  const forms = {
    'login-form': m === 'login',
    'import-form': m === 'import',
    'paste-form': m === 'paste'
  };
  const buttons = {
    'tab-login-btn':  m === 'login',
    'tab-import-btn': m === 'import',
    'tab-paste-btn':  m === 'paste'
  };
  Object.keys(forms).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = forms[id] ? 'block' : 'none';
  });
  Object.keys(buttons).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = 'btn' + (buttons[id] ? ' btn-accent' : '');
  });
}

function autoDetectShift() {
  const input = document.getElementById('li-user').value.trim();
  const user  = state.users.find(x => x.username === input);
  if (user) {
    const today     = todayKey();
    const scheduled = user.schedule[today];
    if (scheduled && scheduled !== '0') {
      document.getElementById('li-shift').value = scheduled;
    }
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
  enterApp();
}

function demoLogin(type) {
  if (type === 'leader') {
    currentUser  = state.users.find(x => x.role === 'Agent Leader') || state.users[0];
    currentShift = 'E';
  } else {
    currentUser  = state.users.find(x => x.role === 'Agent') || state.users[0];
    currentShift = 'E';
  }
  enterApp();
}

function enterApp() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');

  const ri = getRoleInfo(currentUser.role);
  document.getElementById('top-avatar').textContent   = currentUser.name.charAt(0);
  document.getElementById('top-name').textContent     = currentUser.name.split(' ').slice(-1)[0];
  document.getElementById('top-role-tag').textContent = ri.label;
  document.getElementById('top-role-tag').className   = 'role-tag ' + ri.tag;

  document.querySelectorAll('.leader-only').forEach(el =>
    el.style.display = isLeader(currentUser) ? 'flex' : 'none'
  );
  buildDatalist();
  document.getElementById('sidebar-shift').value = currentShift;
  nav('dashboard');
  updateBadge();
}

function logout() {
  currentUser = null;
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
}

// ═══════════════════════════════════════════════
//  IMPORT FROM GOOGLE SHEETS
// ═══════════════════════════════════════════════

function importSheet() {
  const id = document.getElementById('sheet-id').value.trim();
  if (!id) { document.getElementById('import-status').textContent = 'Enter a sheet ID.'; return; }
  const status = document.getElementById('import-status');
  status.innerHTML = '<span style="color:var(--text2)"><span class="spin" style="display:inline-block;width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:6px"></span>Fetching sheet...</span>';
  document.getElementById('import-preview').style.display = 'none';

  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=Schedule%20April_26`;
  fetch(url)
    .then(r => { if (!r.ok) throw new Error('Sheet not accessible (make sure it is shared publicly).'); return r.text(); })
    .then(csv => parseSheetCSV(csv))
    .catch(err => { status.innerHTML = `<span style="color:var(--err)">⚠ ${err.message}</span>`; });
}

function importFromPaste() {
  const rawData = document.getElementById('paste-area').value.trim();
  const status  = document.getElementById('paste-status');
  if (!rawData) { status.textContent = 'Paste something first!'; return; }

  const simulatedCSV = rawData.split('\n').map(line =>
    line.split('\t').map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  parseSheetCSV(simulatedCSV);
  document.getElementById('import-preview').style.display = 'block';
  status.innerHTML = `<span style="color:var(--ok)">✓ Paste parsed! Preview below.</span>`;
}

function parseSheetCSV(csv) {
  const status = document.getElementById('import-status');
  try {
    const lines   = csv.split('\n').map(l => parseCSVLine(l));
    const dateRow = lines.find(l => l.some(c => /^\d{2}\/\d{2}$/.test(c.trim())));
    if (!dateRow) throw new Error("Could not find date headers.");

    const pureDates = [];
    dateRow.forEach((cell, i) => {
      if (i >= 6 && /^\d{2}\/\d{2}$/.test(cell.trim())) pureDates.push({ date: cell.trim(), index: i });
    });

    importedUsers = [];
    lines.forEach(row => {
      const idCell = row[0]?.trim() || '';
      if (!idCell || isNaN(parseInt(idCell)) || idCell.includes('/')) return;
      const schedule = {};
      pureDates.forEach(item => { schedule[item.date] = row[item.index]?.trim() || '0'; });
      importedUsers.push({
        id: Date.now() + importedUsers.length,
        team: row[1]?.trim(), name: row[2]?.trim(), username: row[3]?.trim(),
        role: row[4]?.trim(), gender: row[5]?.trim() || '', password: '1234', schedule
      });
    });

    status.innerHTML = `<span style="color:var(--ok)">✓ Parsed ${importedUsers.length} staff members (Range: ${pureDates[0].date} to ${pureDates[pureDates.length - 1].date})</span>`;
    renderImportPreview();
  } catch (e) {
    status.innerHTML = `<span style="color:var(--err)">Parse error: ${e.message}</span>`;
  }
}

function renderImportPreview() {
  const container   = document.getElementById('preview-list');
  const previewCount= document.getElementById('preview-count');
  const allDates    = Object.keys(importedUsers[0]?.schedule || {});
  previewCount.textContent = importedUsers.length;
  document.getElementById('import-preview').style.display = 'flex';

  const gridLayout = "grid-template-columns: 60px 200px 150px 100px 1fr;";
  const headerHtml = `
    <div style="display:grid; ${gridLayout} gap:12px; padding:12px 20px; background:var(--bg3); font-weight:700; font-size:10px; position:sticky; top:0; z-index:20; border-bottom:1px solid var(--border);">
      <div>GROUP</div><div>FULL NAME</div><div>USER</div><div>POSITION</div>
      <div style="display:flex; gap:6px; overflow-x: auto;">
        ${allDates.map(d => `
          <div style="min-width:32px; text-align:center; line-height:1.2;">
            <div style="color:var(--accent)">${d}</div>
            <div style="opacity:0.5; font-size:8px; font-weight:400;">${getWkDay(d)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  const rowsHtml = importedUsers.map(u => `
    <div style="display:grid; ${gridLayout} gap:12px; padding:10px 20px; border-bottom:1px solid var(--border); align-items:center;">
      <div class="mono" style="font-size:10px; color:var(--text3)">${u.team}</div>
      <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</div>
      <div class="mono" style="font-size:10px; color:var(--accent)">${u.username}</div>
      <div style="font-size:11px; color:var(--text2)">${u.role}</div>
      <div style="display:flex; gap:6px; overflow-x: auto;">
        ${allDates.map(d => {
          const s = u.schedule[d];
          return `<span class="sh sh-${s}" style="min-width:32px; height:20px; font-size:9px; flex-shrink:0;">${s === '0' ? '—' : s}</span>`;
        }).join('')}
      </div>
    </div>`).join('');

  container.innerHTML = headerHtml + rowsHtml;
}

function confirmImport() {
  state.users    = [...importedUsers, ...SEED_USERS];
  state.imported = true;
  state.breaks   = {};
  state.requests = [];
  save();
  buildDatalist();

  const status = document.getElementById('import-status') || document.getElementById('paste-status');
  if (status) status.innerHTML = `<span style="color:var(--ok)">✓ ${importedUsers.length} staff imported.</span>`;

  document.getElementById('import-preview').style.display = 'none';
  setTimeout(() => setLoginMode('login'), 1500);
  renderPage('staff');
}

function factoryReset() {
  if (confirm("This will permanently erase ALL staff, breaks, and requests. Are you sure?")) {
    localStorage.removeItem(STORAGE);
    window.location.reload();
  }
}

function openImportPanel() {
  document.getElementById('staff-import-panel').innerHTML = `
    <div class="card" style="margin-top:16px">
      <div class="card-title">Re-import from Google Sheets</div>
      <div class="fg"><label>Sheet ID</label>
        <div style="display:flex;gap:8px">
          <input id="staff-sheet-id" class="login-input" value="19YqrS2ls7V74bJMQNjWavXTYEeRiMZDptbA_vKK2aPs" style="flex:1">
          <button class="btn btn-accent" onclick="reimportStaff()">Import</button>
        </div>
      </div>
      <div id="reimport-status" style="font-size:12px;min-height:18px;margin-top:6px"></div>
    </div>`;
}

function reimportStaff() {
  const id  = document.getElementById('staff-sheet-id').value.trim();
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=Schedule%20April_26`;
  document.getElementById('reimport-status').innerHTML = '<span style="color:var(--text2)">Fetching...</span>';
  fetch(url)
    .then(r => { if (!r.ok) throw new Error('Not accessible'); return r.text(); })
    .then(csv => { parseSheetCSV(csv); confirmImport(); document.getElementById('reimport-status').innerHTML = '<span style="color:var(--ok)">✓ Reimported!</span>'; nav('staff'); })
    .catch(e  => { document.getElementById('reimport-status').innerHTML = `<span style="color:var(--err)">${e.message}</span>`; });
}
