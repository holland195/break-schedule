# Session Memory — break-schedule

## Bug Fixes

### autoassign.js — 0 breaks assigned
- **Schedule key mismatch**: `autoAssignBreaks` only checked `u.schedule[d]` (DD/MM). Added `u.schedule[WEEK_DAYS[i]]` fallback in all 3 lookup sites (filter, allAlreadyAssigned guard, write loop)
- **`_roleTier` supervisor guard too broad**: `r.includes('supervisor')` fired before exact `'data supervisor'`/`'sr data supervisor'` checks → all QA users silently excluded. Fixed: exact new names MUST come before broad exclusion
- **Legacy Firebase role names**: Firebase stores "QA", "Sr QA", "Agent", "Sr Agent". Added legacy mappings after the broad exclusion block
- **Manual breaks blocked auto-assign**: `_clearAutoBreaksFromWeek` only cleared `note==='auto'`. Added `force=true` param to also clear manual breaks — called from `saveBreakSplits` and `resetBreakSplit`
- **breakSplits overwritten by sync pull**: `_applyRemoteData` unconditionally replaced `state.breakSplits`. Added `state._breakSplitsUpdatedAt` timestamp; remote only wins if `remoteAt >= localAt`. `syncPush` now includes `_breakSplitsUpdatedAt`
- **Terser TDZ crash**: Never declare `const`/`let` inside a loop body in Terser-processed files — mangled names cause `ReferenceError: Cannot access 'a' before initialization`. Inline predicates instead

### auth.js — Avatar
- `avatar_cuong.png` missing: added `onerror` fallback showing initial with role-colored background
- Cuong special-case was hiding role tag and stripping chip styling — removed special case, Cuong now renders like all other leaders
- All non-cuong users: avatar background now matches role color (leader=amber, training=green, qa=purple, agent=blue)

### styles.css
- `.role-training` CSS was missing — Training badge rendered as unstyled plain text. Added dark + light theme styles (green)

---

## New Features

### Policy Compliance (policy-compliance.js)
- **All Records**: newest records on top (sort by `r.no` desc in `_pcApplyFilters`), sticky pagination, `table-layout:fixed` column widths, LEADER column restored
- **Policy 2026**: removed LEADER column, `table-layout:fixed` widths, sticky pagination
- **Summary 30D**: removed LEADER column, `vertical-align:top` on all `<td>`, 2-column CSS grid layout (two role sections side by side)
- **Rules tab** (new): static reference of all 4 policy groups (Nhóm 1–4) in Vietnamese with `tracked` badges for actively-recorded rule IDs
- **Weekly tab** (new): ISO-week heatmap computed from `_pcData()`, year filter, sticky pagination

---

## Critical Invariants (CLAUDE.md)

- `_roleTier`: exact new role names → broad supervisor exclusion → legacy names → null
- Firebase stores legacy names: `Agent`, `Sr Agent`, `QA`, `Sr QA`
- `autoAssignBreaks` checks both `u.schedule[d]` AND `u.schedule[WEEK_DAYS[i]]`
- `_clearAutoBreaksFromWeek(sunday, shifts, force=false)` — `force=true` clears manual breaks too
- `state._breakSplitsUpdatedAt` guards breakSplits from cloud overwrite
- Terser: never `const`/`let` inside loop bodies

---

## New Features (Session 2)

### Date-Versioned Shift Config Manager (PR #91)
- `state.shiftConfig` — append-only list synced to Firebase; each entry `{ effectiveFrom: 'DD/MM'|null, breakSlots:{} }`
- New helpers in `data.js`: `_parseDateKey`, `getConfigForDate(dateStr)`, `_slotIndex(slot, shift)`, `getSlotTime(code, dateStr)`
- Break records now store short codes `A1`/`A2` instead of raw time strings; migration shim in `sync.js → _applyRemoteData` auto-converts legacy slots
- `autoassign.js` write path stores `shift+'1'`/`shift+'2'`; slot lookup via `getConfigForDate(sunday).breakSlots[shift]`
- `sync.js`: `_shiftConfigUpdatedAt` timestamp guard; `syncPush` includes shiftConfig; seeds baseline on first push
- `pages.js`: added `renderShiftConfig()`, `_shiftConfigModalHTML()`, `openShiftConfigModal()`, `saveShiftConfigEntry()`; all slot display sites use `getSlotTime(br.slot, dateStr)`
- `nav.js`/`index.html`: Shift Config page route + nav item (leader+ guard)
- `scripts/daily_sync.gs`: comment added to `BREAK_SLOTS_MAP` — must be manually synced with `data.js BREAK_SLOTS`

### Bug Fix — Shift Config Modal Invisible (PR #92)
- `_shiftConfigModalHTML()` used `class="modal-box"` (no CSS definition) → modal was transparent over dark overlay
- Fix: `class="modal" style="width:460px;"` — `.modal` is the only correct class in styles.css

