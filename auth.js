// ═══════════════════════════════════════════════
//  AUTH — Firebase Authentication
//
//  WHAT CHANGED FROM v1 (localStorage passwords):
//  • doLogin()           → calls Firebase signInWithEmailAndPassword()
//  • logout()            → calls Firebase signOut()
//  • restoreSession()    → replaced by onAuthStateChanged() listener
//  • submitChangePassword() → calls Firebase updatePassword()
//  • bootApp()           → just sets up UI; auth handled by onAuthStateChanged
//
//  WHAT STAYED THE SAME:
//  • enterApp(), _afterLogin(), enterApp() — zero changes
//  • _resolveUser(), _stableId()          — zero changes
//  • autoDetectShift(), toggleTheme()     — zero changes
//  • Excel import, all other functions    — zero changes
//
//  USERNAME → EMAIL mapping:
//  Firebase Auth uses real company email addresses.
//  We map:  cuong.pham  →  cuong.pham@discoveryloft.com
//  Staff can use "Forgot Password" to reset via their real inbox.
// ═══════════════════════════════════════════════

const AUTH_DOMAIN = '@discoveryloft.com'; // company email domain

function _toEmail(username) {
  return username.trim().toLowerCase() + AUTH_DOMAIN;
}

// ── Resolve user object from username (unchanged) ──
function _resolveUser(username) {
  if (!username) return null;
  const fromSchedule = state.users.find(u => u.username === username);
  if (fromSchedule) return fromSchedule;
  const si = DB.getStaffInfo(username);
  if (!si || !si.name) return null;
  return { id: _stableId(username), username, name: si.name, role: si.role || 'Agent', gender: si.gender || '', team: '', schedule: {} };
}

