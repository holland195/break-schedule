// ═══════════════════════════════════════════════
//  CLOUD SYNC — Firebase Realtime Database
//
//  WHY FIREBASE: No rate limits, 1GB free storage,
//  10GB/month transfer, simple REST API.
//
//  HOW IT WORKS:
//
//  1. Admin sets up once:
//     a. Go to console.firebase.google.com → Add project
//     b. Build → Realtime Database → Create database
//        → Start in TEST MODE (we secure it with a secret rule)
//     c. Copy the Database URL (looks like:
//        https://your-project-default-rtdb.firebaseio.com)
//     d. Go to Project Settings → Service Accounts →
//        Database secrets → Show → copy the secret
//     e. Login as admin → Cloud Sync page → paste both → Connect
//     f. Update sync-config.json in GitHub repo → push → done
//
//  2. sync-config.json (in repo root):
//     { "dbUrl": "https://xxx.firebaseio.com", "apiKey": "your-secret" }
//
//  3. Every browser:
//     a. Fetches sync-config.json → gets dbUrl + apiKey
//     b. Reads Firebase → pulls latest data
//     c. Writes use auth=apiKey query param
//     d. No rate limits. No size limits.
//
//  SECURITY:
//  • Database rules restrict write to requests with auth secret
//  • sync-config.json is in your PRIVATE GitHub repo
//  • apiKey is the database secret (not Firebase API key)
// ═══════════════════════════════════════════════

const SYNC_CFG_KEY = 'bsched_sync_cfg';

let syncCfg = (() => {
  try { return JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || {}; } catch(e) { return {}; }
})();

function syncSaveCfg(cfg) {
  syncCfg = cfg;
  localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(cfg));
}

function syncEnabled() {
  return !!(syncCfg.dbUrl && syncCfg.apiKey);
}

// ── Load sync-config.json (always fresh — never use stale localStorage) ──
let _cachedDbUrl = null;

