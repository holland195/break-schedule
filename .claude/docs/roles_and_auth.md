# Roles and Auth

## Role Hierarchy

Defined in `ROLES` constant (`data.js:194`):

| Role Name | Level | Tag | Label |
|---|---|---|---|
| `Admin` | 4 | `role-leader` | Admin |
| `Training Manager` | 3 | `role-training` | Training Manager |
| `Training Assistant` | 3 | `role-training` | Training Assistant |
| `Data Analyst Leader` | 2 | `role-leader` | D.A Leader |
| `Data Analyst Supervisor` | 2 | `role-leader` | D.A Supervisor |
| `Sr Data Analyst` | 1 | `role-agent` | Sr Data Analyst |
| `Sr Data Supervisor` | 1 | `role-qa` | Sr Data Supervisor |
| `Data Analyst` | 0 | `role-agent` | Data Analyst |
| `Data Supervisor` | 0 | `role-qa` | Data Supervisor |

Level semantics:
- **0–1**: IC (analyst tier) — can view schedule, request swaps, submit extra breaks
- **2**: Leader / DA Supervisor — can arrange breaks, fill logbook, manage attendance
- **3**: Training — read-only unified view across all shifts; manage policy records
- **4**: Admin — all of the above + sync settings

---

## Role Guard Functions (data.js)

| Function | Condition | Used for |
|---|---|---|
| `isLeader(u)` | `level >= 2` | Arrange, Attendance, Staff, Policy, Shift Config pages |
| `isTraining(u)` | `level === 3` | Training-specific views; excluded from Arrange page |
| `isAdmin(u)` | `level === 4` | Sync Settings page |

---

## Legacy Role Alias System

Firebase stores legacy names from before the role rename. `_resolveRole(role)` in `data.js` maps them:

| Legacy Firebase Name | Current Name |
|---|---|
| `Agent` | `Data Analyst` |
| `Sr Agent` | `Sr Data Analyst` |
| `QA` | `Data Supervisor` |
| `Sr QA` | `Sr Data Supervisor` |
| `Agent Training Manager` | `Training Manager` |
| `Agent Training Assistant` | `Training Assistant` |

**Always call `_resolveRole(u.role)` before comparing role strings.** Direct string comparison will miss legacy records.

Role fallback chain (used throughout pages.js and attendance.js):
```js
var _role = u.role
  || (state.staffInfo[u.username] || {}).role
  || ((STAFF_INFO_DB || []).find(x => x.username === u.username) || {}).role
  || '';
```

`STAFF_INFO_DB` in `data.js` is the authoritative hardcoded roster. It overrides empty Firebase role values on every sync (`state.staffInfo[r.username].role = r.role` — always, not conditional).

---

## Login Flow (auth.js)

```
doLogin()
  ├── Validate: username, password, shift (non-admin must select shift)
  ├── firebaseSignIn(username@discoveryloft.com, password)
  ├── _resolveUser(username) — build user object from staffSchedule + staffInfo
  ├── syncPull() — pull latest cloud data (gets mustChangePassword flag)
  ├── Check mustChangePassword:
  │     true  → _showChangePwPrompt() — stop here until changed
  │     false → _afterLogin()
  └── _afterLogin()
        ├── syncPull() + startSyncPolling()
        └── enterApp(false)
              ├── Show app screen, hide login
              ├── Render avatar / role chip / shift pills
              └── nav('dashboard')
```

Email mapping: `cuong.pham` → `cuong.pham@discoveryloft.com` (via `_toEmail()` in auth.js)

---

## Password Change

Triggered when `mustChangePassword === true` on first login or admin reset:

1. `_showChangePwPrompt()` — swap to `#changepw-view`
2. `submitChangePassword()`:
   - Validate: min 6 chars, confirm match, not `'1234'` or `'Pave@1234'`
   - `firebaseUpdatePassword(newPw)` — updates Firebase Auth
   - `DB.setPassword(username, newPw)` — local; sets `mustChangePassword = false`
   - Set `localStorage.setItem('pw_changed_' + username, '1')`
   - `syncPush()` — pushes `mustChangePassword: false` to cloud
3. Proceed to `_afterLogin()`

Cancelling password change calls `firebaseSignOut()` and returns to login screen.

---

## Nav Role Guards (nav.js)

Page guards evaluated inside `nav(page)`:

| Page | Required | Blocked if |
|---|---|---|
| `attendance` | `isLeader(currentUser)` | level < 2 |
| `arrange` | `isLeader && !isTraining` | level < 2 or level === 3 |
| `staff` | `isLeader(currentUser)` | level < 2 |
| `shiftconfig` | `isLeader(currentUser)` | level < 2 |
| `policy` | `isLeader(currentUser)` | level < 2 |
| `sync` | `isAdmin(currentUser)` | level < 4 |
| `training_overview` | automatic redirect from `dashboard` for training role | — |

Agents (level 0–1) can access: `dashboard`, `schedule`, `requests`, `extbreak`, `feedback`.
