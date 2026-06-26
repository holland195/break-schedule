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

// Read and modify autoassignCode to filter sundays in the VM
let modifiedAutoassignCode = autoassignCode.replace(
  `if (sundays.length === 0) return { assigned: 0, weekCount: 0 };`,
  `var baselineSunday = '28/06';
  sundays = sundays.filter(function(sunday) {
    return _mondayToDate(sunday) >= _mondayToDate(baselineSunday);
  });
  if (sundays.length === 0) return { assigned: 0, weekCount: 0 };`
);

vm.runInContext(modifiedAutoassignCode, context);

const stateData = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));
// Set split to 50% for Shift A agent
stateData.breakSplits = {
  A: { agent: 50, qa: 67, sr_qa: 50 }
};
context.state = stateData;

vm.runInContext(`
  state = this.state;
  localStorage.removeItem('bsched_rotation');
  
  var week1Dates = getWeekRange('28/06'); // Sunday 28/06 to Saturday 04/07
  var week2Dates = getWeekRange('05/07'); // Sunday 05/07 to Saturday 11/07
  
  // Clean up week 2 breaks
  week2Dates.forEach(function(d) {
    state.users.forEach(function(u) {
      delete state.breaks[u.id + '_' + d];
    });
  });

  // Run modified autoAssignBreaks
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
