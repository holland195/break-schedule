# memory.md — Break Schedule App: Updates & Debugs Log

---

## Feature — Date-Versioned Shift Config Manager (PR #91)

**Problem**: Changing shift hours or adding new shifts required a code deploy.

**Solution**: Append-only `state.shiftConfig` list synced to Firebase. Each entry: `{ effectiveFrom: 'DD/MM' | null, breakSlots: {...} }`. Baseline seeded from hardcoded `BREAK_SLOTS`.

**New helpers in `data.js`**:
- `_parseDateKey(dk)` — converts `DD/MM[/YYYY]` string to a timestamp for comparison
- `getConfigForDate(dateStr)` — merges all entries with `effectiveFrom ≤ dateStr`, returns full `breakSlots`
- `_slotIndex(slot, shift)` — resolves short codes (`A1`) or legacy time strings to a 0-based index
- `getSlotTime(code, dateStr)` — resolves short code → display time string via versioned config

**Short-code storage**: break records now store `A1`/`A2` (shift letter + index) instead of raw time strings (`18:00–19:30`). Migration shim in `sync.js → _applyRemoteData` auto-converts legacy time-string slots on every Firebase pull.

**`autoassign.js`**: `_getSlotMap` and write path use `getConfigForDate(sunday).breakSlots[shift]`; writes `shift + '1'` / `shift + '2'` short codes to Firebase.

**`sync.js`**: `_applyRemoteData` merges remote `shiftConfig` using `_shiftConfigUpdatedAt` timestamp guard (remote only wins if `remoteAt >= localAt`). `syncPush` includes `shiftConfig` + `_shiftConfigUpdatedAt`. Seeds baseline to Firebase on first push when `state.shiftConfig` is empty.

**`pages.js`**: Added `renderShiftConfig()`, `_shiftConfigModalHTML()`, `openShiftConfigModal(shift)`, `saveShiftConfigEntry()`. All slot display sites updated to call `getSlotTime(br.slot, dateStr)`.

**`nav.js`**: Added `shiftconfig` page guard (leader+) and route entry. **`index.html`**: added Shift Config nav item with settings-gear SVG icon.

**`scripts/daily_sync.gs`**: Added comment to `BREAK_SLOTS_MAP` noting it must be manually synced with `data.js BREAK_SLOTS` when shift times change.

---

## Debug — Shift Config Modal Invisible Background (PR #92)

**Problem**: Edit and Add Shift modals appeared dim/invisible. `_shiftConfigModalHTML()` in `pages.js` used `class="modal-box"` which has no CSS definition in `styles.css`. The dark `rgba(0,0,0,.7)` overlay bled through the unstyled box.

**Fix** (`pages.js → _shiftConfigModalHTML()`):
```
Before: '<div class="modal-box" style="max-width:460px;">'
After:  '<div class="modal" style="width:460px;">'
```

---

## Feature — daily_sync.gs Slack Post Fixes (included in PR #91)

**Bug 1 — Wrong caption**: Hardcoded `"(Thứ Tư–Thứ Sáu)"` (Wed–Fri) but the Tuesday auto-post starts from Tuesday, making the range Tue–Fri.
**Fix**: Use the already-computed `vnDay` variable → `'(' + vnDay + '–Thứ Sáu)'`

**Bug 2 — Duplicate legend**: The `_buildBreakTablePdf` function generated a legend column for every date column (4 repeats on a 4-day Tuesday post).
**Fix**: Single legend column at the end. `numCols = FIXED + dateCols.length + 1` (was `* 2`). Header and data row loops updated accordingly; column widths updated (date cols 70px, legend col 90px).

---

## Feature — Team-Level Break Assignment in autoassign.js

All members of the same team are now assigned to the same break slot each week. Rotation advances per-team (not per-member), so teammates always share a slot. Previously, individual members rotated independently.

---

## Feature — Arrange-Breaks UI Refactors

- 3-column controls layout
- Distribution panel reads actual Firebase break assignments (not stored split percentages) to display real slot counts
- Enforces ≥ 1 group per slot in the distribution panel
- Per-tier split sliders scoped to Shift A only (other shifts don't use percentage splits)
- Position tags added to member rows in the arrange view
- `saveBreakSplits` resets rotation on every Save click
- Save and Reset paths call `_clearAutoBreaksFromWeek(fromSunday, shifts, force=true)` to clear both auto and manual breaks — prevents the `allAlreadyAssigned` guard from skipping re-assignment when a supervisor has manually set any break

---

## Critical Pitfalls Reference

| Pitfall | Detail |
|---------|--------|
| Terser loop bodies | Never `const`/`let` inside a loop body — use `var` or inline. After Terser mangling, hoisting causes TDZ `ReferenceError`. |
| Role name duality | Firebase stores legacy names (`Agent`, `Sr Agent`, `QA`, `Sr QA`); UI uses new names. `_roleTier` in `autoassign.js` handles both — exact new-name checks MUST come BEFORE the broad `includes('supervisor')` exclusion. |
| Schedule key format | GAS writes zero-padded `DD/MM` keys; `autoAssignBreaks` checks both `u.schedule[d]` (date key) and `u.schedule[WEEK_DAYS[i]]` (day-name fallback). |
| `_clearAutoBreaksFromWeek` force param | `force=true` clears manual breaks too; required for `saveBreakSplits`/`resetBreakSplit` or the `allAlreadyAssigned` guard skips re-assignment. |
| breakSplits sync guard | `_breakSplitsUpdatedAt` timestamp in `state` prevents periodic Firebase pulls from reverting a just-saved split. |
| CSS `.modal` only | Only `.modal` is defined in `styles.css`. Never use `.modal-box` — it has no styles. |
| Short codes vs time strings | Firebase stores `A1`/`A2`; always display via `getSlotTime(code, dateStr)`. Legacy time strings pass through `getSlotTime` unchanged for backward compatibility. |
| GAS `BREAK_SLOTS_MAP` | Must be manually updated alongside `data.js BREAK_SLOTS` when shift times change. A comment in `daily_sync.gs` notes this. |
| Extra-break modal slot parsing | The 30-min break modal parses slot time strings (`slot.split('–')`). The `eligibleDays` data attribute is populated with `getSlotTime(br.slot, dk)` (resolved time string), not the raw short code. |
