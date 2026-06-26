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
  toast: function(msg, type) { console.log('[TOAST]', type, msg); }
};

const vm = require('vm');
vm.createContext(context);
vm.runInContext(dataCode, context);
vm.runInContext(autoassignCode, context);

// Seed from backup_state.json
const stateData = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));

// We want to run autoAssignBreaks using the state from backup_state.json
context.state = stateData;

// Also we need to bind state inside the VM
vm.runInContext(`
  state = this.state;
`, context);

console.log('Running autoAssignBreaks in VM...');
vm.runInContext(`
  // Clear any existing rotation
  localStorage.removeItem('bsched_rotation');
  
  // Clean up any breaks for week 06/07 (05/07 Sunday anchor) so they are auto-assigned
  // BUT KEEP week 29/06 (28/06 Sunday anchor) breaks as they are in backup_state.json
  var week1Dates = getWeekRange('28/06'); // Sunday 28/06 to Saturday 04/07
  var week2Dates = getWeekRange('05/07'); // Sunday 05/07 to Saturday 11/07
  
  week2Dates.forEach(function(d) {
    state.users.forEach(function(u) {
      delete state.breaks[u.id + '_' + d];
    });
  });

  // Run autoAssignBreaks
  var result = autoAssignBreaks(state.users);
  console.log('Result:', result);

  // Let's print the breaks for Shift A agents in both weeks
  console.log('\\nUser | Week 1 (29/06) Sched/Breaks | Week 2 (06/07) Sched/Breaks');
  console.log('-----------------------------------------------------------------');
  state.users.forEach(function(u) {
    var role = (state.staffInfo[u.username] || {}).role || u.role || '';
    var r = role.toLowerCase().trim();
    var isAnalyst = r === 'data analyst' || r === 'sr data analyst' || r === 'agent' || r === 'sr agent';
    if (!isAnalyst) return;

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
