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

// ── Bulk break-assignment enable/disable per shift ──
function getBulkBreakEnabled(shift) {
  if (!state.bulkBreakEnabled) return true; // default ON
  var v = state.bulkBreakEnabled[shift];
  return v === undefined ? true : !!v;
}
function _setBulkBreakEnabled(shift, enabled) {
  if (!state.bulkBreakEnabled) state.bulkBreakEnabled = { A: true, D: true, E: true };
  state.bulkBreakEnabled[shift] = enabled;
  save();
}

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

  var N          = existing.length;
  var wStart     = N > 0 ? ((weeksDiff % N) + N) % N : 0;

  var result = {};
  // Existing teams rotate first; new teams fill only the remaining slot-2 target.
  var oldSlot2Count = Math.min(slot2Count, existing.length);
  existing.forEach(function(t, i) {
    result[t] = (N > 0 && oldSlot2Count > 0 && ((i - wStart + N) % N) < oldSlot2Count) ? slot2 : slot1;
  });

  var assignedSlot2 = existing.reduce(function(count, t) {
    return count + (result[t] === slot2 ? 1 : 0);
  }, 0);
  var newSlot2Count = Math.max(0, slot2Count - assignedSlot2);

  brandNew.sort(_naturalSort).forEach(function(t, i) {
    result[t] = i < newSlot2Count ? slot2 : slot1;
  });

  brandNew.forEach(function(t) {
    if (!knownSet.has(t)) {
      knownList.push(t);
      knownSet.add(t);
    }
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
  var key = shift + '_' + tier;
  if (!rot[key] || !rot[key].baseDate) rot[key] = {};
  var entry = rot[key];
  if (!entry.baseDate) entry.baseDate = sunday;
  if (!entry.members) entry.members  = [];

  var knownList = entry.members;
  if (knownList.length === 0 && members.length > 0) {
    var weekDates = getWeekRange(sunday);
    var slot2Users = [];
    var slot1Users = [];
    var unassignedUsers = [];

    members.forEach(function(u) {
      var ukey = u.username || u.id;
      var hasSlot2 = false;
      var hasSlot1 = false;

      weekDates.forEach(function(d) {
        if (_getSched(u.username, d) !== shift) return;
        var ex = DB.getBreak(u.id, d);
        if (ex && ex.slot) {
          var idx = _slotIndex(ex.slot, shift);
          if (idx === 1) hasSlot2 = true;
          else if (idx === 0) hasSlot1 = true;
        }
      });

      if (hasSlot2) {
        slot2Users.push(ukey);
      } else if (hasSlot1) {
        slot1Users.push(ukey);
      } else {
        unassignedUsers.push(ukey);
      }
    });

    slot2Users.sort(_naturalSort);
    slot1Users.sort(_naturalSort);
    unassignedUsers.sort(_naturalSort);

    entry.members = slot2Users.concat(slot1Users).concat(unassignedUsers);
    knownList = entry.members;
  }

  var knownSet  = new Set(knownList);

  // Add any new members to knownList/knownSet immediately so they participate in rotation
  members.forEach(function(u) {
    var ukey = u.username || u.id;
    if (!knownSet.has(ukey)) {
      knownList.push(ukey);
      knownSet.add(ukey);
    }
  });

  // Sort active members by their position in knownList
  var activeMembers = members.slice().sort(function(a, b) {
    return knownList.indexOf(a.username || a.id) - knownList.indexOf(b.username || b.id);
  });

  var baseDate  = _mondayToDate(entry.baseDate);
  var thisDate  = _mondayToDate(sunday);
  var weeksDiff = Math.round((thisDate - baseDate) / (7 * 24 * 60 * 60 * 1000));

  var N          = activeMembers.length;
  var wStart     = (N > 0 && slot2Count > 0) ? (((weeksDiff * slot2Count) % N) + N) % N : 0;

  var result = {};
  activeMembers.forEach(function(u, i) {
    var ukey = u.username || u.id;
    result[ukey] = (N > 0 && slot2Count > 0 && ((i - wStart + N) % N) < slot2Count) ? slot2 : slot1;
  });

  return result;
}

function _isOffOrHalfDay(username, dateKey) {
  var attCode = typeof _getMonthlyAttendanceCode === 'function' ? _getMonthlyAttendanceCode(username, dateKey) : '';
  if (!attCode) return false;
  var parsed = _parseAttCode(attCode);
  if (!parsed) return false;
  return parsed.type === 'OFF' || parsed.type === 'HD1' || parsed.type === 'HD2';
}

function _getPrevWeekSatMonSlotIndex(u, prevMonday, shift) {
  var prevWeekRange = getWeekRange(prevMonday);
  var days = [prevWeekRange[0], prevWeekRange[6], prevWeekRange[5]]; // Mon, Sun, Sat
  for (var i = 0; i < days.length; i++) {
    var d = days[i];
    if (_getSched(u.username, d) !== shift) continue;
    var br = DB.getBreak(u.id, d);
    if (br && br.slot) {
      var idx = _slotIndex(br.slot, shift);
      if (idx === 0 || idx === 1) return idx;
    }
  }
  return -1;
}

function _getPrevWeekTueFriSlotIndex(u, prevMonday, shift) {
  var prevWeekRange = getWeekRange(prevMonday);
  for (var i = 1; i <= 4; i++) { // Tue-Fri
    var d = prevWeekRange[i];
    if (_getSched(u.username, d) !== shift) continue;
    var br = DB.getBreak(u.id, d);
    if (br && br.slot) {
      var idx = _slotIndex(br.slot, shift);
      if (idx === 0 || idx === 1) return idx;
    }
  }
  return -1;
}

// ── Main entry point ──
// Called by confirmScheduleImport() after users are merged into state.
// importedUsers: array of user objects from the import.
// Returns { assigned, weekCount }
function autoAssignBreaks(importedUsers) {
  if (importedUsers && importedUsers[0]) {
    var keys = Object.keys(importedUsers[0].schedule || {}).slice(0, 5);
    toast('Schedule keys: ' + keys.join(', '), 'warn');
  }
  if (!importedUsers || importedUsers.length === 0) {
    return { assigned: 0, weekCount: 0 };
  }

  var RUN_TIMESTAMP = Date.now();

  var allDates = new Set();
  Object.values(state.staffSchedule || {}).forEach(function(sc) {
    Object.keys(sc || {}).forEach(function(d) { allDates.add(d); });
  });
  importedUsers.forEach(function(u) {
    Object.keys(u.schedule || {}).forEach(function(d) { allDates.add(d); });
  });

  var _mondaySet = {};
  var allDatesArray = [];
  allDates.forEach(function(d) { allDatesArray.push(d); });
  allDatesArray.filter(function(d) { return /^\d{1,2}\/\d{1,2}$/.test(d); }).forEach(function(d) {
    _mondaySet[_getMondayAnchor(d)] = true;
  });
  var mondays = Object.keys(_mondaySet).sort(function(a, b) {
    return _mondayToDate(a) - _mondayToDate(b);
  });

  // Filter out weeks before the baseline week of June 29 (Monday anchor '29/06')
  var baselineMonday = '29/06';
  mondays = mondays.filter(function(m) {
    return _mondayToDate(m) >= _mondayToDate(baselineMonday);
  });

  if (mondays.length === 0) return { assigned: 0, weekCount: 0 };

  var rot = _loadRotation();
  var totalAssigned = 0;

  mondays.forEach(function(monday) {
    var weekDates = getWeekRange(monday);
    var shifts = Object.keys(getConfigForDate(monday).breakSlots);
    var isFuture = _isFutureWeek(monday);
    var weekLabel = isFuture ? '(future)' : '(current/past)';
    console.log('[autoassign] Processing week ' + monday + ' ' + weekLabel);

    shifts.forEach(function(shift) {
      // Skip this shift entirely if bulk break assignment is OFF
      if (!getBulkBreakEnabled(shift)) return;
      var slots = getConfigForDate(monday).breakSlots[shift];
      if (!slots || slots.length < 2) return;
      var slot1 = slots[0];
      var slot2 = slots[1];

      var onShift = importedUsers.filter(function(u) {
        var role = (DB.getStaffInfo(u.username) || {}).role || u.role || '';
        if (!_roleTier(role)) return false;
        return weekDates.some(function(d) {
          return _getSched(u.username, d) === shift;
        });
      });
      if (onShift.length === 0) return;

      var tiers = { agent: [], qa: [], sr_qa: [] };
      onShift.forEach(function(u) {
        var role = (DB.getStaffInfo(u.username) || {}).role || u.role || '';
        var t = _roleTier(role);
        if (t) tiers[t].push(u);
      });

      Object.keys(tiers).forEach(function(tier) {
        var members = tiers[tier];
        if (members.length === 0) return;

        var customPct = getBreakSplitPct(shift, tier);
        var slot1Count = customPct !== null
          ? Math.round(members.length * customPct / 100)
          : Math.ceil(members.length / 2);
        var slot2Count = members.length - slot1Count;

        var userSlotMap = _getSlotMap(rot, shift, tier, monday, members, slot1, slot2, slot2Count);
        var slotBasisMap = userSlotMap;

        // Shift E should split by group, matching the distribution panel and
        // the "groups assigned as a block" rule. The user-level map can drift
        // badly when the roster changes between weeks.
        if (shift === 'E') {
          var teamSeen = {};
          var teamsForTier = [];
          members.forEach(function(u) {
            var teamKey = u.team || ('_' + (u.username || u.id));
            if (!teamSeen[teamKey]) {
              teamSeen[teamKey] = true;
              teamsForTier.push(teamKey);
            }
          });

          var teamSlot1Count = customPct !== null
            ? Math.round(teamsForTier.length * customPct / 100)
            : Math.ceil(teamsForTier.length / 2);
          var teamSlot2Count = teamsForTier.length - teamSlot1Count;
          var teamSlotMap = _getTeamSlotMap(rot, shift, tier, monday, teamsForTier, slot1, slot2, teamSlot2Count);

          slotBasisMap = {};
          members.forEach(function(u) {
            var teamKey = u.team || ('_' + (u.username || u.id));
            slotBasisMap[u.username || u.id] = teamSlotMap[teamKey] || slot1;
          });
        }

        var allAlreadyAssigned = members.every(function(u) {
          return weekDates.every(function(d) {
            if (_getSched(u.username, d) !== shift) return true;
            if (_isOffOrHalfDay(u.username, d)) return true;
            var ex = DB.getBreak(u.id, d);
            if (!ex || !_slotBelongsToShift(ex.slot, shift)) return false;
            if (shift !== 'E' || ex.note !== 'auto') return true;

            var expectedSlot = slotBasisMap[u.username || u.id] || slot1;
            var expectedIdx = expectedSlot === slot2 ? 1 : 0;
            return _slotIndex(ex.slot, shift) === expectedIdx;
          });
        });
        if (allAlreadyAssigned) {
          toast('[autoassign] ' + shift + '/' + tier + '/' + monday + ': all assigned, skipping', 'warn');
          return;
        }

        // 1. Custom override for the transition week of June 29 (week 29/6)
        if (monday === '29/06') {
          if (shift === 'A' && tier === 'agent') {
            members.forEach(function(u) {
              var team = u.team || '';
              weekDates.forEach(function(d) {
                if (_getSched(u.username, d) !== 'A') return;
                if (_isOffOrHalfDay(u.username, d)) return;
                var slotVal = 'A1';
                if (team === 'DA7' || team === 'DA8' || team === 'DA9') {
                  if (d === '29/06') slotVal = 'A2';
                } else if (team === 'DA10' || team === 'DA11' || team === 'DA12') {
                  if (d !== '04/07' && d !== '05/07') slotVal = 'A2';
                } else if (team.startsWith('DA29') || team.startsWith('DA30') || team.startsWith('DA31') || 
                           team.startsWith('DA32') || team.startsWith('DA33') || team.startsWith('DA34')) {
                  slotVal = 'A2';
                }
                DB.setBreak(u.id, d, {
                  slot: slotVal,
                  note: 'auto',
                  by:   null,
                  at:   RUN_TIMESTAMP,
                });
                totalAssigned++;
              });
            });
            return;
          }

          if (shift === 'A' && tier === 'qa') {
            members.forEach(function(u) {
              var team = u.team || '';
              weekDates.forEach(function(d) {
                if (_getSched(u.username, d) !== 'A') return;
                if (_isOffOrHalfDay(u.username, d)) return;
                var slotVal = 'A1';
                if (team === 'DS2' || team === 'DS3' || team === 'DS4' || team === 'DS5') {
                  slotVal = 'A2';
                } else if (team === 'DS6' || team === 'DS7' || team === 'DS8') {
                  if (d !== '04/07' && d !== '05/07') slotVal = 'A2';
                } else if (team === 'DS9' || team === 'DS10' || team === 'DS11') {
                  if (d === '04/07' || d === '05/07') slotVal = 'A2';
                } else if (team === 'DS12' || team === 'DS13' || team === 'DS14' || team === 'DS15' || team === 'DS16') {
                  if (d === '04/07') slotVal = 'A2';
                }
                DB.setBreak(u.id, d, {
                  slot: slotVal,
                  note: 'auto',
                  by:   null,
                  at:   RUN_TIMESTAMP,
                });
                totalAssigned++;
              });
            });
            return;
          }
        }

        // Calculate previous week's Monday
        var parts = monday.split('/');
        var dt = new Date(2026, parseInt(parts[1]) - 1, parseInt(parts[0]));
        dt.setDate(dt.getDate() - 7);
        var prevMonday = String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');

        // 2. Normal rotation & Tue-Fri inversion logic
        members.forEach(function(u) {
          var baseSatMonSlot, baseTueFriSlot;

          if (shift === 'E') {
            baseSatMonSlot = slotBasisMap[u.username || u.id] || slot1;
            baseTueFriSlot = baseSatMonSlot;
          } else {
            var prevSatMonIdx = _getPrevWeekSatMonSlotIndex(u, prevMonday, shift);
            var prevTueFriIdx = _getPrevWeekTueFriSlotIndex(u, prevMonday, shift);

            // Resolve Sat-Mon slot
            if (prevSatMonIdx !== -1) {
              baseSatMonSlot = (prevSatMonIdx === 0) ? slot2 : slot1;
            } else {
              // Fallback to standard rotation
              baseSatMonSlot = slotBasisMap[u.username || u.id] || slot1;
            }

            // Resolve Tue-Fri slot
            if (prevTueFriIdx !== -1) {
              baseTueFriSlot = (prevTueFriIdx === 0) ? slot2 : slot1;
            } else {
              // Fallback to standard rotation opposite
              var baseSlot = slotBasisMap[u.username || u.id] || slot1;
              baseTueFriSlot = (baseSlot === slot2) ? slot1 : slot2;
            }
          }

          weekDates.forEach(function(d) {
            if (_getSched(u.username, d) !== shift) return;
            if (_isOffOrHalfDay(u.username, d)) return;

            var assignedSlot;
            if (shift === 'A' || shift === 'D') {
              var wkday = getWkDay(d);
              if (wkday === 'Tue' || wkday === 'Wed' || wkday === 'Thu' || wkday === 'Fri') {
                assignedSlot = baseTueFriSlot;
              } else {
                assignedSlot = baseSatMonSlot;
              }
            } else {
              // Shift E: use baseTueFriSlot (which alternates weekly directly) for all days
              assignedSlot = baseTueFriSlot;
            }

            var ex = DB.getBreak(u.id, d);
            if (ex && _slotBelongsToShift(ex.slot, shift)) {
              var expectedIdx = assignedSlot === slot2 ? 1 : 0;
              var existingIdx = _slotIndex(ex.slot, shift);
              if (shift !== 'E' || ex.note !== 'auto' || existingIdx === expectedIdx) return;
            }

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

  // ── Post-process: ensure slot 2 is present on Mon, Sat, Sun per tier ──
  // After the main rotation, check each week × shift × {Mon,Sat,Sun} for each tier.
  // If no one in a tier is on slot 2 that day (because the slot-2 rotated members are absent),
  // and there are >= 2 members of that tier working, pick one who is on slot 1 and override to slot 2.
  var _checkDays = new Set(['Mon', 'Sat', 'Sun']);
  mondays.forEach(function(monday) {
    var weekDates2 = getWeekRange(monday);
    var shifts2 = Object.keys(getConfigForDate(monday).breakSlots);
    shifts2.forEach(function(shift) {
      var slots2 = getConfigForDate(monday).breakSlots[shift];
      if (!slots2 || slots2.length < 2) return;
      var slot2Code = shift + '2';

      weekDates2.forEach(function(dk) {
        if (!_checkDays.has(getWkDay(dk))) return;

        var tierUsers = { agent: [], qa: [], sr_qa: [] };
        importedUsers.forEach(function(u) {
          var role = (DB.getStaffInfo(u.username) || {}).role || u.role || '';
          var t = _roleTier(role);
          if (t && _getSched(u.username, dk) === shift) {
            if (!_isOffOrHalfDay(u.username, dk)) {
              tierUsers[t].push(u);
            }
          }
        });

        Object.keys(tierUsers).forEach(function(tier) {
          var dayUsers = tierUsers[tier];
          if (dayUsers.length < 2) return;

          var hasSlot2 = dayUsers.some(function(u) {
            var br = DB.getBreak(u.id, dk);
            return br && br.slot === slot2Code;
          });
          if (hasSlot2) return;

          var sortedUsers = dayUsers.slice().sort(function(a, b) {
            return _naturalSort(a.username || a.id, b.username || b.id);
          });
          var pickedUser = sortedUsers[0];
          DB.setBreak(pickedUser.id, dk, {
            slot: slot2Code,
            note: 'auto',
            by:   null,
            at:   RUN_TIMESTAMP,
          });
          totalAssigned++;
          console.log('[autoassign] weekend-fill: ' + shift + ' ' + dk + ' (' + tier + ') → slot2 assigned to ' + pickedUser.username);
        });
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

  return { assigned: totalAssigned, weekCount: mondays.length };
}

// ── Bulk Break Toggle ──

// Returns the Monday anchor (DD/MM) of the current week.
function _currentWeekMonday() {
  var now = new Date();
  // Week starts Monday; getDay() returns 0=Sun…6=Sat
  var dayOfWeek = now.getDay(); // 0=Sun
  var daysToMon = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
  var mon = new Date(now);
  mon.setDate(now.getDate() + daysToMon);
  mon.setHours(0, 0, 0, 0);
  return String(mon.getDate()).padStart(2, '0') + '/' + String(mon.getMonth() + 1).padStart(2, '0');
}

// Clear all auto-assigned (and optionally manual) breaks from fromMonday onward for the given shift.
function _clearBreaksFromMondayForShift(fromMonday, shift, force) {
  var parts = fromMonday.split('/');
  var fromDate = new Date(2026, parseInt(parts[1]) - 1, parseInt(parts[0]));
  fromDate.setHours(0, 0, 0, 0);
  Object.keys(state.breaks || {}).forEach(function(key) {
    var dayPart = key.split('_').pop();
    if (!/^\d{1,2}\/\d{1,2}$/.test(dayPart)) return;
    var dp = dayPart.split('/');
    var d = new Date(2026, parseInt(dp[1]) - 1, parseInt(dp[0]));
    d.setHours(0, 0, 0, 0);
    if (d < fromDate) return;
    var br = state.breaks[key];
    if (!br) return;
    if (!force && br.note !== 'auto') return;
    if (_slotBelongsToShift(br.slot, shift)) delete state.breaks[key];
  });
}

/**
 * Toggle bulk break assignment ON/OFF for a specific shift.
 * Called from the Arrange page toggle button.
 * @param {string} shift  'A', 'D' or 'E'
 */
async function toggleBulkBreak(shift) {
  var currentlyOn = getBulkBreakEnabled(shift);
  var thisMonday = _currentWeekMonday();

  if (currentlyOn) {
    // ── Turning OFF ──
    var msg = 'Turn OFF auto break assignment for Shift ' + shift + '?\n\n'
      + '• All auto-assigned breaks on current and future weeks for Shift ' + shift + ' will be cleared.\n'
      + '• Past weeks are not affected.\n'
      + '• Manual overrides on current/future weeks will also be removed.\n\n'
      + 'Continue?';
    if (!confirm(msg)) return;

    // Clear current + future weeks for this shift (force = true to also remove manual)
    _clearBreaksFromMondayForShift(thisMonday, shift, true);
    _setBulkBreakEnabled(shift, false);
    await syncWrite();
    toast('Shift ' + shift + ' auto-break assignment turned OFF. Breaks cleared from ' + thisMonday + ' onward.', 'warn');

  } else {
    // ── Turning ON ──
    var msg = 'Turn ON auto break assignment for Shift ' + shift + '?\n\n'
      + '• Auto-break assignment will resume for Shift ' + shift + '.\n'
      + '• Current and future weeks will be filled based on the existing rotation.\n\n'
      + 'Continue?';
    if (!confirm(msg)) return;

    _setBulkBreakEnabled(shift, true);
    // Re-run auto-assign — the existing rotation state is preserved so it continues from last known pattern
    var result = autoAssignBreaks(state.users);
    await syncWrite();
    toast('Shift ' + shift + ' auto-break assignment turned ON. Re-assigned ' + result.assigned + ' break(s).', 'ok');
  }

  nav('arrange');
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
