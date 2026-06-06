# Date and Schedule

## Date Key Formats

| Format | Example | Used for |
|---|---|---|
| `DD/MM` | `05/06` | Break keys, schedule keys, logbook keys, attendance keys |
| `YYYY-MM` | `2026-06` | Monthly attendance bucket (`monthKey`) |
| `Mon`/`Tue`…`Sun` | `Wed` | Day-name fallback in schedule (when no DD/MM import yet) |
| `YYYY-MM-DD` | `2026-06-05` | Policy compliance records |

The canonical date key throughout the app is `DD/MM` (zero-padded). GAS writes zero-padded keys; all web-app helpers produce zero-padded output.

---

## Schedule Storage

`state.staffSchedule[username][key] = shiftCode`

`key` is either:
- `DD/MM` — specific date import from GAS (authoritative; checked first)
- Day name (`Mon`, `Tue`, …) — weekly default fallback

`shiftCode` is `'A'`, `'D'`, `'E'`, or `'0'` (day off).

**Always use `_getSched(username, dk)` — never read `staffSchedule` directly.** It applies the fallback automatically.

---

## Key Helper Functions (data.js)

| Function | Signature | Purpose |
|---|---|---|
| `_getSched(username, dk)` | `(username, 'DD/MM') → shiftCode` | Returns date-specific key if present, else day-name fallback, else `'0'` |
| `_getSchedObj(username)` | `(username) → {DD/MM: code, ...}` | Returns entire schedule dict for user |
| `getWeekRange(sundayStr)` | `('DD/MM') → string[7]` | Sun–Sat date keys starting from given Sunday |
| `getWkDay(ds)` | `('DD/MM') → string` | Returns day name `'Sun'`…`'Sat'` for a given date key |
| `getWeekDates()` | `() → string[7]` | Current week's 7 date keys (Sun–Sat) |
| `_sortDateKeys(keys)` | `(string[]) → string[]` | Sort `DD/MM` keys chronologically; cross-year aware |
| `_parseDateKey(dk)` | `('DD/MM') → number` | Convert to UTC timestamp (ms) for comparison |
| `todayKey()` | `() → string` | Returns today's day name (`'Mon'`, `'Tue'`, …) |
| `currentMonthKey()` | `() → string` | Returns `'YYYY-MM'` for current month |
| `monthKeyFromDate(ds)` | `('DD/MM') → 'YYYY-MM'` | Derive month key from date key |

`WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']` — index 0=Sun aligns with `Date.getDay()`.

---

## Break Slot Codes

Break records store **short codes** like `A1`, `A2`, `D1`, `D2`, `E1`, `E2`.

- Letter = shift (`A`, `D`, `E`)
- Number = slot index (`1` or `2`)

Display strings (e.g. `'18:00–19:30'`) are **never stored**; they are resolved at render time.

| Function | Signature | Purpose |
|---|---|---|
| `getSlotTime(code, dateStr)` | `('A1', 'DD/MM') → '18:00–19:30'` | Resolve short code to display string using versioned config |
| `_slotIndex(slot, shift)` | `('A1', 'A') → 0` | Resolve short code or legacy time string to 0-based index |
| `getShortSlot(shift, fullTime)` | `('A', '18:00–19:30') → 'A1'` | Convert display string to short code |

---

## Versioned Shift Config

`state.shiftConfig` is an append-only array of config snapshots:

```js
[
  { effectiveFrom: null, breakSlots: { A: ['18:00–19:30','19:30–21:00'], D: [...], E: [...] } },
  { effectiveFrom: '01/09/2026', breakSlots: { E: ['09:00–10:30','10:30–12:00'] } }
]
```

`getConfigForDate(dateStr)` merges all entries with `effectiveFrom <= dateStr` (null = always baseline). Use this instead of `BREAK_SLOTS` everywhere display times are needed for a specific date.

`BREAK_SLOTS` constant in `data.js` is the **seeded baseline** only. The GAS `BREAK_SLOTS_MAP` must be manually kept in sync with `data.js BREAK_SLOTS` when shift times change (note in both files).

---

## Common Patterns

**Get a user's shift on a specific date:**
```js
var shiftCode = _getSched(u.username, '05/06');  // 'A', 'D', 'E', or '0'
```

**Check if user is on shift today:**
```js
return weekRange.some(function(d) { return _getSched(u.username, d) === currentShift; });
```

**Get all date keys in current week:**
```js
var dates = getWeekRange(activeMonday);  // activeMonday is a Sunday (SPA convention)
```

**Resolve break slot for display:**
```js
var label = getSlotTime(br.slot, dateKey);  // br.slot = 'A1', returns '18:00–19:30'
```
