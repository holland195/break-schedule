# Build and Deploy

## Build Script (`build.sh`)

```bash
npm install -g terser
bash build.sh
```

Outputs to `dist/`. Files in `dist/` are what Vercel serves.

### Files Minified by Terser

```
data.js
sync.js
auth.js
pages.js
autoassign.js
attendance.js
nav.js
policy-compliance.js
policy-feedback.js
training.views.js
report.js
firebase-auth.js
```

### Files Copied As-Is (not minified)

| File | Reason |
|------|--------|
| `firebase-config.js` | Firebase SDK requires readable config object |
| `index.html` | No minification needed |
| `styles.css` | No minification needed |
| `sync-config.json` | **Not committed to repo** — admin fills after deploy via Sync Settings page |

---

## Terser Flags

```bash
terser input.js --compress drop_console=true --mangle --output dist/input.js
```

- `drop_console=true` — strips all `console.*` calls from production output
- `--mangle` — renames local variables to single letters (`a`, `b`, `c`, …)

---

## CRITICAL: Terser `var` Rule

**Never declare `const` or `let` inside:**
- A loop body (`for`, `while`)
- A `.forEach()`, `.map()`, `.some()`, `.filter()`, `.reduce()` callback
- Any nested function body inside another function

**Why**: After name mangling, `const`/`let` declarations in nested scopes produce TDZ (Temporal Dead Zone) errors at runtime:
```
ReferenceError: Cannot access 'a' before initialization
```

The bug only appears in production (minified) — development (unminified) works fine.

**Fix**: Use `var`, or inline the expression directly:

```js
// WRONG — will crash after minification:
arr.forEach(function(item) {
  const val = item.value * 2;  // ← TDZ crash
  doSomething(val);
});

// CORRECT:
arr.forEach(function(item) {
  var val = item.value * 2;
  doSomething(val);
});
```

---

## CSS Constraint

Only `.modal` class exists in `styles.css` for modal containers. **Never use `.modal-box`** — it has no CSS definition and renders as a transparent box over the dark overlay.

```html
<!-- WRONG: -->
<div class="modal-box">...</div>

<!-- CORRECT: -->
<div class="modal" style="width:460px;">...</div>
```

---

## Deployment

**Vercel** auto-deploys on push to `main`.

`vercel.json` config:
- `buildCommand`: `npm install -g terser && bash build.sh`
- `outputDirectory`: `dist`
- Production branch: `main`

All routes rewrite to `index.html` (SPA routing).

---

## Configuration Files

### `firebase-config.js`

Not minified. Contains `FIREBASE_CONFIG` object (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId, measurementId). Intentionally committed to repo — Firebase web config is public by design; security is enforced by Firebase Auth and database rules.

### `sync-config.json`

**Not committed to repo.** Contains:
```json
{ "dbUrl": "https://...", "apiKey": "..." }
```

Admin fills this after first deploy via the Sync Settings page (Admin role only). Cached in `localStorage` key `bsched_sync_cfg` after first save.

### `database.rules.json`

Firebase security rules. Writes require the `apiKey` secret; reads are open (Firebase Auth guards the app).

---

## Local Development

No dev server needed — open `index.html` directly in browser (or serve via `npx serve .`). All JS modules load sequentially from `index.html` script tags. Firebase config reads from `firebase-config.js`; DB URL reads from `sync-config.json` (must exist locally).

Edits to source files are reflected immediately on browser refresh. Run `bash build.sh` before testing production behavior (minified output).
