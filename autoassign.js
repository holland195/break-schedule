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

// Convert 'DD/MM' string → JS Date (assume year 2026)
function _mondayToDate(monStr) {
  const [d, m] = monStr.split('/');
  return new Date(2026, parseInt(m) - 1, parseInt(d));
}

// Get the Monday of the current real calendar week
function _currentWeekMonday() {
  const now  = new Date();
  const day  = now.getDay(); // 0=Sun,1=Mon,...6=Sat
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(now);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// Is a given Monday string strictly in the future (starts after current week)?
function _isFutureWeek(monStr) {
  const monDate    = _mondayToDate(monStr);
  const thisMonday = _currentWeekMonday();
  // Future = the Monday is after this week's Monday
  return monDate > thisMonday;
}

function _loadRotation() {
  try { return JSON.parse(localStorage.getItem(ROTATION_STORAGE_KEY)) || {}; } catch(e) { return {}; }
}
function _saveRotation(rot) {
  try { localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(rot)); } catch(e) {}
}

// ── Core rotation phase resolver (Option C) ──
//
// Called once per (shift, tier, monday) in sorted Monday order.
// The rotation object is mutated in place across calls so each
// future Monday sees the already-flipped phase from the previous Monday.
//
// rot: the mutable rotation object (shared across all calls in one import run)
// monday: 'DD/MM' string for this week's Monday
// Returns the phase (0 or 1) to use for this week
function _resolvePhase(rot, shift, tier, monday) {
  const key   = `${shift}_${tier}`;
  const entry = rot[key];

  if (!entry) {
    // First time ever seen — start at phase 0
    rot[key] = { phase: 0, lastWeek: monday };
    return 0;
  }

  if (entry.lastWeek === monday) {
    // Same Monday already recorded in this run or a previous import → idempotent
    return entry.phase;
  }

  if (!_isFutureWeek(monday)) {
    // Past or current week → DO NOT flip, just use current recorded phase
    // Update lastWeek only if this monday is newer than recorded
    // (handles the case where past weeks were imported out of order)
    const recordedDate = _mondayToDate(entry.lastWeek);
    const thisDate     = _mondayToDate(monday);
    if (thisDate > recordedDate) {
      // More recent past/current week — update lastWeek but keep phase
      rot[key] = { phase: entry.phase, lastWeek: monday };
    }
    return entry.phase;
  }

  // Future week → flip exactly once
  const newPhase = entry.phase === 0 ? 1 : 0;
  rot[key] = { phase: newPhase, lastWeek: monday };
  return newPhase;
}

// ── Main entry point ──
// Called by confirmScheduleImport() after users are merged into state.
// importedUsers: array of user objects from the import.
// Returns { assigned, weekCount }
function autoAssignBreaks(importedUsers) {
  if (!importedUsers || importedUsers.length === 0) {
    return { assigned: 0, weekCount: 0 };
  }

  // Collect all DD/MM dates from imported schedules
  const allDates = new Set();
  importedUsers.forEach(u => {
    Object.keys(u.schedule || {}).forEach(d => allDates.add(d));
  });

  // Find all Monday dates, sort chronologically
  const mondays = [...allDates]
    .filter(d => /^\d{2}\/\d{2}$/.test(d) && getWkDay(d) === 'Mon')
    .sort((a, b) => _mondayToDate(a) - _mondayToDate(b));

  if (mondays.length === 0) return { assigned: 0, weekCount: 0 };

  // Load rotation state once — mutate in place across all weeks in this import
  // This ensures future weeks see the correctly accumulated phase from earlier weeks
  const rot    = _loadRotation();
  const shifts = Object.keys(BREAK_SLOTS);
  let totalAssigned = 0;

  mondays.forEach(monday => {
    const weekDates = getWeekRange(monday);
    const isFuture  = _isFutureWeek(monday);
    const weekLabel = isFuture ? '(future)' : '(current/past)';
    console.log(`[autoassign] Processing week ${monday} ${weekLabel}`);

    shifts.forEach(shift => {
      const slots = BREAK_SLOTS[shift];
      if (!slots || slots.length < 2) return;
      const [slot1, slot2] = slots;

      // Users on this shift in this week
      const onShift = importedUsers.filter(u => {
        const role = u.role || DB.getStaffInfo(u.username)?.role || '';
        if (!_roleTier(role)) return false;
        return weekDates.some(d => u.schedule[d] === shift);
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

        // Resolve phase using Option C logic
        const phase      = _resolvePhase(rot, shift, tier, monday);
        const firstCount = Math.ceil(members.length / 2);

        members.forEach((u, idx) => {
          const inFirst      = idx < firstCount;
          // phase=0: first→slot1, second→slot2
          // phase=1: first→slot2, second→slot1
          const assignedSlot = phase === 0
            ? (inFirst ? slot1 : slot2)
            : (inFirst ? slot2 : slot1);

          weekDates.forEach(d => {
            if (u.schedule[d] !== shift) return;
            DB.setBreak(u.id, d, {
              slot: assignedSlot,
              note: 'auto',
              by:   null,
              at:   Date.now(),
            });
            totalAssigned++;
          });
        });
      });
    });
  });

  // Persist the updated rotation state
  _saveRotation(rot);

  // Push everything to cloud
  if (typeof syncWrite === 'function') syncWrite();

  return { assigned: totalAssigned, weekCount: mondays.length };
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
