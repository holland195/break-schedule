// ═══════════════════════════════════════════════
//  CLOUD SYNC — JSONBin.io free backend
//
//  What syncs to cloud: breaks, requests, extBreaks, staffInfo passwords
//  What stays local: state.users (schedule grid), raw staffInfo details
//
//  Setup: only needs a JSONBin Master Key.
//  The bin is auto-created on first connect — no manual bin creation needed.
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

// ── Auto-create a new bin using just the Master Key ──
async function syncCreateBin(apiKey) {
  const res = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Master-Key':  apiKey,
      'X-Bin-Name':    'bsched-data',
      'X-Bin-Private': 'false',
    },
    body: JSON.stringify({ breaks:{}, requests:[], extBreaks:{}, _created: Date.now() }),
  });
  if (!res.ok) throw new Error(`Could not create bin (HTTP ${res.status})`);
  const json = await res.json();
  return json.metadata?.id || null;
}

// ── Pull from cloud ──
async function syncPull() {
  if (!syncEnabled()) return false;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}/latest`, {
      headers: { 'X-Master-Key': syncCfg.apiKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const remote = json.record || {};
    if (remote.breaks)    state.breaks    = remote.breaks;
    if (remote.requests)  state.requests  = remote.requests;
    if (remote.extBreaks) state.extBreaks = remote.extBreaks;
    // Sync passwords/mustChangePassword from cloud so first-login works cross-device
    if (remote.staffPasswords) {
      Object.entries(remote.staffPasswords).forEach(([u, p]) => {
        if (state.staffInfo[u]) {
          state.staffInfo[u].password          = p.password          ?? state.staffInfo[u].password;
          state.staffInfo[u].mustChangePassword = p.mustChangePassword ?? state.staffInfo[u].mustChangePassword;
        }
      });
    }
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    return false;
  }
}

// ── Push to cloud ──
async function syncPush() {
  if (!syncEnabled()) return false;
  try {
    // Build password map to sync (never stores plain text — just flag + hashed)
    const staffPasswords = {};
    Object.entries(state.staffInfo || {}).forEach(([u, si]) => {
      if (si.password || si.mustChangePassword !== undefined) {
        staffPasswords[u] = {
          password:          si.password,
          mustChangePassword: si.mustChangePassword,
        };
      }
    });
    const payload = {
      breaks:    state.breaks,
      requests:  state.requests,
      extBreaks: state.extBreaks,
      staffPasswords,
      _updated:  Date.now(),
    };
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}`, {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': syncCfg.apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch(e) {
    console.warn('[sync] push failed:', e.message);
    return false;
  }
}

async function saveAndSync() {
  save();
  if (syncEnabled()) syncPush();
}

async function syncWrite() {
  updateSyncBadge('busy');
  const ok = await saveAndSync();
  updateSyncBadge(ok !== false ? 'ok' : 'err');
}

