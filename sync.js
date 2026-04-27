// ═══════════════════════════════════════════════
//  CLOUD SYNC — JSONBin.io
//
//  Security model:
//  • Bin is PUBLIC  → any browser can READ  passwords (no key needed)
//  • Only admin has apiKey → only admin can WRITE to the bin
//
//  This means:
//  • Users never need the Master Key
//  • Any browser can pull latest passwords at page load — no setup needed
//  • Only the binId needs to be known by all browsers
//  • The binId is stored in a second tiny "pointer" bin that is also public
//    so even the binId auto-discovers itself on fresh browsers
//
//  Flow on fresh browser (cuong.pham on Edge):
//  1. bootApp() calls syncBootPull()
//  3. Gets { dataBinId } from pointer bin → reads data bin → pulls passwords
//  4. Login form unlocks → cuong.pham types new password → works
// ═══════════════════════════════════════════════

const SYNC_CFG_KEY    = 'bsched_sync_cfg';
// This is a PUBLIC "pointer" bin that only stores the data bin's ID.
// It is set once by admin and never changes. No secret needed to read it.
// Admin must fill this in via Cloud Sync settings — it gets saved here after first connect.


// ── Load configs ──
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

// ── PUBLIC read of data bin (no API key needed — bin is public) ──
async function syncPublicPull() {
  const binId = syncCfg.binId || '';
  if (!binId) return false;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json   = await res.json();
    const remote = json.record || {};
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] public pull failed:', e.message);
    return false;
  }
}

// ── AUTHENTICATED pull (admin browser — has apiKey) ──
async function syncPull() {
  if (!syncEnabled()) return syncPublicPull();
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}/latest`, {
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
  if (remote.breaks)    state.breaks    = remote.breaks;
  if (remote.requests)  state.requests  = remote.requests;
  if (remote.extBreaks) state.extBreaks = remote.extBreaks;
  if (remote._dataBinId && !syncCfg.binId) {
    syncSaveCfg({ ...syncCfg, binId: remote._dataBinId });
  }
  // Sync schedule users — only fill if local is empty (local import wins)
  if (remote.users && remote.users.length > 0 && state.users.length === 0) {
    state.users = remote.users;
    if (typeof buildDatalist === 'function') buildDatalist();
  }
  // Sync passwords
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

// ── Push (admin only — needs apiKey) ──
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
    // Compact users: strip heavy fields to keep payload small
    // Only keep: id, username, name, team, role, gender, schedule
    const usersCompact = (state.users || []).map(u => ({
      id: u.id, username: u.username, name: u.name,
      team: u.team || '', role: u.role || '', gender: u.gender || '',
      schedule: u.schedule || {},
    }));

    const payload = {
      breaks: state.breaks,
      requests: state.requests,
      extBreaks: state.extBreaks,
      staffPasswords,
      users: usersCompact,     // schedule grid — synced so all browsers see data
      _dataBinId: syncCfg.binId,
      _updated: Date.now(),
    };
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': syncCfg.apiKey },
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
  await saveAndSync();
  updateSyncBadge(syncEnabled() ? 'ok' : 'err');
}

// ── Boot pull — called before login, NO master key needed ──
async function syncBootPull() {
  // Determine best available binId:
  // 1. From localStorage (any browser that's ever pulled before)
  // 2. From hardcoded BSCHED_PUBLIC_BIN_ID in data.js (fresh browser after admin sets it)
  const binId = syncCfg.binId
    || (typeof BSCHED_PUBLIC_BIN_ID !== 'undefined' && BSCHED_PUBLIC_BIN_ID ? BSCHED_PUBLIC_BIN_ID : null);

  if (!binId) return false; // no bin known — admin hasn't set up sync yet

  // Save binId to localStorage so future pulls are faster
  if (!syncCfg.binId) {
    syncSaveCfg({ ...syncCfg, binId });
  }

  try {
    // PUBLIC read — no API key needed
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json   = await res.json();
    const remote = json.record || {};
    _applyRemoteData(remote);
    save();
    return true;
  } catch(e) {
    console.warn('[sync] boot pull failed:', e.message);
    return false;
  }
}

// ── syncTryAutoConnect — called at boot ──
async function syncTryAutoConnect() {
  if (syncEnabled()) {
    // Admin browser: authenticated pull
    await syncPull();
  } else {
    // All other browsers: public pull using binId from localStorage or BSCHED_PUBLIC_BIN_ID
    await syncBootPull();
  }
}

// ── Poll every 30 s ──
let _syncInterval = null;
function startSyncPolling() {
  if (_syncInterval) clearInterval(_syncInterval);
  if (!syncCfg.binId) return; // need at least a binId to poll (public or authenticated)
  _syncInterval = setInterval(async () => {
    const ok = syncEnabled() ? await syncPull() : await syncPublicPull();
    // Never re-render arrange or staff pages mid-use — user may have unsaved checkbox/paste state
    const noRerenderPages = new Set(['arrange', 'staff']);
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
  if (!syncCfg.binId) { el.style.display = 'none'; return; }
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
  // First create the bin
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
  const json  = await res.json();
  const binId = json.metadata?.id;
  if (!binId) throw new Error('No bin ID returned');

  // Make it PUBLIC so any browser can read without a key
  await fetch(`https://api.jsonbin.io/v3/b/${binId}/meta/privacy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
    body: JSON.stringify({ private: false }),
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
    const match = bins.find(b => b.name === 'bsched-data');
    return match?.id || (bins.length === 1 ? bins[0].id : null);
  } catch(e) { return null; }
}

