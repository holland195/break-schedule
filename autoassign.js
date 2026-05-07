// ═══════════════════════════════════════════════
//  AUTO-ASSIGN BREAK SLOTS
//
//  Rules:
//  • 3 independent role tiers:
//      Tier 1 — Agent + Sr Agent (pooled)
//      Tier 2 — QA
//      Tier 3 — Sr QA
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

// ── Helpers ──

function _roleTier(role) {
  if (!role) return null;
  const r = role.toLowerCase().trim();
  if (r.includes('leader') || r.includes('supervisor') || r.includes('admin')) return null;
  if (r === 'agent' || r === 'sr agent' || r === 'sr. agent') return 'agent';
  if (r === 'qa') return 'qa';
  if (r === 'sr qa' || r === 'sr. qa') return 'sr_qa';
  return null;
}

function _naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function _getShiftChar(schedVal) {
  if (!schedVal) return null;
  const m = String(schedVal).match(/([A-E])/);
  return m ? m[1] : null;
}

// Convert 'DD/MM' string → JS Date (assume year 2026)
function _mondayToDate(monStr) {
  const [d, m] = monStr.split('/');
  return new Date(2026, parseInt(m) - 1, parseInt(d));
}

// Get the Monday of the current real calendar week — in schedule year (2026)
function _currentWeekSunday() {
  const now = new Date();
  const sun = new Date(2026, now.getMonth(), now.getDate() - now.getDay());
  sun.setHours(0, 0, 0, 0);
  return sun;
}

// Is a given Monday string strictly in the future (starts after current week)?
// Both dates use year 2026 so comparison is consistent with getWeekRange()
function _isFutureWeek(sunStr) {
  const sunDate      = _mondayToDate(sunStr); // _mondayToDate works for any DD/MM
  const thisSunday   = _currentWeekSunday();
  return sunDate > thisSunday;
}

function _loadRotation() {
  try { return JSON.parse(localStorage.getItem(ROTATION_STORAGE_KEY)) || {}; } catch(e) { return {}; }
}
function _saveRotation(rot) {
  try { localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(rot)); } catch(e) {}
}

// _resolvePhase v2: sequential flip per batch
// Uses a two-phase approach:
//   1. Calendar-based (past/current week) — never flip, idempotent re-import
//   2. Sequential (any NEW week in this batch) — flip once per new Monday seen
//      regardless of calendar position, so 3 weeks in one paste = 3 alternating phases
function _resolvePhase(rot, shift, tier, monday) {
  const key   = `${shift}_${tier}`;
  const entry = rot[key];
 
  // First time ever seen — start at phase 0
  if (!entry) {
    rot[key] = { phase: 0, lastWeek: monday };
    return 0;
  }
 
  // Same Monday already recorded — idempotent (safe to re-import)
  if (entry.lastWeek === monday) {
    return entry.phase;
  }
 
  // Check if this monday is newer than what we've recorded
  const recordedDate = _mondayToDate(entry.lastWeek);
  const thisDate     = _mondayToDate(monday);
 
  if (thisDate <= recordedDate) {
    // Older or same week — don't touch the phase, just return current
    return entry.phase;
  }
 
  // This is a NEW week (newer monday than recorded).
  // Flip the phase — this handles both future weeks AND same-batch sequential weeks.
  // Whether it's "future" by calendar or just the next week in the imported paste,
  // each new week gets a fresh alternating phase.
  const newPhase = entry.phase === 0 ? 1 : 0;
  rot[key] = { phase: newPhase, lastWeek: monday };
  return newPhase;
}

