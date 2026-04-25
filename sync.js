// ═══════════════════════════════════════════════
//  CLOUD SYNC — JSONBin.io free backend
//  Breaks, requests, extBreaks sync across all
//  browsers and devices automatically.
//
//  Admin setup (one-time):
//   1. jsonbin.io → sign up free → New Bin → {}
//   2. Copy Bin ID + Master Key
//   3. Enter in Cloud Sync menu (Admin only)
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

// ── Pull cloud → overwrite local operational data ──
async function syncPull() {
  if (!syncEnabled()) return false;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}/latest`, {
      headers: { 'X-Master-Key': syncCfg.apiKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json   = await res.json();
    const remote = json.record || {};
    if (remote.breaks)    state.breaks    = remote.breaks;
    if (remote.requests)  state.requests  = remote.requests;
    if (remote.extBreaks) state.extBreaks = remote.extBreaks;
    // Also sync staffInfo (passwords, mustChangePassword) across devices
    if (remote.staffInfo) {
      // Merge: keep local non-password fields, take cloud passwords/flags
      Object.entries(remote.staffInfo).forEach(([u, d]) => {
        if (!state.staffInfo[u]) state.staffInfo[u] = {};
        if (d.password)          state.staffInfo[u].password          = d.password;
        if (d.mustChangePassword !== undefined) state.staffInfo[u].mustChangePassword = d.mustChangePassword;
      });
    }
    save();
    return true;
  } catch(e) {
    console.warn('[sync] pull failed:', e.message);
    return false;
  }
}

// ── Push local → cloud ──
async function syncPush() {
  if (!syncEnabled()) return false;
  try {
    // Build a compact staffInfo snapshot (only password fields — not PII)
    const staffInfoPw = {};
    Object.entries(state.staffInfo).forEach(([u, d]) => {
      staffInfoPw[u] = { password: d.password || '1234', mustChangePassword: d.mustChangePassword !== false };
    });
    const payload = {
      breaks:    state.breaks,
      requests:  state.requests,
      extBreaks: state.extBreaks,
      staffInfo: staffInfoPw,
      _updated:  Date.now(),
    };
    const res = await fetch(`https://api.jsonbin.io/v3/b/${syncCfg.binId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': syncCfg.apiKey },
      body:    JSON.stringify(payload),
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

// ── syncWrite: used by assign, approve, extbreak etc. ──
async function syncWrite() {
  updateSyncBadge('busy');
  save();
  if (syncEnabled()) {
    const ok = await syncPush();
    updateSyncBadge(ok ? 'ok' : 'err');
  } else {
    updateSyncBadge('err');
  }
}

// ── Auto-poll every 30 s ──
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
function stopSyncPolling() { if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; } }

// ── Badge ──
function updateSyncBadge(status) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  if (!syncEnabled()) { el.style.display='none'; return; }
  el.style.display = '';
  const map = { ok:['☁ Synced','var(--ok)'], err:['☁ Offline','var(--warn)'], busy:['☁ Syncing…','var(--text3)'] };
  const [text, color] = map[status] || map.err;
  el.textContent = text; el.style.color = color;
}

// ── Sync Settings page (admin only) ──
function renderSyncSettings() {
  const enabled = syncEnabled();
  return `
<div class="page-header">
  <div>
    <div class="page-title">☁ Cloud Sync</div>
    <div class="page-sub">Break data stored on JSONBin.io — shared across all browsers & devices</div>
  </div>
</div>

<div class="card" style="max-width:560px;">
  <div class="card-title">Connection Status</div>
  ${enabled
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--C-bg);border:1px solid var(--C-color);border-radius:6px;font-size:12px;color:var(--C-color);">
        <span style="font-size:16px;">☁</span>
        <div><b>Sync active.</b> Break assignments, requests and 30-min registrations sync automatically every 30 s and on every save.</div>
       </div>`
    : `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--D-bg);border:1px solid var(--D-color);border-radius:6px;font-size:12px;color:var(--D-color);">
        <span style="font-size:16px;">⚠</span>
        <div><b>Not configured.</b> Data is stored locally on this browser only. Other devices won't see updates.</div>
       </div>`}
</div>

