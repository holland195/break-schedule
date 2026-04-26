// ═══════════════════════════════════════════════
//  CLOUD SYNC — JSONBin.io
//
//  ADMIN SETUP (one time only):
//  1. Go to jsonbin.io → Sign Up Free
//  2. Profile → API Keys → copy Secret Key
//  3. Go to Cloud Sync page in this app → paste key → Connect
//  4. The app auto-creates a bin and saves JSONBIN_BIN_ID + JSONBIN_API_KEY
//     into this file via the Sync Settings page.
//
//  USERS: do nothing. The app pulls passwords silently before login.
//  The key is never shown to users.
// ═══════════════════════════════════════════════

const SYNC_CFG_KEY = 'bsched_sync_cfg';

// Read config from localStorage (written by admin via Cloud Sync settings page)
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

// ── Auto-create a bin ──
async function syncCreateBin(apiKey) {
  const res = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Master-Key':  apiKey,
      'X-Bin-Name':    'bsched-data',
    },
    body: JSON.stringify({ breaks:{}, requests:[], extBreaks:{}, staffPasswords:{}, _created: Date.now() }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
  const json = await res.json();
  return json.metadata?.id || null;
}

// ── Find existing bin by listing all bins for this key ──
async function syncFindBin(apiKey) {
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b', {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const bins = Array.isArray(json.metadata) ? json.metadata : [];
    const match = bins.find(b => b.name === 'bsched-data');
    return match?.id || (bins.length === 1 ? bins[0].id : null);
  } catch(e) { return null; }
}

// ── Pull from cloud → update local passwords + data ──
async function syncPull() {
  if (!syncEnabled()) return false;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}/latest`, {
      headers: { 'X-Master-Key': syncCfg.apiKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json  = await res.json();
    const remote = json.record || {};

    // Sync operational data
    if (remote.breaks)    state.breaks    = remote.breaks;
    if (remote.requests)  state.requests  = remote.requests;
    if (remote.extBreaks) state.extBreaks = remote.extBreaks;

    // Sync ALL passwords — create shell entries for users not yet imported locally
    if (remote.staffPasswords) {
      Object.entries(remote.staffPasswords).forEach(([uname, p]) => {
        if (!state.staffInfo[uname]) {
          state.staffInfo[uname] = { name: uname, role: '', gender: '', empNo: '', dob: '' };
        }
        state.staffInfo[uname].password           = p.password;
        state.staffInfo[uname].mustChangePassword  = p.mustChangePassword;
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
    // Build complete password map from all staffInfo entries
    const staffPasswords = {};
    Object.entries(state.staffInfo || {}).forEach(([uname, si]) => {
      staffPasswords[uname] = {
        password:          si.password          ?? '1234',
        mustChangePassword: si.mustChangePassword ?? true,
      };
    });

    const payload = {
      breaks:         state.breaks,
      requests:       state.requests,
      extBreaks:      state.extBreaks,
      staffPasswords,
      _updated:       Date.now(),
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

// ── saveAndSync: call instead of save() for operations that need cloud push ──
async function saveAndSync() {
  save();
  if (syncEnabled()) syncPush();
}

async function syncWrite() {
  updateSyncBadge('busy');
  await saveAndSync();
  updateSyncBadge('ok');
}

// ── Auto-pull on page load using locally stored admin key ──
// Users never configure this. The admin's browser stores the key in localStorage.
// After that, every browser that has ever had admin configure sync on it will
// auto-pull passwords. For brand-new browsers: they pull via the boot sequence
// using whatever key is in their localStorage (admin must have set it up there).
async function syncTryAutoConnect() {
  if (syncEnabled()) {
    // Key + binId already in localStorage — just pull latest passwords
    await syncPull();
    return;
  }
  // Key in localStorage but binId missing (e.g. after partial reset)
  const stored = (() => { try { return JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || {}; } catch(e) { return {}; }})();
  if (!stored.apiKey) return; // no key stored — only admin can fix via Sync Settings
  let binId = await syncFindBin(stored.apiKey);
  if (binId) {
    syncSaveCfg({ binId, apiKey: stored.apiKey });
    await syncPull();
  }
}

// ── Poll every 30 s ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  if (!syncEnabled()) return;
  _syncInterval = setInterval(async () => {
    const ok = await syncPull();
    if (ok && typeof currentPage !== 'undefined' && currentPage) {
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
  const map = {
    ok:   ['☁ Synced',   'var(--ok)'],
    err:  ['☁ Offline',  'var(--warn)'],
    busy: ['☁ Syncing…', 'var(--text3)'],
  };
  const [txt, col] = map[status] || map.err;
  el.textContent = txt; el.style.color = col;
}

// ═══════════════════════════════════════════════
//  CLOUD SYNC SETTINGS PAGE — admin only
// ═══════════════════════════════════════════════
function renderSyncSettings() {
  const enabled = syncEnabled();
  return `
<div class="page-header">
  <div>
    <div class="page-title">☁ Cloud Sync</div>
    <div class="page-sub">Configure once — all users' passwords sync automatically across every browser</div>
  </div>
</div>

<!-- Status -->
<div class="card" style="max-width:600px;">
  ${enabled
    ? `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--C-bg);border:1px solid var(--C-color);border-radius:8px;font-size:12px;color:var(--C-color);">
        <span style="font-size:22px;">☁</span>
        <div>
          <b>Sync is active.</b><br>
          Passwords, breaks, and requests sync automatically every 30 s.<br>
          <span style="opacity:0.7;font-size:11px;">Bin ID: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${syncCfg.binId}</code></span>
        </div>
       </div>`
    : `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--D-bg);border:1px solid var(--D-color);border-radius:8px;font-size:12px;color:var(--D-color);">
        <span style="font-size:22px;">⚠</span>
        <div>
          <b>Sync not configured.</b><br>
          Passwords changed on one browser won't be visible on others.<br>
          Set this up once and all users will sync automatically.
        </div>
       </div>`}