// ── Main entry point ──
// Called by confirmScheduleImport() after users are merged into state.
// importedUsers: array of user objects from the import.
// Returns { assigned, weekCount }
function autoAssignBreaks(importedUsers) {
  console.log("Auto-assign started with users:", importedUsers.length);
  if (!importedUsers || importedUsers.length === 0) {
    return { assigned: 0, weekCount: 0 };
  }

  // Single timestamp for the entire run — all auto-assigned breaks
  // in this import get the same `at` value. This is important for
  // Option B's merge logic: any manual override done AFTER this import
  // will have a higher timestamp and always wins on pull.
  const RUN_TIMESTAMP = Date.now();

  // Collect all DD/MM dates from imported schedules
  const allDates = new Set();
  importedUsers.forEach(u => {
    Object.keys(u.schedule || {}).forEach(d => allDates.add(d));
  });

  // Find all Sunday dates, sort chronologically
  const sundays = [...allDates]
  .filter(d => /^\d{1,2}\/\d{1,2}$/.test(d) && getWkDay(d) === 'Sun')
  .sort((a, b) => _mondayToDate(a) - _mondayToDate(b));

if (sundays.length === 0) return { assigned: 0, weekCount: 0 };

  // Load rotation state once — mutate in place across all weeks in this import
  // This ensures future weeks see the correctly accumulated phase from earlier weeks
  const rot    = _loadRotation();
  const shifts = Object.keys(BREAK_SLOTS);
  let totalAssigned = 0;

  sundays.forEach(sunday => {
  const weekDates = getWeekRange(sunday); // now returns Sun–Sat
    
    const isFuture  = _isFutureWeek(sunday);
    const weekLabel = isFuture ? '(future)' : '(current/past)';
    console.log(`[autoassign] Processing week ${sunday} ${weekLabel}`);

    shifts.forEach(shift => {
      const slots = BREAK_SLOTS[shift];
      if (!slots || slots.length < 2) return;
      const [slot1, slot2] = slots;

      // Users on this shift in this week
      const onShift = importedUsers.filter(u => {
  const role = u.role || DB.getStaffInfo(u.username)?.role || '';
  if (!_roleTier(role)) return false;
  return weekDates.some(d => _getShiftChar(u.schedule[d]) === shift);
});
      if (onShift.length === 0) return;

      // Split into tiers
      const tiers = { agent: [], qa: [], sr_qa: [] };
      onShift.forEach(u => {
        const role = u.role || DB.getStaffInfo(u.username)?.role || '';
        const t    = _roleTier(role);
        if (t) tiers[t].push(u);
      });

      Object.entries(tiers).forEach(([tier, members]) => {
        if (members.length === 0) return;

        // Sort by group name (natural: AT1 < AT9 < AT10)
        members.sort((a, b) => _naturalSort(a.team || '', b.team || ''));

        // ── Option D: check per-member per-day before assigning ──
        // Count how many members in this tier already have ALL their working
        // days assigned this week — used to decide rotation phase recording.
        const fullyAssigned = members.filter(u =>
  weekDates.every(d => {
    if (_getShiftChar(u.schedule[d]) !== shift) return true;
    return !!DB.getBreak(u.id, d);
  })
);
        const allAlreadyAssigned = fullyAssigned.length === members.length;

        // Resolve phase using Option C logic.
        // IMPORTANT: we resolve the phase even if everyone is already assigned,
        // so that the rotation state is updated correctly for future weeks.
        const phase = _resolvePhase(rot, shift, tier, sunday);
        const firstCount = Math.ceil(members.length / 2);

        // If all members are already fully assigned this week, skip writing
        // but keep the resolved phase (recorded above) for rotation continuity.
        if (allAlreadyAssigned) {
          console.log(`[autoassign] ${shift}/${tier}/${sunday}: all assigned, skipping (phase=${phase} recorded)`);
          return;
        }

        members.forEach((u, idx) => {
          const inFirst      = idx < firstCount;
          const assignedSlot = phase === 0
            ? (inFirst ? slot1 : slot2)
            : (inFirst ? slot2 : slot1);

          weekDates.forEach(d => {
  if (_getShiftChar(u.schedule[d]) !== shift) return; // off or different shift

            // ── Option D: skip this specific member+day if already assigned ──
            const existing = DB.getBreak(u.id, d);
            if (existing) {
              console.log(`[autoassign] Skip ${u.username} on ${d} — already has ${existing.slot}`);
              return; // preserve existing break (manual or prior auto-assign)
            }

            DB.setBreak(u.id, d, {
              slot: (assignedSlot || '').replace(/[\u2012\u2013\u2014\u002D]/g, '–'),
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
    phase:    val.phase,
    lastWeek: val.lastWeek,
    isFuture: _isFutureWeek(val.lastWeek),
  }));
}
