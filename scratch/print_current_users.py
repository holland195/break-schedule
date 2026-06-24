import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json?auth=W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK'

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode('utf-8')
        wrapper = json.loads(res_data)
        if wrapper and 'data' in wrapper:
            state = json.loads(wrapper['data'])
            users = state.get('users', [])
            print(f"Loaded {len(users)} users from Firebase.")
            # Print unique teams
            teams = set(u.get('team') for u in users if u.get('team'))
            print("Unique teams in Firebase currently:", sorted(list(teams)))
            
            # Save user list to json file for reference
            out_path = r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\current_users.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(users, f, indent=2, ensure_ascii=False)
            print(f"Saved current users to {out_path}")
        else:
            print("No data in Firebase wrapper.")
except Exception as e:
    print("Error:", e)