### daily_sync.gs Slack Post Fixes (in PR #91)
- Caption hardcoded `"(Thứ Tư–Thứ Sáu)"` → fixed to `'(' + vnDay + '–Thứ Sáu)'` using already-computed `vnDay`
- Legend column repeated per date col → fixed to single legend at end; `numCols = FIXED + dateCols.length + 1`

### Team-Level Break Assignment (autoassign.js)
- Rotation now advances per-team, not per-member — teammates always share a slot each week

### Arrange-Breaks UI Refactors
- 3-column controls layout; distribution panel reads actual Firebase assignments (not stored percentages)
- Enforces ≥ 1 group per slot; per-tier split sliders scoped to Shift A only
- `saveBreakSplits` resets rotation on every Save; uses `force=true` on `_clearAutoBreaksFromWeek`

---

## Critical Invariants (additions from Session 2)

- CSS: only `.modal` exists in styles.css — never use `.modal-box`
- Short codes in Firebase: `A1`/`A2`; display via `getSlotTime(code, dateStr)`. Legacy time strings pass through unchanged
- Extra-break modal: `eligibleDays` data attribute populated with `getSlotTime(br.slot, dk)` (resolved time string), not raw short code
- GAS `BREAK_SLOTS_MAP` must be manually updated alongside `data.js BREAK_SLOTS` when shift times change

---

## New Features & Fixes (Session 3)

### GAS Writeback Filter Fix (PR #98)
- `syncAttendanceWriteback()` was skipping manual edits when `note === ""` (falsy)
- Fix: replaced `!rec.note ||` with `rec.by == null ||` — `by` is always set for web-app saves, always `null` for GAS auto-imports

### Training Schedule Today-Highlight Fix (PR #98)
- `renderScheduleTraining()` used `curWeekDates[d===0?6:d-1]` (off by one for Sunday-first array)
- Fix: `curWeekDates[d]` — `d = getDay()` already maps to Sunday-first indices

### Dashboard Team Grid Fix (PR #98)
- `BREAK_SLOTS[currentShift].indexOf(br.slot)` returned -1 for short codes → all badges same color
- Fix: `_slotIndex(br.slot, currentShift)` (data.js helper handles short codes + legacy strings)
- Added position grouping (Data Analyst / Sr Data Analyst / Data Supervisor / Sr Data Supervisor) + per-position border colors

### Monthly Attendance Fill + GAS Writeback (PR #99)
- `fillAttRow(username, monthKey)` — fills empty cells with `_saFillCode` for one user's visible dates
- `fillAttAll()` — fills all visible staff's empty cells for visible dates
- Shift filter (`_saShiftFilter`) narrows rows to users whose schedule matches the selected shift
- When shift filter active, table shows only current week (7 cols via `getWeekDates()`) instead of full month
- `syncMonthlyAttWriteback()` in `daily_sync.gs` — reads Firebase `monthlyAttendance`, writes codes back to Attendance Google Sheet; piggybacked on existing 3 daily triggers (15:30/00:30/06:30)

### Staff Attendance Edit UX (PRs #100–#104)
- Per-cell click opens code picker modal (`openAttCellModal`) with Save/Clear/Copy buttons
- Copy button sets `_attCopiedCode`; paste chip appears in controls bar; clicking any cell pastes without modal
- Ctrl+C on hovered cell copies code; Ctrl+V pastes to hovered cell; Esc exits paste mode
- `_attHoveredCell` tracked via `onmouseover` on every cell; `_installAttKbd()` registered once with `sa-kbd-marker` guard
- `clearAttAll()` — removes codes matching `_saFillCode` for visible staff × visible dates (all-shifts: only XA/XD/XE on today; shift-filtered: any code on today)
- Fill All and Clear scope: **both modes now target today only**
- All-shifts Fill All: per-user schedule auto-detect (`X + u.schedule[todayDk]`); skips day-off users
- Shift-filtered Fill All: `X + _saShiftFilter` for all visible staff today
- Code picker dropdown removed; Fill All auto-detects code from shift/schedule
- FILL column removed from table; per-row fill replaced by copy-paste mode
- `table-layout:fixed` when shift filtered → sticky cols locked at 92/165/145px; date cols expand to fill width
- Date TH uses `min-width:40px` only (no `width:`) so fixed-layout distributes remaining space to date cols

### L (Personal Leave) Color
- Old: `rgba(8,145,178,.12)` / `#0891b2` (cyan — too close to working code)
- New: `rgba(99,102,241,.13)` / `#6366f1` (indigo)
- Updated in both `_offColors` object and `legendHTML` span

---

## Critical Invariants (additions from Session 3)