async function loadSyncConfig() {
  try {
    const res = await fetch('./sync-config.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    const dbUrl = (cfg.dbUrl || '').replace(/\/$/, ''); // strip trailing slash
    if (!dbUrl) return null;
    syncSaveCfg({
      dbUrl:  dbUrl,
      apiKey: cfg.apiKey || syncCfg.apiKey || '',
    });
    _cachedDbUrl = dbUrl;
    console.log('[sync] config loaded from sync-config.json, dbUrl:', dbUrl);
    return { dbUrl, apiKey: cfg.apiKey };
  } catch(e) {
    console.warn('[sync] sync-config.json error:', e.message);
    return null;
  }
}

async function discoverDbUrl() {
  if (_cachedDbUrl) return _cachedDbUrl;
  if (syncCfg.dbUrl) { _cachedDbUrl = syncCfg.dbUrl; return _cachedDbUrl; }
  const cfg = await loadSyncConfig();
  return cfg ? cfg.dbUrl : null;
}

// ── Firebase REST helpers ──
// Firebase REST: GET  /path.json?auth=SECRET  → read
//                PUT  /path.json?auth=SECRET  → write (replace)
const FB_PATH = '/bsched.json';

function _fbUrl(dbUrl, secret) {
  return `${dbUrl}${FB_PATH}${secret ? '?auth=' + encodeURIComponent(secret) : ''}`;
}

async function _fbGet(dbUrl, secret) {
  const res = await fetch(_fbUrl(dbUrl, secret), { cache: 'no-store' });
  if (res.status === 401 || res.status === 403) throw new Error('HTTP ' + res.status);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const wrapper = await res.json();
  // Data is stored as a JSON string under key "data" to avoid Firebase
  // key restrictions (no . # $ [ ] / allowed in key names).
  // Payload keys like "cuong.pham" or "28/04" live safely inside the string.
  if (!wrapper || !wrapper.data) return {};
  return JSON.parse(wrapper.data);
}

async function _fbPut(dbUrl, secret, data) {
  if (!secret) throw new Error('No API key — cannot write');
  const res = await fetch(_fbUrl(dbUrl, secret), {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + msg);
  }
  return true;
}

// ── Pull ──
async function syncPublicPull() {
  const dbUrl = await discoverDbUrl();
  if (!dbUrl) return false;
  try {
    const remote = await _fbGet(dbUrl, syncCfg.apiKey || null);
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    if (e.message.includes('401') || e.message.includes('403')) {
      _cachedDbUrl = null;
      syncSaveCfg({ ...syncCfg, dbUrl: null });
      return 'stale';
    }
    return false;
  }
}

async function syncPull() {
  if (!syncEnabled()) return syncPublicPull();
  try {
    const remote = await _fbGet(syncCfg.dbUrl, syncCfg.apiKey);
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    return false;
  }
}

// ── Apply remote data (unchanged merge logic) ──
function _applyRemoteData(remote) {
  if (!remote || typeof remote !== 'object') return;

  if (remote.breaks) {
    const localBAt    = state._breaksUpdatedAt  || 0;
    const remoteBAt   = remote._breaksUpdatedAt || 0;
    const localIsEmpty = Object.keys(state.breaks).length === 0;

    if (localIsEmpty) {
      state.breaks = remote.breaks;
    } else if (remoteBAt > localBAt) {
      state.breaks = remote.breaks;
    } else if (localBAt > remoteBAt) {
      // local wins — do nothing
    } else {
      Object.entries(remote.breaks).forEach(([key, remoteEntry]) => {
        const localEntry = state.breaks[key];
        if (!localEntry) {
          state.breaks[key] = remoteEntry;
        } else {
          if ((remoteEntry.at || 0) > (localEntry.at || 0)) {
            state.breaks[key] = remoteEntry;
          }
        }
      });
    }
  }
  if (remote.breaks && remote._breaksUpdatedAt) {
    if ((remote._breaksUpdatedAt || 0) > (state._breaksUpdatedAt || 0)) {
      state._breaksUpdatedAt = remote._breaksUpdatedAt;
    }
  }
  if (remote.requests)  state.requests  = remote.requests;
  if (remote.extBreaks) state.extBreaks = remote.extBreaks;
  if (remote.users && remote.users.length > 0) {
    const localUAt  = state._usersUpdatedAt  || 0;
    const remoteUAt = remote._usersUpdatedAt || 0;
    if (state.users.length === 0) {
      state.users = remote.users;
      state._usersUpdatedAt = remoteUAt;
      if (typeof activeMonday !== 'undefined') {
        const now = new Date(); const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(now.getFullYear(), now.getMonth(), diff);
        activeMonday = `${mon.getDate().toString().padStart(2,'0')}/${(mon.getMonth()+1).toString().padStart(2,'0')}`;
      }
    } else if (remoteUAt > localUAt) {
      state.users = remote.users;
      state._usersUpdatedAt = remoteUAt;
    }
  }
  if (remote.attendance) {
    // Merge attendance — remote wins per entry if newer
    Object.entries(remote.attendance).forEach(([key, remoteEntry]) => {
      const localEntry = state.attendance[key];
      if (!localEntry || (remoteEntry.at || 0) >= (localEntry.at || 0)) {
        state.attendance[key] = remoteEntry;
      }
    });
  }
  if (remote.staffPasswords) {
    Object.entries(remote.staffPasswords).forEach(([uname, p]) => {
      if (!state.staffInfo[uname]) {
        state.staffInfo[uname] = { name: uname, role: '', gender: '', empNo: '', dob: '' };
      }
      state.staffInfo[uname].password           = p.password;
      state.staffInfo[uname].mustChangePassword  = p.mustChangePassword;
    });
  }
}

// ── Push to Firebase ──
async function syncPush() {
  if (!syncEnabled()) return false;
  try {
    const staffPasswords = {};
    Object.entries(state.staffInfo || {}).forEach(([uname, si]) => {
      staffPasswords[uname] = {
        password:           si.password           ?? '1234',
        mustChangePassword: si.mustChangePassword ?? true,
      };
    });
    // Include full schedule — Firebase has no size limits
    const usersCompact = state.users.map(u => ({
      id: u.id, username: u.username, name: u.name,
      team: u.team, role: u.role, gender: u.gender || '',
      schedule: u.schedule || {},
    }));
    const payload = {
      breaks:           state.breaks,
      requests:         state.requests,
      extBreaks:        state.extBreaks,
      attendance:       state.attendance || {},
      users:            usersCompact,
      staffPasswords,
      _updated:         Date.now(),
      _breaksUpdatedAt: state._breaksUpdatedAt || Date.now(),
      _usersUpdatedAt:  state._usersUpdatedAt  || 0,
    };
    const kb = (JSON.stringify(payload).length / 1024).toFixed(1);
    console.log(`[sync] push payload: ${kb}kb`);
    // Wrap entire payload as a JSON string — avoids Firebase key restrictions
    // (Firebase forbids . # $ [ ] / in keys; our data has all of these)
    await _fbPut(syncCfg.dbUrl, syncCfg.apiKey, { data: JSON.stringify(payload) });
    return true;
  } catch(e) {
    console.warn('[sync] push failed:', e.message);
    if (e.message.includes('401') || e.message.includes('403')) {
      if (typeof toast === 'function') toast('☁ Sync auth failed. Go to Cloud Sync → Reconnect.', 'err');
    }
    updateSyncBadge('err');
    return false;
  }
}

async function saveAndSync() {
  save();
  if (syncEnabled()) await syncPush();
}
async function syncWrite() {
  updateSyncBadge('busy');
  await saveAndSync();
  updateSyncBadge(syncEnabled() ? 'ok' : 'err');
}

// ── Boot ──
async function syncTryAutoConnect() {
  await loadSyncConfig();
  if (syncEnabled()) {
    const ok = await syncPull();
    return ok ? true : 'error';
  } else if (syncCfg.dbUrl) {
    return await syncPublicPull();
  }
  return false;
}

// ── Poll every 2 minutes ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  _syncInterval = setInterval(async () => {
    const noRerenderPages = new Set(['arrange', 'staff']);
    if (!syncCfg.dbUrl && !_cachedDbUrl) {
      stopSyncPolling();
      updateSyncBadge('err');
      return;
    }
    const ok = syncEnabled() ? await syncPull() : await syncPublicPull();
    if (ok && typeof currentPage !== 'undefined' && !noRerenderPages.has(currentPage)) {
      nav(currentPage);
      updateBadge();
    }
    updateSyncBadge(ok ? 'ok' : 'err');
  }, 2 * 60 * 1000); // 2 minutes — Firebase has no rate limits
}
function stopSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  _syncInterval = null;
}

