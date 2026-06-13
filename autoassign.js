// ═══════════════════════════════════════════════
//  AUTO-ASSIGN BREAK SLOTS
//
//  Rules:
//  • 3 independent role tiers:
//      Tier 1 — Data Analyst + Sr Data Analyst (pooled)
//      Tier 2 — Data Supervisor
//      Tier 3 — Sr Data Supervisor
//  • Groups sorted naturally (AT1 < AT2 < AT9 < AT10)
//  • Even split: ceil(n/2) → first half, floor(n/2) → second half
//  • Groups assigned as a block (Option A)
//  • Rotation rule (Option C — calendar-aware):
//      - Past/current week → use existing recorded phase (idempotent re-import)
//      - Future week      → flip phase once per new future Monday found
//      - "Current week"   = the Monday whose 7-day window contains today
//  • Leaders / Supervisors / Admin skipped
//  • Off days (schedule ≠ shift) skipped
// ═══════════════════════════════════════════════

const ROTATION_STORAGE_KEY = 'bsched_rotation';
const BREAK_SPLIT_KEY      = 'bsched_break_split';

// ── Break split storage ──
// Persists per-shift custom split percentages (slot1 %).
// null entry → use default 50/50 rotation for that shift.

function _loadBreakSplit() {
  // Primary: cloud-synced state.breakSplits; migrate from localStorage on first use
  if (state.breakSplits && Object.keys(state.breakSplits).length > 0) {
    return { ...state.breakSplits };
  }
  try {
    const ls = JSON.parse(localStorage.getItem(BREAK_SPLIT_KEY)) || {};
    if (Object.keys(ls).length > 0) {
      state.breakSplits = { ...ls }; // migrate to state
    }
    return ls;
  } catch(e) { return {}; }
}
function _saveBreakSplit(splits) {
  state.breakSplits = { ...splits };
  state._breakSplitsUpdatedAt = Date.now();
  try { localStorage.setItem(BREAK_SPLIT_KEY, JSON.stringify(splits)); } catch(e) {}
}

// Returns the saved slot-1 percentage (0–100) for a shift (and optionally a tier).
// Shift value may be a plain number (legacy) or an object with per-tier keys.
// Returns null if no custom split is configured for the given shift/tier.
function getBreakSplitPct(shift, tier) {
  var splits = _loadBreakSplit();
  var val = splits[shift];
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object') {
    if (tier && val[tier] !== undefined) return val[tier];
    if (val.pct !== undefined) return val.pct;
    return null;
  }
  return null;
}

// Saves a custom slot-1 percentage for a shift. Pass null to clear (revert to rotation).
function setBreakSplitPct(shift, pct) {
  const splits = _loadBreakSplit();
  if (pct === null) delete splits[shift];
  else splits[shift] = Math.max(0, Math.min(100, Math.round(pct)));
  _saveBreakSplit(splits);
}

// ── Helpers ──

// Normalize dash variants for slot comparison
function _nd(s) {
  return (s || '').replace(/[\u2012\u2013\u2014\u002D\u2212]/g, '-').replace(/\s/g, '');
}

// Check if a saved slot belongs to the given shift (prevents wrong-shift slots blocking reassignment)
function _slotBelongsToShift(slot, shift) {
  if (!slot) return false;
  // Short code form (e.g., 'A1', 'E2') — check shift letter + valid digit
  if (slot.length === 2 && slot[0] === shift && !isNaN(parseInt(slot[1]))) return true;
  // Legacy time string — normalize and compare against BREAK_SLOTS
  return (BREAK_SLOTS[shift] || []).some(s => _nd(s) === _nd(slot));
}

function _roleTier(role) {
  if (!role) return null;
  const r = role.toLowerCase().trim();

  // New role names — must come BEFORE the broad 'supervisor' exclusion below
  if (r === 'data analyst' || r === 'sr data analyst') return 'agent';
  if (r === 'data supervisor') return 'qa';
  if (r === 'sr data supervisor') return 'sr_qa';

  // Skip management / non-IC roles
  if (r.includes('leader') || r.includes('supervisor') || r.includes('admin') || r.includes('manager') || r.includes('assistant')) return null;

  // Legacy role names (pre-rename, matching ROLE_ALIASES in data.js)
  if (r === 'agent' || r === 'sr agent') return 'agent';
  if (r === 'qa') return 'qa';
  if (r === 'sr qa') return 'sr_qa';

  return null;
}

