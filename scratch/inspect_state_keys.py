import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Helper to check if a username is corrupted
def is_corrupted_username(username):
    if not username:
        return True
    if ' ' in username:
        return True
    if any(c.isupper() for c in username):
        return True
    if any(ord(c) > 127 for c in username):
        return True
    if username in ["start", "agent", "qa"]:
        return True
    if ":" in username:
        return True
    return False

with open("scratch/current_users.json", "r", encoding="utf-8") as f:
    # This was just the users list. We want to inspect the whole state.
    # Let's fetch the state from the downloaded JSON if we have one, or fetch it from Firebase.
    pass

import urllib.request
url = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json?auth=W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK'

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        wrapper = json.loads(response.read().decode('utf-8'))
        state = json.loads(wrapper['data'])
    
    print("Firebase keys:", list(state.keys()))
    
    # Check staffSchedule
    sched_keys = list(state.get('staffSchedule', {}).keys())
    corrupted_sched = [k for k in sched_keys if is_corrupted_username(k)]
    print(f"staffSchedule keys: {len(sched_keys)} | Corrupted: {len(corrupted_sched)}")
    if corrupted_sched:
        print("Corrupted schedule keys (first 5):", corrupted_sched[:5])
        
    # Check monthlyAttendance
    att_keys = list(state.get('monthlyAttendance', {}).keys())
    corrupted_att = [k for k in att_keys if is_corrupted_username(k)]
    print(f"monthlyAttendance keys: {len(att_keys)} | Corrupted: {len(corrupted_att)}")
    if corrupted_att:
        print("Corrupted attendance keys (first 5):", corrupted_att[:5])
        
    # Check logbook
    # Logbook keys are in the format "uid_dateKey"
    # Let's check if the uid belongs to any corrupted user.
    # We can match uid to users.
    users = state.get('users', [])
    uid_to_username = {u.get('id'): u.get('username') for u in users if u.get('id') is not None}
    
    logbook_keys = list(state.get('logbook', {}).keys())
    corrupted_logbook_cnt = 0
    for k in logbook_keys:
        parts = k.split('_')
        if len(parts) >= 2:
            try:
                uid = int(parts[0])
                uname = uid_to_username.get(uid)
                if uname and is_corrupted_username(uname):
                    corrupted_logbook_cnt += 1
            except ValueError:
                pass
    print(f"logbook keys: {len(logbook_keys)} | Corrupted (based on UID): {corrupted_logbook_cnt}")

except Exception as e:
    print("Error:", e)