function updateSyncBadge(status) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  if (!syncCfg.dbUrl && !_cachedDbUrl) { el.style.display = 'none'; return; }
  el.style.display = '';
  const map = {
    ok:   ['☁ Synced',   'var(--ok)'],
    err:  ['☁ Offline',  'var(--warn)'],
    busy: ['☁ Syncing…', 'var(--text3)'],
  };
  const [txt, col] = map[status] || map.err;
  el.textContent = txt; el.style.color = col;
}

// ═══════════════════════════════════════════════
//  SYNC SETTINGS PAGE — admin only
// ═══════════════════════════════════════════════
function renderSyncSettings() {
  if (!isAdmin(currentUser)) return '<div class="empty">Access denied.</div>';
  const enabled = syncEnabled();
  const dbUrl   = syncCfg.dbUrl || _cachedDbUrl || '';

  return `
<div class="page-header">
  <div>
    <div class="page-title">☁ Cloud Sync</div>
    <div class="page-sub">One-time admin setup — all users sync automatically on any browser</div>
  </div>
</div>

<!-- Status -->
<div class="card" style="max-width:620px;">
  ${enabled
    ? `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--C-bg);border:1px solid var(--C-color);border-radius:8px;font-size:12px;color:var(--C-color);">
        <span style="font-size:22px;">☁</span>
        <div><b>Sync is active.</b> Passwords, breaks and requests sync automatically.<br>
          <span style="opacity:.7;font-size:11px;">DB: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${dbUrl}</code></span>
        </div>
       </div>`
    : `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--D-bg);border:1px solid var(--D-color);border-radius:8px;font-size:12px;color:var(--D-color);">
        <span style="font-size:22px;">⚠</span>
        <div><b>Not configured.</b> Password changes won't sync across browsers until setup is complete.</div>
       </div>`}
</div>

<!-- How it works -->
<div class="card" style="max-width:620px;margin-top:0;background:var(--bg3);">
  <div class="card-title">How it works (after setup)</div>
  <div style="font-size:12px;color:var(--text2);line-height:2.1;">
    ✦ Data stored in <b>Firebase Realtime Database</b> — no rate limits, 1 GB free<br>
    ✦ <code style="background:var(--bg4);padding:1px 5px;border-radius:3px;">sync-config.json</code> in your <b>private</b> GitHub repo contains <b>dbUrl</b> and <b>apiKey</b><br>
    ✦ Every browser fetches this file at page load → syncs automatically<br>
    ✦ <b>Safe because the repo is private</b> — only team members with repo access can see the key
  </div>
</div>

<!-- Setup steps -->
<div class="card" style="max-width:620px;margin-top:0;">
  <div class="card-title">🔑 Admin Setup — 2 steps, done once</div>

  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:12px;line-height:2.2;">
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 1 — Create Firebase Project</b>
    <b>1a</b> → Go to <a href="https://console.firebase.google.com" target="_blank" style="color:var(--accent);text-decoration:underline;">console.firebase.google.com</a> → <b>Add project</b> → any name<br>
    <b>1b</b> → Left menu: <b>Build → Realtime Database → Create database</b><br>
    <b>1c</b> → Choose location → <b>Start in test mode</b> → Enable<br>
    <b>1d</b> → Copy the <b>Database URL</b> shown (e.g. <code style="background:var(--bg4);padding:1px 4px;border-radius:3px;">https://xxx-rtdb.firebaseio.com</code>)<br>
    <div style="height:8px;"></div>
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 2 — Get the Database Secret</b>
    <b>2a</b> → Project Settings (gear icon) → <b>Service accounts</b> tab<br>
    <b>2b</b> → Scroll down → <b>Database secrets</b> → click <b>Show</b> → copy the secret<br>
    <b>2c</b> → Paste both below → click <b>Connect</b><br>
    <div style="height:8px;"></div>
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 3 — Add sync-config.json to GitHub</b>
    <b>3a</b> → In your GitHub repo, update <code style="background:var(--bg4);padding:1px 6px;border-radius:3px;">sync-config.json</code> with content shown below<br>
    <b>3b</b> → Commit and push → all browsers auto-connect on next page load<br>
    <span style="color:var(--text3);font-size:11px;">✦ Keep repo <b>Private</b> — this file contains your database secret</span>
  </div>

  <div class="fg">
    <label>Firebase Database URL</label>
    <input id="sync-db-url" class="login-input" type="text"
      placeholder="https://your-project-default-rtdb.firebaseio.com (or .firebasedatabase.app)"
      value="${dbUrl}"
      style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
  </div>
  <div class="fg" style="margin-top:10px;">
    <label>Database Secret</label>
    <div style="display:flex;gap:8px;">
      <input id="sync-api-key" class="login-input" type="password"
        placeholder="your-database-secret"
        value="${syncCfg.apiKey || ''}"
        style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;">
      <button class="btn btn-sm" onclick="const i=document.getElementById('sync-api-key');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈';">👁</button>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
    <button class="btn btn-accent" onclick="saveSyncCfg()">${enabled ? '🔄 Reconnect' : '⚡ Connect'}</button>
    ${enabled ? `
    <button class="btn" onclick="forceSyncPull()">↓ Pull now</button>
    <button class="btn" onclick="forceSyncPush()">↑ Push now</button>
    <button class="btn btn-err btn-sm" onclick="clearSyncCfg()">Disconnect</button>` : ''}
  </div>
  <div id="sync-test-status" style="font-size:12px;margin-top:12px;min-height:20px;"></div>
</div>

<!-- sync-config.json content (shown after connect) -->
${dbUrl ? `
<div class="card" style="max-width:620px;margin-top:0;border-color:var(--accent);">
  <div class="card-title" style="color:var(--accent);">📄 sync-config.json — copy exact content</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.7;">
    Create or update <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">sync-config.json</code>
    in your GitHub repo root.<br>
    <b style="color:var(--warn);">⚠ Keep your repo Private — this file contains your database secret.</b>
  </div>
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ok);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <pre style="margin:0;white-space:pre-wrap;word-break:break-all;">{
  "dbUrl": "${dbUrl}",
  "apiKey": "${syncCfg.apiKey || ''}"
}</pre>
    <button class="btn btn-sm" style="flex-shrink:0;"
      onclick="navigator.clipboard.writeText(JSON.stringify({dbUrl:'${dbUrl}',apiKey:'${syncCfg.apiKey||''}'},null,2));toast('Copied! Paste into sync-config.json','ok')">Copy</button>
  </div>
  <div style="font-size:11px;color:var(--text3);margin-top:8px;">
    Commit and push to GitHub → all browsers auto-connect within 1–2 minutes.
  </div>
