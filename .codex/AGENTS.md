# Break Schedule - Codex Guide

## Project Overview

Internal daily management tool for a 3-shift BPO company. Leaders manage staff break slots, staff view schedules and request swaps, and policy/attendance flows help track daily operations.

The app is a vanilla JavaScript SPA. It uses global script files rather than ES modules, so public functions used by inline HTML handlers must remain global.

## Tech Stack

- Vanilla JavaScript, HTML, CSS
- Firebase Auth and Realtime Database
- Cloudflare Worker local API via Wrangler
- Static web app served from `dist/`
- Build/minification through `build.sh`
- No bundler and no framework

## Dev Commands

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run build
```

`npm run dev` starts both:

- Worker API: usually `http://localhost:8787`
- Static web app: usually `http://localhost:3000`

## Important Files

- `index.html`: main SPA shell and script load order.
- `styles.css`: global app styling.
- `data.js`: constants, staff roster, role helpers, shift definitions, attendance codes.
- `auth.js`: app auth/session helpers.
- `firebase-auth.js`: Firebase SDK auth setup.
- `sync.js`: local/cloud state sync, Firebase reads/writes, merge handling.
- `nav.js`: SPA routing and role-based page guards.
- `autoassign.js`: break assignment and rotation logic.
- `attendance.js`: attendance parsing and logbook calculations.
- `policy-compliance.js`: policy rules and violation detection.
- `policy-feedback.js`: policy record/review UI.
- `training.views.js`: training pages and views.
- `report.js`: reports and exports.
- `pages.shared.js`: shared page helpers/state.
- `pages.dashboard.js`: dashboard rendering.
- `pages.schedule.js`: schedule rendering.
- `pages.requests.js`: break swap/request UI and handlers.
- `pages.arrange.js`: arrange breaks UI and assignment controls.
- `pages.staff.js`: staff, import, attendance, and working-time UI.
- `pages.extbreak.js`: 30-minute/extra break UI and handlers.
- `pages.shiftconfig.js`: shift config UI and save handlers.
- `dist/`: generated build output. Do not edit generated files manually.

## Coding Rules

- Preserve global-script behavior. Do not convert files to `type="module"` unless explicitly requested.
- Do not rename public functions used by inline handlers or `nav.js`.
- Keep script order in `index.html` compatible with globals.
- Prefer mechanical, low-risk edits over broad refactors.
- Do not manually edit `dist/` files; update source files and run the build.
- Before build, check for mojibake/encoding artifacts such as `â`, `ð`, `�`, `Ã`, and accidental replacement characters.
- Use `var` in risky legacy/global-script areas where minification or callback scoping can cause issues in this codebase.
- Keep Vietnamese UI text readable and verify characters before building.

## Build Notes

`build.sh` minifies source files into `dist/` and copies app assets. The user has said not to upload `build.sh` to repo main unless explicitly requested.

Run syntax checks on touched JS files before building:

```bash
node --check pages.arrange.js
node --check pages.requests.js
node --check pages.staff.js
node --check nav.js
```

Adjust the list to match files actually touched.

## Data And Sync Notes

- Firebase writes wrap app state as `{ data: JSON.stringify(state) }`.
- Firebase reads unwrap `.data` and parse JSON.
- Passwords must not be synced.
- `STAFF_INFO_DB` in `data.js` is authoritative for staff info.
- Resolve legacy role names before comparing role strings.
- Keep `BREAK_SLOTS` and related sync/config mappings aligned when shift times change.

## UI Notes

- The app is operational software, not a marketing site. Prefer compact, scannable, work-focused UI.
- Avoid large decorative sections and unnecessary cards.
- For Arrange Breaks, preserve table readability and keep controls from crowding the schedule grid.
- For policy and request flows, make status and allowed actions clear.
- Use familiar icons where the existing UI pattern supports them.

## Git Safety

- The worktree may contain user changes. Never revert changes you did not make unless explicitly asked.
- Before feature or bug work, use a branch when the user asks for repo-ready changes.
- Do not commit, push, or open PRs unless explicitly requested.
- Ignore unrelated dirty files unless they block the task.

## Verification Checklist

- Run `node --check` on touched JS files.
- Check for mojibake before build.
- Run the existing build path when relevant.
- If changing UI, run the app locally and inspect with Playwright when available.
- Smoke-test the affected route and at least one inline-handler action when changing page files.