// Make existing bin public (called when admin connects to an existing bin)
async function syncMakeBinPublic(binId, apiKey) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${binId}/meta/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
      body: JSON.stringify({ private: false }),
    });
  } catch(e) { /* best-effort */ }
}

// ═══════════════════════════════════════════════
//  SYNC SETTINGS PAGE — admin only
// ═══════════════════════════════════════════════
function renderSyncSettings() {
  const enabled = syncEnabled();
  const hasBin  = !!syncCfg.binId;
  return `
<div class="page-header">
  <div>
    <div class="page-title">☁ Cloud Sync</div>
    <div class="page-sub">Configure once — all users' passwords sync automatically on any browser</div>
  </div>
</div>

<div class="card" style="max-width:600px;">
  ${enabled
    ? `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--C-bg);border:1px solid var(--C-color);border-radius:8px;font-size:12px;color:var(--C-color);">
        <span style="font-size:22px;">☁</span>
        <div><b>Sync is active.</b> Passwords and break data sync automatically.<br>
          <span style="opacity:.7;font-size:11px;">Bin ID: <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">${syncCfg.binId}</code>
          &nbsp;(public read, authenticated write)</span></div>
       </div>`
    : `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--D-bg);border:1px solid var(--D-color);border-radius:8px;font-size:12px;color:var(--D-color);">
        <span style="font-size:22px;">⚠</span>
        <div><b>Not configured.</b> Password changes on one browser won't appear on others.</div>
       </div>`}
</div>

<div class="card" style="max-width:600px;margin-top:0;background:var(--bg3);">
  <div class="card-title">How users get passwords synced (no action needed from them)</div>
  <div style="font-size:12px;color:var(--text2);line-height:2;">
    ✦ User opens app on <b>any browser</b> → app silently reads passwords from cloud (public read, no key)<br>
    ✦ User logs in with <code style="background:var(--bg4);padding:1px 5px;border-radius:3px;">1234</code> → forced to set new password → pushed to cloud<br>
    ✦ Next time on any other browser → latest password already pulled → login works<br>
    ✦ <b>Users never see or configure anything sync-related</b>
  </div>
</div>

<div class="card" style="max-width:600px;margin-top:0;">
  <div class="card-title">🔑 Admin Setup (one time)</div>
  <div style="background:var(--bg3);border-left:3px solid var(--accent);padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:16px;font-size:12px;line-height:2;">
    <b>1</b> → <a href="https://jsonbin.io" target="_blank" style="color:var(--accent);text-decoration:underline;">jsonbin.io</a> → Sign Up Free<br>
    <b>2</b> → Profile icon → <b>API Keys</b> → under <b>Secret Key</b> → <b>Show</b> → copy<br>
    <b>3</b> → Paste below → <b>Connect</b><br>
    <span style="color:var(--text3);font-size:11px;">
      ✦ Bin is auto-created and made <b>publicly readable</b> (no key needed to read)<br>
      ✦ Only writing requires the key (only this browser can push changes)
    </span>
  </div>

  <div class="fg">
    <label>Master Key (Secret Key from JSONBin)</label>
    <div style="display:flex;gap:8px;">
      <input id="sync-api-key" class="login-input" type="password"
        placeholder="$2b$10$…" value="${syncCfg.apiKey || ''}"
        style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;">
      <button class="btn btn-sm" onclick="const i=document.getElementById('sync-api-key');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈';">👁</button>
    </div>
  </div>

  ${hasBin ? `
  <div class="fg" style="margin-top:4px;">
    <label>Bin ID (public — safe to share)</label>
    <div style="display:flex;gap:8px;">
      <input class="login-input" value="${syncCfg.binId}" readonly
        style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text3);">
      <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${syncCfg.binId}');toast('Bin ID copied!','ok')">Copy</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px;">
      Paste this Bin ID into <code style="background:var(--bg3);padding:1px 5px;border-radius:3px;">sync.js</code>
    </div>
  </div>` : ''}

  <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
    <button class="btn btn-accent" onclick="saveSyncCfg()">${enabled ? '🔄 Reconnect' : '⚡ Connect'}</button>
    ${enabled ? `
    <button class="btn" onclick="forceSyncPull()">↓ Pull now</button>
    <button class="btn" onclick="forceSyncPush()">↑ Push now</button>
    <button class="btn btn-err btn-sm" onclick="clearSyncCfg()">Disconnect</button>` : ''}
  </div>
  <div id="sync-test-status" style="font-size:12px;margin-top:12px;min-height:20px;"></div>
</div>

<div class="card" style="max-width:600px;margin-top:0;border-color:var(--err);">
  <div class="card-title" style="color:var(--err);">⚠ Danger Zone</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    Reset this device's local data (schedule, breaks, sync config). Cloud data is not affected.
  </div>
  <button class="btn btn-err btn-sm" onclick="factoryReset()">⚠ Reset This Device</button>
</div>`;
}

