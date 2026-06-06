# Architecture

## Data Flow

```
Google Sheets (Attendance, Schedule, Logbook, Policy sheets)
    │
    │  GAS dailySync() — 6 AM trigger
    ▼
Firebase Realtime DB  (/bsched node)
    │
    │  sync.js syncPull() — on login + WebSocket / 60s REST poll
    ▼
state (localStorage bsched_v6) ← _applyRemoteData() merges remote → local
    │
    │  nav(page) → renderXxx() → innerHTML #main-content
    ▼
UI (index.html SPA)
    │
    │  user action → DB.setXxx() → syncPush() → Firebase
    ▼
Firebase Realtime DB  (round-trip complete)
```

GAS also has 3 writeback triggers (00:30 / 06:30 / 15:30) that push Firebase → Google Sheets for logbook edits and today's attendance codes.

---

## Module Map

| File | Responsibility | Key exports |
|---|---|---|
| `data.js` | Constants, state, all helpers | `state`, `DB`, `ROLES`, `BREAK_SLOTS`, `_getSched`, `_resolveRole`, `getConfigForDate`, `getSlotTime` |
| `sync.js` | Firebase REST + WebSocket I/O, merge logic | `syncPull`, `syncPush`, `syncWrite`, `startSyncPolling`, `_applyRemoteData` |
| `auth.js` | Login, password change, session, Excel import | `doLogin`, `logout`, `enterApp`, `importExcelStaffInfo` |
| `firebase-auth.js` | Firebase SDK wrapper | `firebaseSignIn`, `firebaseSignOut`, `firebaseGetIdToken`, `firebaseOnAuthStateChanged` |
| `firebase-config.js` | Firebase project credentials (not minified) | `FIREBASE_CONFIG` |
| `nav.js` | SPA router + role guards | `nav`, `changeSidebarShift`, `toggleSidebar` |
| `pages.js` | All page renderers + modals | `renderDashboard`, `renderArrange`, `renderStaff`, `renderPolicyCompliance`, + ~40 others |
| `autoassign.js` | Break rotation algorithm | `autoAssignBreaks`, `_roleTier`, `_getSlotMap`, `resetRotation` |
| `attendance.js` | Logbook UI, late/early calc, keyboard shortcuts | `renderAttendance`, `saveAttendance`, `calcLateEarly`, `copyText` |
| `policy-compliance.js` | Policy violation tracking + rules UI | `renderPolicyCompliance`, `_pcApplyFilters` |
| `policy-feedback.js` | Agent feedback on violations, split-panel team view | `renderPolicyFeedback`, `_fbRenderTeam`, `_fbSelectPerson` |
| `training.views.js` | Unified multi-shift views for training role | `renderScheduleTraining`, `renderAttendanceTraining`, `renderExtBreakTraining` |
| `report.js` | Monthly reports, export utilities | `renderReport` |
| `scripts/daily_sync.gs` | GAS pipeline: Sheets → Firebase; writebacks | `dailySync`, `syncLogbook`, `syncAttendance`, `syncSchedule` |

---

## Firebase Node Structure

All data lives under the `bsched` node. Payload is wrapped: `{ data: JSON.stringify(state) }`.

```
bsched/
  data: "<JSON string of state object>"
```

Unwrapped `state` keys:

| Key | Type | Written by | Purpose |
|---|---|---|---|
| `users` | `User[]` | GAS `syncSchedule` | Staff array: `{id, username, name, role, team}` |
| `staffInfo` | `{username: StaffInfo}` | Web app (admin) | `{name, role, gender, empNo, dob, mustChangePassword}` — no passwords |
| `staffSchedule` | `{username: {DD/MM: shiftCode}}` | GAS `syncSchedule` | Authoritative shift assignments |
| `logbook` | `{uid_DD/MM: LogEntry}` | GAS `syncLogbook` + web app | `{start, end, note, by, at, _deleted}` |
| `monthlyAttendance` | `{username: {YYYY-MM: {DD/MM: code}}}` | GAS `syncAttendance` + web app | Attendance codes per day |
| `breaks` | `{uid_DD/MM: Break}` | Web app (leaders) | `{slot, note, by, at}` — slot is short code e.g. `A1` |
| `extBreaks` | `{uid: {weekKey: ExtBreak[]}}` | Web app | 30-min extra break requests |
| `requests` | `Request[]` | Web app | Break swap requests |
| `breakSplits` | `{shift: {tier: percent}}` | Web app (leaders) | Custom slot1/slot2 ratio |
| `shiftConfig` | `ShiftConfig[]` | Web app (admin) | Append-only versioned break slot times |
| `policyCompliance` | `PolicyRecord[]` | GAS `syncPolicy` + web app | Violation records |
| `slackAutoPost` | `{shift: {enabled, lastPostedAt}}` | GAS + web app | Slack auto-post state |
| `_updated` | `number` | Web app on push | Last push timestamp (UTC ms) |
| `_breaksUpdatedAt` | `number` | Web app | Timestamp guard for breaks merge |
| `_breakSplitsUpdatedAt` | `number` | Web app | Timestamp guard for breakSplits merge |
| `_shiftConfigUpdatedAt` | `number` | Web app | Timestamp guard for shiftConfig merge |
| `_usersUpdatedAt` | `number` | GAS `syncSchedule` | Triggers auto-assign on web app when updated |

---

## SPA Routing

`nav(page)` in `nav.js`:

1. Set `currentPage = page`
2. Apply training redirect: `dashboard` → `training_overview` for training role
3. Role guard — returns "Access denied" HTML if failed:
   - `attendance`, `staff`, `shiftconfig`, `policy`: level ≥ 2
   - `arrange`: level = 2 only (not training level 3)
   - `sync`: level = 4 (admin only)
4. Call the renderer function → write result to `document.getElementById('main-content').innerHTML`
5. Call `attachPageEvents(page)` for post-render event wiring

Re-rendering the current page is idempotent: `nav(currentPage)` refreshes UI with latest state.

---

## Real-time Sync

`startSyncPolling()` in `sync.js`:

1. Attempt Firebase WebSocket listener via `ref.on('value', callback)` — delta sync, fires on any change
2. If unavailable, fall back to 60-second REST poll via `setInterval`

On each update: `_onRemoteUpdate(remote)` → `_applyRemoteData(remote)` → re-render if no modal open.
Notifications (toast) fire for new swap requests and pending extra break requests.
