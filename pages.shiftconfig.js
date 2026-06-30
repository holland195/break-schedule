// ═══════════════════════════════════════════════
//  RENDER: SHIFT CONFIG — manage shift times and break slots
//  Access: Leader (level 2+)
// ═══════════════════════════════════════════════
function renderShiftConfig() {
  var todayDk = (function() {
    var n = new Date();
    return n.getDate().toString().padStart(2,'0') + '/' + (n.getMonth()+1).toString().padStart(2,'0');
  })();
  var cfg = getConfigForDate(todayDk);
  var allShifts = Object.keys(cfg.breakSlots).sort();

  var rows = allShifts.map(function(sh) {
    var shiftDef = SHIFTS[sh] || null;
    var times = shiftDef ? shiftDef.start + ' – ' + shiftDef.end : '—';
    var slots = cfg.breakSlots[sh] || [];
    var s1 = slots[0] || '—';
    var s2 = slots[1] || '—';
    return '<tr>' +
      '<td style="padding:10px 16px;font-weight:700;font-family:\"IBM Plex Mono\",monospace;font-size:14px;">' +
        '<span class="sh sh-' + sh + '" style="width:28px;height:28px;font-size:13px;display:inline-flex;align-items:center;justify-content:center;">' + sh + '</span>' +
      '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:var(--text2);">' + times + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;font-family:\"IBM Plex Mono\",monospace;">' +
        '<span class="break-slot assigned slot-1" style="font-size:10px;padding:2px 6px;margin-right:4px;">' + sh + '1</span>' + s1 +
      '</td>' +
      '<td style="padding:10px 12px;font-size:12px;font-family:\"IBM Plex Mono\",monospace;">' +
        '<span class="break-slot assigned slot-2" style="font-size:10px;padding:2px 6px;margin-right:4px;">' + sh + '2</span>' + s2 +
      '</td>' +
      '<td style="padding:10px 12px;text-align:center;">' +
        '<button class="btn btn-sm" onclick="openShiftConfigModal(\'' + sh + '\')" style="font-size:11px;">Edit</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  var history = (state.shiftConfig || []).filter(function(e) { return e.effectiveFrom; }).sort(function(a,b) {
    return _parseDateKey(b.effectiveFrom) - _parseDateKey(a.effectiveFrom);
  });
  var historyHTML = history.length > 0
    ? '<details style="margin-top:24px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text2);">Change History (' + history.length + ')</summary>' +
      '<div style="margin-top:10px;">' +
      history.map(function(e) {
        var changes = Object.entries(e.breakSlots || {}).map(function(kv) {
          return '<span style="font-size:11px;font-family:\"IBM Plex Mono\",monospace;margin-right:8px;">' + kv[0] + '1: ' + (kv[1][0]||'?') + ' / ' + kv[0] + '2: ' + (kv[1][1]||'?') + '</span>';
        }).join('');
        return '<div style="padding:8px 12px;background:var(--bg3);border-radius:6px;margin-bottom:6px;">' +
          '<span style="font-size:11px;font-weight:700;color:var(--accent);margin-right:12px;">Effective ' + e.effectiveFrom + '</span>' + changes +
        '</div>';
      }).join('') +
      '</div></details>'
    : '';

  return '<div class="page-header"><div>' +
    '<div class="page-title">⚙ Shift Configuration</div>' +
    '<div class="page-sub">Manage shift break slot times. Changes apply to new auto-assignments from the effective date onward.</div>' +
  '</div>' +
  '<button class="btn btn-accent" onclick="openShiftConfigModal(null)" style="white-space:nowrap;">+ Add Shift</button></div>' +
  '<div class="card" style="overflow-x:auto;">' +
  '<table style="width:100%;border-collapse:collapse;">' +
  '<thead><tr style="border-bottom:2px solid var(--border);">' +
    '<th style="padding:8px 16px;text-align:left;font-size:11px;color:var(--text3);">Shift</th>' +
    '<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);">Work Hours</th>' +
    '<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);">Slot 1</th>' +
    '<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);">Slot 2</th>' +
    '<th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text3);"></th>' +
  '</tr></thead>' +
  '<tbody>' + rows + '</tbody>' +
  '</table></div>' +
  '<div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.7;">' +
    '<b>Note:</b> Updating slot times here affects auto-assignment from the effective date onward. ' +
    'Historical break records are stored as short codes (A1/A2) and display correctly via the original config. ' +
    'Update <code>BREAK_SLOTS_MAP</code> in <code>scripts/daily_sync.gs</code> to keep Slack posts in sync.' +
  '</div>' +
  historyHTML +
  _shiftConfigModalHTML();
}