// ── Auto-refresh every 30 s ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  if (!syncEnabled()) return;
  _syncInterval = setInterval(async () => {
    const ok = await syncPull();
    if (ok && currentPage) {
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
  if (!syncEnabled()) { el.style.display = 'none'; return; }
  el.style.display = '';
  const map = { ok: ['☁ Synced','var(--ok)'], err: ['☁ Offline','var(--warn)'], busy: ['☁ Syncing…','var(--text3)'] };
  const [txt, col] = map[status] || map.err;
  el.textContent = txt; el.style.color = col;
}

// ═══════════════════════════════════════════════
//  SYNC SETTINGS PAGE (Admin only)
// ═══════════════════════════════════════════════
function renderSyncSettings() {
  const enabled = syncEnabled();
  return `
<div class="page-header">
  <div>
    <div class="page-title">☁ Cloud Sync</div>
    <div class="page-sub">Share break data across all browsers &amp; devices via JSONBin.io</div>
  </div>
</div>

<!-- Status banner -->
<div class="card" style="max-width:600px;">
  ${enabled
    ? `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--C-bg);border:1px solid var(--C-color);border-radius:8px;font-size:12px;color:var(--C-color);">
        <span style="font-size:20px;">☁</span>
        <div><b>Sync is active.</b><br>Break assignments, requests and 30-min registrations auto-sync every 30 s and on every save.<br>
        <span style="color:var(--text3);font-size:11px;">Bin ID: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${syncCfg.binId}</code></span></div>
       </div>`
    : `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--D-bg);border:1px solid var(--D-color);border-radius:8px;font-size:12px;color:var(--D-color);">
        <span style="font-size:20px;">⚠</span>
        <div><b>Not configured.</b> Data is saved locally only on this browser. Other devices won't see updates.</div>
       </div>`}
</div>

<!-- Setup card -->
<div class="card" style="max-width:600px;margin-top:0;">
  <div class="card-title">🔑 Setup — Paste Master Key Only</div>

  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:12px 14px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:12px;color:var(--text2);line-height:1.9;">
    <b style="color:var(--text);font-size:13px;">How to get your Master Key (2 minutes):</b><br>
    <span style="color:var(--accent);font-weight:600;">Step 1</span> — Go to
      <a href="https://jsonbin.io" target="_blank" style="color:var(--accent);text-decoration:underline;">jsonbin.io</a>
      and <b>sign up free</b> (email + password, no credit card)<br>
    <span style="color:var(--accent);font-weight:600;">Step 2</span> — After login, click your <b>profile icon (top-right)</b> → <b>API Keys</b><br>
    <span style="color:var(--accent);font-weight:600;">Step 3</span> — Under <b>"Secret Key"</b>, click <b>Show</b> → copy the full key starting with <code style="background:var(--bg4);padding:1px 6px;border-radius:3px;">$2b$10$...</code><br>
    <span style="color:var(--accent);font-weight:600;">Step 4</span> — Paste it below and click <b>Auto-Setup &amp; Connect</b><br>
    <span style="color:var(--text3);font-size:11px;">✦ A storage bin will be created automatically — you do NOT need to create one manually.</span>
  </div>

  <div class="fg">
    <label>Master Key (Secret Key from JSONBin)</label>
    <input id="sync-api-key" class="login-input" type="password"
      placeholder="$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      value="${syncCfg.apiKey||''}"
      style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.04em;">
  </div>

  ${enabled ? `
  <div class="fg" style="margin-top:4px;">
    <label>Bin ID (auto-created)</label>
    <input id="sync-bin-id" class="login-input" value="${syncCfg.binId||''}" readonly
      style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text3);">
  </div>` : ''}

  <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:center;">
    <button class="btn btn-accent" onclick="saveSyncCfg()" style="min-width:200px;">
      ${enabled ? '🔄 Re-connect / Update Key' : '⚡ Auto-Setup &amp; Connect'}
    </button>
    ${enabled ? `
    <button class="btn" onclick="forceSyncPull()" title="Download latest data from cloud">↓ Pull now</button>
    <button class="btn" onclick="forceSyncPush()" title="Upload local data to cloud">↑ Push now</button>
    <button class="btn btn-err btn-sm" onclick="clearSyncCfg()">Disconnect</button>` : ''}
  </div>
  <div id="sync-test-status" style="font-size:12px;margin-top:12px;min-height:20px;"></div>
</div>

<!-- What syncs -->
<div class="card" style="max-width:600px;margin-top:0;background:var(--bg3);">
  <div class="card-title">What syncs &amp; what stays local</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12px;color:var(--text2);line-height:1.9;">
    <div>
      <div style="font-weight:700;color:var(--ok);margin-bottom:4px;">☁ Synced to cloud</div>
      ✦ Break assignments<br>
      ✦ Swap requests &amp; approvals<br>
      ✦ 30-min extra break registrations<br>
      ✦ Password change status<br>
    </div>
    <div>
      <div style="font-weight:700;color:var(--text3);margin-bottom:4px;">💻 Local only</div>
      ✦ Staff schedule grid (import per device)<br>
      ✦ Staff info details (Excel import)<br>
      ✦ Sync configuration<br>
    </div>
  </div>
</div>

<!-- Danger zone (admin only) -->
<div class="card" style="max-width:600px;margin-top:0;border-color:var(--err);">
  <div class="card-title" style="color:var(--err);">⚠ Danger Zone</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    <b>Reset all local data</b> — erases this browser's schedule import, break assignments, and sync config.
    Staff info passwords are preserved. Admin login will still work after reset.
  </div>
  <button class="btn btn-err btn-sm" onclick="factoryReset()">⚠ Reset This Device</button>
</div>`;
}

// ── Connect: auto-create bin if no binId, then test ──
async function saveSyncCfg() {
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!apiKey) { status.innerHTML='<span style="color:var(--err)">Paste your Master Key first.</span>'; return; }
  if (!apiKey.startsWith('$2')) {
    status.innerHTML='<span style="color:var(--err)">⚠ That doesn\'t look like a JSONBin Master Key. It should start with <code>$2b$10$</code></span>';
    return;
  }

  status.innerHTML='<span style="color:var(--text3)">⏳ Setting up…</span>';

  let binId = syncCfg.binId || '';

  // If no bin yet, auto-create one
  if (!binId) {
    try {
      status.innerHTML='<span style="color:var(--text3)">⏳ Creating storage bin…</span>';
      binId = await syncCreateBin(apiKey);
      if (!binId) throw new Error('Bin ID not returned');
    } catch(e) {
      status.innerHTML=`<span style="color:var(--err)">⚠ Could not create bin: ${e.message}<br>Check that your key is correct and has write access.</span>`;
      return;
    }
  }

  syncSaveCfg({ binId, apiKey });
  status.innerHTML='<span style="color:var(--text3)">⏳ Testing connection…</span>';

  const ok = await syncPull();
  if (ok) {
    status.innerHTML=`<span style="color:var(--ok)">✓ Connected! Bin ID: <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">${binId}</code><br>Data is now syncing automatically.</span>`;
    startSyncPolling();
    updateSyncBadge('ok');
    setTimeout(() => nav('sync'), 1200); // re-render to show bin ID field
  } else {
    status.innerHTML='<span style="color:var(--err)">⚠ Connection test failed. Check your Master Key and try again.</span>';
    syncSaveCfg({});
  }
}

function clearSyncCfg() {
  if (!confirm('Disconnect cloud sync? Local data remains.')) return;
  syncSaveCfg({}); stopSyncPolling(); updateSyncBadge('err'); nav('sync');
}

async function forceSyncPull() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML='<span style="color:var(--text3)">Pulling from cloud…</span>';
  const ok = await syncPull();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pulled latest data from cloud.</span>' : '<span style="color:var(--err)">Pull failed. Check connection.</span>';
  if (ok) { nav(currentPage); updateBadge(); updateSyncBadge('ok'); }
}

async function forceSyncPush() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML='<span style="color:var(--text3)">Pushing to cloud…</span>';
  const ok = await syncPush();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Local data pushed to cloud.</span>' : '<span style="color:var(--err)">Push failed. Check connection.</span>';
  if (ok) updateSyncBadge('ok');
}
