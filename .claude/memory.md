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
