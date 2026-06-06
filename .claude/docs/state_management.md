# State Management

## `state` Object Shape

Loaded from localStorage key `bsched_v6` via `load()` in `data.js`. All Firebase pulls are merged into this object; all writes update this object then push to Firebase.

```js
state = {
  // Staff data (from GAS syncSchedule)
  users: [],               // User[] — {id, username, name, role, team, gender, empNo}
  staffInfo: {},           // {username: {name, role, gender, empNo, dob, phone, password, mustChangePassword}}
  staffSchedule: {},       // {username: {DD/MM: shiftCode, Mon: shiftCode}}

  // Break assignments (from web app leaders)
  breaks: {},              // {uid_DD/MM: {slot:'A1', note:'', by:uid, at:ts}}
  extBreaks: {},           // {uid: {weekKey: [{day, pos, status, by, reason, at}]}}
  requests: [],            // [{id, from, to, day, slot, reason, status, at, resolvedBy}]
  breakSplits: {},         // {shift: {tier: percent}} — slot1 % per shift+tier

  // Attendance (from GAS syncAttendance + web app)
  monthlyAttendance: {},   // {username: {YYYY-MM: {DD/MM: codeString}}}
  logbook: {},             // {uid_DD/MM: {start, end, note, by, at, _deleted}}

  // Policy (from GAS syncPolicy + web app)
  policyCompliance: [],    // PolicyRecord[]

  // Configuration
  shiftConfig: [],         // [{effectiveFrom:DD/MM|null, breakSlots:{shift:[slot1,slot2]}}]
  slackAutoPost: {},       // {shift: {enabled:bool, lastPostedAt:ts}}

  // Session
  session: null,           // {username, userId, shift} — set on login, cleared on logout
  imported: false,

  // Sync timestamps (used for merge conflict resolution)
  _updated: 0,
  _breaksUpdatedAt: 0,
  _usersUpdatedAt: 0,
  _breakSplitsUpdatedAt: 0,
  _shiftConfigUpdatedAt: 0,
}
```

`save()` in `data.js` writes `state` to localStorage. `load()` reads it. `syncPush()` sends it to Firebase.

---

## `DB` Object (data.js)

All state mutations go through `DB` methods (never mutate `state` directly from pages).

| Method | Signature | Notes |
|---|---|---|
| `getUsers()` | `() → User[]` | Returns `state.users` |
| `getUser(id)` | `(id) → User\|null` | Find by numeric ID |
| `upsertUser(u)` | `(u) → void` | Insert or replace by ID |
| `getBreak(uid, day)` | `(uid, day) → Break\|null` | Key: `uid_day` |
| `setBreak(uid, day, d)` | `(uid, day, d) → void` | Writes `state.breaks[key]`; caller must `syncWrite()` |
| `getRequests()` | `() → Request[]` | All swap requests |
| `addRequest(r)` | `(r) → void` | Push to `state.requests` |
| `updateRequest(i, r)` | `(i, r) → void` | Merge into `state.requests[i]` |
| `getExtBreaks(uid, mk)` | `(uid, mk) → ExtBreak[]` | Extra breaks for user+weekKey |
| `addExtBreak(uid, mk, e)` | `(uid, mk, e) → void` | Append to list |
| `deleteExtBreak(uid, mk, i)` | `(...) → void` | Remove by index |
| `approveExtBreak(uid, mk, idx, byId)` | `(...) → void` | Set status='approved', by=byId |
| `rejectExtBreak(uid, mk, idx, byId, reason)` | `(...) → void` | Set status='rejected' |
| `getPendingExtBreaks()` | `() → array` | All pending across all users |
| `countPendingExtBreaks()` | `() → number` | Count pending |
| `countExtBreaks(uid, mk)` | `(uid, mk) → number` | Count for user+week |
| `getLogbook(uid, day)` | `(uid, day) → LogEntry\|null` | Returns null if `_deleted` |
| `setLogbook(uid, day, d)` | `(uid, day, d) → void` | Writes `state.logbook[key]` |
| `delLogbook(uid, day)` | `(uid, day) → void` | Sets `_deleted: true` tombstone |
| `getStaffInfo(username)` | `(username) → StaffInfo\|null` | From `state.staffInfo` |
| `setStaffInfo(username, d)` | `(username, d) → void` | Merge into `state.staffInfo[username]` |
| `getPassword(username)` | `(username) → string` | Returns stored password or `'1234'` default |
| `mustChangePw(username)` | `(username) → bool` | Check `mustChangePassword` flag |
| `setPassword(username, pw)` | `(username, pw) → void` | Sets password + clears `mustChangePassword` |
| `getMonthlyAtt(username, mk)` | `(username, mk) → {DD/MM: code}` | Returns `{}` if absent |
| `setMonthlyAtt(username, mk, data)` | `(username, mk, data) → void` | Replaces entire month object |
| `clearMonthlyAtt(username, mk)` | `(username, mk) → void` | Deletes month entry |
| `saveSession(s)` | `(s) → void` | Persists session to `state.session` |
| `clearSession()` | `() → void` | Nulls `state.session` |
| `getSession()` | `() → Session\|null` | Get current session |

---

## `_applyRemoteData` Merge Rules (sync.js)

Called every time Firebase data is pulled. Resolves conflicts by data type:

| Data Type | Merge Rule |
|---|---|
| `breaks` | Remote wins if `remote._breaksUpdatedAt > local._breaksUpdatedAt`; otherwise per-entry newer `at` timestamp wins |
| `users` | Remote wins if `remote._usersUpdatedAt > local._usersUpdatedAt`; also triggers `autoAssignBreaks` for leaders |
| `breakSplits` | Remote wins only if `remoteAt >= localAt` (prevents just-saved splits being overwritten) |
| `shiftConfig` | Remote wins only if `remoteSCAt >= localSCAt` |
| `logbook` | Per-entry: newer `at` timestamp wins; respects `_deleted` tombstones |
| `monthlyAttendance` | Remote always wins (GAS is authoritative) |
| `staffSchedule` | Remote always wins (GAS is authoritative) |
| `policyCompliance` | Remote wins unless local has newer agent feedback or status update |
| `staffInfo` | Per-username merge; **password field never applied from cloud** |
| `requests`, `extBreaks`, `slackAutoPost` | Remote always wins |
| **Legacy migration** | Break slot time strings (`18:00–19:30`) auto-converted to short codes (`A1`) on every pull |

---

## `syncPush` Payload (sync.js)

Fields written to Firebase on every push:

```js
{
  breaks, requests, extBreaks, breakSplits,
  logbook, monthlyAttendance, staffSchedule,
  users: usersCompact,           // {id, username, name, team, role, gender, empNo} only
  staffInfo: staffInfoCloud,     // mustChangePassword included; password excluded
  policyCompliance, slackAutoPost, shiftConfig,
  _updated: Date.now(),
  _breaksUpdatedAt, _breakSplitsUpdatedAt, _shiftConfigUpdatedAt, _usersUpdatedAt
}
```

Wrapped as: `{ data: JSON.stringify(payload) }`

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `bsched_v6` | Main state object (all `state` fields) |
| `bsched_rotation` | Break rotation state per shift+tier (baseDate, members[]) |
| `pw_changed_{username}` | Flag: user has changed password; suppresses mustChangePassword prompt |
| `arrange-controls-collapsed` | Sidebar collapsed state on Arrange page |
| `bsched_sync_cfg` | `{dbUrl, apiKey}` — Firebase connection config cached from sync-config.json |
| `theme` | `'dark'` or `'light'` |
