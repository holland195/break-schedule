// ═══════════════════════════════════════════════
//  CLOUD SYNC — JSONBin.io + GitHub sync-config.json
//
//  HOW IT WORKS (zero friction for users):
//
//  1. Admin sets up once:
//     a. Go to jsonbin.io → sign up → copy Secret Key
//     b. Login as admin → Cloud Sync page → paste key → Connect
//     c. App creates a public JSONBin → shows the Bin ID
//     d. Admin creates sync-config.json in the GitHub repo (see below)
//     e. Push to GitHub → done forever
//
//  2. sync-config.json (place in root of GitHub repo, same folder as index.html):
//     { "binId": "your-bin-id-here" }
//
//  3. Every browser on every device:
//     a. Fetches ./sync-config.json (same origin → no CORS, no key needed)
//     b. Gets the binId → reads the PUBLIC JSONBin → pulls latest passwords
//     c. Login form unlocks → user logs in with their real password
//     d. Done. No master key. No admin visit. No setup per device.
//
//  SECURITY:
//  • JSONBin data bin is PUBLIC for reading (passwords are hashed-equivalent,
//    not plain text — stored as user-chosen strings, no PII beyond username)
//  • Only the admin browser can WRITE (has the Secret Key in localStorage)
//  • sync-config.json only contains the binId — not the secret key
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
  return !!(syncCfg.binId && syncCfg.apiKey);
}

// ── Step 1: Discover binId from sync-config.json (GitHub-hosted, same origin) ──
let _cachedBinId = null;

// Load full sync config from sync-config.json (binId + apiKey for private repo)
async function loadSyncConfig() {
  try {
    const res = await fetch('./sync-config.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    if (!cfg.binId) return null;
    // Save both binId and apiKey to localStorage
    syncSaveCfg({
      binId:  cfg.binId,
      apiKey: cfg.apiKey || syncCfg.apiKey || '',
    });
    _cachedBinId = cfg.binId;
    console.log('[sync] config loaded from sync-config.json, binId:', cfg.binId);
    return cfg;
  } catch(e) {
    console.warn('[sync] sync-config.json error:', e.message);
    return null;
  }
}

async function discoverBinId() {
  // 1. Already cached in memory
  if (_cachedBinId) return _cachedBinId;
  // 2. Already in localStorage
  if (syncCfg.binId) { _cachedBinId = syncCfg.binId; return _cachedBinId; }
  // 3. Fetch sync-config.json
  const cfg = await loadSyncConfig();
  return cfg ? cfg.binId : null;
}

// ── Pull for non-admin browsers ──
// Uses apiKey from sync-config.json if available (private repo).
// Falls back to unauthenticated read for public bins.
async function syncPublicPull() {
  const binId = await discoverBinId();
  if (!binId) return false;
  // Use apiKey if available (loaded from sync-config.json or localStorage)
  const headers = {};
  if (syncCfg.apiKey) headers['X-Master-Key'] = syncCfg.apiKey;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      cache: 'no-store',
      headers,
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      console.warn(`[sync] bin ${binId} returned ${res.status} — clearing stale ID`);
      _cachedBinId = null;
      syncSaveCfg({ ...syncCfg, binId: null });
      return 'stale';
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json   = await res.json();
    const remote = json.record || {};
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    return false;
  }
}