</div>` : ''}

<!-- Danger zone -->
<div class="card" style="max-width:620px;margin-top:0;border-color:var(--err);">
  <div class="card-title" style="color:var(--err);">⚠ Danger Zone</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    Reset this device's local data. Cloud data and sync-config.json are not affected.
    After reset, reopen the app — it will re-sync automatically from sync-config.json.
  </div>
  <button class="btn btn-err btn-sm" onclick="factoryReset()">⚠ Reset This Device</button>
</div>

${typeof renderRotationPanel === 'function' ? renderRotationPanel() : ''}`;
}

async function saveSyncCfg() {
  const dbUrl  = (document.getElementById('sync-db-url').value || '').trim().replace(/\/$/, '');
  const apiKey = (document.getElementById('sync-api-key').value || '').trim();
  const status = document.getElementById('sync-test-status');
  if (!dbUrl)  { status.innerHTML = '<span style="color:var(--err)">Paste your Firebase Database URL.</span>'; return; }
  if (!apiKey) { status.innerHTML = '<span style="color:var(--err)">Paste your Database Secret.</span>'; return; }
  if (!dbUrl.includes('firebaseio.com') && !dbUrl.includes('firebasedatabase.app')) {
    status.innerHTML = '<span style="color:var(--err)">⚠ URL should contain <code>firebaseio.com</code> or <code>firebasedatabase.app</code></span>'; return;
  }
  status.innerHTML = '<span style="color:var(--text3)">⏳ Connecting to Firebase…</span>';
  _cachedDbUrl = dbUrl;
  syncSaveCfg({ dbUrl, apiKey });
  // Test connection with a pull
  const ok = await syncPull();
  if (ok || ok === true) {
    await syncPush();
    startSyncPolling();
    updateSyncBadge('ok');
    status.innerHTML = '<span style="color:var(--ok)">✓ Connected to Firebase!</span>';
    setTimeout(() => nav('sync'), 1200);
  } else {
    syncSaveCfg({});
    status.innerHTML = '<span style="color:var(--err)">⚠ Connection failed. Check your Database URL and Secret.</span>';
  }
}

function clearSyncCfg() {
  if (!confirm('Disconnect sync on this device?')) return;
  syncSaveCfg({}); _cachedDbUrl = null; stopSyncPolling(); updateSyncBadge('err'); nav('sync');
}

async function forceSyncPull() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML = '<span style="color:var(--text3)">Pulling…</span>';
  const ok = await syncPull();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pulled latest data.</span>' : '<span style="color:var(--err)">Pull failed.</span>';
  if (ok) { nav(currentPage); updateBadge(); updateSyncBadge('ok'); }
}

async function forceSyncPush() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML = '<span style="color:var(--text3)">Pushing…</span>';
  const ok = await syncPush();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pushed.</span>' : '<span style="color:var(--err)">Push failed.</span>';
  if (ok) updateSyncBadge('ok');
}
