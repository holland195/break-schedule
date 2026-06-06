# CLAUDE.md

Internal daily management tool for a 3-shift BPO company. Leaders assign and manage employee break slots; staff view their schedules and request swaps. A Google Apps Script pipeline syncs Google Sheets → Firebase Realtime DB → this SPA every morning at 6 AM.

## Tech Stack

- Vanilla JS (ES6+), no framework, no bundler
- Firebase Realtime DB (`asia-southeast1`), REST API + WebSocket SDK v9 compat
- Firebase Auth (email/password; `@discoveryloft.com` domain enforced)
- Google Apps Script (`scripts/daily_sync.gs`) — daily cron data pipeline
- Terser (minification) + Vercel (hosting; auto-deploys `main` → `dist/`)
- SheetJS xlsx 0.18.5, html2canvas 1.4.1 (CDN)

## Dev Commands

```bash
npm install -g terser
bash build.sh   # minifies 12 JS modules → dist/; copies HTML/CSS/JSON
# Deploy: push to main → Vercel auto-deploys (outputDirectory: dist)
```

## Module Responsibilities

| File | Role |
|------|------|
| `data.js` | Constants, staff roster, shift definitions, attendance codes, helpers |
| `auth.js` | Firebase Auth: login, session, username→email mapping |
| `firebase-auth.js` | Firebase SDK init and auth state listener |
| `sync.js` | All Firebase DB reads/writes; merge conflict resolution |
| `pages.js` | All 12 UI page renderers |
| `nav.js` | SPA router: 12 pages with role guards |
| `autoassign.js` | Break rotation algorithm — circular sliding-window per shift/tier |
| `attendance.js` | Time parsing, late/early calculation, logbook integration |
| `policy-compliance.js` | Break policy rules, quota tracking, violation flagging |
| `policy-feedback.js` | Policy violation logging and manager review UI |
| `report.js` | Monthly reports, attendance summaries, export |
| `training.views.js` | Training-role dashboard and views |

## Data Flow

```
Google Sheets → GAS dailySync() [6AM] → Firebase Realtime DB
    → sync.js syncPull() [on load + 60s REST] → _applyRemoteData() → state
    → nav(page) re-renders → user edits → syncPush() → Firebase
```

## Core Logic

**Break rotation**: `autoAssignBreaks()` in `autoassign.js` assigns shift members to slot1/slot2 using a circular sliding-window per role tier. Stores short codes (`A1`/`A2`). Fully idempotent.

**Attendance codes**: `XA/XD/XE` = working; `A1/A2/D1/D2/E1/E2` = half-day; `A/H/U/S/L/0` = full-day off types.

**Role levels**: 0=Data Analyst, 1=Sr Analyst/Sr DS, 2=Leader/DA Supervisor, 3=Training, 4=Admin. Controls every page guard and feature flag.

## Key Constraints

| Rule | Detail |
|------|--------|
| **Terser `var` rule** | Never `const`/`let` inside loop bodies, `.forEach`/`.map`/`.some` callbacks, or nested function bodies. After mangling → TDZ `ReferenceError`. Use `var` or inline the expression. |
| **CSS modal class** | Only `.modal` exists in `styles.css` — never `.modal-box` (undefined, transparent). |
| **Firebase payload wrap** | Always `{ data: JSON.stringify(state) }` on write; unwrap `.data` → `JSON.parse` on read. |
| **Passwords never sync** | Cloud stores only `mustChangePassword` flag. Password field excluded from `syncPush`. |
| **BREAK_SLOTS sync** | `BREAK_SLOTS` in `data.js` and `BREAK_SLOTS_MAP` in `daily_sync.gs` must be manually kept in sync when shift times change. |
| **`_resolveRole()` always** | Firebase stores legacy role names (`Agent`, `QA`). Always call `_resolveRole()` before comparing role strings in web app code. |
| **`_roleTier` ordering** | In `autoassign.js`: exact new-name checks BEFORE `includes('supervisor')` exclusion — otherwise `Data Supervisor` (level 0) is silently excluded. |
| **`force=true` for resets** | `_clearAutoBreaksFromWeek(sun, shifts, force=true)` required in `saveBreakSplits`/`resetBreakSplit` — otherwise `allAlreadyAssigned` guard fires and 0 breaks are assigned. |
| **`STAFF_INFO_DB` authoritative** | Hardcoded roster in `data.js`; its `role` field always overwrites Firebase `staffInfo` on every load. |
| **GAS role filter** | `syncLogbook` uses `indexOf('analyst supervisor')` — NOT `indexOf('supervisor')` — to avoid excluding `Data Supervisor` (analyst-tier). |

## Additional Documentation

- `.claude/docs/architecture.md` — modules, data flow, Firebase node structure, SPA routing
- `.claude/docs/state_management.md` — state shape, DB object, sync merge rules, localStorage keys
- `.claude/docs/roles_and_auth.md` — role hierarchy, login flow, page guards
- `.claude/docs/date_and_schedule.md` — date formats, schedule keys, helper functions
- `.claude/docs/break_assignment.md` — rotation algorithm, slot codes, split percentages
- `.claude/docs/gas_sync.md` — GAS functions, triggers, Firebase I/O, writeback
- `.claude/docs/build_and_deploy.md` — Terser rules, build pipeline, deployment
