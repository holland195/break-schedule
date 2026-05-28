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