function _naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Round-robin interleave users from different teams so same-group members
// are spread apart in the rotation list. Teams sorted naturally (AT1 < AT2 …).
// This prevents the A2 window from lingering on a single group for many
// consecutive weeks when members of the same group share adjacent positions.
function _interleaveByTeam(users) {
  var teamMap = {};
  users.forEach(function(u) {
    var t = u.team || '_';
    if (!teamMap[t]) teamMap[t] = [];
    teamMap[t].push(u);
  });
  var teams = Object.keys(teamMap).sort(_naturalSort);
  var result = [];
  var maxLen = teams.reduce(function(m, t) { return Math.max(m, teamMap[t].length); }, 0);
  for (var ri = 0; ri < maxLen; ri++) {
    teams.forEach(function(t) {
      if (ri < teamMap[t].length) result.push(teamMap[t][ri]);
    });
  }
  return result;
}



// Convert 'DD/MM' string → JS Date (assume year 2026)
function _mondayToDate(monStr) {
  const [d, m] = monStr.split('/');
  return new Date(2026, parseInt(m) - 1, parseInt(d));
}

// Replace _currentWeekMonday:
function _currentWeekSunday() {
  const now = new Date();
  const sun = new Date(2026, now.getMonth(), now.getDate() - now.getDay());
  sun.setHours(0, 0, 0, 0);
  return sun;
}

// Replace _isFutureWeek:
function _isFutureWeek(sunStr) {
  const sunDate    = _mondayToDate(sunStr); // works for any DD/MM
  const thisSunday = _currentWeekSunday();
  return sunDate > thisSunday;
}

function _loadRotation() {
  try { return JSON.parse(localStorage.getItem(ROTATION_STORAGE_KEY)) || {}; } catch(e) { return {}; }
}
function _saveRotation(rot) {
  try { localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(rot)); } catch(e) {}
}

// _getSlotMap — circular sliding window rotation.
//
// Team-level rotation: assigns each TEAM (group) to a slot, so every member
// of the same team lands on the same slot. Rotation key: `${shift}_${tier}_teams`.
// slot2Count = number of teams that go to slot2 this week.
// Fully idempotent.
function _getTeamSlotMap(rot, shift, tier, sunday, teams, slot1, slot2, slot2Count) {
  var key = shift + '_' + tier + '_teams';
  if (!rot[key] || !rot[key].baseDate) rot[key] = {};
  var entry = rot[key];
  if (!entry.baseDate) entry.baseDate = sunday;
  if (!entry.members) entry.members = [];

  var knownList = entry.members;
  var knownSet  = new Set(knownList);

  var brandNew = teams.filter(function(t) { return !knownSet.has(t); });
  var existing = teams.filter(function(t) { return  knownSet.has(t); });

  existing.sort(function(a, b) { return knownList.indexOf(a) - knownList.indexOf(b); });

  var baseDate  = _mondayToDate(entry.baseDate);
  var thisDate  = _mondayToDate(sunday);
  var weeksDiff = Math.round((thisDate - baseDate) / (7 * 24 * 60 * 60 * 1000));

  var newA2Count = Math.min(brandNew.length, slot2Count);
  var remA2      = slot2Count - newA2Count;
  var N          = existing.length;
  var wStart     = N > 0 ? ((weeksDiff % N) + N) % N : 0;

  var result = {};
  existing.forEach(function(t, i) {
    result[t] = (N > 0 && remA2 > 0 && ((i - wStart + N) % N) < remA2) ? slot2 : slot1;
  });
  brandNew.sort(_naturalSort).forEach(function(t, i) {
    result[t] = i < newA2Count ? slot2 : slot1;
    if (!knownSet.has(t)) { knownList.push(t); knownSet.add(t); }
  });

  return result;
}

