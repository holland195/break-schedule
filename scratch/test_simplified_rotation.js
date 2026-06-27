const fs = require('fs');

const dataCode = fs.readFileSync('data.js', 'utf8');

const context = {
  console: { log: function(...args) { console.log('[LOG]', ...args); } },
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); },
    removeItem(key) { delete this.store[key]; }
  },
  document: {
    documentElement: { setAttribute() {} },
    getElementById() { return { innerHTML: '', style: {}, classList: { add() {}, remove() {} }, options: [] }; },
    querySelectorAll() { return []; }
  },
  Date: Date,
  Math: Math,
  Set: Set,
  Map: Map,
  Object: Object,
  Array: Array,
  String: String,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  toast: function() {}
};

const vm = require('vm');
vm.createContext(context);
vm.runInContext(dataCode, context);

// Define the simplified _getSlotMap function
const simplifiedGetSlotMap = `
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

  // Add any new members to knownList/knownSet immediately
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
`;

// Load autoassign.js code but replace _getSlotMap and add sunday filtering
const autoassignCode = fs.readFileSync('autoassign.js', 'utf8');
let modifiedAutoassignCode = autoassignCode.replace(
  `if (sundays.length === 0) return { assigned: 0, weekCount: 0 };`,
  `var baselineSunday = '28/06';
  sundays = sundays.filter(function(sunday) {
    return _mondayToDate(sunday) >= _mondayToDate(baselineSunday);
  });
  if (sundays.length === 0) return { assigned: 0, weekCount: 0 };`
);

// We replace the _getSlotMap function in the code
const slotMapRegex = /function _getSlotMap[\s\S]*?return result;\s*\}/;
modifiedAutoassignCode = modifiedAutoassignCode.replace(slotMapRegex, simplifiedGetSlotMap);

vm.runInContext(modifiedAutoassignCode, context);

const stateData = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));
stateData.breakSplits = {
  A: { agent: 50, qa: 67, sr_qa: 50 }
};
context.state = stateData;

vm.runInContext(`
  state = this.state;
  localStorage.removeItem('bsched_rotation');
  
  var week1Dates = getWeekRange('28/06');
  var week2Dates = getWeekRange('05/07');
  
  // Clean up week 2 breaks
  week2Dates.forEach(function(d) {
    state.users.forEach(function(u) {
      delete state.breaks[u.id + '_' + d];
    });
  });

  autoAssignBreaks(state.users);

  // Print the results for Shift A qa (DS)
  console.log('\\nUser | Week 1 (29/06) Sched/Breaks | Week 2 (06/07) Sched/Breaks');
  console.log('-----------------------------------------------------------------');
  state.users.forEach(function(u) {
    var role = (state.staffInfo[u.username] || {}).role || u.role || '';
    var r = role.toLowerCase().trim();
    var isDS = r === 'data supervisor' || r === 'qa';
    if (!isDS) return;

    var sched = state.staffSchedule[u.username] || {};
    var onShiftA = week1Dates.some(function(d) { return sched[d] === 'A'; }) || week2Dates.some(function(d) { return sched[d] === 'A'; });
    if (!onShiftA) return;

    var bInfo1 = week1Dates.map(function(d) {
      var br = state.breaks[u.id + '_' + d];
      var sch = sched[d] || '0';
      return getWkDay(d) + ':' + sch + (br ? '(' + br.slot + ')' : '');
    }).join(' ');

    var bInfo2 = week2Dates.map(function(d) {
      var br = state.breaks[u.id + '_' + d];
      var sch = sched[d] || '0';
      return getWkDay(d) + ':' + sch + (br ? '(' + br.slot + ')' : '');
    }).join(' ');

    console.log(u.username.padEnd(18) + ' | W1: ' + bInfo1 + ' | W2: ' + bInfo2);
  });
`, context);
