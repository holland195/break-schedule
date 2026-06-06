# GAS Sync (daily_sync.gs)

## Function Inventory

| Function | Trigger | Purpose |
|---|---|---|
| `dailySync()` | 6 AM daily | Orchestrator: fetch Firebase → run 3 sub-syncs → push back → log/email |
| `syncAttendance(current, log)` | via dailySync | Reads Attendance sheet → `state.monthlyAttendance[username][YYYY-MM][DD/MM] = code` |
| `syncSchedule(current, log)` | via dailySync | Reads Schedule sheet → `state.staffSchedule[username][DD/MM] = shiftCode`; creates missing users |
| `syncLogbook(current, log, monthOverride?)` | via dailySync or directly | Reads Logbook sheet (month-specific tab) → `state.logbook[uid_DD/MM]`; handles manual override protection |
| `syncAttendanceWriteback()` | 00:30/06:30/15:30 | Writes manual logbook edits (today's) back to Logbook Google Sheet |
| `syncMonthlyAttWriteback()` | 00:30/06:30/15:30 | Writes today's `monthlyAttendance` codes back to Attendance sheet; **today only** |
| `dailySyncPolicy()` | ~midnight | Reads Policy compliance sheet → `state.policyCompliance` |
| `dailySlackShiftA/D/E()` | per-shift timing | Posts break schedule image to Slack for that shift |
| `runSyncLogbook()` | manual (GAS editor) | Convenience runner: fetch → syncLogbook → push if imported > 0 |
| `runSyncLogbookMay()` | manual | Shortcut: `runSyncLogbookMonth(4)` |
| `runSyncLogbookMonth(n)` | manual | Sync a specific month by index (0=Jan … 11=Dec) |
| `runSyncSchedule()` | manual | Fetch → syncSchedule → push |
| `createWritebackTriggers()` | run once | Installs the 3 daily writeback time triggers |
| `createPolicyTrigger()` | run once | Installs the midnight policy trigger |

---

## Trigger Schedule

| Trigger | Time | What runs |
|---|---|---|
| Daily sync | 6:00 AM | `dailySync()` — attendance + schedule + logbook |
| Writeback × 3 | 00:30, 06:30, 15:30 | `syncAttendanceWriteback()` + `syncMonthlyAttWriteback()` |
| Policy | ~00:00 | `dailySyncPolicy()` |
| Slack Shift A | configurable | `dailySlackShiftA()` |
| Slack Shift D | configurable | `dailySlackShiftD()` |
| Slack Shift E | configurable | `dailySlackShiftE()` |

---

## Firebase I/O

**Read** (`firebaseGet()`):
```
GET ${FIREBASE_URL}/bsched.json?auth=${FIREBASE_SECRET}
```
Response: `{ data: "<JSON string>" }` → extract `.data` → `JSON.parse(data)` → `current` object

**Write** (`firebasePut(jsonStr)`):
```
PUT ${FIREBASE_URL}/bsched.json?auth=${FIREBASE_SECRET}
Body: { data: JSON.stringify(current) }
```

Constants `FIREBASE_URL` and `FIREBASE_SECRET` are set at the top of `daily_sync.gs`. These must match `sync-config.json` values used by the web app.

---

## `syncLogbook` Key Behaviors

**Sheet detection** (fully dynamic — no hardcoded rows):
1. Auto-detect date header row: first of top 10 rows with the most parseable date cells
2. Auto-detect sub-header row: first row after date row containing `'start'` AND one of `'end'`/`'early'`/`'late'`
3. Build `dateCols[]`: scan from col H for `'start'` sub-headers; scan forward ≤5 cols for matching `'end'` sub-header to find `endColIdx`

**Role exclusion filter**: Excludes users whose role contains `'leader'`, `'analyst supervisor'`, `'training'`, `'manager'`, or `'admin'`.
Note: uses `'analyst supervisor'` (not `'supervisor'`) — `'Data Supervisor'` (analyst-tier) must NOT be excluded.

**Manual record protection**:
- If `existing.note !== 'auto'` → the record was manually saved by a leader; skip overwrite
- Exception: if `endStr` is available AND `existing.end` is empty → patch just the end time

**Self-fetch + push-back** (for direct calls from GAS editor):
```js
if (!current || (!current.users && !current.staffInfo)) {
  current = JSON.parse(firebaseGet());  // self-fetch
  _selfFetched = true;
}
// ... end of function:
if (_selfFetched && result.imported > 0) {
  firebasePut(JSON.stringify({ data: JSON.stringify(current) }));
}
```

**Month override** — to sync a non-current month:
```js
// Direct call:
syncLogbook(current, log, 4)  // 4 = May (0-based)

// Convenience from GAS editor:
runSyncLogbookMay()           // runs for May sheet
runSyncLogbookMonth(3)        // runs for April sheet
```

---

## `syncSchedule` Key Behaviors

- Creates missing users when `username` exists in schedule sheet but not in Firebase
- New user ID = FNV-style hash of username (deterministic, stable)
- Stamps `current._usersUpdatedAt = Date.now()` → web app detects new import and triggers `autoAssignBreaks`
- Normalizes `state.users` object → array (Firebase sometimes returns numeric-keyed objects)

---

## `_fmtTimeCell(val)` — Time Cell Parsing

Handles all time cell types from GAS `getValues()`:
- `Date` object → use UTC fields (avoids historical timezone offset bugs); returns `''` if exactly midnight 00:00:00 (blank sentinel)
- Fractional day (`0..1`) → multiply by 86400 for seconds
- String with AM/PM (e.g. `"2:58:39 PM"`) → 12h parse
- String without AM/PM (e.g. `"14:58:53"`) → 24h parse

Display values (`getDisplayValues()`) are tried first; raw values as fallback:
```js
const startStr = _fmtTimeCell(displayRow[col.startColIdx]) || _fmtTimeCell(row[col.startColIdx]);
```

Output always `"HH:MM:SS"` (24h, zero-padded).
