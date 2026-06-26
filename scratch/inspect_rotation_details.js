const fs = require('fs');

// Load data
const dataCode = fs.readFileSync('data.js', 'utf8');
const autoassignCode = fs.readFileSync('autoassign.js', 'utf8');

// Construct mock context
const context = {
  console: {
    log: function(...args) { console.log('[LOG]', ...args); }
  },
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
  toast: function(msg, type) {}
};

const vm = require('vm');
vm.createContext(context);
vm.runInContext(dataCode, context);
vm.runInContext(autoassignCode, context);

// Override _getSlotMap to print details
vm.runInContext(`
  var original_getSlotMap = _getSlotMap;
  _getSlotMap = function(rot, shift, tier, sunday, members, slot1, slot2, slot2Count) {
    if (shift === 'A' && tier === 'agent') {
      console.log('\\n[getSlotMap A/agent] sunday:', sunday);
      console.log('  slot2Count:', slot2Count);
      console.log('  members length:', members.length);
      
      var key = shift + '_' + tier;
      var rotEntryBefore = rot[key] ? JSON.parse(JSON.stringify(rot[key])) : null;
      console.log('  rot entry before:', JSON.stringify(rotEntryBefore));
      
      var res = original_getSlotMap(rot, shift, tier, sunday, members, slot1, slot2, slot2Count);
      
      var rotEntryAfter = rot[key] ? JSON.parse(JSON.stringify(rot[key])) : null;
      console.log('  rot entry after:', JSON.stringify(rotEntryAfter));
      
      // Let's print the assigned slots
      var sortedRes = {};
      Object.keys(res).sort().forEach(function(k) {
        sortedRes[k] = res[k];
      });
      console.log('  assignments:', JSON.stringify(sortedRes));
      return res;
    }
    return original_getSlotMap(rot, shift, tier, sunday, members, slot1, slot2, slot2Count);
  };
`, context);

const stateData = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));
context.state = stateData;

vm.runInContext(`
  state = this.state;
  localStorage.removeItem('bsched_rotation');
  
  var week2Dates = getWeekRange('05/07');
  week2Dates.forEach(function(d) {
    state.users.forEach(function(u) {
      delete state.breaks[u.id + '_' + d];
    });
  });
  
  autoAssignBreaks(state.users);
`, context);