function _stableId(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (Math.imul(31, h) + username.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────
function autoDetectShift() {
  const input = document.getElementById('li-user').value.trim();
  const user  = state.users.find(x => x.username === input);
  if (user) {
    const sch = user.schedule[todayKey()];
    if (sch && sch !== '0') document.getElementById('li-shift').value = sch;
  }
}

async function doLogin() {
  const u   = document.getElementById('li-user').value.trim();
  const p   = document.getElementById('li-pass').value.trim();
  const s   = document.getElementById('li-shift').value;
  const err = document.getElementById('login-err');
  const btn = document.getElementById('signin-btn');

  if (!u || !p) { err.textContent = 'Enter username and password.'; return; }

  err.style.color  = 'var(--text3)';
  err.textContent  = '☁ Signing in…';
  btn.disabled     = true;

  try {
    // ── Firebase Auth: verify credentials on Google's servers ──
    // Legacy mapping: staff who haven't changed password yet still type "1234"
    // but Firebase account was created with "Pave@1234" (Firebase rejects weak passwords)
    const firebasePassword = (p === '1234') ? 'Pave@1234' : p;
    const credential = await firebaseSignIn(_toEmail(u), firebasePassword);
    const firebaseUid = credential.user.uid;

    // Resolve staff profile from local/cloud data
    const si   = DB.getStaffInfo(u);
    const user = _resolveUser(u);

    if (!user) {
      err.style.color = '';
      err.textContent = 'Username not found in staff data. Ask admin to import staff.';
      btn.disabled = false;
      return;
    }

    const isAdminUser = (ROLES[user.role]?.level || 0) >= 3;
    if (!isAdminUser && !s) {
      err.style.color = '';
      err.textContent = 'Please select your current shift.';
      btn.disabled = false;
      return;
    }

    currentUser  = user;
    currentShift = s || 'E';
    err.textContent = '';

    // Check first-login password change requirement
    if (DB.mustChangePw(u)) {
      btn.disabled = false;
      _showChangePwPrompt(u);
      return;
    }

    DB.saveSession({ username: u, userId: user.id, shift: currentShift });
    btn.disabled = false;
    _afterLogin();

  } catch (e) {
    btn.disabled    = false;
    err.style.color = '';
    // Firebase error codes
    if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' ||
        e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      err.textContent = 'Incorrect username or password.';
    } else if (e.code === 'auth/too-many-requests') {
      err.textContent = 'Too many failed attempts. Try again later.';
    } else if (e.code === 'auth/network-request-failed') {
      err.textContent = 'Network error. Check your connection.';
    } else {
      err.textContent = 'Sign in failed: ' + (e.message || e.code || 'unknown error');
      console.warn('[auth] Firebase sign-in error:', e);
    }
  }
}

// ─────────────────────────────────────────────
//  FIRST-LOGIN PASSWORD CHANGE
// ─────────────────────────────────────────────
function _showChangePwPrompt(username) {
  document.getElementById('login-view').style.display    = 'none';
  document.getElementById('changepw-view').style.display = '';
  document.getElementById('login-err').textContent       = '';
  document.getElementById('chpw-username').textContent   = username;
  document.getElementById('chpw-err').textContent        = '';
  document.getElementById('chpw-new').value              = '';
  document.getElementById('chpw-confirm').value          = '';
  setTimeout(() => document.getElementById('chpw-new').focus(), 50);
}

async function submitChangePassword() {
  const username = document.getElementById('chpw-username').textContent;
  const np1      = document.getElementById('chpw-new').value.trim();
  const np2      = document.getElementById('chpw-confirm').value.trim();
  const err      = document.getElementById('chpw-err');

  if (np1.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  if (np1 !== np2)    { err.textContent = 'Passwords do not match.'; return; }
  if (np1 === '1234' || np1 === 'Pave@1234') { err.textContent = 'Please choose a personal password.'; return; }

  err.style.color = 'var(--text3)';
  err.textContent = '☁ Updating password…';

  try {
    // ── Update password in Firebase Auth ──
    await firebaseUpdatePassword(np1);

    // Mark as changed in local/cloud state (for mustChangePw flag)
    DB.setPassword(username, np1);
    DB.saveSession({ username, userId: currentUser.id, shift: currentShift });

    document.getElementById('changepw-view').style.display = 'none';
    document.getElementById('login-view').style.display    = '';
    toast('Password updated! Welcome 👋', 'ok');

    // Push new flag to cloud so other devices know password is set
    if (typeof syncWrite === 'function') syncWrite();
    _afterLogin();

  } catch (e) {
    err.style.color = '';
    if (e.code === 'auth/requires-recent-login') {
      err.textContent = 'Session expired. Please sign in again to change password.';
    } else {
      err.textContent = 'Failed to update password: ' + (e.message || e.code);
      console.warn('[auth] updatePassword error:', e);
    }
  }
}

function cancelChangePassword() {
  currentUser = null;
  firebaseSignOut(); // sign out of Firebase too
  document.getElementById('changepw-view').style.display = 'none';
  document.getElementById('login-view').style.display    = '';
  document.getElementById('login-err').textContent       = '';
}

// ─────────────────────────────────────────────
//  POST-LOGIN FLOW (unchanged)
// ─────────────────────────────────────────────
async function _afterLogin() {
  if (!syncEnabled()) await syncTryAutoConnect();
  if (syncEnabled()) {
    updateSyncBadge('busy');
    await syncPull();
    updateSyncBadge('ok');
  }
  enterApp(false);
  startSyncPolling && startSyncPolling();
}

function enterApp(fromSession) {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  document.body.classList.add('app-active');
  document.body.classList.remove('login-active');

  const ri = getRoleInfo(currentUser.role);
  document.getElementById('top-avatar').textContent   = currentUser.name.charAt(0);
  document.getElementById('top-name').textContent     = currentUser.name.split(' ').slice(-1)[0];
  document.getElementById('top-role-tag').textContent = ri.label;
  document.getElementById('top-role-tag').className   = 'role-tag ' + ri.tag;

  const si     = DB.getStaffInfo(currentUser.username);
  const gender = si?.gender || currentUser.gender || '';
  const tg     = document.getElementById('top-gender');
  if (tg) {
    tg.textContent  = gender === 'F' ? '♀' : gender === 'M' ? '♂' : '';
    tg.style.color  = gender === 'F' ? 'var(--A-color)' : 'var(--B-color)';
    tg.style.display = gender ? '' : 'none';
  }

  document.querySelectorAll('.leader-only').forEach(el => el.style.display = isLeader(currentUser) ? 'flex' : 'none');
  document.querySelectorAll('.arrange-nav').forEach(el => el.style.display = (isLeader(currentUser) && !isTraining(currentUser)) ? 'flex' : 'none');
  document.querySelectorAll('.admin-only').forEach(el => el.style.display  = isAdmin(currentUser) ? 'flex' : 'none');

  buildDatalist();
  document.getElementById('sidebar-shift').value = currentShift;

  if (typeof updateSyncBadge === 'function') updateSyncBadge(typeof syncEnabled === 'function' && syncEnabled() ? 'ok' : 'err');
  if (fromSession && typeof syncEnabled === 'function' && syncEnabled()) {
    syncPull().then(ok => { if (ok) nav(currentPage); updateSyncBadge(ok ? 'ok' : 'err'); });
    if (typeof startSyncPolling === 'function') startSyncPolling();
  }
  nav('dashboard');
  updateBadge();
}

// ─────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────
async function logout() {
  DB.clearSession();
  if (typeof stopSyncPolling === 'function') stopSyncPolling();
  currentUser = null;

  try {
    await firebaseSignOut(); // sign out from Firebase Auth
  } catch (e) {
    console.warn('[auth] signOut error:', e);
  }

  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  document.body.classList.remove('app-active');
  document.body.classList.add('login-active');
}

// ─────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────
function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = currentTheme === 'dark' ? '☀ Light' : '☾ Dark';
}

// ═══════════════════════════════════════════════
//  EXCEL IMPORT (Staff Info) — unchanged
// ═══════════════════════════════════════════════
function importExcelStaffInfo() {
  const fileInput = document.getElementById('excel-file-input');
  if (!fileInput?.files?.[0]) { toast('Select an Excel file first.', 'err'); return; }
  const status = document.getElementById('excel-import-status');
  status.innerHTML = '<span style="color:var(--text2)"><span class="spin" style="display:inline-block;width:12px;height:12px;border-width:2px;vertical-align:middle;margin-right:6px"></span>Reading…</span>';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (typeof XLSX === 'undefined') { status.innerHTML = '<span style="color:var(--err)">SheetJS not loaded.</span>'; return; }
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let hi = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('name')));
      if (hi < 0) hi = 0;
      const headers = rows[hi].map(h => String(h).toLowerCase().replace(/[\s\n]/g, ''));
      const col = k => headers.findIndex(h => h.includes(k));
      const iName = col('name'), iUser = col('username'), iGender = col('gender');
      const iDob  = col('birth') >= 0 ? col('birth') : col('dob');
      const iRole = col('position') >= 0 ? col('position') : col('role');
      const iEmp  = col('employee') >= 0 ? col('employee') : col('empno');
      let imported = 0;
      rows.slice(hi + 1).forEach(row => {
        const username = String(row[iUser] || '').trim();
        const name     = String(row[iName] || '').trim();
        if (!username || !name) return;
        const gRaw   = String(row[iGender] || '').toLowerCase();
        const gender  = gRaw.startsWith('f') ? 'F' : gRaw.startsWith('m') ? 'M' : '';
        const existing = DB.getStaffInfo(username) || {};
        DB.setStaffInfo(username, {
          empNo:              String(row[iEmp] || existing.empNo || '').trim(),
          name,
          gender,
          dob:                String(row[iDob] || existing.dob || '').trim(),
          role:               String(row[iRole] || existing.role || '').trim(),
          password:           existing.password || '1234',
          mustChangePassword: existing.mustChangePassword ?? true,
        });
        imported++;
      });
      status.innerHTML = `<span style="color:var(--ok)">✓ Imported ${imported} staff records.</span>`;
      if (typeof syncWrite === 'function') syncWrite();
    } catch (ex) {
      status.innerHTML = `<span style="color:var(--err)">Error: ${ex.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
}