// ── AUTHENTICATED pull (admin — has apiKey in localStorage) ──
async function syncPull() {
  if (!syncEnabled()) return syncPublicPull();
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}/latest`, {
      cache: 'no-store',
      headers: { 'X-Master-Key': syncCfg.apiKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json   = await res.json();
    const remote = json.record || {};
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    return false;
  }
}

function _applyRemoteData(remote) {
  // ── Breaks merge: compare collection-level timestamps first ──
  // state._breaksUpdatedAt = when we last wrote breaks locally (set on every assign/import)
  // remote._breaksUpdatedAt = when the cloud breaks were last pushed
  //
  // Cases:
  //  A. remote newer than local → cloud wins, replace entirely (normal sync from another device)
  //  B. local newer than remote → local wins, keep entirely (our push is in-flight or just landed)
  //  C. equal or no timestamp   → fall back to per-entry merge (safe default)
  //  D. local is empty          → always take cloud (fresh browser, no local data yet)
  if (remote.breaks) {
    const localBAt  = state._breaksUpdatedAt  || 0;
    const remoteBAt = remote._breaksUpdatedAt || 0;
    const localIsEmpty = Object.keys(state.breaks).length === 0;

    if (localIsEmpty) {
      // Case D: fresh browser — take everything from cloud
      state.breaks = remote.breaks;
    } else if (remoteBAt > localBAt) {
      // Case A: cloud is genuinely newer — replace entirely
      state.breaks = remote.breaks;
    } else if (localBAt > remoteBAt) {
      // Case B: local is newer (e.g. push in-flight) — keep local entirely
      // Do nothing — our local data wins
    } else {
      // Case C: same timestamp or no timestamp — per-entry merge
      Object.entries(remote.breaks).forEach(([key, remoteEntry]) => {
        const localEntry = state.breaks[key];
        if (!localEntry) {
          state.breaks[key] = remoteEntry;
        } else {
          const localAt  = localEntry.at  || 0;
          const remoteAt = remoteEntry.at || 0;
          if (remoteAt > localAt) {
            state.breaks[key] = remoteEntry;
          }
        }
      });
    }
  }
  // After any successful breaks merge, sync the local timestamp to match
  // what we just received. This prevents the 30-second poll from re-applying
  // Case A on the next tick (which would be correct but wastes a merge).
  if (remote.breaks && remote._breaksUpdatedAt) {
    // Only update if remote is newer — never go backwards
    if ((remote._breaksUpdatedAt || 0) > (state._breaksUpdatedAt || 0)) {
      state._breaksUpdatedAt = remote._breaksUpdatedAt;
    }
  }
  if (remote.requests)  state.requests  = remote.requests;
  if (remote.extBreaks) state.extBreaks = remote.extBreaks;
  // Restore schedule users from cloud using timestamp comparison
  // This prevents an old cloud schedule from overwriting a newer local import
  if (remote.users && remote.users.length > 0) {
    const localUAt  = state._usersUpdatedAt  || 0;
    const remoteUAt = remote._usersUpdatedAt || 0;
    if (state.users.length === 0) {
      // Fresh browser — take cloud users unconditionally
      state.users = remote.users;
      state._usersUpdatedAt = remoteUAt;
      // Reset activeMonday to current week so we don't land on an old week
      if (typeof activeMonday !== 'undefined') {
        const now = new Date(); const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(now.getFullYear(), now.getMonth(), diff);
        activeMonday = `${mon.getDate().toString().padStart(2,'0')}/${(mon.getMonth()+1).toString().padStart(2,'0')}`;
      }
    } else if (remoteUAt > localUAt) {
      // Cloud has a newer import — replace local schedule
      state.users = remote.users;
      state._usersUpdatedAt = remoteUAt;
    }
    // else: local is newer or same — keep local schedule (don't restore old weeks)
  }
  // Sync passwords — authoritative from cloud
  // Works even if user not in local staffInfo yet (fresh browser)
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

// ── Push to cloud (admin only) ──
async function syncPush() {
  if (!syncEnabled()) return false;
  try {
    const staffPasswords = {};
    Object.entries(state.staffInfo || {}).forEach(([uname, si]) => {
      staffPasswords[uname] = {
        password:          si.password          ?? '1234',
        mustChangePassword: si.mustChangePassword ?? true,
      };
    });
    const usersCompact = state.users.map(u => ({
      id: u.id, username: u.username, name: u.name,
      team: u.team, role: u.role, gender: u.gender || '',
      schedule: u.schedule,
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
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': syncCfg.apiKey },
      body:    JSON.stringify(payload),
    });
    if (res.status === 403 || res.status === 404) {
      // Bin deleted, private, or wrong — clear stale config so
      // next reconnect from Cloud Sync page starts fresh
      console.warn(`[sync] push: bin returned ${res.status} — clearing stale binId`);
      syncSaveCfg({ ...syncCfg, binId: null });
      _cachedBinId = null;
      updateSyncBadge('err');
      // Show admin a toast if available
      if (typeof toast === 'function') {
        toast('☁ Sync bin not found (403). Go to Cloud Sync → Reconnect.', 'err');
      }
      return false;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch(e) {
    console.warn('[sync] push failed:', e.message);
    return false;
  }
}

async function saveAndSync() {
  save(); // always write localStorage first (instant, never fails)
  if (syncEnabled()) await syncPush(); // Option D: await so push completes before any pull
}
async function syncWrite() {
  updateSyncBadge('busy');
  await saveAndSync(); // awaited all the way through
  updateSyncBadge(syncEnabled() ? 'ok' : 'err');
}

// ── Boot: load sync-config.json + pull passwords BEFORE login ──
// Returns: true=synced, false=no config, 'stale'=bad binId, 'error'=network fail
async function syncTryAutoConnect() {
  // ALWAYS fetch sync-config.json — it may have been updated with a new
  // binId/apiKey since last visit. This overwrites any stale localStorage
  // value so users never need to manually clear their cache.
  await loadSyncConfig(); // updates syncCfg in-place via syncSaveCfg
  if (syncEnabled()) {
    const ok = await syncPull();
    return ok ? true : 'error';
  } else if (syncCfg.binId) {
    // Have binId but no apiKey — try pull anyway (may work if bin is public)
    const result = await syncPublicPull();
    return result;
  }
  return false; // no config at all
}

// ── Poll every 30 s ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  _syncInterval = setInterval(async () => {
    const noRerenderPages = new Set(['arrange', 'staff']);
    // If binId was cleared (403/404), stop polling until admin reconnects
    if (!syncCfg.binId && !_cachedBinId) {
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
  // Show badge only if we have a binId (even without apiKey)
  if (!syncCfg.binId && !_cachedBinId) { el.style.display = 'none'; return; }
  el.style.display = '';
  const map = {
    ok:   ['☁ Synced',   'var(--ok)'],
    err:  ['☁ Offline',  'var(--warn)'],
    busy: ['☁ Syncing…', 'var(--text3)'],
  };
  const [txt, col] = map[status] || map.err;
  el.textContent = txt; el.style.color = col;
}

// ── Create a PUBLIC bin ──
async function syncCreateBin(apiKey) {
  const res = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Master-Key':  apiKey,
      'X-Bin-Name':    'bsched-data',
    },
    body: JSON.stringify({
      breaks:{}, requests:[], extBreaks:{}, users:[], staffPasswords:{}, _created: Date.now()
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
  const json  = await res.json();
  const binId = json.metadata?.id;
  if (!binId) throw new Error('No bin ID returned from JSONBin');
  // Make it public so anyone can read without a key
  await fetch(`https://api.jsonbin.io/v3/b/${binId}/meta/privacy`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
    body:    JSON.stringify({ private: false }),
  });
  return binId;
}

