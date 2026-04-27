// ═══════════════════════════════════════════════
//  AUTO-ASSIGN BREAK SLOTS
//
//  Rules:
//  • Roles split into 3 independent tiers:
//      Tier 1 — Agent + Sr Agent (pooled)
//      Tier 2 — QA
//      Tier 3 — Sr QA
//  • Groups sorted naturally (AT1 < AT2 < AT9 < AT10)
//  • Members split evenly: ceil(n/2) → slot 1, floor(n/2) → slot 2
//  • Groups are assigned as a block (Option A) — no splitting a group
//    across slots unless the group itself spans both halves
//  • Week-to-week rotation: slot assignment flips for each tier+shift
//    pair based on the imported week's Monday date
//  • Leaders / Supervisors / Admin are skipped
//  • Off days (schedule = '0' or different shift) are skipped
//  • Existing assignments for OTHER weeks are preserved
// ═══════════════════════════════════════════════

const ROTATION_STORAGE_KEY = 'bsched_rotation';

// Role → tier mapping
function _roleTier(role) {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes('leader') || r.includes('supervisor') || r.includes('admin')) return null; // skip
  if (r === 'agent' || r === 'sr agent' || r === 'sr. agent') return 'agent';
  if (r === 'qa') return 'qa';
  if (r === 'sr qa' || r === 'sr. qa') return 'sr_qa';
  return null; // unknown roles skipped
}

// Natural sort comparator for group names (AT1 < AT2 < AT9 < AT10 < QA1 < QA10)
function _naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Load rotation state from localStorage
function _loadRotation() {
  try { return JSON.parse(localStorage.getItem(ROTATION_STORAGE_KEY)) || {}; } catch(e) { return {}; }
}
function _saveRotation(rot) {
  localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(rot));
}

// Get rotation phase (0 or 1) for a given shift + tier + weekMonday
// Phase 0 = first half of groups → slot 1
// Phase 1 = first half of groups → slot 2 (flipped)
function _getRotationPhase(shift, tier, weekMonday) {
  const rot = _loadRotation();
  const key = `${shift}_${tier}`;

  if (!rot[key]) {
    // No history — start at phase 0, record it
    rot[key] = { phase: 0, lastWeek: weekMonday };
    _saveRotation(rot);
    return 0;
  }

  const entry = rot[key];
  if (entry.lastWeek === weekMonday) {
    // Same week imported again — use existing phase (idempotent)
    return entry.phase;
  }

  // New week detected — flip phase
  const newPhase = entry.phase === 0 ? 1 : 0;
  rot[key] = { phase: newPhase, lastWeek: weekMonday };
  _saveRotation(rot);
  return newPhase;
}

// Main entry point — called after schedule import
// importedUsers: array of user objects just imported
// Returns { assigned, skipped, weekCount } summary
function autoAssignBreaks(importedUsers) {
  if (!importedUsers || importedUsers.length === 0) return { assigned: 0, skipped: 0, weekCount: 0 };

  // Gather all unique week Mondays from the imported schedule
  const allDates    = new Set();
  importedUsers.forEach(u => { Object.keys(u.schedule || {}).forEach(d => allDates.add(d)); });
  const dateArr     = [...allDates].filter(d => /^\d{2}\/\d{2}$/.test(d));
  const mondays     = dateArr.filter(d => getWkDay(d) === 'Mon').sort(_naturalSort);

  if (mondays.length === 0) return { assigned: 0, skipped: 0, weekCount: 0 };

  let totalAssigned = 0;

  // Process each shift independently
  const shifts = Object.keys(BREAK_SLOTS);

  mondays.forEach(monday => {
    const weekDates = getWeekRange(monday); // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]

    shifts.forEach(shift => {
      const slots = BREAK_SLOTS[shift];
      if (!slots || slots.length < 2) return;
      const slot1 = slots[0];
      const slot2 = slots[1];

      // Collect all imported users on this shift during this week
      const onShift = importedUsers.filter(u => {
        const tier = _roleTier(u.role || DB.getStaffInfo(u.username)?.role || '');
        if (!tier) return false; // skip leaders/supervisors
        return weekDates.some(d => u.schedule[d] === shift);
      });

      if (onShift.length === 0) return;

      // Split into tiers and process each independently
      const tiers = { agent: [], qa: [], sr_qa: [] };
      onShift.forEach(u => {
        const role = u.role || DB.getStaffInfo(u.username)?.role || '';
        const tier = _roleTier(role);
        if (tier) tiers[tier].push(u);
      });

      Object.entries(tiers).forEach(([tier, members]) => {
        if (members.length === 0) return;

        // Sort members by group name (natural sort)
        members.sort((a, b) => _naturalSort(a.team || '', b.team || ''));

        // Get rotation phase for this shift+tier+week
        const phase = _getRotationPhase(shift, tier, monday);

        // Calculate split: ceil(n/2) for the "first" half
        const total      = members.length;
        const firstCount = Math.ceil(total / 2);

        // Assign slot based on phase
        // phase=0: first half → slot1, second half → slot2
        // phase=1: first half → slot2, second half → slot1
        members.forEach((u, idx) => {
          const inFirstHalf = idx < firstCount;
          const assignedSlot = (phase === 0)
            ? (inFirstHalf ? slot1 : slot2)
            : (inFirstHalf ? slot2 : slot1);

          // Assign for every day this user is on this shift in this week
          weekDates.forEach(d => {
            if (u.schedule[d] !== shift) return; // not on this shift this day
            // Always assign (auto-assign is authoritative for imported weeks)
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

  // Push to cloud
  if (typeof syncWrite === 'function') syncWrite();

  return { assigned: totalAssigned, weekCount: mondays.length };
}

// Reset rotation history for a specific shift+tier (admin utility)
function resetRotation(shift, tier) {
  const rot = _loadRotation();
  const key = `${shift}_${tier}`;
  delete rot[key];
  _saveRotation(rot);
}

// Get current rotation state for display in UI
function getRotationSummary() {
  const rot = _loadRotation();
  return Object.entries(rot).map(([key, val]) => ({
    key,
    shift:    key.split('_')[0],
    tier:     key.split('_').slice(1).join('_'),
    phase:    val.phase,
    lastWeek: val.lastWeek,
  }));
}