<div class="card" style="max-width:560px;margin-top:0;">
  <div class="card-title">JSONBin.io Setup</div>
  <div style="font-size:12px;color:var(--text2);line-height:1.9;margin-bottom:16px;">
    <b style="color:var(--text);">Quick setup (2 min, free):</b><br>
    1. <a href="https://jsonbin.io" target="_blank" style="color:var(--accent);">jsonbin.io</a> → Sign Up Free<br>
    2. Dashboard → <b>Create Bin</b> → paste <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">{}</code> → Save<br>
    3. Copy the <b>Bin ID</b> from the URL (e.g. <code style="background:var(--bg3);padding:1px 6px;border-radius:3px;">683abc12…</code>)<br>
    4. Top-right → <b>API Keys</b> → copy Master Key<br>
    5. Paste both below → Save &amp; Connect
  </div>
  <div class="fg">
    <label>Bin ID</label>
    <input id="sync-bin-id" class="login-input" placeholder="683abc12ef5d2c3b4a..." value="${syncCfg.binId||''}">
  </div>
  <div class="fg" style="margin-top:8px;">
    <label>Master API Key</label>
    <input id="sync-api-key" class="login-input" type="password" placeholder="$2b$10$..." value="${syncCfg.apiKey||''}">
  </div>
  <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
    <button class="btn btn-accent" onclick="saveSyncCfg()">Save &amp; Connect</button>
    ${enabled ? `
    <button class="btn" onclick="forceSyncPull()">↓ Pull now</button>
    <button class="btn" onclick="forceSyncPush()">↑ Push now</button>
    <button class="btn btn-err btn-sm" onclick="clearSyncCfg()">Disconnect</button>` : ''}
  </div>
  <div id="sync-test-status" style="font-size:12px;margin-top:10px;min-height:18px;"></div>
</div>

<div class="card" style="max-width:560px;margin-top:0;background:var(--bg3);">
  <div class="card-title">What syncs</div>
  <div style="font-size:12px;color:var(--text2);line-height:1.9;">
    ✦ <b>Break assignments</b> — synced on every save<br>
    ✦ <b>Swap requests &amp; approvals</b> — synced instantly<br>
    ✦ <b>30-min extra break registrations</b> — synced instantly<br>
    ✦ <b>Passwords (hashed)</b> — so first-login flag works everywhere<br>
    ✦ <b>Staff schedules &amp; info</b> — local only (import once per device via Excel/paste)
  </div>
</div>`;
}

async function saveSyncCfg() {
  const binId  = document.getElementById('sync-bin-id').value.trim();
  const apiKey = document.getElementById('sync-api-key').value.trim();
  const status = document.getElementById('sync-test-status');
  if (!binId || !apiKey) { status.innerHTML='<span style="color:var(--err)">Enter both fields.</span>'; return; }
  status.innerHTML='<span style="color:var(--text3)">Testing…</span>';
  syncSaveCfg({ binId, apiKey });
  const ok = await syncPull();
  if (ok) {
    status.innerHTML='<span style="color:var(--ok)">✓ Connected! Data pulled.</span>';
    startSyncPolling(); updateSyncBadge('ok'); nav(currentPage);
  } else {
    status.innerHTML='<span style="color:var(--err)">⚠ Failed — check Bin ID and Key.</span>';
    syncSaveCfg({});
  }
}
function clearSyncCfg() {
  if (!confirm('Disconnect cloud sync?')) return;
  syncSaveCfg({}); stopSyncPolling(); updateSyncBadge('err'); nav('sync');
}
async function forceSyncPull() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML='<span style="color:var(--text3)">Pulling…</span>';
  const ok = await syncPull();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pulled.</span>' : '<span style="color:var(--err)">Failed.</span>';
  if (ok) { nav(currentPage); updateBadge(); }
}
async function forceSyncPush() {
  const s = document.getElementById('sync-test-status');
  s.innerHTML='<span style="color:var(--text3)">Pushing…</span>';
  const ok = await syncPush();
  s.innerHTML = ok ? '<span style="color:var(--ok)">✓ Pushed.</span>' : '<span style="color:var(--err)">Failed.</span>';
}