// Guarantees EXACTLY slot2Count members on slot2 every week, with the
// "A2 window" shifting by 1 position each week so every member gets equal
// time in each slot over the long run.
//
// New members (first appearance on this shift) fill A2 first; overflow → A1.
//
// Storage per key `${shift}_${tier}`:
//   { baseDate: 'DD/MM', members: ['username', ...] }
//   baseDate  — Sunday of the first week ever processed (never changes)
//   members   — stable ordered list; new members appended on first appearance
//
// Fully idempotent: processing the same week N times gives the same result.
function _getSlotMap(rot, shift, tier, sunday, members, slot1, slot2, slot2Count) {
  const key = `${shift}_${tier}`;
  // Migrate old formats (v2 had {phase,lastWeek}, v3 had {baseDate} with no members list)
  if (!rot[key] || !rot[key].baseDate) rot[key] = {};
  const entry = rot[key];
  if (!entry.baseDate) entry.baseDate = sunday;
  if (!entry.members) entry.members  = [];

  const knownList = entry.members;       // mutated in place, then saved by caller
  const knownSet  = new Set(knownList);

  // Classify members
  const brandNew  = members.filter(u => !knownSet.has(u.username || u.id));
  const existing  = members.filter(u =>  knownSet.has(u.username || u.id));

  // Existing members sorted by their stable position in knownList
  existing.sort((a, b) =>
    knownList.indexOf(a.username || a.id) - knownList.indexOf(b.username || b.id)
  );

  // Sliding window offset
  const baseDate  = _mondayToDate(entry.baseDate);
  const thisDate  = _mondayToDate(sunday);
  const weeksDiff = Math.round((thisDate - baseDate) / (7 * 24 * 60 * 60 * 1000));

  // New members claim A2 slots first; remaining A2 slots go to the window
  const newA2Count = Math.min(brandNew.length, slot2Count);
  const remA2      = slot2Count - newA2Count;
  const N          = existing.length;
  const wStart     = N > 0 ? ((weeksDiff % N) + N) % N : 0;

  const result = {};

  existing.forEach((u, i) => {
    const ukey = u.username || u.id;
    result[ukey] = (N > 0 && remA2 > 0 && ((i - wStart + N) % N) < remA2) ? slot2 : slot1;
  });

  _interleaveByTeam(brandNew).forEach((u, i) => {
    const ukey = u.username || u.id;
    result[ukey] = i < newA2Count ? slot2 : slot1;
    if (!knownSet.has(ukey)) { knownList.push(ukey); knownSet.add(ukey); }
  });

  return result;
}

