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
const BREAK_SPLIT_KEY      = 'bsched_break_split';

// ── Break split storage ──
// Persists per-shift custom split percentages (slot1 %).
// null entry → use default 50/50 rotation for that shift.

function _loadBreakSplit() {
  try { return JSON.parse(localStorage.getItem(BREAK_SPLIT_KEY)) || {}; } catch(e) { return {}; }
}
function _saveBreakSplit(splits) {
  try { localStorage.setItem(BREAK_SPLIT_KEY, JSON.stringify(splits)); } catch(e) {}
}

// Returns the saved slot-1 percentage (0–100) for a shift, or null if using rotation.
function getBreakSplitPct(shift) {
  const splits = _loadBreakSplit();
  const val = splits[shift];
  return (typeof val === 'number') ? val : null;
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
  return (BREAK_SLOTS[shift] || []).some(s => _nd(s) === _nd(slot));
}

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

// _resolvePhase v3: deterministic week-distance approach
// Stores only a baseDate (first Sunday ever seen for this shift+tier).
// Phase = weeksDiff % 2 — fully idempotent regardless of processing order.
// Re-running auto-assign for any week always produces the same phase as the first run,
// so agents reliably alternate slots across weeks.
function _resolvePhase(rot, shift, tier, sunday) {
  const key = `${shift}_${tier}`;
  // Guard against missing entry OR old-format entries ({phase, lastWeek} from v2)
  if (!rot[key] || !rot[key].baseDate) {
    rot[key] = { baseDate: sunday };
  }
  const baseDate  = _mondayToDate(rot[key].baseDate);
  const thisDate  = _mondayToDate(sunday);
  const weeksDiff = Math.round((thisDate - baseDate) / (7 * 24 * 60 * 60 * 1000));
  return ((weeksDiff % 2) + 2) % 2;
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

        const customPct = getBreakSplitPct(shift);
        // Always resolve/update rotation phase — custom % changes group SIZE only,
        // not whether rotation happens. The phase determines which group leads this week.
        const phase = _resolvePhase(rot, shift, tier, sunday);

        // Sort by group name (natural: AT1 < AT9 < AT10)
        members.sort((a, b) => _naturalSort(a.team || '', b.team || ''));

        // ── Option D: check per-member per-day before assigning ──
        // Count how many members in this tier already have ALL their working
        // days assigned this week — used to decide rotation phase recording.
const fullyAssigned = members.filter(u =>
  weekDates.every(d => {
    if (u.schedule[d] !== shift) return true;
    const existing = DB.getBreak(u.id, d);
    return existing && _slotBelongsToShift(existing.slot, shift); // must be correct shift's slot
  })
);
const allAlreadyAssigned = fullyAssigned.length === members.length;

        // When custom % is set: fixed split, no rotation.
        // When null: use 50/50 with calendar-aware rotation.
        const firstCount = customPct !== null
          ? Math.round(members.length * customPct / 100)
          : Math.ceil(members.length / 2);

        // If all members are already fully assigned this week, skip writing
        // but keep the resolved phase (recorded above) for rotation continuity.
        if (allAlreadyAssigned) {
          console.log(`[autoassign] ${shift}/${tier}/${sunday}: all assigned, skipping (phase=${phase}${customPct !== null ? ` custom ${customPct}%` : ' 50/50'})`);
          return;
        }

        members.forEach((u, idx) => {
          const inFirst      = idx < firstCount;
          // Custom %: first group always → slot1 (no phase flip).
          // Rotation: phase determines which group gets slot1 this week.
          // Rotation always active: phase decides which group leads this week.
          // Custom % only affects group size, not the alternation.
          const assignedSlot = phase === 0
            ? (inFirst ? slot1 : slot2)
            : (inFirst ? slot2 : slot1);

          weekDates.forEach(d => {
  if (u.schedule[d] !== shift) return; // off or different shift

            const existing = DB.getBreak(u.id, d);
if (existing && _slotBelongsToShift(existing.slot, shift)) {
  console.log(`[autoassign] Skip ${u.username} on ${d} — already has ${existing.slot}`);
  return; // only skip if existing slot actually belongs to this shift
}
// wrong-shift slot → overwrite it with correct assignment

            DB.setBreak(u.id, d, {
              slot: (assignedSlot || '').replace(/[\u2012\u2013\u2014\u002D]/g, '\u2013'),
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
