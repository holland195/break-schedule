// ═══════════════════════════════════════════════
//  CLOUD SYNC — JSONBin.io
//
//  Single source of truth strategy:
//  • Cloud stores: breaks, requests, extBreaks, staffPasswords, _masterKey
//  • On login: pull cloud → merge passwords → if _masterKey found in cloud,
//    auto-restore sync config on any browser
//  • staffPasswords is a COMPLETE map — even if local staffInfo missing,
//    password changes are always synced and applied when staffInfo loads later
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

// ── Auto-create a bin (only needs apiKey) ──
async function syncCreateBin(apiKey) {
  const res = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Master-Key':  apiKey,
      'X-Bin-Name':    'bsched-data',
      'X-Bin-Private': 'false',
    },
    body: JSON.stringify({
      breaks:{}, requests:[], extBreaks:{}, staffPasswords:{},
      _masterKey: apiKey,   // store key in cloud so other browsers auto-recover
      _created: Date.now()
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.metadata?.id || null;
}

// ── Try to auto-discover binId using the master key ──
// JSONBin /v3/b lists all bins owned by this key
async function syncFindBin(apiKey) {
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b', {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Find our app bin by name
    const bins = json.metadata || [];
    const match = bins.find(b => b.name === 'bsched-data');
    return match?.id || (bins.length > 0 ? bins[0].id : null);
  } catch(e) { return null; }
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

    // ── Merge passwords: cloud is always authoritative ──
    // Apply to ALL usernames in cloud, creating staffInfo entries if missing
    if (remote.staffPasswords) {
      Object.entries(remote.staffPasswords).forEach(([uname, p]) => {
        if (!state.staffInfo[uname]) {
          // Create a minimal staffInfo shell so password is remembered
          state.staffInfo[uname] = { name: uname, role: '', gender: '', empNo: '', dob: '' };
        }
        state.staffInfo[uname].password          = p.password;
        state.staffInfo[uname].mustChangePassword = p.mustChangePassword;
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
    // Build COMPLETE password map — every user in staffInfo
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
      _masterKey:     syncCfg.apiKey,   // always keep key in cloud for auto-recovery
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

// ── Try to auto-restore sync config from cloud ──
// Called on login with just apiKey (from prompt if not stored locally)
async function syncAutoRestore(apiKey) {
  // 1. Try to find existing bin
  let binId = await syncFindBin(apiKey);
  if (!binId) return false;
  syncSaveCfg({ binId, apiKey });
  return await syncPull();
}

// ── Try to auto-restore sync config + pull passwords on any browser ──
// Called before login so passwords are up-to-date from cloud
async function syncTryAutoConnect() {
  if (syncEnabled()) {
    // Already configured — just pull to get latest passwords
    await syncPull();
    return;
  }
  // Check if we have a stored key but lost the binId (e.g. after device reset)
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || {}; } catch(e) { return {}; }
  })();
  if (!stored.apiKey) return; // no key at all — nothing to do

  // Have a key but no binId — try to find the bin
  let binId = stored.binId || null;
  if (!binId) {
    binId = await syncFindBin(stored.apiKey);
    if (binId) syncSaveCfg({ binId, apiKey: stored.apiKey });
  }
  if (binId && stored.apiKey) {
    // Now pull — this updates staffPasswords in localStorage
    await syncPull();
  }
}

async function saveAndSync() {
  save();
  if (syncEnabled()) syncPush();
}

async function syncWrite() {
  updateSyncBadge('busy');
  await saveAndSync();
  updateSyncBadge('ok');
}

// ── Poll every 30 s ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  if (!syncEnabled()) return;
  _syncInterval = setInterval(async () => {
    const ok = await syncPull();
    if (ok && currentPage) { nav(currentPage); updateBadge(); }
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
  const map = { ok:['☁ Synced','var(--ok)'], err:['☁ Offline','var(--warn)'], busy:['☁ Syncing…','var(--text3)'] };
  const [txt, col] = map[status] || map.err;
  el.textContent = txt; el.style.color = col;
}

// ═══════════════════════════════════════════════
//  SYNC SETTINGS PAGE
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

<div class="card" style="max-width:620px;">
  ${enabled
    ? `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--C-bg);border:1px solid var(--C-color);border-radius:8px;font-size:12px;color:var(--C-color);">
        <span style="font-size:20px;">☁</span>
        <div><b>Sync is active</b> — auto-syncs every 30 s and on every save.<br>
        <span style="opacity:0.7;font-size:11px;">Bin: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${syncCfg.binId}</code></span></div>
       </div>`
    : `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--D-bg);border:1px solid var(--D-color);border-radius:8px;font-size:12px;color:var(--D-color);">
        <span style="font-size:20px;">⚠</span>
        <div><b>Not configured.</b> Data is saved locally only. Other devices won't see updates.</div>
       </div>`}
</div>

<div class="card" style="max-width:620px;margin-top:0;">
  <div class="card-title">🔑 Connect with Master Key</div>

  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:12px;line-height:2;">
    <b style="font-size:13px;">How to get your Master Key:</b><br>
    <span style="color:var(--accent);font-weight:700;">1</span> &nbsp;Go to
      <a href="https://jsonbin.io" target="_blank" style="color:var(--accent);font-weight:600;">jsonbin.io</a>
      → <b>Sign Up Free</b> (email + password, no credit card)<br>
    <span style="color:var(--accent);font-weight:700;">2</span> &nbsp;After login → click <b>profile icon (top-right)</b> → <b>API Keys</b><br>
    <span style="color:var(--accent);font-weight:700;">3</span> &nbsp;Under <b>"Secret Key"</b> → click <b>👁 Show</b> → copy the full key<br>
    <span style="color:var(--text3);font-size:11px;padding-left:16px;">(starts with <code style="background:var(--bg4);padding:1px 6px;border-radius:3px;">$2b$10$…</code>)</span><br>
    <span style="color:var(--accent);font-weight:700;">4</span> &nbsp;Paste below → click <b>Connect</b><br>
    <span style="color:var(--text3);font-size:11px;padding-left:16px;">✦ Storage bin auto-created — no manual setup needed<br>
    &nbsp;&nbsp;&nbsp;✦ On any other browser/device: just paste the same key and click Connect</span>
  </div>

  <div class="fg">
    <label>Master Key (Secret Key from JSONBin profile)</label>
    <div style="display:flex;gap:8px;">
      <input id="sync-api-key" class="login-input" type="password"
        placeholder="$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        value="${syncCfg.apiKey||''}"
        style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.04em;">
      <button class="btn" onclick="toggleKeyVisibility()" id="key-vis-btn" style="white-space:nowrap;font-size:11px;">👁 Show</button>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center;">
    <button class="btn btn-accent" onclick="saveSyncCfg()" style="min-width:160px;">
      ${enabled ? '🔄 Reconnect' : '⚡ Connect'}
    </button>
    ${enabled ? `
    <button class="btn" onclick="forceSyncPull()">↓ Pull now</button>
    <button class="btn" onclick="forceSyncPush()">↑ Push now</button>
    <button class="btn btn-err btn-sm" onclick="clearSyncCfg()">Disconnect</button>` : ''}
  </div>
  <div id="sync-test-status" style="font-size:12px;margin-top:12px;min-height:20px;"></div>
</div>

<div class="card" style="max-width:620px;margin-top:0;background:var(--bg3);">
  <div class="card-title">What syncs vs stays local</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:12px;color:var(--text2);line-height:1.9;">
    <div>
      <div style="font-weight:700;color:var(--ok);margin-bottom:4px;">☁ Cloud (all devices)</div>
      ✦ Break assignments<br>
      ✦ Swap requests &amp; approvals<br>
      ✦ 30-min break registrations<br>
      ✦ <b>Passwords &amp; first-login flags</b><br>
      ✦ Sync key (auto-recovers on any browser)
    </div>
    <div>
      <div style="font-weight:700;color:var(--text3);margin-bottom:4px;">💻 Local only (import per device)</div>
      ✦ Staff schedule grid (paste from Sheets)<br>
      ✦ Staff info details (Excel import)<br>
    </div>
  </div>
</div>

<div class="card" style="max-width:620px;margin-top:0;border-color:var(--err);">
  <div class="card-title" style="color:var(--err);">⚠ Danger Zone</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    Erase all local data on this device (schedule grid, break assignments, sync config).
    Cloud data is not affected. After reset, re-import schedule and reconnect sync with your Master Key.
  </div>
  <button class="btn btn-err btn-sm" onclick="factoryReset()">⚠ Reset This Device</button>
</div>`;
}

function toggleKeyVisibility() {
  const inp = document.getElementById('sync-api-key');
  const btn = document.getElementById('key-vis-btn');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁 Show' : '🙈 Hide';
}

async function saveSyncCfg() {
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!apiKey) { status.innerHTML='<span style="color:var(--err)">Paste your Master Key first.</span>'; return; }
  if (!apiKey.startsWith('$2')) {
    status.innerHTML='<span style="color:var(--err)">⚠ That doesn\'t look like a Master Key. It must start with <code>$2b$10$</code></span>';
    return;
  }
  status.innerHTML='<span style="color:var(--text3)">⏳ Looking for existing bin…</span>';

  let binId = syncCfg.binId || null;

  // Try to find existing bin first
  if (!binId) {
    binId = await syncFindBin(apiKey);
  }

  // None found — create one
  if (!binId) {
    status.innerHTML='<span style="color:var(--text3)">⏳ Creating storage bin…</span>';
    try {
      binId = await syncCreateBin(apiKey);
    } catch(e) {
      status.innerHTML=`<span style="color:var(--err)">⚠ ${e.message}</span>`;
      return;
    }
  }

  syncSaveCfg({ binId, apiKey });
  status.innerHTML='<span style="color:var(--text3)">⏳ Connecting…</span>';

  const ok = await syncPull();
  if (ok) {
    status.innerHTML=`<span style="color:var(--ok)">✓ Connected! Bin ID: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${binId}</code></span>`;
    // Push immediately so master key is stored in cloud for other browsers
    await syncPush();
    startSyncPolling();
    updateSyncBadge('ok');
    setTimeout(() => nav('sync'), 1000);
  } else {
    status.innerHTML='<span style="color:var(--err)">⚠ Connection failed. Check your Master Key.</span>';
    syncSaveCfg({});
  }
}

function clearSyncCfg() {
  if (!confirm('Disconnect sync on this device?')) return;
  syncSaveCfg({}); stopSyncPolling(); updateSyncBadge('err'); nav('sync');
}

async function forceSyncPull() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML='<span style="color:var(--text3)">Pulling…</span>';
  const ok = await syncPull();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pulled latest data.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) { nav(currentPage); updateBadge(); updateSyncBadge('ok'); }
}

async function forceSyncPush() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML='<span style="color:var(--text3)">Pushing…</span>';
  const ok = await syncPush();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pushed.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) updateSyncBadge('ok');
}
