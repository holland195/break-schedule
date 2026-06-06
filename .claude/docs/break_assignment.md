# Break Assignment

## Overview

`autoAssignBreaks(users)` in `autoassign.js` is the entry point. It:
1. Collects all unique weeks (Sunday anchors) from `state.staffSchedule`
2. For each week × shift × role tier, runs `_getSlotMap()` to assign slot1/slot2
3. Writes short-code breaks to `state.breaks` with `note:'auto'`
4. Returns `{assigned, weekCount}`

The algorithm is **fully idempotent** — re-running on the same data gives the same result. The `allAlreadyAssigned` guard skips weeks where all members already have breaks.

---

## `_roleTier(role)` — Role to Tier Mapping

Maps a role string to a tier name used by the rotation. **Ordering is critical** — never rearrange.

```
1. Exact new-name checks:
   'data supervisor'      → 'qa'
   'sr data supervisor'   → 'sr_qa'
   'data analyst'         → 'agent'
   'sr data analyst'      → 'agent'

2. Broad exclusion (management — return null):
   includes 'leader', 'supervisor', 'admin', 'manager', 'assistant'

3. Legacy name checks (Firebase pre-rename):
   'agent'     → 'agent'
   'sr agent'  → 'agent'
   'qa'        → 'qa'
   'sr qa'     → 'sr_qa'

4. Return null (unknown — skip)
```

The **'data supervisor'** exact check MUST come before step 2 — otherwise it would be caught by `includes('supervisor')` and return null, silently excluding all Data Supervisors from break assignment.

---

## `_getSlotMap(shift, tier, users, sunday)` — Rotation Algorithm

Circular sliding-window assignment:

1. Load or create rotation entry for `shift+tier` key from `bsched_rotation` localStorage
2. `baseDate` = first Sunday ever seen for this key (never changes after set)
3. `members` = ordered list of usernames (new members appended when first seen)
4. `weeksDiff = weeksBetween(baseDate, sunday)`
5. `wStart = (weeksDiff % N + N) % N` where N = members.length
6. Assign: members `[wStart … wStart+split-1]` → slot1, rest → slot2

`split` = number of members assigned to slot1, calculated from `getBreakSplitPct()` (default 50%).

New members always fill **slot2 (A2)** on first appearance, then join rotation from their insert position.

---

## `autoAssignBreaks()` — Sunday Detection

Derives Sunday anchors from **any** date in `staffSchedule` — not just Sundays:

```js
// For each DD/MM date in schedule, rewind to that date's Sunday
var dt = new Date(year, month-1, day);
dt.setDate(dt.getDate() - dt.getDay());  // getDay() == 0 for Sun
```

This means a schedule with only Mon–Sat imports still correctly processes the week. The early-return guard `if (sundays.length === 0) return` only fires for truly empty schedules.

---

## `_clearAutoBreaksFromWeek(fromSunday, shifts, force=false)`

Deletes break records from `fromSunday` onward for the given shifts.

- `force=false` (default): only clears records with `note==='auto'` (auto-assigned)
- `force=true`: clears ALL breaks including manually set ones

**`force=true` is required** when calling from `saveBreakSplits()` or `resetBreakSplit()`. If any break was manually set by a leader, `force=false` leaves it in place — then `autoAssignBreaks` sees all slots filled and hits the `allAlreadyAssigned` guard, assigning 0 new breaks.

---

## Break Split Percentages

`state.breakSplits[shift][tier] = percentForSlot1` (number 0–100, or absent = default 50%)

| Function | Signature | Purpose |
|---|---|---|
| `getBreakSplitPct(shift, tier)` | `(shift, tier?) → number\|null` | Get slot1 %; null = use default 50% |
| `setBreakSplitPct(shift, tier, pct)` | `(shift, tier, pct) → void` | Save custom %; null clears to default |

`state._breakSplitsUpdatedAt` timestamp guard: remote data only overwrites local if `remoteAt >= localAt`. This prevents a periodic sync pull from reverting a just-saved split.

---

## Slot Short Codes

Stored in `state.breaks[uid_DD/MM].slot`:

- `A1`, `A2` — Shift A slots
- `D1`, `D2` — Shift D slots
- `E1`, `E2` — Shift E slots

Legacy time strings (e.g. `'18:00–19:30'`) from pre-versioning era are auto-migrated to short codes in `_applyRemoteData()` on every pull.

---

## Shift Config Versioning

`state.shiftConfig` is an append-only array. Each entry:
```js
{
  effectiveFrom: 'DD/MM' | null,  // null = baseline (always active)
  breakSlots: { A: ['...','...'], D: [...], E: [...] }  // partial overrides OK
}
```

`getConfigForDate(dateStr)` in `data.js` merges all entries with `effectiveFrom <= dateStr`. Use this for all slot time resolution — never use `BREAK_SLOTS` directly for display.

**`BREAK_SLOTS` in `data.js` and `BREAK_SLOTS_MAP` in `daily_sync.gs` must be manually kept in sync.** GAS does not read from Firebase for its slot definitions.
