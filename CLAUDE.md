# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Deploy

```bash
# Build (minifies JS into dist/)
npm install -g terser && bash build.sh

# Deploy: Vercel auto-deploys from main branch (outputDirectory: dist)
```

`build.sh` minifies all JS modules via Terser (console-dropping, name mangling) except `firebase-config.js`, which is copied unminified — the Firebase SDK requires readable config.

## Architecture

Single-page vanilla JS app backed by Firebase Realtime Database. No framework, no bundler beyond Terser minification, no test suite.

### Entry point

`index.html` loads all JS modules sequentially. The `#main-content` div is the SPA canvas. `nav.js` handles routing and role-based page guards.

### Module responsibilities

| File | Role |
|------|------|
| `data.js` | Constants, staff roster, shift definitions, attendance codes, calculation helpers |
| `auth.js` | Firebase Auth: login, session, username→`@discoveryloft.com` email mapping |
| `firebase-auth.js` | Firebase SDK initialization and auth state listener |
| `sync.js` | All Firebase Realtime DB reads/writes; reads `sync-config.json` for DB URL + secret |
| `pages.js` | All 12 UI page renderers (dashboard, schedule, attendance, arrange-breaks, policy, reports, etc.) |
| `nav.js` | Router: 12 named pages with role guards (Agent / Supervisor / Leader / Manager / Training) |
| `autoassign.js` | Break rotation algorithm — assigns break slots per shift/tier, tracks rotation state |
| `attendance.js` | Time parsing, late/early minute calculation, conflict detection, logbook integration |
| `policy-compliance.js` | Break policy rules, quota tracking, violation flagging |
| `policy-feedback.js` | Policy violation logging and manager review UI |
| `report.js` | Monthly reports, attendance summaries, export utilities |
| `training.views.js` | Separate dashboard and views for training-role users |

### Data flow

```
Google Sheets (GAS trigger 6AM daily)
    ↓  scripts/daily_sync.gs
Firebase Realtime DB (asia-southeast)
    ↓  sync.js (on page load + periodic pull)
pages.js renders UI → user writes → sync.js pushes back to Firebase
```

`scripts/daily_sync.gs` is a Google Apps Script. The sole trigger entry point is `dailySync()`. It syncs attendance, schedule, and logbook data and emails results/errors.

### Data model

- **Staff**: 40+ members with roles (Agent, Supervisor, Leader, Manager, Training variants)
- **Shifts**: A–E with distinct time blocks (e.g. Shift B = "3PM–12AM")
- **Attendance codes**: `XA`/`XB`/… = working; `A1`/`A2` = half-day paid; `A`/`H`/`U`/`S`/`L`/`0` = full-day off types
- **Break slots**: Per-shift, multiple slots, rotation state tracked in Firebase
- **Attendance records**: Per-user per-day (actual times, late/early minutes, conflicts)

### Configuration files

- `firebase-config.js` — Firebase project credentials (intentionally unminified)
- `sync-config.json` — Firebase DB URL + write secret; filled by admin, not committed
- `database.rules.json` — Firebase security rules (writes require auth secret)
- `vercel.json` — Vercel build and routing config

## Critical autoassign.js notes

### Role name handling in `_roleTier`

Firebase stores **legacy** role names (`"Agent"`, `"Sr Agent"`, `"QA"`, `"Sr QA"`) that differ from the current UI names (`"Data Analyst"`, `"Sr Data Analyst"`, `"Data Supervisor"`, `"Sr Data Supervisor"`). `_roleTier` must handle **both** name sets directly — it does NOT call `_resolveRole()` from data.js.

**Critical ordering**: the exact new-name checks (`data supervisor`, `sr data supervisor`) MUST come BEFORE the broad `r.includes('supervisor')` exclusion — otherwise all QA/SR_QA users are silently skipped. Current working order in `_roleTier`:

1. Check exact new names → return tier
2. Check `includes('leader'|'supervisor'|'admin'|'manager'|'assistant')` → return null (management exclusion)
3. Check exact legacy names → return tier
4. Return null (unknown role)

`ROLE_ALIASES` in `data.js` maps: `Agent→Data Analyst`, `Sr Agent→Sr Data Analyst`, `QA→Data Supervisor`, `Sr QA→Sr Data Supervisor`.

### Schedule key format in `autoAssignBreaks`

GAS (`daily_sync.gs`) stores schedule keys as zero-padded `DD/MM` strings (e.g. `"05/05"`). `autoAssignBreaks` checks **both** `u.schedule[d]` (date key) and `u.schedule[WEEK_DAYS[i]]` (day-name fallback like `"Mon"`) in all three schedule lookup sites — the filter, the `allAlreadyAssigned` guard, and the write loop. The fallback is needed because some import paths may store day-name keys.

`WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']` — index aligns with `weekDates` array returned by `getWeekRange(sunday)`.

### `_clearAutoBreaksFromWeek` force parameter

`_clearAutoBreaksFromWeek(fromSunday, shifts, force = false)` — when `force = true` it clears **both** auto-assigned (`note==='auto'`) AND manually-set breaks. This is required for `saveBreakSplits` and `resetBreakSplit` in pages.js: if any break was manually set by a supervisor, the default auto-only clear leaves it in place, then `autoAssignBreaks` hits the `allAlreadyAssigned` guard and assigns 0 breaks.

### breakSplits cloud sync

`state._breakSplitsUpdatedAt` tracks when splits were last saved locally. `_applyRemoteData` in sync.js uses a timestamp comparison before applying remote `breakSplits` — remote only wins if `remoteAt >= localAt`. `syncPush` includes `_breakSplitsUpdatedAt` in the payload. This prevents periodic sync pulls from silently reverting a user's just-saved split percentage.

### Terser minification pitfall

Terser drops `console.*` calls and mangles variable names. **Never declare `const`/`let` inside a loop body** in any file processed by Terser — the hoisting behaviour after mangling can cause TDZ `ReferenceError: Cannot access 'a' before initialization` at runtime. If you need a helper predicate inside a loop, inline it directly rather than assigning it to a named variable.