- `fillAttAll()` / `clearAttAll()` always target today only; existing codes on today are preserved by fill (skips if exists)
- `_installAttKbd()` uses `#sa-kbd-marker` DOM element to guard Ctrl+C/V/Esc from firing on other pages
- `table-layout:fixed` needs date TH without explicit `width` so fixed cols stay exact and date cols absorb remaining space
- `syncMonthlyAttWriteback()` in GAS: uses same sheet/row/col detection as `syncAttendance()`; runs on all 3 daily triggers
- "A" code: conflict detected if attendance logged same day; excluded from late/early stats; Fill All skips cells that already have any code (including A)

---

## New Features & Fixes (Session 4 — PRs #109–#119)

### GAS syncSchedule — User Creation + Team/Role Updates (PRs #109–#113)
- `syncSchedule()` now creates new user entries when username not found (leaders/supervisors not yet in Firebase)
- New user fields: `id` (hash of username), `username`, `name` (Col C), `role` (Col G), `team` (Col B), `schedule: {}`
- For existing users: updates `team` (Col B) AND `role` (Col G) on every sync
- `const userIdx` → `var userIdx` (V8 `const` cannot be reassigned)
- Default `log` guard: `if (typeof log !== 'function') log = function(m) { console.log(m); };`
- `runSyncSchedule()` standalone wrapper for GAS editor: fetches Firebase, calls syncSchedule, writes back
- Firebase returns `current.users` as object (not array) via REST API → normalized with `for...in` loop before `findIndex`

### Staff Schedule Tab (pages.js) — Leader/Training Role-Based Filter
- **Lead/sub view**: shows all non-training staff (excludes training users)
- **Training view**: shows all staff
- Training detection: `isTraining(u) || _roleStr.includes('training') || u.team.charAt(0)==='T'`
- Day-name fallback in `renderStaffRows`: `u.schedule[d] || u.schedule[getWkDay(d)] || '0'`
- No-import fallback: when no `DD/MM` date keys exist, shows current week from day-name keys
- POSITION column: `getRoleInfo(_effRole).label` with `state.staffInfo` → STAFF_INFO_DB fallback chain

### Staff Attendance Tab (pages.js) — Sort Order + POSITION Fix
- Sort order: Training Manager(1) → Training Assistant(2) → D.A Leader(3) → D.A Supervisor(4) → Sr DS(5) → DS(6) → Sr DA(7) → DA(8)
- Within each group: sort by team code (L1→L5, S1→S5), then name
- `_STAFF_SORT_RANK` map + `_sortStaffUsers(users)` helper (applied in both Staff Schedule and Staff Attendance)
- POSITION cell fallback: `u.role || state.staffInfo[u.username].role || STAFF_INFO_DB lookup`
- Staff Attendance date selector: `_saDateFilter` variable; date picker before month picker; resets on shift/month/year change
- Shift filter fix: `(sc[dk] || sc[getWkDay(dk)]) === _saShiftFilter` (date-specific wins over day-name)
- Half-day D1/D2 legend chip: changed from amber to purple `rgba(167,139,250,.14)` / `#a78bfa`

### Auth — Training Role Nav Visibility (PR #119)
- `_resolveUser()` was returning `state.users` entry directly even when `role` was empty
- Empty role → `isLeader('')` = false → all `.leader-only` nav items hidden (Staff, Policy, Logbook)
- Fix: supplement `fromSchedule.role` with `state.staffInfo[username].role` → STAFF_INFO_DB fallback
- Returns `Object.assign({}, fromSchedule, {role: _effRole})` to avoid mutating `state.users`
- Training users must sign out and back in after deploy for nav to update

---

## Critical Invariants (additions from Session 4)

- `state.staffInfo[username].role` is the reliable role source for training users — Firebase `staffInfo` node has correct roles even when `state.users[i].role` is empty
- Role fallback chain (used in auth.js, pages.js): `u.role || state.staffInfo[u.username].role || STAFF_INFO_DB lookup || default`
- `_resolveUser()` must not return a user object with empty role — always supplement via fallback chain
- `_sortStaffUsers()` uses same fallback chain for sort key; without it users with empty role sort to rank 99 (bottom)
- GAS `syncSchedule`: `var userIdx` (not `const`) — reassigned after user creation
- `runSyncSchedule()` is the standalone GAS wrapper; `dailySync()` is the production entry point
- Firebase REST API returns `users` as object with numeric string keys — always normalize with loop before array methods

---

## New Features & Fixes (Session 5 — PRs #220–#233)

### Month Overview Design (PR #220 — pages.js)
- Removed dash separators between role-tier rows
- Stronger tier band backgrounds (alternating rows)
- Weekend column shading (`Sat`/`Sun` slightly dimmer)
- Sticky header with box-shadow on scroll
- Larger shift badges

