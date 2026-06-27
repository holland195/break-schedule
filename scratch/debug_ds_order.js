const fs = require('fs');

const dataCode = fs.readFileSync('data.js', 'utf8');
const autoassignCode = fs.readFileSync('autoassign.js', 'utf8');

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

let modifiedAutoassignCode = autoassignCode.replace(
  `if (sundays.length === 0) return { assigned: 0, weekCount: 0 };`,
  `var baselineSunday = '28/06';
  sundays = sundays.filter(function(sunday) {
    return _mondayToDate(sunday) >= _mondayToDate(baselineSunday);
  });
  if (sundays.length === 0) return { assigned: 0, weekCount: 0 };`
);

vm.runInContext(modifiedAutoassignCode, context);

// Override _getSlotMap to log the calculations for qa tier
vm.runInContext(`
  var original_getSlotMap = _getSlotMap;
  _getSlotMap = function(rot, shift, tier, sunday, members, slot1, slot2, slot2Count) {
    var res = original_getSlotMap(rot, shift, tier, sunday, members, slot1, slot2, slot2Count);
    if (shift === 'A' && tier === 'qa') {
      var key = shift + '_' + tier;
      console.log('\\n--- [getSlotMap] Shift:', shift, 'Tier:', tier, 'Sunday:', sunday, '---');
      console.log('  slot2Count:', slot2Count);
      console.log('  N:', rot[key].members.length);
      console.log('  members list in order:');
      rot[key].members.forEach(function(m, i) {
        var isWorkingThisWeek = members.some(function(u) { return (u.username || u.id) === m; });
        var assignedSlot = res[m];
        console.log('    [' + i + '] ' + m + ' | working:' + isWorkingThisWeek + ' | assigned:' + assignedSlot);
      });
    }
    return res;
  };
`, context);

const stateData = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));
// Set split to 67% for qa tier
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
`, context);