// ── Main entry point ──
// Called by confirmScheduleImport() after users are merged into state.
// importedUsers: array of user objects from the import.
// Returns { assigned, weekCount }
function autoAssignBreaks(importedUsers) {
  //console.log("Auto-assign started with users:", importedUsers.length);
    if (importedUsers && importedUsers[0]) {
    const keys = Object.keys(importedUsers[0].schedule || {}).slice(0, 5);
    toast('Schedule keys: ' + keys.join(', '), 'warn');
  }
  if (!importedUsers || importedUsers.length === 0) {
    
    return { assigned: 0, weekCount: 0 };
  }

  // Single timestamp for the entire run — all auto-assigned breaks
  // in this import get the same `at` value. This is important for
  // Option B's merge logic: any manual override done AFTER this import
  // will have a higher timestamp and always wins on pull.
  const RUN_TIMESTAMP = Date.now();

  // Collect all DD/MM dates from staffSchedule
  const allDates = new Set();
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(d) { allDates.add(d); });
  });
  // Fallback: also collect from user objects (backwards compat during migration)
  importedUsers.forEach(u => {
    Object.keys(u.schedule || {}).forEach(d => allDates.add(d));
  });

  // Derive all Sunday anchors from any date in the schedule.
  // If the import has no Sunday entries (e.g. Mon–Sat only), rewind each date
  // to its containing Sunday so those weeks are still processed.
  var _sundaySet = {};
  [...allDates].filter(function(d) { return /^\d{1,2}\/\d{1,2}$/.test(d); }).forEach(function(d) {
    var parts = d.split('/');
    var dt = new Date(2026, parseInt(parts[1]) - 1, parseInt(parts[0]));
    dt.setDate(dt.getDate() - dt.getDay()); // rewind to Sunday
    var sd = String(dt.getDate()).padStart(2, '0');
    var sm = String(dt.getMonth() + 1).padStart(2, '0');
    _sundaySet[sd + '/' + sm] = true;
  });
  const sundays = Object.keys(_sundaySet).sort((a, b) => _mondayToDate(a) - _mondayToDate(b));

  if (sundays.length === 0) return { assigned: 0, weekCount: 0 };

  // Load rotation state once — mutate in place across all weeks in this import
  // This ensures future weeks see the correctly accumulated phase from earlier weeks
  const rot    = _loadRotation();
  let totalAssigned = 0;

  sundays.forEach(sunday => {
  const weekDates = getWeekRange(sunday); // now returns Sun–Sat
    const shifts = Object.keys(getConfigForDate(sunday).breakSlots);

    const isFuture  = _isFutureWeek(sunday);

    const weekLabel = isFuture ? '(future)' : '(current/past)';
    console.log(`[autoassign] Processing week ${sunday} ${weekLabel}`);

    shifts.forEach(shift => {
      const slots = getConfigForDate(sunday).breakSlots[shift];
      if (!slots || slots.length < 2) return;
      const [slot1, slot2] = slots;

      // Users on this shift in this week.
      // Schedule keys may be DD/MM date strings OR day-name strings ('Mon', 'Tue'…)
      // depending on how GAS imported them — check both, matching pages.js behaviour.
      const onShift = importedUsers.filter(u => {
        const role = DB.getStaffInfo(u.username)?.role || u.role || '';
        if (!_roleTier(role)) return false;
        return weekDates.some((d, i) => _getSched(u.username, d) === shift);
      });
      if (onShift.length === 0) return;

      // Split into tiers
      const tiers = { agent: [], qa: [], sr_qa: [] };
      onShift.forEach(u => {
        const role = DB.getStaffInfo(u.username)?.role || u.role || '';
        const t    = _roleTier(role);
        if (t) tiers[t].push(u);
      });

      Object.entries(tiers).forEach(([tier, members]) => {
        if (members.length === 0) return;

        // Group members by team and compute slot assignment at team level
        // so all members of the same team always land on the same slot.
        const teamGroups = {};
        members.forEach(u => {
          const t = u.team || '_no_team_';
          if (!teamGroups[t]) teamGroups[t] = [];
          teamGroups[t].push(u);
        });
        const teams = Object.keys(teamGroups).sort(_naturalSort);

        const customPct      = getBreakSplitPct(shift, tier);
        const slot1TeamCount = customPct !== null
          ? Math.round(teams.length * customPct / 100)
          : Math.ceil(teams.length / 2);
        const slot2TeamCount = teams.length - slot1TeamCount;

        // Compute team slot map — always runs to keep rotation state current
        const teamSlotMap = _getTeamSlotMap(rot, shift, tier, sunday, teams, slot1, slot2, slot2TeamCount);

        // Skip writing if every member already has a correct break this week
        const allAlreadyAssigned = members.every(u =>
          weekDates.every((d, i) => {
            if (_getSched(u.username, d) !== shift) return true;
            const ex = DB.getBreak(u.id, d);
            return ex && _slotBelongsToShift(ex.slot, shift);
          })
        );
        if (allAlreadyAssigned) {
          //console.log(`[autoassign] ${shift}/${tier}/${sunday}: all assigned, skipping`);
          toast(`[autoassign] ${shift}/${tier}/${sunday}: all assigned, skipping`, 'warn');
          return;
        }

        members.forEach(u => {
          const assignedSlot = teamSlotMap[u.team || '_no_team_'] || slot1;

          weekDates.forEach((d, i) => {
            if (_getSched(u.username, d) !== shift) return;
            const ex = DB.getBreak(u.id, d);
            if (ex && _slotBelongsToShift(ex.slot, shift)) return;
            DB.setBreak(u.id, d, {
              slot: assignedSlot === slot2 ? shift + '2' : shift + '1',
              note: 'auto',
              by:   null,
              at:   RUN_TIMESTAMP,
            });
            totalAssigned++;
          });
        });
      });
    });
  });

  // ── Post-process: ensure slot 2 is present on Mon, Sat, Sun ──
  // After the main rotation, check each week × shift × {Mon,Sat,Sun}.
  // If no team is on slot 2 that day (because the slot-2 team is absent),
  // pick the first present team that is currently on slot 1 and override
  // just that day's assignments to slot 2.
  var _checkDays = new Set(['Mon', 'Sat', 'Sun']);
  sundays.forEach(function(sunday) {
    var weekDates2 = getWeekRange(sunday);
    var shifts2 = Object.keys(getConfigForDate(sunday).breakSlots);
    shifts2.forEach(function(shift) {
      var slots2 = getConfigForDate(sunday).breakSlots[shift];
      if (!slots2 || slots2.length < 2) return;
      var slot2Code = shift + '2';

      weekDates2.forEach(function(dk) {
        if (!_checkDays.has(getWkDay(dk))) return;

        // Collect all users on this shift on this day
        var dayUsers = importedUsers.filter(function(u) {
          var role = (DB.getStaffInfo(u.username) || {}).role || u.role || '';
          if (!_roleTier(role)) return false;
          return _getSched(u.username, dk) === shift;
        });
        if (dayUsers.length === 0) return;

        // Check if anyone already has slot 2 this day
        var hasSlot2 = dayUsers.some(function(u) {
          var br = DB.getBreak(u.id, dk);
          return br && br.slot === slot2Code;
        });
        if (hasSlot2) return;

        // No slot 2 — group present users by team and pick first team
        var teamGroups2 = {};
        dayUsers.forEach(function(u) {
          var t = u.team || '_no_team_';
          if (!teamGroups2[t]) teamGroups2[t] = [];
          teamGroups2[t].push(u);
        });
        var sortedTeams2 = Object.keys(teamGroups2).sort(_naturalSort);
        if (!sortedTeams2.length) return;

        // Pick first team and assign slot 2 for this specific day only
        var pickedTeam = sortedTeams2[0];
        teamGroups2[pickedTeam].forEach(function(u) {
          DB.setBreak(u.id, dk, {
            slot: slot2Code,
            note: 'auto',
            by:   null,
            at:   RUN_TIMESTAMP,
          });
          totalAssigned++;
        });
        console.log('[autoassign] weekend-fill: ' + shift + ' ' + dk + ' → slot2 assigned to team ' + pickedTeam);
      });
    });
  });

  // Persist the updated rotation state
  _saveRotation(rot);

  // Mark when breaks were last written so the merge logic in _applyRemoteData
  // can detect that our local data is newer than anything currently in the cloud
  state._breaksUpdatedAt = RUN_TIMESTAMP;

  // Note: syncWrite() is called by confirmScheduleImport() with await
  // Do not call it here — caller handles the push after this returns

  return { assigned: totalAssigned, weekCount: sundays.length };
}

// ── Admin utilities ──

// Reset rotation for a specific shift+tier (forces phase 0 on next import)
function resetRotation(shift, tier) {
  const rot = _loadRotation();
  delete rot[`${shift}_${tier}`];
  _saveRotation(rot);
  toast(`Rotation reset for Shift ${shift} / ${tier}`, 'warn');
}

// Get rotation summary for display in Cloud Sync settings
function getRotationSummary() {
  const rot = _loadRotation();
  return Object.entries(rot).map(([key, val]) => ({
    key,
    shift:    key.split('_')[0],
    tier:     key.split('_').slice(1).join('_'),
    baseDate: val.baseDate || '—',
    members:  (val.members || []).length,
  }));
}
