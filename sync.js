// ═══════════════════════════════════════════════
//  CLOUD SYNC — GitHub Gist + sync-config.json
//
//  WHY GIST: JSONBin free tier is limited to 100kb per record.
//  GitHub Gist has no meaningful size limit and is free forever.
//
//  HOW IT WORKS:
//
//  1. Admin sets up once:
//     a. Go to github.com → Settings → Developer settings
//        → Personal access tokens → Tokens (classic) → Generate new token
//     b. Scopes needed: ✅ gist  (nothing else required)
//     c. Copy the token (starts with ghp_ or github_pat_)
//     d. Login as admin → Cloud Sync page → paste token → click Connect
//     e. App creates a secret Gist → shows the Gist ID
//     f. Update sync-config.json in your GitHub repo with gistId + token
//     g. Push → done forever
//
//  2. sync-config.json (in repo root, same folder as index.html):
//     { "gistId": "abc123...", "apiKey": "ghp_..." }
//
//  3. Every browser on every device:
//     a. Fetches ./sync-config.json → gets gistId + token
//     b. Reads the Gist → pulls latest passwords/breaks/requests
//     c. Login form unlocks → user logs in with real password
//     d. Done. No manual key entry. No admin visits.
//
//  SECURITY:
//  • Gist is SECRET (not public) — only accessible with the token
//  • sync-config.json is in your PRIVATE GitHub repo — safe
//  • Token scope is gist-only — cannot access code or other repos
// ═══════════════════════════════════════════════

const SYNC_CFG_KEY = 'bsched_sync_cfg';

let syncCfg = (() => {
  try { return JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || {}; } catch(e) { return {}; }
})();

function syncSaveCfg(cfg) {
  syncCfg = cfg;
  localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(cfg));
}

// syncEnabled = we have both a gistId and a token to read/write
function syncEnabled() {
  return !!(syncCfg.gistId && syncCfg.apiKey);
}

// ── Load sync-config.json from GitHub Pages (same origin, no CORS) ──
let _cachedGistId = null;

