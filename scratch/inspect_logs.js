const fs = require('fs');

// Load data
const dataCode = fs.readFileSync('data.js', 'utf8');
const autoassignCode = fs.readFileSync('autoassign.js', 'utf8');

// Construct mock context
const context = {
  console: {
    log: function(...args) {
      const line = args.join(' ');
      if (line.includes('skipping') || line.includes('Processing week 28/06') || line.includes('Processing week 05/07')) {
        console.log(line);
      }
    }
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
  toast: function(msg, type) {
    console.log('[TOAST]', type, msg);
  }
};

const vm = require('vm');
vm.createContext(context);
vm.runInContext(dataCode, context);
vm.runInContext(autoassignCode, context);

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