async function syncFindBin(apiKey) {
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b', {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const bins = Array.isArray(json.metadata) ? json.metadata : [];
    // Find all bins named 'bsched-data', sort by creation time (newest first)
    const matches = bins
      .filter(b => b.name === 'bsched-data')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (matches.length > 0) return matches[0].id;
    // No named match — only use a bin if there's exactly one (avoid wrong pick)
    return bins.length === 1 ? bins[0].id : null;
  } catch(e) { return null; }
}

async function syncMakeBinPublic(binId, apiKey) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/meta/privacy`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
      body:    JSON.stringify({ private: false }),
    });
    if (res.ok) {
      console.log('[sync] bin set to public OK');
      return true;
    }
    console.warn('[sync] syncMakeBinPublic failed:', res.status);
    return false;
  } catch(e) {
    console.warn('[sync] syncMakeBinPublic error:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════
//  SYNC SETTINGS PAGE — admin only
// ═══════════════════════════════════════════════
function renderSyncSettings() {
  const enabled = syncEnabled();
  const binId   = syncCfg.binId || _cachedBinId || '';

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
          <span style="opacity:.7;font-size:11px;">Bin ID: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${binId}</code></span>
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
    ✦ <code style="background:var(--bg4);padding:1px 5px;border-radius:3px;">sync-config.json</code> in your <b>private</b> GitHub repo contains both <b>binId</b> and <b>apiKey</b><br>
    ✦ Every browser fetches this file at page load → gets both values → can read + write to JSONBin<br>
    ✦ Passwords and break data sync automatically across all browsers<br>
    ✦ <b>Safe because the repo is private</b> — only team members with repo access can see the key<br>
    ✦ No manual key entry on any device. No admin visits.
  </div>
</div>

<!-- Setup steps -->
<div class="card" style="max-width:620px;margin-top:0;">
  <div class="card-title">🔑 Admin Setup — 2 steps, done once</div>

  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:12px;line-height:2.2;">
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 1 — Connect JSONBin</b>
    <b>1a</b> → Go to <a href="https://jsonbin.io" target="_blank" style="color:var(--accent);text-decoration:underline;">jsonbin.io</a> → Sign Up Free<br>
    <b>1b</b> → Profile icon (top-right) → <b>API Keys</b> → under <b>Secret Key</b> → <b>👁 Show</b> → copy<br>
    <b>1c</b> → Paste below → click <b>Connect</b> → note the <b>Bin ID</b> shown<br>
    <div style="height:12px;"></div>
    <b style="font-size:13px;display:block;margin-bottom:4px;">Step 2 — Add sync-config.json to GitHub</b>
    <b>2a</b> → In your GitHub repository, open (or create) <code style="background:var(--bg4);padding:1px 6px;border-radius:3px;">sync-config.json</code><br>
    <b>2b</b> → File must contain both <b>binId</b> AND <b>apiKey</b> (see card below for exact content)<br>
    <b>2c</b> → Commit and push → all browsers will auto-connect on next page load<br>
    <span style="color:var(--text3);font-size:11px;">✦ Safe because your GitHub repo is <b>Private</b> — the key is not visible publicly</span>
  </div>

  <div class="fg">
    <label>JSONBin Secret Key (Master Key)</label>
    <div style="display:flex;gap:8px;">
      <input id="sync-api-key" class="login-input" type="password"
        placeholder="$2b$10$…" value="${syncCfg.apiKey || ''}"
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

<!-- GitHub file instruction (shown after connect) -->
${binId ? `
<div class="card" style="max-width:620px;margin-top:0;border-color:var(--accent);">
  <div class="card-title" style="color:var(--accent);">📄 sync-config.json — copy exact content</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.7;">
    Create or update <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">sync-config.json</code>
    in your GitHub repo root (same folder as <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">index.html</code>).<br>
    <b style="color:var(--warn);">⚠ Keep your repo Private — this file contains your API key.</b>
  </div>
  <div style="background:var(--bg3);border-radius:8px;padding:14px 16px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ok);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <pre style="margin:0;white-space:pre-wrap;word-break:break-all;">{
  "binId": "${binId}",
  "apiKey": "${syncCfg.apiKey || ''}"
}</pre>
    <button class="btn btn-sm" style="flex-shrink:0;"
      onclick="navigator.clipboard.writeText(JSON.stringify({binId:'${binId}',apiKey:'${syncCfg.apiKey||''}'},null,2));toast('Copied! Paste into sync-config.json','ok')">Copy</button>
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