async function saveSyncCfg() {
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!apiKey) { status.innerHTML = '<span style="color:var(--err)">Paste your Master Key.</span>'; return; }
  if (!apiKey.startsWith('$2')) { status.innerHTML = '<span style="color:var(--err)">⚠ Key should start with <code>$2b$10$</code></span>'; return; }

  status.innerHTML = '<span style="color:var(--text3)">⏳ Looking for existing bin…</span>';
  let binId = syncCfg.binId || await syncFindBin(apiKey);

  if (!binId) {
    status.innerHTML = '<span style="color:var(--text3)">⏳ Creating public bin…</span>';
    try { binId = await syncCreateBin(apiKey); }
    catch(e) { status.innerHTML = `<span style="color:var(--err)">⚠ ${e.message}</span>`; return; }
  } else {
    // Ensure existing bin is public
    await syncMakeBinPublic(binId, apiKey);
  }

  syncSaveCfg({ binId, apiKey });
  status.innerHTML = '<span style="color:var(--text3)">⏳ Connecting…</span>';

  const ok = await syncPull();
  if (ok) {
    await syncPush(); // push so passwords are in cloud immediately
    status.innerHTML = `<span style="color:var(--ok)">✓ Connected!</span>
      <div style="margin-top:10px;padding:10px 12px;background:var(--A-bg);border:1px solid var(--A-color);border-radius:6px;font-size:11px;line-height:1.9;color:var(--text2);">
        <b style="color:var(--A-color);">⚡ Final step — paste Bin ID into data.js:</b><br>
        Open <code style="background:var(--bg4);padding:1px 5px;border-radius:3px;">data.js</code> → find <code>BSCHED_PUBLIC_BIN_ID</code> near the top → replace with:<br>
        <code style="background:var(--bg4);padding:2px 8px;border-radius:3px;display:inline-block;margin:4px 0;color:var(--ok);">const BSCHED_PUBLIC_BIN_ID = '${binId}';</code><br>
        Save &amp; redeploy. After that, <b>any browser with no setup</b> will pull passwords before login.
      </div>`;
    startSyncPolling();
    updateSyncBadge('ok');
    setTimeout(() => nav('sync'), 2000);
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
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pulled.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) { nav(currentPage); updateBadge(); updateSyncBadge('ok'); }
}

async function forceSyncPush() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML = '<span style="color:var(--text3)">Pushing…</span>';
  const ok = await syncPush();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pushed.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) updateSyncBadge('ok');
}