</div>

<!-- How it works for users -->
<div class="card" style="max-width:600px;margin-top:0;background:var(--bg3);">
  <div class="card-title">How it works for users</div>
  <div style="font-size:12px;color:var(--text2);line-height:2;">
    ✦ Users log in with default password <code style="background:var(--bg4);padding:1px 6px;border-radius:3px;">1234</code><br>
    ✦ App forces them to set a new password on first login<br>
    ✦ New password is immediately pushed to cloud<br>
    ✦ <b>Any browser</b> silently pulls the latest password at page load — before the login form appears<br>
    ✦ Users never see or touch any sync setting
  </div>
</div>

<!-- Admin setup -->
<div class="card" style="max-width:600px;margin-top:0;">
  <div class="card-title">🔑 Admin Setup (one time only)</div>

  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:12px;line-height:2;">
    <b>Step 1</b> → Go to <a href="https://jsonbin.io" target="_blank" style="color:var(--accent);font-weight:600;text-decoration:underline;">jsonbin.io</a> and <b>Sign Up Free</b><br>
    <b>Step 2</b> → Click your <b>profile icon (top-right)</b> → <b>API Keys</b><br>
    <b>Step 3</b> → Under <b>"Secret Key"</b> → click <b>👁 Show</b> → copy the full key<br>
    <b>Step 4</b> → Paste below and click <b>Connect</b><br>
    <span style="color:var(--text3);font-size:11px;">✦ A storage bin is auto-created — no manual bin creation needed<br>✦ This key is only stored on this admin browser's localStorage — never sent to users</span>
  </div>

  <div class="fg">
    <label>JSONBin Master Key (Secret Key)</label>
    <div style="display:flex;gap:8px;">
      <input id="sync-api-key" class="login-input" type="password"
        placeholder="$2b$10$…"
        value="${syncCfg.apiKey || ''}"
        style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;">
      <button class="btn btn-sm" onclick="
        const i=document.getElementById('sync-api-key');
        i.type=i.type==='password'?'text':'password';
        this.textContent=i.type==='password'?'👁':'🙈';" style="white-space:nowrap;">👁</button>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
    <button class="btn btn-accent" onclick="saveSyncCfg()">
      ${enabled ? '🔄 Reconnect' : '⚡ Connect'}
    </button>
    ${enabled ? `
    <button class="btn" onclick="forceSyncPull()">↓ Pull now</button>
    <button class="btn" onclick="forceSyncPush()">↑ Push now</button>
    <button class="btn btn-err btn-sm" onclick="clearSyncCfg()">Disconnect</button>` : ''}
  </div>
  <div id="sync-test-status" style="font-size:12px;margin-top:12px;min-height:20px;"></div>
</div>

<!-- Danger zone -->
<div class="card" style="max-width:600px;margin-top:0;border-color:var(--err);">
  <div class="card-title" style="color:var(--err);">⚠ Danger Zone</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    Reset this device — clears local schedule data, break assignments, and sync config.
    Cloud data and passwords are not affected.
    After reset, re-import the schedule and reconnect sync with your Master Key.
  </div>
  <button class="btn btn-err btn-sm" onclick="factoryReset()">⚠ Reset This Device</button>
</div>`;
}

async function saveSyncCfg() {
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!apiKey) { status.innerHTML = '<span style="color:var(--err)">Paste your Master Key.</span>'; return; }
  if (!apiKey.startsWith('$2')) {
    status.innerHTML = '<span style="color:var(--err)">⚠ Key should start with <code>$2b$10$</code></span>'; return;
  }
  status.innerHTML = '<span style="color:var(--text3)">⏳ Looking for existing bin…</span>';

  let binId = syncCfg.binId || await syncFindBin(apiKey);

  if (!binId) {
    status.innerHTML = '<span style="color:var(--text3)">⏳ Creating bin…</span>';
    try { binId = await syncCreateBin(apiKey); }
    catch(e) { status.innerHTML = `<span style="color:var(--err)">⚠ ${e.message}</span>`; return; }
  }

  syncSaveCfg({ binId, apiKey });
  status.innerHTML = '<span style="color:var(--text3)">⏳ Connecting…</span>';

  const ok = await syncPull();
  if (ok) {
    // Push immediately so staffPasswords are in cloud for other browsers
    await syncPush();
    status.innerHTML = `<span style="color:var(--ok)">✓ Connected! Bin: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${binId}</code><br>Passwords are now syncing automatically across all browsers.</span>`;
    startSyncPolling();
    updateSyncBadge('ok');
    setTimeout(() => nav('sync'), 1500);
  } else {
    syncSaveCfg({});
    status.innerHTML = '<span style="color:var(--err)">⚠ Failed. Check your Master Key.</span>';
  }
}

function clearSyncCfg() {
  if (!confirm('Disconnect sync on this device?')) return;
  syncSaveCfg({}); stopSyncPolling(); updateSyncBadge('err'); nav('sync');
}

async function forceSyncPull() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML = '<span style="color:var(--text3)">Pulling…</span>';
  const ok = await syncPull();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pulled latest data.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) { nav(currentPage); updateBadge(); updateSyncBadge('ok'); }
}

async function forceSyncPush() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML = '<span style="color:var(--text3)">Pushing…</span>';
  const ok = await syncPush();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pushed.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) updateSyncBadge('ok');
}
