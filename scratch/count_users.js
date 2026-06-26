const fs = require('fs');
const state = JSON.parse(fs.readFileSync('scratch/backup_state.json', 'utf8'));

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

const w1 = getWeekRange('29/06');
const w2 = getWeekRange('06/07');

function _roleTier(role) {
  if (!role) return null;
  const r = role.toLowerCase().trim();
  if (r === 'data analyst' || r === 'sr data analyst' || r === 'agent' || r === 'sr agent') return 'agent';
  if (r === 'data supervisor' || r === 'qa') return 'qa';
  if (r === 'sr data supervisor' || r === 'sr qa') return 'sr_qa';
  return null;
}

function _getSched(username, dk) {
  var sc = state.staffSchedule[username] || {};
  var v = sc[dk];
  if (v) return v;
  return '0';
}

[w1, w2].forEach((week, idx) => {
  const sunday = week[0]; // Wait, getWeekRange returns Mon-Sun. So sunday is the last element or we get Sunday using the first element minus 1 day.
  // Wait, in our getWeekRange implementation:
  // start is the Monday. So range has Mon, Tue, Wed, Thu, Fri, Sat, Sun.
  // So the 7th element (index 6) is Sunday!
  // Wait, let's see. For 29/06 (Monday), the dates returned are:
  // 29/06 (Mon), 30/06 (Tue), 01/07 (Wed), 02/07 (Thu), 03/07 (Fri), 04/07 (Sat), 05/07 (Sun).
  // So Sunday is indeed 05/07.
  console.log(`\n--- Week ${idx + 1} (${week[0]}) ---`);
  
  // Who is on Shift A, tier agent in this week?
  const onShift = state.users.filter(u => {
    const role = (state.staffInfo[u.username] || {}).role || u.role || '';
    if (_roleTier(role) !== 'agent') return false;
    return week.some(d => _getSched(u.username, d) === 'A');
  });
  
  console.log(`On Shift A, Agent: ${onShift.length} users`);
  onShift.forEach(u => {
    console.log(`  - ${u.username}`);
  });
});