### Staff Attendance — Per-Day Shift Filter (PRs #221–#227 — pages.js)
- Added ▼ arrow icon per date column header; click opens A/D/E picker for that day
- Selecting a shift filters rows using `_getSched(u.username, _saShiftFilterDate) === _saShiftFilter`
- All columns remain visible — only rows are filtered (NOT column collapse)
- Module-level variable `_saShiftFilterDate` tracks which date's picker is open
- `_saShiftFilter` tracks the active shift (or `'All'`)
- Active filter shown as colored `● A` dot in the column header; clicking active button clears
- `allDates` always = full month (no longer switches to 7-col week view on shift filter)
- Table style stays `width:max-content;min-width:100%` in all modes
- Month/year picker changes reset both `_saShiftFilterDate` and `_saShiftFilter`

### Username/Password Login Fallback (PR #228 — index.html + auth.js)
- Added "or use password" collapsible section below Google sign-in button
- Hidden by default; toggle reveals username + password inputs
- `doLogin()` uses `firebaseSignIn(_toEmail(u), p)` — same Firebase Auth, just email/password method
- Allows testing without a Google account

### Login Form Redesign (PR #229 — index.html)
- Replaced browser-default white inputs with dark glass style
- "or use password" divider: horizontal rules + muted toggle button
- Inputs: `background:rgba(255,255,255,.06)`, `border:1px solid rgba(255,255,255,.12)`, blue glow on focus
- Sign in button: `background:rgba(91,141,255,.18)` blue-tinted glass
- Forgot password: muted `rgba(255,255,255,.3)` link

### Bug — Null TypeError on Sign-in Button (PR #230 — index.html)
- `doLogin()` calls `btn.disabled = true` where `btn = getElementById('signin-btn')`
- Sign in button had no `id` → `btn` was null → TypeError on every login attempt
- Fix: added `id="signin-btn"` to the button element

### Show/Hide Password Toggle (PR #230 — index.html)
- Wrapped `li-pass` input in a `position:relative` container
- Eye icon button (SVG) positioned absolute at `right:10px`
- Click toggles `input.type` between `password` and `text`
- Icon switches: open eye (hidden) ↔ eye-with-slash (visible)
- Initial eye icon color: `rgba(255,255,255,.35)` (later fixed, see below)

### Bug — Eye Icon Invisible on Light Background (PR #231 — index.html)
- Chrome autofill sets input background to white; `rgba(255,255,255,.35)` icon becomes invisible
- Fix: changed icon color to `rgba(100,116,139,.9)` (slate-gray) — legible on both light and dark
- Hover: `rgba(30,41,59,.95)` (near-black)

### Bug — Shift Detects After syncPull (PR #231 — auth.js)
- `_detectShiftFor(u)` was called before `syncPull()`, reading stale `state.staffSchedule` from localStorage
- Fix: moved `currentShift = _detectShiftFor(u)` to after `await syncPull()` completes

### Bug — Shift Defaults to E on Day-Off (PR #232 — auth.js)
- `_detectShiftFor` only checked today; if today is a rest day (e.g. Saturday), `_getSched` returned `'0'` → fallback to `'E'`
- Root cause: cuong.pham (Shift A leader) logs in on Saturday — no shift entry for Sat
- Fix: scan forward up to 7 days from today; use first day with a non-zero shift code
  ```js
  for (var i = 0; i < 7; i++) {
    d.setDate(base.getDate() + i);
    var sch = _getSched(username, dk);
    if (sch && sch !== '0') return _guardShift(sch);
  }
  return 'E';
  ```

### Feature — Google Profile Photo in Avatar (PR #233 — auth.js)
- `doGoogleLogin()` stores `credential.user.photoURL` on `currentUser.photoURL` after sign-in
- `enterApp()` checks `currentUser.photoURL` first; uses it as `<img src>` if set
- Falls back to `avatar_cuong.png` (static file) for cuong.pham on username/password login
- Falls back to role-colored initial for everyone else
- `onerror` handler on `<img>` degrades to initial avatar if Google photo URL breaks

---

## Critical Invariants (additions from Session 5)

- `doLogin()` button element MUST have `id="signin-btn"` — function reads it to toggle disabled state
- Eye toggle uses slate-gray color (`rgba(100,116,139,.9)`) — NOT white — to be visible on autofill white backgrounds
- `_detectShiftFor(username)` scans forward 7 days; never relies on just today
- `currentShift = _detectShiftFor(u)` must come AFTER `await syncPull()` so schedule data is fresh
- `currentUser.photoURL` is set only for Google logins; absent for username/password logins
- `enterApp()` avatar priority: `photoURL` → `avatar_cuong.png` (cuong only) → role-colored initial

