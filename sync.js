// ═══════════════════════════════════════════════
//  CLOUD SYNC  (JSONBin.io)
//  • Bin ID is created once and persisted in localStorage.
//  • Clicking Save calls syncWrite() — it never creates a new bin.
//  • syncInit() connects to an existing bin or creates one for
//    the very first time only.
// ═══════════════════════════════════════════════

const SYNC_KEY    = 'bsched_sync_cfg';   // localStorage key for config
const SYNC_API    = 'https://api.jsonbin.io/v3/b';

// ── Load persisted sync config ──────────────────
let syncCfg = (() => {
  try { const d = localStorage.getItem(SYNC_KEY); return d ? JSON.parse(d) : null; } catch(e) { return null; }
})();
// syncCfg shape: { binId, apiKey, enabled }

function _saveSyncCfg(cfg) {
  syncCfg = cfg;
  localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
}

// ── Status badge helper ─────────────────────────
function _setSyncBadge(text, color) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  el.style.display = text ? '' : 'none';
  el.textContent   = text || '';
  el.style.color   = color || 'var(--text-muted, #888)';
}

// ══════════════════════════════════════════════════
//  syncWrite  — called by save-actions throughout
//  the app (e.g. assign break, approve request …).
//  Only runs if sync is enabled and a bin ID exists.
// ══════════════════════════════════════════════════
async function syncWrite() {
  save(); // always persist locally first

  if (!syncCfg?.enabled || !syncCfg?.binId || !syncCfg?.apiKey) return;

  _setSyncBadge('↑ saving…', '#f0a500');
  try {
    const res = await fetch(`${SYNC_API}/${syncCfg.binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': syncCfg.apiKey,
      },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _setSyncBadge('✓ synced', '#4caf82');
    setTimeout(() => _setSyncBadge('', ''), 3000);
  } catch(e) {
    console.warn('[sync] write failed:', e.message);
    _setSyncBadge('⚠ sync err', '#e05252');
  }
}

// ══════════════════════════════════════════════════
//  syncRead  — pull latest state from the cloud bin.
//  Merges remote state into local, then refreshes UI.
// ══════════════════════════════════════════════════
async function syncRead() {
  if (!syncCfg?.enabled || !syncCfg?.binId || !syncCfg?.apiKey) return;

  _setSyncBadge('↓ loading…', '#5b9cf6');
  try {
    const res = await fetch(`${SYNC_API}/${syncCfg.binId}/latest`, {
      headers: { 'X-Master-Key': syncCfg.apiKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const remote = json.record;
    if (remote && typeof remote === 'object') {
      // Merge remote into local state (remote wins)
      Object.assign(state, remote);
      save();
      if (typeof renderPage === 'function') renderPage(currentPage || 'dashboard');
      _setSyncBadge('✓ loaded', '#4caf82');
      setTimeout(() => _setSyncBadge('', ''), 3000);
    }
  } catch(e) {
    console.warn('[sync] read failed:', e.message);
    _setSyncBadge('⚠ sync err', '#e05252');
  }
}

// ══════════════════════════════════════════════════
//  syncInit  — called from the Cloud Sync settings
//  page when the user clicks Connect.
//  • If a binId is already stored → just re-enables.
//  • Only creates a new bin when there is genuinely
//    no binId saved anywhere.
// ══════════════════════════════════════════════════
async function syncInit(apiKey) {
  if (!apiKey) { toast('Enter an API key first', 'err'); return; }

  // ── Already have a bin ID saved? Just re-enable. ──
  if (syncCfg?.binId) {
    _saveSyncCfg({ ...syncCfg, apiKey, enabled: true });
    toast('Cloud sync re-connected (existing bin)', 'ok');
    _setSyncBadge('✓ connected', '#4caf82');
    if (typeof renderPage === 'function') renderPage('sync');
    return;
  }

  // ── First-ever setup: create a new bin ────────────
  _setSyncBadge('⚙ creating…', '#f0a500');
  try {
    const res = await fetch(SYNC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
        'X-Bin-Name':   'bsched-data',
        'X-Bin-Private':'true',
      },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const binId = json.metadata?.id;
    if (!binId) throw new Error('No bin ID in response');

    _saveSyncCfg({ binId, apiKey, enabled: true });
    toast('Cloud sync connected — new bin created', 'ok');
    _setSyncBadge('✓ connected', '#4caf82');
    if (typeof renderPage === 'function') renderPage('sync');
  } catch(e) {
    console.warn('[sync] init failed:', e.message);
    toast('Sync setup failed: ' + e.message, 'err');
    _setSyncBadge('⚠ failed', '#e05252');
  }
}

// ══════════════════════════════════════════════════
//  syncDisconnect  — disables sync without deleting
//  the stored bin ID, so reconnecting later reuses it.
// ══════════════════════════════════════════════════
function syncDisconnect() {
  if (syncCfg) {
    _saveSyncCfg({ ...syncCfg, enabled: false });
  }
  _setSyncBadge('', '');
  toast('Cloud sync disconnected', 'warn');
  if (typeof renderPage === 'function') renderPage('sync');
}

// ══════════════════════════════════════════════════
//  syncForgetBin  — wipes stored bin ID entirely.
//  Next syncInit() will create a brand new bin.
//  Exposed for the UI settings panel only.
// ══════════════════════════════════════════════════
function syncForgetBin() {
  localStorage.removeItem(SYNC_KEY);
  syncCfg = null;
  _setSyncBadge('', '');
  toast('Sync config cleared — next connect will create a new bin', 'warn');
  if (typeof renderPage === 'function') renderPage('sync');
}

// ══════════════════════════════════════════════════
//  syncRenderPage  — renders the Cloud Sync UI page.
//  Called by nav.js when the user clicks ☁ Cloud Sync.
// ══════════════════════════════════════════════════
function syncRenderPage() {
  const connected = !!(syncCfg?.enabled && syncCfg?.binId);
  const hasBin    = !!syncCfg?.binId;
  const binId     = syncCfg?.binId || '—';
  const apiKey    = syncCfg?.apiKey || '';

  return `
  <div class="page-header"><h1>☁ Cloud Sync</h1></div>
  <div class="card" style="max-width:560px;margin:0 auto;">
    <div style="margin-bottom:16px;">
      <strong>Status:</strong>
      <span style="margin-left:8px;color:${connected ? '#4caf82' : '#e05252'}">
        ${connected ? '● Connected' : hasBin ? '○ Disconnected (bin saved)' : '○ Not set up'}
      </span>
    </div>

    ${hasBin ? `<div style="margin-bottom:12px;font-size:12px;color:var(--text-muted,#888);">
      Bin ID: <code style="user-select:all;">${binId}</code>
    </div>` : ''}

    ${!connected ? `
    <label class="form-label">JSONBin Master API Key</label>
    <input id="sync-key-input" type="password" class="form-input" placeholder="$2a$10$…" value="${apiKey}" style="margin-bottom:12px;" />
    <button class="btn btn-primary" onclick="syncInit(document.getElementById('sync-key-input').value.trim())">
      ${hasBin ? 'Reconnect' : 'Connect & Create Bin'}
    </button>
    ` : `
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="syncRead()">↓ Pull from Cloud</button>
      <button class="btn btn-primary" onclick="syncWrite()">↑ Push to Cloud</button>
      <button class="btn" onclick="syncDisconnect()" style="background:var(--danger-bg,#3a1a1a);color:var(--danger,#e05252);">Disconnect</button>
    </div>
    `}

    ${hasBin && connected ? `
    <hr style="margin:20px 0;border-color:var(--border,#333);">
    <details>
      <summary style="cursor:pointer;color:var(--text-muted,#888);font-size:12px;">Advanced</summary>
      <div style="margin-top:12px;">
        <button class="btn" onclick="if(confirm('This forgets the saved bin ID. A new bin will be created on next connect.')) syncForgetBin();"
          style="background:var(--danger-bg,#3a1a1a);color:var(--danger,#e05252);font-size:12px;">
          ✕ Forget Bin &amp; Reset
        </button>
      </div>
    </details>` : ''}
  </div>`;
}