function _shiftConfigModalHTML() {
  return '<div id="modal-shiftcfg" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-shiftcfg\')">' +
  '<div class="modal" style="width:460px;">' +
    '<div class="modal-title" id="shiftcfg-title">Edit Shift</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
      '<label style="font-size:12px;">Shift Letter<br>' +
        '<input id="shiftcfg-letter" type="text" maxlength="2" class="login-input" style="margin-top:4px;text-transform:uppercase;" placeholder="A">' +
      '</label>' +
      '<label style="font-size:12px;">Effective From (DD/MM)<br>' +
        '<input id="shiftcfg-from" type="text" class="login-input" style="margin-top:4px;" placeholder="01/07">' +
      '</label>' +
      '<label style="font-size:12px;">Slot 1 (HH:MM–HH:MM)<br>' +
        '<input id="shiftcfg-s1" type="text" class="login-input" style="margin-top:4px;" placeholder="09:30–11:00">' +
      '</label>' +
      '<label style="font-size:12px;">Slot 2 (HH:MM–HH:MM)<br>' +
        '<input id="shiftcfg-s2" type="text" class="login-input" style="margin-top:4px;" placeholder="11:00–12:30">' +
      '</label>' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn" onclick="closeModal(\'modal-shiftcfg\')">Cancel</button>' +
      '<button class="btn btn-accent" onclick="saveShiftConfigEntry()">Save</button>' +
    '</div>' +
  '</div></div>';
}

function openShiftConfigModal(shift) {
  var todayDk = (function() {
    var n = new Date();
    return n.getDate().toString().padStart(2,'0') + '/' + (n.getMonth()+1).toString().padStart(2,'0');
  })();
  document.getElementById('shiftcfg-title').textContent = shift ? 'Edit Shift ' + shift : 'Add New Shift';
  document.getElementById('shiftcfg-letter').value = shift || '';
  document.getElementById('shiftcfg-letter').disabled = !!shift;
  document.getElementById('shiftcfg-from').value = todayDk;
  var slots = shift ? (getConfigForDate(todayDk).breakSlots[shift] || []) : [];
  document.getElementById('shiftcfg-s1').value = slots[0] || '';
  document.getElementById('shiftcfg-s2').value = slots[1] || '';
  document.getElementById('modal-shiftcfg').classList.add('show');
}

function saveShiftConfigEntry() {
  var letter = document.getElementById('shiftcfg-letter').value.trim().toUpperCase();
  var from   = document.getElementById('shiftcfg-from').value.trim();
  var s1     = document.getElementById('shiftcfg-s1').value.trim();
  var s2     = document.getElementById('shiftcfg-s2').value.trim();

  if (!letter || letter.length > 2) { toast('Enter a shift letter (A–Z).', 'err'); return; }
  if (!from || !/^\d{1,2}\/\d{1,2}/.test(from)) { toast('Enter effective date as DD/MM.', 'err'); return; }
  if (!s1 || !s2) { toast('Enter both slot time windows.', 'err'); return; }

  if (!state.shiftConfig) state.shiftConfig = [];

  // Check if existing baseline needs to be created
  if (state.shiftConfig.length === 0) {
    state.shiftConfig.push({ effectiveFrom: null, breakSlots: Object.assign({}, BREAK_SLOTS) });
  }

  // Append new versioned entry
  state.shiftConfig.push({ effectiveFrom: from, breakSlots: { [letter]: [s1, s2] } });
  state._shiftConfigUpdatedAt = Date.now();
  save();
  if (typeof syncWrite === 'function') syncWrite();
  closeModal('modal-shiftcfg');
  toast('Shift config saved. Effective from ' + from + '.', 'ok');
  nav('shiftconfig');
}
