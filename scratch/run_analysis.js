const fs = require('fs');
const state = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));

// Find week dates
function getWeekRange(monStr) {
  const [d, m] = monStr.split('/');
  const range = [];
  const start = new Date(2026, parseInt(m) - 1, parseInt(d));
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    range.push(String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0'));
  }
  return range;
}

const w1 = getWeekRange('29/06'); // 29/06 to 05/07
const w2 = getWeekRange('06/07'); // 06/07 to 12/07

console.log('Week 29/06 dates:', w1);
console.log('Week 06/07 dates:', w2);

// Filter users of Shift A
const shiftAUsers = state.users.filter(u => {
  // role check
  const role = (state.staffInfo[u.username] || {}).role || u.role || '';
  const r = role.toLowerCase().trim();
  const isAnalyst = r === 'data analyst' || r === 'sr data analyst' || r === 'agent' || r === 'sr agent';
  if (!isAnalyst) return false;
  
  // check if ever on Shift A in either week
  const sched = state.staffSchedule[u.username] || {};
  return w1.some(d => sched[d] === 'A') || w2.some(d => sched[d] === 'A');
});

console.log(`Total Shift A Analyst Users: ${shiftAUsers.length}`);

// Print their schedule and breaks for both weeks
shiftAUsers.sort((a,b) => (a.username || '').localeCompare(b.username || ''));

console.log('\nUser | Week 29/06 Sched & Breaks | Week 06/07 Sched & Breaks');
console.log('-----------------------------------------------------------');
shiftAUsers.forEach(u => {
  const sched = state.staffSchedule[u.username] || {};
  const username = u.username;
  
  const w1Info = w1.map(d => {
    const sch = sched[d] || '0';
    const br = state.breaks[u.id + '_' + d];
    return `${getWkDay(d)}:${sch}${br ? '(' + br.slot + ')' : ''}`;
  }).join(' ');

  const w2Info = w2.map(d => {
    const sch = sched[d] || '0';
    const br = state.breaks[u.id + '_' + d];
    return `${getWkDay(d)}:${sch}${br ? '(' + br.slot + ')' : ''}`;
  }).join(' ');

  console.log(`${username.padEnd(8)} | W1: ${w1Info} | W2: ${w2Info}`);
});

function getWkDay(ds) {
  const [d, m] = ds.split('/');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(2026, parseInt(m) - 1, parseInt(d)).getDay()];
}
