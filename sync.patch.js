// ═══════════════════════════════════════════════
//  SYNC.JS — CHANGES FOR FIREBASE AUTH
//
//  Find and replace these two sections in sync.js:
//
//  CHANGE 1: Remove staffPasswords from syncPush payload
//  CHANGE 2: Remove staffPasswords from _applyRemoteData
//  CHANGE 3: Add wipeStaffPasswords() admin utility
// ═══════════════════════════════════════════════


// ─────────────────────────────────────────────
//  CHANGE 1 — In syncPush(), find this block:
//
//    const staffPasswords = {};
//    const staffInfoCloud = {};
//    Object.entries(state.staffInfo || {}).forEach(([uname, si]) => {
//      staffPasswords[uname] = {
//        password:           si.password           ?? '1234',
//        mustChangePassword: si.mustChangePassword ?? true,
//      };
//      staffInfoCloud[uname] = { ... };
//    });
//    const payload = {
//      ...
//      staffPasswords,        // ← REMOVE this line
//      ...
//    };
//
//  REPLACE WITH:
// ─────────────────────────────────────────────

    const staffInfoCloud = {};
    Object.entries(state.staffInfo || {}).forEach(([uname, si]) => {
      // Only sync profile info — passwords now managed by Firebase Auth
      staffInfoCloud[uname] = {
        name:               si.name               || '',
        role:               si.role               || '',
        gender:             si.gender             || '',
        empNo:              si.empNo              || '',
        dob:                si.dob                || '',
        mustChangePassword: si.mustChangePassword ?? true,
        // NOTE: si.password is intentionally NOT included
      };
    });

    const payload = {
      breaks:           state.breaks,
      requests:         state.requests,
      extBreaks:        state.extBreaks,
      attendance:       state.attendance || {},
      users:            usersCompact,
      // staffPasswords: REMOVED — passwords owned by Firebase Auth now
      staffInfo:        staffInfoCloud,
      _updated:         Date.now(),
      _breaksUpdatedAt: state._breaksUpdatedAt || Date.now(),
      _usersUpdatedAt:  state._usersUpdatedAt  || 0,
    };


// ─────────────────────────────────────────────
//  CHANGE 2 — In _applyRemoteData(), find and DELETE this entire block:
//
//  if (remote.staffPasswords) {
//    Object.entries(remote.staffPasswords).forEach(([uname, p]) => {
//      if (!state.staffInfo[uname]) {
//        state.staffInfo[uname] = { name: uname, role: '', gender: '', empNo: '', dob: '' };
//      }
//      state.staffInfo[uname].password           = p.password;
//      state.staffInfo[uname].mustChangePassword  = p.mustChangePassword;
//    });
//  }
//
//  REPLACE WITH:
// ─────────────────────────────────────────────

  // Restore mustChangePassword flag from cloud staffInfo
  // (passwords are managed by Firebase Auth — we only sync the flag)
  if (remote.staffInfo) {
    Object.entries(remote.staffInfo).forEach(([uname, si]) => {
      if (!state.staffInfo[uname]) state.staffInfo[uname] = {};
      state.staffInfo[uname].name   = si.name   || state.staffInfo[uname].name   || '';
      state.staffInfo[uname].role   = si.role   || state.staffInfo[uname].role   || '';
      state.staffInfo[uname].gender = si.gender || state.staffInfo[uname].gender || '';
      state.staffInfo[uname].empNo  = si.empNo  || state.staffInfo[uname].empNo  || '';
      state.staffInfo[uname].dob    = si.dob    || state.staffInfo[uname].dob    || '';
      // Sync mustChangePassword flag — this is the only password-related field we keep
      if (si.mustChangePassword !== undefined) {
        state.staffInfo[uname].mustChangePassword = si.mustChangePassword;
      }
    });
  }
  // NOTE: The old staffPasswords block is removed — no longer read from cloud


// ─────────────────────────────────────────────
//  CHANGE 3 — Add this new function anywhere in sync.js
//  (e.g. after syncWrite)
//  This wipes the old staffPasswords node from Firebase DB.
//  Run once from Cloud Sync page after deploying Firebase Auth.
// ─────────────────────────────────────────────

async function wipeStaffPasswords() {
  if (!syncEnabled()) { toast('Sync not connected.', 'err'); return; }
  const status = document.getElementById('sync-test-status');
  if (status) status.innerHTML = '<span style="color:var(--text3)">Wiping old passwords from cloud…</span>';

  try {
    // Pull current data
    const remote = await _fbGet(syncCfg.dbUrl, syncCfg.apiKey);

    // Remove staffPasswords node
    delete remote.staffPasswords;

    // Also scrub password field from staffInfo entries if present
    if (remote.staffInfo) {
      Object.values(remote.staffInfo).forEach(si => {
        delete si.password;
      });
    }

    // Push cleaned data back
    await _fbPut(syncCfg.dbUrl, syncCfg.apiKey, { data: JSON.stringify(remote) });

    if (status) status.innerHTML = '<span style="color:var(--ok)">✓ Old passwords wiped from Firebase DB.</span>';
    toast('✓ Old passwords removed from cloud database.', 'ok');
    console.log('[sync] staffPasswords wiped from Firebase DB');
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--err)">Failed: ${e.message}</span>`;
    toast('Failed to wipe passwords: ' + e.message, 'err');
  }
}
