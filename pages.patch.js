// ═══════════════════════════════════════════════
//  PAGES.JS — CHANGE FOR FIREBASE AUTH
//
//  In renderSyncSettings(), find the Danger Zone card:
//
//    <div class="card" style="...border-color:var(--err);">
//      <div class="card-title">⚠ Danger Zone</div>
//      ...
//      <button class="btn btn-err btn-sm" onclick="factoryReset()">⚠ Reset This Device</button>
//    </div>
//
//  ADD this new card BEFORE the Danger Zone card:
// ═══════════════════════════════════════════════

`
<!-- Firebase Auth cleanup card — add before Danger Zone -->
<div class="card" style="max-width:620px;margin-top:0;border-color:var(--warn);">
  <div class="card-title" style="color:var(--warn);">🔐 Firebase Auth — Password Cleanup</div>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
    Removes old plaintext passwords from Firebase Realtime Database.<br>
    Run this <b>once</b> after deploying Firebase Auth — passwords are now managed by Firebase Auth, not the database.
  </div>
  <button class="btn btn-warn btn-sm" onclick="wipeStaffPasswords()">🗑 Wipe Old Passwords from DB</button>
  <div style="font-size:11px;color:var(--text3);margin-top:8px;">
    Safe to run — only removes the <code>staffPasswords</code> node and <code>password</code> fields from cloud. Does not affect breaks, schedules, or attendance data.
  </div>
</div>
`
