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
  return !!(syncCfg.dbUrl);
}

// ── Load sync-config.json (always fresh — never use stale localStorage) ──
let _cachedDbUrl = null;

async function loadSyncConfig() {
  try {
    const res = await fetch('./sync-config.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    const dbUrl = (cfg.dbUrl || '').replace(/\/$/, '');
    if (!dbUrl) return null;
    // Only use apiKey from sync-config.json — never from localStorage cache
    // This prevents stale/revoked secrets from being used
    syncSaveCfg({
      dbUrl:  dbUrl,
      apiKey: cfg.apiKey || '', // empty if not in config file
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
const FB_PATH = '/bsched.json';

function _fbUrl(dbUrl, secret) {
  // secret param kept for signature compatibility but no longer used
  return `${dbUrl}${FB_PATH}`;
}

async function _fbGet(dbUrl, secret) {
  const token = typeof firebaseGetIdToken === 'function' ? await firebaseGetIdToken() : null;
  const url   = token
    ? `${dbUrl}${FB_PATH}?auth=${token}`
    : `${dbUrl}${FB_PATH}${secret ? '?auth=' + encodeURIComponent(secret) : ''}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401 || res.status === 403) throw new Error('HTTP ' + res.status);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const wrapper = await res.json();
  if (!wrapper || !wrapper.data) return {};
  
  const rawData = wrapper.data;
  let decompressed;
  if (rawData && rawData.startsWith('{')) {
    decompressed = rawData;
  } else {
    decompressed = LZString.decompressFromUTF16(rawData);
  }
  return JSON.parse(decompressed || '{}');
}

async function _fbPut(dbUrl, secret, data) {
  const token = typeof firebaseGetIdToken === 'function' ? await firebaseGetIdToken() : null;

  if (!token && !secret) throw new Error('No auth token or API key — cannot write');

  const url = token
    ? `${dbUrl}${FB_PATH}?auth=${token}`
    : `${dbUrl}${FB_PATH}?auth=${encodeURIComponent(secret)}`;

  const putBody = {
    ...data,
    data: LZString.compressToUTF16(data.data)
  };

  const res = await fetch(url, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(putBody),
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
  if (remote.requests)    state.requests    = remote.requests;
  if (remote.extBreaks)   state.extBreaks   = remote.extBreaks;
  if (remote.breakSplits) {
    const localAt  = state._breakSplitsUpdatedAt || 0;
    const remoteAt = remote._breakSplitsUpdatedAt || 0;
    if (remoteAt >= localAt) {
      state.breakSplits = remote.breakSplits;
      state._breakSplitsUpdatedAt = remoteAt;
    }
  }
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

      // ── Auto-assign breaks when GAS pushes a new schedule ──
      const isLeaderOrAbove = typeof currentUser !== 'undefined' && currentUser &&
        (isLeader(currentUser) || isTraining(currentUser) || isAdmin(currentUser));
      if (isLeaderOrAbove && typeof autoAssignBreaks === 'function') {
        console.log('[sync] new schedule from GAS — running auto-assign');
        autoAssignBreaks(state.users);
        setTimeout(() => { if (typeof syncWrite === 'function') syncWrite(); }, 500);
      }
    }
  }
  if (remote.logbook) {
    Object.entries(remote.logbook).forEach(([key, remoteEntry]) => {
      const localEntry = state.logbook[key];
      const remoteAt = remoteEntry.at || 0;
      const localAt  = localEntry?.at || 0;
      if (!localEntry || remoteAt >= localAt) {
        if (remoteEntry._deleted) {
          // Remote tombstone is newer — delete locally too
          delete state.logbook[key];
        } else {
          state.logbook[key] = remoteEntry;
        }
      }
    });
  }
  if (remote.monthlyAttendance) {
    if (!state.monthlyAttendance) state.monthlyAttendance = {};
    // Merge per username → monthKey → dateKey
    Object.entries(remote.monthlyAttendance).forEach(([username, months]) => {
      if (!state.monthlyAttendance[username]) state.monthlyAttendance[username] = {};
      Object.entries(months || {}).forEach(([mk, dates]) => {
        // Remote wins — monthly attendance is imported by admin, not edited per-device
        state.monthlyAttendance[username][mk] = dates;
      });
    });
  }
  if (remote.workingTime) {
    if (!state.workingTime) state.workingTime = {};
    Object.entries(remote.workingTime).forEach(([username, months]) => {
      if (!state.workingTime[username]) state.workingTime[username] = {};
      Object.entries(months || {}).forEach(([mk, entry]) => {
        state.workingTime[username][mk] = entry;
      });
    });
  }

  // Policy Compliance records
if (remote.policyCompliance && remote.policyCompliance.length > 0) {
  // Only overwrite local if remote has more records or local is empty
  if (!state.policyCompliance || state.policyCompliance.length === 0
      || remote.policyCompliance.length >= state.policyCompliance.length) {
    // Preserve local agent feedback / status edits that are newer
    var pcMap = {};
    (state.policyCompliance || []).forEach(function(r) {
      if (r.no) pcMap[r.no] = r;
    });
    state.policyCompliance = remote.policyCompliance.map(function(r) {
      var local = pcMap[r.no];
      if (local) {
        // Keep whichever feedback/status was set more recently
        return Object.assign({}, r, {
          agentFeedback:        local.agentFeedback || r.agentFeedback,
          feedbackReadByLeader: local.feedbackReadByLeader || r.feedbackReadByLeader,
          leaderConfirm:        local.leaderConfirm || r.leaderConfirm,
          status:               local.status || r.status,
          mailCheck:            local.mailCheck || r.mailCheck,
        });
      }
      return Object.assign({}, r);
    });
  }
}
  if (remote.staffInfo) {
   Object.entries(remote.staffInfo).forEach(([uname, si]) => {
     if (!state.staffInfo[uname]) state.staffInfo[uname] = {};
     state.staffInfo[uname].name   = si.name   || state.staffInfo[uname].name   || '';
     state.staffInfo[uname].role   = si.role   || state.staffInfo[uname].role   || '';
     state.staffInfo[uname].gender = si.gender || state.staffInfo[uname].gender || '';
     if (si.empNo)  state.staffInfo[uname].empNo  = si.empNo;
     if (si.dob)    state.staffInfo[uname].dob    = si.dob;
     if (si.phone)  state.staffInfo[uname].phone  = si.phone;
     if (si.active === false) state.staffInfo[uname].active = false;
     else if (si.active === true) state.staffInfo[uname].active = true;
     // password never applied from cloud — local only
     // Cloud ALWAYS wins for mustChangePassword — never let seed override it
     // If cloud explicitly says false, user already changed pw → never prompt again
     if (si.mustChangePassword === false) {
       state.staffInfo[uname].mustChangePassword = false;
       // Also set localStorage flag so check in doLogin passes too
       localStorage.setItem('pw_changed_' + uname, '1');
     } else if (si.mustChangePassword === true) {
       // Only set true if localStorage flag not already set (user changed on this device before)
       if (localStorage.getItem('pw_changed_' + uname) !== '1') {
         state.staffInfo[uname].mustChangePassword = true;
       }
     }
   });
   save(); // persist merged staffInfo immediately
 }

  if (remote.slackAutoPost && typeof remote.slackAutoPost === 'object') {
    state.slackAutoPost = Object.assign({}, state.slackAutoPost || {}, remote.slackAutoPost);
  }

  if (remote.gasConfig && typeof remote.gasConfig === 'object') {
    state.gasConfig = Object.assign({}, state.gasConfig || {}, remote.gasConfig);
  }

  // Shift config versioning: remote wins if newer
  if (remote.shiftConfig) {
    var localSCAt  = state._shiftConfigUpdatedAt || 0;
    var remoteSCAt = remote._shiftConfigUpdatedAt || 0;
    if (remoteSCAt >= localSCAt) {
      state.shiftConfig = remote.shiftConfig;
      if (remoteSCAt) state._shiftConfigUpdatedAt = remoteSCAt;
    }
  }

  // staffSchedule: remote always wins (GAS is authoritative)
  if (remote.staffSchedule && typeof remote.staffSchedule === 'object') {
    state.staffSchedule = remote.staffSchedule;
  }
  // Migration shim: copy old u.schedule from remote users into staffSchedule
  if (remote.users && Array.isArray(remote.users)) {
    if (!state.staffSchedule) state.staffSchedule = {};
    remote.users.forEach(function(u) {
      if (u.username && u.schedule && Object.keys(u.schedule).length > 0) {
        if (!state.staffSchedule[u.username]) state.staffSchedule[u.username] = {};
        Object.keys(u.schedule).forEach(function(k) {
          if (!state.staffSchedule[u.username][k]) state.staffSchedule[u.username][k] = u.schedule[k];
        });
      }
    });
  }

  // Self-healing: Prune any corrupted usernames from state
  const isCorruptedUsername = function(uname) {
    if (!uname) return true;
    uname = String(uname).trim();
    if (uname.indexOf(' ') !== -1) return true;
    if (/[A-Z]/.test(uname)) return true;
    if (/[^\x00-\x7F]/.test(uname)) return true;
    if (uname === 'start' || uname === 'agent' || uname === 'qa') return true;
    if (uname.indexOf(':') !== -1) return true;
    return false;
  };

  if (state.users && Array.isArray(state.users)) {
    state.users = state.users.filter(function(u) {
      return !isCorruptedUsername(u.username);
    });
  }
  if (state.staffInfo) {
    Object.keys(state.staffInfo).forEach(function(uname) {
      if (isCorruptedUsername(uname)) {
        delete state.staffInfo[uname];
      }
    });
  }
  if (state.staffSchedule) {
    Object.keys(state.staffSchedule).forEach(function(uname) {
      if (isCorruptedUsername(uname)) {
        delete state.staffSchedule[uname];
      }
    });
  }

  // Migration: convert legacy time-string slots to short codes in memory.
  // Runs on every pull so old Firebase records are progressively updated.
  Object.values(state.breaks || {}).forEach(function(r) {
    if (!r || !r.slot) return;
    if (r.slot.length <= 3) return; // already a short code
    var shiftKeys = Object.keys(BREAK_SLOTS);
    for (var _si = 0; _si < shiftKeys.length; _si++) {
      var _sh = shiftKeys[_si];
      var _code = typeof getShortSlot === 'function' ? getShortSlot(_sh, r.slot) : '';
      if (_code && _code.length === 2 && _code[0] === _sh) { r.slot = _code; break; }
    }
  });
}

// ── Push to Firebase ──
async function syncPush() {
  if (!syncEnabled()) return false;
  try {
    
    const staffInfoCloud = {};
Object.entries(state.staffInfo || {}).forEach(([uname, si]) => {
  staffInfoCloud[uname] = {
    name:               si.name               || '',
    role:               si.role               || '',
    gender:             si.gender             || '',
    empNo:              si.empNo              || '',
    dob:                si.dob                || '',
    active:             si.active !== false,
    phone:              si.phone              || '',
    mustChangePassword: si.mustChangePassword === true ? true : false,
  };
});
    const usersCompact = state.users.map(u => ({
      id: u.id, username: u.username, name: u.name,
      team: u.team, role: u.role, gender: u.gender || '',
      empNo: u.empNo || '',
    }));
    // Seed shiftConfig baseline if not yet set
    if (!state.shiftConfig || state.shiftConfig.length === 0) {
      state.shiftConfig = [{ effectiveFrom: null, breakSlots: Object.assign({}, BREAK_SLOTS) }];
      state._shiftConfigUpdatedAt = Date.now();
    }

    const payload = {
  breaks:            state.breaks,
  requests:          state.requests,
  extBreaks:         state.extBreaks,
  breakSplits:       state.breakSplits || {},
  logbook:           state.logbook || {},
  monthlyAttendance: state.monthlyAttendance || {},
  workingTime:       state.workingTime       || {},
  staffSchedule:     state.staffSchedule || {},
  users:             usersCompact,
  staffInfo:         staffInfoCloud,
  policyCompliance:  state.policyCompliance || [],
  slackAutoPost:     state.slackAutoPost    || {},
  gasConfig:         state.gasConfig        || {},
  shiftConfig:           state.shiftConfig          || [],
  _updated:          Date.now(),
  _breaksUpdatedAt:       state._breaksUpdatedAt       || Date.now(),
  _breakSplitsUpdatedAt:  state._breakSplitsUpdatedAt  || 0,
  _shiftConfigUpdatedAt:  state._shiftConfigUpdatedAt  || 0,
  _usersUpdatedAt:        state._usersUpdatedAt         || 0,
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

async function wipeStaffPasswords() {
  if (!syncEnabled()) { toast('Sync not connected.', 'err'); return; }
  const status = document.getElementById('wipe-status');
  if (status) status.innerHTML = '<span style="color:var(--text3)">⏳ Wiping old passwords…</span>';
 
  try {
    const remote = await _fbGet(syncCfg.dbUrl, syncCfg.apiKey);
 
    // Remove staffPasswords node entirely
    delete remote.staffPasswords;
 
    // Remove password field from each staffInfo entry
    if (remote.staffInfo) {
      Object.values(remote.staffInfo).forEach(si => {
        delete si.password;
      });
    }
 
    await _fbPut(syncCfg.dbUrl, syncCfg.apiKey, { data: JSON.stringify(remote) });
 
    if (status) status.innerHTML = '<span style="color:var(--ok)">✓ Done — old passwords removed from database.</span>';
    toast('✓ Old passwords wiped from Firebase DB.', 'ok');
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--err)">Failed: ${e.message}</span>`;
    toast('Failed: ' + e.message, 'err');
  }
}

// ── Boot ──
async function syncTryAutoConnect() {
  await loadSyncConfig();
  // Don't attempt REST pull at boot — no Firebase Auth token yet
  // WebSocket listener will connect after login via startSyncPolling()
  // Only pull if we have a valid auth token (post-login)
  const token = typeof firebaseGetIdToken === 'function' ? await firebaseGetIdToken() : null;
  if (!token) {
    console.log('[sync] syncTryAutoConnect: no auth token yet — skipping pre-login pull');
    return false;
  }
  if (syncEnabled() || syncCfg.dbUrl) {
    const ok = await syncPull();
    return ok ? true : 'error';
  }
  return false;
}

// ═══════════════════════════════════════════════
//  REALTIME LISTENER — Firebase WebSocket (delta only)
//  Replaces REST polling — sends only changes, not full payload
//  Falls back to 60s REST poll if WebSocket unavailable
// ═══════════════════════════════════════════════
let _fbListener      = null; // Firebase WebSocket listener ref
let _syncInterval    = null; // fallback REST poll interval
let _lastRemoteTs    = 0;    // track last seen _updated timestamp

// ── Notification helpers (extracted from old polling block) ──
function _checkNotifications(prevState) {
  if (typeof currentUser === 'undefined' || !currentUser) return;

  const newPendingReqs = (state.requests || []).filter(r => r.status === 'pending').length;
  const newPendingExts = Object.values(state.extBreaks || {})
    .flatMap(arr => arr || [])
    .filter(e => !e.status || e.status === 'pending').length;
  const newMyResolved = (state.requests || [])
    .filter(r => r.userId === currentUser.id && r.status !== 'pending').length;
  const newMyExtApproved = Object.entries(state.extBreaks || {})
    .filter(([k]) => k.startsWith(currentUser.id + '_'))
    .flatMap(([, arr]) => arr || [])
    .filter(e => e.status === 'approved' || e.status === 'rejected').length;

  if (isLeader(currentUser) && newPendingReqs > prevState.pendingReqs)
    toast(`🔄 ${newPendingReqs - prevState.pendingReqs} new break swap request(s)`, 'warn');
  if (isLeader(currentUser) && newPendingExts > prevState.pendingExts)
    toast(`🌸 ${newPendingExts - prevState.pendingExts} new 30-min break request(s)`, 'warn');
  if (newMyResolved > prevState.myResolved) {
    const latest = (state.requests || [])
      .filter(r => r.userId === currentUser.id && r.status !== 'pending')
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0))[0];
    if (latest)
      toast(`🔄 Your swap request: ${latest.status.toUpperCase()}`, latest.status === 'approved' ? 'ok' : 'err');
  }
  if (newMyExtApproved > prevState.myExtApproved)
    toast('🌸 Your 30-min break request was updated', 'ok');
}

function _snapState() {
  return {
    pendingReqs:    (state.requests || []).filter(r => r.status === 'pending').length,
    pendingExts:    Object.values(state.extBreaks || {}).flatMap(a => a || []).filter(e => !e.status || e.status === 'pending').length,
    myResolved:     currentUser ? (state.requests || []).filter(r => r.userId === currentUser.id && r.status !== 'pending').length : 0,
    myExtApproved:  currentUser ? Object.entries(state.extBreaks || {}).filter(([k]) => k.startsWith(currentUser.id + '_')).flatMap(([, a]) => a || []).filter(e => e.status === 'approved' || e.status === 'rejected').length : 0,
  };
}

function _onRemoteUpdate(remote) {
  if (!remote || typeof remote !== 'object') return;

  // Skip if no new data (compare _updated timestamp)
  const remoteTs = remote._updated || 0;
  if (remoteTs && remoteTs <= _lastRemoteTs) return;
  _lastRemoteTs = remoteTs;

  const prev = _snapState();
  _applyRemoteData(remote);
  save();
  _checkNotifications(prev);

  // Re-render if no modal open
  const noRerenderPages = new Set(['arrange', 'staff']);
  if (typeof currentPage !== 'undefined' && !noRerenderPages.has(currentPage)) {
    const pcModalOpen  = document.getElementById('pc-modal')?.style.display === 'flex';
    const anyModalOpen = !!document.querySelector('.modal-overlay.show') || pcModalOpen;
    var _attSuppressed = currentPage === 'attendance'
      && window._attLastSavedAt
      && (Date.now() - window._attLastSavedAt < 5000);
    if (!anyModalOpen && !_attSuppressed) { nav(currentPage); updateBadge(); }
  }
  updateSyncBadge('ok');
}

// ── Start WebSocket listener via Firebase SDK ──
function _startFirebaseListener() {
  const dbUrl = syncCfg.dbUrl || _cachedDbUrl;
  if (!dbUrl) return false;

  // Firebase Realtime Database SDK must be loaded
  if (typeof firebase === 'undefined' || !firebase.database) {
    console.warn('[sync] Firebase SDK not available for WebSocket listener');
    return false;
  }

  try {
    // Stop existing listener
    if (_fbListener) {
      try { _fbListener.off(); } catch(e) {}
      _fbListener = null;
    }

    // Guard: ensure Firebase app and database are initialized
    if (typeof firebase === 'undefined') return false;
    let db;
    try {
      db = firebase.database();
    } catch(e) {
      console.warn('[sync] firebase.database() not ready:', e.message);
      return false;
    }
    if (!db) return false;
    const ref = db.ref('bsched');


    // .on('value') uses WebSocket — fires once on connect, then only on changes
    // This sends DELTAS not full payload = ~95% bandwidth reduction
    ref.on('value', (snapshot) => {
      try {
        const wrapper = snapshot.val();
        if (!wrapper || !wrapper.data) return;
        const remote = JSON.parse(wrapper.data);
        _onRemoteUpdate(remote);
      } catch (e) {
        console.warn('[sync] WebSocket parse error:', e.message);
      }
    }, (err) => {
      console.warn('[sync] WebSocket listener error:', err.message);
      updateSyncBadge('err');
      // Fall back to REST polling
      _startFallbackPolling();
    });

    _fbListener = ref;
    console.log('[sync] WebSocket listener active — delta sync enabled');
    return true;
  } catch (e) {
    console.warn('[sync] Failed to start WebSocket listener:', e.message);
    return false;
  }
}

// ── Fallback: 60s REST poll (used if WebSocket unavailable) ──
function _startFallbackPolling() {
  if (_syncInterval) return; // already running
  console.log('[sync] Starting 60s fallback REST polling');
  _syncInterval = setInterval(async () => {
    if (!syncCfg.dbUrl && !_cachedDbUrl) { stopSyncPolling(); updateSyncBadge('err'); return; }

    // Skip poll if tab is hidden — saves bandwidth when user switches tabs
    if (document.hidden) return;

    const ok = syncEnabled() ? await syncPull() : await syncPublicPull();
    if (ok === true) {
      const noRerenderPages = new Set(['arrange', 'staff', 'attendance']);
      if (typeof currentPage !== 'undefined' && !noRerenderPages.has(currentPage)) {
        const pcModalOpen  = document.getElementById('pc-modal')?.style.display === 'flex';
        const anyModalOpen = !!document.querySelector('.modal-overlay.show') || pcModalOpen;
        if (!anyModalOpen) { nav(currentPage); updateBadge(); }
      }
    }
    if (!ok) updateSyncBadge('err');
  }, 60 * 1000);
}

// ── Main entry: try WebSocket first, fall back to REST ──
function startSyncPolling() {
  stopSyncPolling(); // clear any existing

  const wsStarted = _startFirebaseListener();
  if (!wsStarted) {
    // WebSocket not available — use 60s REST polling
    _startFallbackPolling();
  }
}

function stopSyncPolling() {
  // Stop WebSocket listener
  if (_fbListener) {
    try { _fbListener.off(); } catch(e) {}
    _fbListener = null;
  }
  // Stop REST polling
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
  console.log('[sync] Polling stopped');
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
  el.textContent = txt;
  el.style.color = col;
  el.title = status === 'busy' ? 'Syncing…' : 'Click to sync now';
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

<!-- Firebase Auth — Password Cleanup (add BEFORE Danger Zone card) -->
<div class="card" style="max-width:620px;margin-top:0;border-color:var(--warn);">
  <div class="card-title" style="color:var(--warn);">🔐 Firebase Auth — Password Cleanup</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    Removes old plaintext passwords from Firebase Realtime Database.<br>
    Run this <b>once</b> after deploying Firebase Auth.
  </div>
  <button class="btn btn-warn btn-sm" onclick="wipeStaffPasswords()">🗑 Wipe Old Passwords from DB</button>
  <div id="wipe-status" style="font-size:11px;color:var(--text3);margin-top:8px;min-height:16px;"></div>
</div>

<!-- GAS Function Controls -->
<div class="card" style="max-width:620px;margin-top:0;">
  <div class="card-title">⚙ GAS Function Controls</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:14px;line-height:1.7;">
    Enable or disable individual Google Apps Script sync functions. Changes apply on the next scheduled run.
    All functions are <b>ON</b> by default.
  </div>
  ${[
    { key:'syncAttendance',         label:'Import Attendance',         dir:'Sheets → Firebase',  desc:'Daily 6AM — imports attendance codes from the Attendance sheet' },
    { key:'syncSchedule',           label:'Import Schedule',           dir:'Sheets → Firebase',  desc:'Daily 6AM — imports staff shift schedule from the Schedule sheet' },
    { key:'syncLogbook',            label:'Import Logbook',            dir:'Sheets → Firebase',  desc:'Daily 6AM — imports clock-in/out times from Logbook sheets' },
    { key:'syncPolicy',             label:'Import Policy Violations',  dir:'Sheets → Firebase',  desc:'Daily 00:00 — imports policy violation records from the Policy sheet' },
    { key:'writebackShiftA', label:'Writeback — Shift A', dir:'Firebase → Sheets', desc:'Daily 15:30 — writes Shift A logbook edits + monthly attendance back to Sheets' },
    { key:'writebackShiftD', label:'Writeback — Shift D', dir:'Firebase → Sheets', desc:'Daily 00:30 — writes Shift D logbook edits + monthly attendance back to Sheets' },
    { key:'writebackShiftE', label:'Writeback — Shift E', dir:'Firebase → Sheets', desc:'Daily 06:30 — writes Shift E logbook edits + monthly attendance back to Sheets' },
  ].map(function(f) {
    var enabled = state.gasConfig[f.key] !== false;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">' +
      '<div style="flex:1;padding-right:12px;">' +
        '<div style="font-size:13px;font-weight:600;">' + f.label + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' + f.dir + ' &nbsp;·&nbsp; ' + f.desc + '</div>' +
      '</div>' +
      '<button class="btn btn-sm' + (enabled ? ' btn-accent' : '') + '" ' +
        'onclick="_toggleGasFunc(\'' + f.key + '\')" ' +
        'style="min-width:46px;">' + (enabled ? 'ON' : 'OFF') + '</button>' +
    '</div>';
  }).join('')}
</div>

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

async function _toggleGasFunc(key) {
  if (!state.gasConfig) state.gasConfig = {};
  state.gasConfig[key] = state.gasConfig[key] === false ? true : false;
  syncWrite();
  nav('sync');
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