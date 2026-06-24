import json
import urllib.request
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

url = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json?auth=W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK'

def is_corrupted_username(username):
    if not username:
        return True
    username = str(username).strip()
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

try:
    print("Fetching live data...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        wrapper = json.loads(response.read().decode('utf-8'))
        state = json.loads(wrapper['data'])

    sched = state.get('staffSchedule', {})
    print(f"Current staffSchedule keys count: {len(sched)}")
    corrupted_before = [k for k in sched.keys() if is_corrupted_username(k)]
    print(f"Corrupted keys before: {len(corrupted_before)}")
    
    # Perform clean
    cleaned_sched = {k: v for k, v in sched.items() if not is_corrupted_username(k)}
    state['staffSchedule'] = cleaned_sched
    print(f"Cleaned staffSchedule keys count: {len(state['staffSchedule'])}")
    
    # Upload
    print("Uploading cleaned state...")
    now_ms = int(time.time() * 1000)
    state['_usersUpdatedAt'] = now_ms
    state['_updated'] = now_ms
    payload = {"data": json.dumps(state, ensure_ascii=False)}
    payload_json = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    
    put_req = urllib.request.Request(
        url,
        data=payload_json,
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
        method='PUT'
    )
    with urllib.request.urlopen(put_req) as put_res:
        print("Upload status:", put_res.status)
        
    # Re-fetch and check
    print("Re-fetching to verify...")
    with urllib.request.urlopen(req) as response:
        wrapper2 = json.loads(response.read().decode('utf-8'))
        state2 = json.loads(wrapper2['data'])
    sched2 = state2.get('staffSchedule', {})
    print(f"Re-fetched staffSchedule keys count: {len(sched2)}")
    corrupted_after = [k for k in sched2.keys() if is_corrupted_username(k)]
    print(f"Corrupted keys after: {len(corrupted_after)}")
    
except Exception as e:
    print("Error:", e)
