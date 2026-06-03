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