async function loadSyncConfig() {
  try {
    const res = await fetch('./sync-config.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    // Support both new (gistId) and legacy (binId) field names
    const gistId = cfg.gistId || cfg.binId || null;
    if (!gistId) return null;
    syncSaveCfg({
      gistId:  gistId,
      apiKey:  cfg.apiKey || syncCfg.apiKey || '',
    });
    _cachedGistId = gistId;
    console.log('[sync] config loaded from sync-config.json, gistId:', gistId);
    return { gistId, apiKey: cfg.apiKey };
  } catch(e) {
    console.warn('[sync] sync-config.json error:', e.message);
    return null;
  }
}

async function discoverGistId() {
  if (_cachedGistId) return _cachedGistId;
  if (syncCfg.gistId) { _cachedGistId = syncCfg.gistId; return _cachedGistId; }
  const cfg = await loadSyncConfig();
  return cfg ? cfg.gistId : null;
}

// ── GitHub Gist API helpers ──
const GIST_FILENAME = 'bsched-data.json';
const GIST_API      = 'https://api.github.com/gists';

async function _gistGet(gistId, token) {
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${GIST_API}/${gistId}`, { cache: 'no-store', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const raw  = json.files?.[GIST_FILENAME]?.content;
  if (!raw) throw new Error('Gist file not found');
  return JSON.parse(raw);
}

async function _gistPut(gistId, token, data) {
  const body = JSON.stringify({
    files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } }
  });
  const res = await fetch(`${GIST_API}/${gistId}`, {
    method:  'PATCH',
    headers: {
      'Accept':        'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return true;
}

async function _gistCreate(token) {
  const res = await fetch(GIST_API, {
    method:  'POST',
    headers: {
      'Accept':        'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      description: 'bsched-data — Break Schedule sync',
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({
            breaks: {}, requests: [], extBreaks: {}, users: [],
            staffPasswords: {}, _created: Date.now()
          }, null, 2)
        }
      }
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
  const json = await res.json();
  if (!json.id) throw new Error('No Gist ID returned from GitHub');
  return json.id;
}

// ── Pull (works for all browsers — token from sync-config.json) ──
async function syncPublicPull() {
  const gistId = await discoverGistId();
  if (!gistId) return false;
  try {
    const remote = await _gistGet(gistId, syncCfg.apiKey || null);
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    if (e.message.includes('404') || e.message.includes('401')) {
      _cachedGistId = null;
      syncSaveCfg({ ...syncCfg, gistId: null });
      return 'stale';
    }
    return false;
  }
}

async function syncPull() {
  if (!syncEnabled()) return syncPublicPull();
  try {
    const remote = await _gistGet(syncCfg.gistId, syncCfg.apiKey);
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    return false;
  }
}

// ── Apply remote data (unchanged logic) ──
function _applyRemoteData(remote) {
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

// ── Push to cloud ──
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
    // GitHub Gist has no size limit — include full schedule so all browsers
    // stay in sync without needing a manual CSV import on each device.
    const usersCompact = state.users.map(u => ({
      id: u.id, username: u.username, name: u.name,
      team: u.team, role: u.role, gender: u.gender || '',
      schedule: u.schedule || {},
    }));
    const payload = {
      breaks:           state.breaks,
      requests:         state.requests,
      extBreaks:        state.extBreaks,
      users:            usersCompact,
      staffPasswords,
      _updated:         Date.now(),
      _breaksUpdatedAt: state._breaksUpdatedAt || Date.now(),
      _usersUpdatedAt:  state._usersUpdatedAt  || 0,
    };
    const kb = (JSON.stringify(payload).length / 1024).toFixed(1);
    console.log(`[sync] push payload: ${kb}kb`);
    await _gistPut(syncCfg.gistId, syncCfg.apiKey, payload);
    return true;
  } catch(e) {
    console.warn('[sync] push failed:', e.message);
    if (e.message.includes('401')) {
      if (typeof toast === 'function') toast('☁ Sync token invalid. Go to Cloud Sync → Reconnect.', 'err');
      updateSyncBadge('err');
    } else if (e.message.includes('404')) {
      syncSaveCfg({ ...syncCfg, gistId: null });
      _cachedGistId = null;
      if (typeof toast === 'function') toast('☁ Sync Gist not found. Go to Cloud Sync → Reconnect.', 'err');
      updateSyncBadge('err');
    }
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

// ── Boot: always reload sync-config.json so stale localStorage never wins ──
async function syncTryAutoConnect() {
  await loadSyncConfig();
  if (syncEnabled()) {
    const ok = await syncPull();
    return ok ? true : 'error';
  } else if (syncCfg.gistId) {
    return await syncPublicPull();
  }
  return false;
}

// ── Poll every 30s ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  _syncInterval = setInterval(async () => {
    const noRerenderPages = new Set(['arrange', 'staff']);
    if (!syncCfg.gistId && !_cachedGistId) {
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
  }, 30000);
}
function stopSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  _syncInterval = null;
}

function updateSyncBadge(status) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  if (!syncCfg.gistId && !_cachedGistId) { el.style.display = 'none'; return; }
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
  const gistId  = syncCfg.gistId || _cachedGistId || '';

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
          <span style="opacity:.7;font-size:11px;">Gist ID: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${gistId}</code></span>
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
    ✦ Data is stored in a <b>secret GitHub Gist</b> — no size limits, free forever<br>
    ✦ <code style="background:var(--bg4);padding:1px 5px;border-radius:3px;">sync-config.json</code> in your <b>private</b> GitHub repo contains <b>gistId</b> and <b>token</b><br>
    ✦ Every browser fetches this file at page load → reads + writes the Gist automatically<br>
    ✦ Passwords, breaks and requests sync across all browsers<br>
    ✦ <b>Safe because the repo is private</b> and the token has <b>gist scope only</b>
  </div>
</div>

<!-- Setup steps -->
<div class="card" style="max-width:620px;margin-top:0;">
  <div class="card-title">🔑 Admin Setup — 2 steps, done once</div>

  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:12px;line-height:2.2;">
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 1 — Create a GitHub Token</b>
    <b>1a</b> → Go to <a href="https://github.com/settings/tokens/new" target="_blank" style="color:var(--accent);text-decoration:underline;">github.com/settings/tokens/new</a><br>
    <b>1b</b> → Note: <code style="background:var(--bg4);padding:1px 5px;border-radius:3px;">bsched-sync</code> → Expiration: <b>No expiration</b><br>
    <b>1c</b> → Check only <b>✅ gist</b> scope → click <b>Generate token</b> → copy the token<br>
    <b>1d</b> → Paste below → click <b>Connect</b> → note the <b>Gist ID</b> shown<br>
    <div style="height:12px;"></div>
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 2 — Add sync-config.json to GitHub</b>
    <b>2a</b> → In your GitHub repo, open (or create) <code style="background:var(--bg4);padding:1px 6px;border-radius:3px;">sync-config.json</code><br>
    <b>2b</b> → Paste the exact content shown below after connecting<br>
    <b>2c</b> → Commit and push → all browsers auto-connect on next page load<br>
    <span style="color:var(--text3);font-size:11px;">✦ Safe because your repo is <b>Private</b> and the token scope is <b>gist-only</b></span>
  </div>

  <div class="fg">
    <label>GitHub Personal Access Token</label>
    <div style="display:flex;gap:8px;">
      <input id="sync-api-key" class="login-input" type="password"
        placeholder="ghp_… or github_pat_…" value="${syncCfg.apiKey || ''}"
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
${gistId ? `
<div class="card" style="max-width:620px;margin-top:0;border-color:var(--accent);">
  <div class="card-title" style="color:var(--accent);">📄 sync-config.json — copy exact content</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.7;">
    Create or update <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">sync-config.json</code>
    in your GitHub repo root (same folder as <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">index.html</code>).<br>
    <b style="color:var(--warn);">⚠ Keep your repo Private — this file contains your GitHub token.</b>
  </div>
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ok);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <pre style="margin:0;white-space:pre-wrap;word-break:break-all;">{
  "gistId": "${gistId}",
  "apiKey": "${syncCfg.apiKey || ''}"
}</pre>
    <button class="btn btn-sm" style="flex-shrink:0;"
      onclick="navigator.clipboard.writeText(JSON.stringify({gistId:'${gistId}',apiKey:'${syncCfg.apiKey||''}'},null,2));toast('Copied! Paste into sync-config.json','ok')">Copy</button>
  </div>
  <div style="font-size:11px;color:var(--text3);margin-top:8px;">
    Commit and push to GitHub → GitHub Pages redeploys → all browsers auto-connect within 1–2 minutes.
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
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!apiKey) { status.innerHTML = '<span style="color:var(--err)">Paste your GitHub token.</span>'; return; }
  if (!apiKey.startsWith('ghp_') && !apiKey.startsWith('github_pat_') && !apiKey.startsWith('gho_')) {
    status.innerHTML = '<span style="color:var(--err)">⚠ Token should start with <code>ghp_</code> or <code>github_pat_</code></span>'; return;
  }
  status.innerHTML = '<span style="color:var(--text3)">⏳ Looking for existing Gist…</span>';
  let gistId = syncCfg.gistId || _cachedGistId || await _gistFind(apiKey);
  if (!gistId) {
    status.innerHTML = '<span style="color:var(--text3)">⏳ No existing Gist found — creating one…</span>';
    try { gistId = await _gistCreate(apiKey); }
    catch(e) { status.innerHTML = `<span style="color:var(--err)">⚠ ${e.message}</span>`; return; }
  }
  _cachedGistId = gistId;
  syncSaveCfg({ gistId, apiKey });
  status.innerHTML = '<span style="color:var(--text3)">⏳ Connecting…</span>';
  const ok = await syncPull();
  if (ok) {
    await syncPush();
    startSyncPolling();
    updateSyncBadge('ok');
    status.innerHTML = `<span style="color:var(--ok)">✓ Connected! Gist ID: <b>${gistId}</b></span>`;
    setTimeout(() => nav('sync'), 1200);
  } else {
    syncSaveCfg({});
    status.innerHTML = '<span style="color:var(--err)">⚠ Connection failed. Check your token and try again.</span>';
  }
}

// Find existing bsched-data gist owned by this token
async function _gistFind(token) {
  try {
    const res = await fetch(`${GIST_API}?per_page=100`, {
      headers: {
        'Accept':        'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
      }
    });
    if (!res.ok) return null;
    const gists = await res.json();
    const match = gists.find(g => g.files?.[GIST_FILENAME]);
    return match ? match.id : null;
  } catch(e) { return null; }
}

function clearSyncCfg() {
  if (!confirm('Disconnect sync on this device?')) return;
  syncSaveCfg({}); _cachedGistId = null; stopSyncPolling(); updateSyncBadge('err'); nav('sync');
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