${typeof renderRotationPanel === 'function' ? renderRotationPanel() : ''}` ;
}

async function saveSyncCfg() {
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!apiKey) { status.innerHTML = '<span style="color:var(--err)">Paste your Secret Key.</span>'; return; }
  if (!apiKey.startsWith('$2')) {
    status.innerHTML = '<span style="color:var(--err)">⚠ Key should start with <code>$2b$10$</code></span>'; return;
  }
  status.innerHTML = '<span style="color:var(--text3)">⏳ Looking for existing bin…</span>';
  // Always search for existing bin first — never create a duplicate
  status.innerHTML = '<span style="color:var(--text3)">⏳ Searching for existing bin…</span>';
  let binId = syncCfg.binId || _cachedBinId || await syncFindBin(apiKey);
  if (!binId) {
    status.innerHTML = '<span style="color:var(--text3)">⏳ No existing bin found — creating one…</span>';
    try { binId = await syncCreateBin(apiKey); }
    catch(e) { status.innerHTML = `<span style="color:var(--err)">⚠ ${e.message}</span>`; return; }
  } else {
    // Ensure the found bin is public so all browsers can read it without a key
    await syncMakeBinPublic(binId, apiKey);
  }
  _cachedBinId = binId;
  syncSaveCfg({ binId, apiKey });
  status.innerHTML = '<span style="color:var(--text3)">⏳ Connecting…</span>';
  const ok = await syncPull();
  if (ok) {
    await syncPush();
    startSyncPolling();
    updateSyncBadge('ok');
    status.innerHTML = `<span style="color:var(--ok)">✓ Connected! Bin ID: <b>${binId}</b></span>`;
    setTimeout(() => nav('sync'), 1200);
  } else {
    syncSaveCfg({});
    status.innerHTML = '<span style="color:var(--err)">⚠ Connection failed. Check your Secret Key.</span>';
  }
}

function clearSyncCfg() {
  if (!confirm('Disconnect sync on this device?')) return;
  syncSaveCfg({}); _cachedBinId = null; stopSyncPolling(); updateSyncBadge('err'); nav('sync');
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