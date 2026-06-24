import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json?auth=W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK'

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

try:
    # 1. Fetch current data
    print("Fetching current data from Firebase...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode('utf-8')
        wrapper = json.loads(res_data)
        
    if not wrapper or 'data' not in wrapper:
        print("Error: Invalid Firebase data format.")
        sys.exit(1)
        
    state = json.loads(wrapper['data'])
    print("Firebase state successfully loaded.")
    
    # 2. Load correct Jul_26 records to get the new team mappings
    with open(r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\extracted_jul_26_correct.json", "r", encoding="utf-8") as f:
        jul_records = json.load(f)
    
    new_team_map = {r['username'].lower().strip(): r['team'] for r in jul_records}
    
    # 3. Clean and update users list
    original_users = state.get('users', [])
    cleaned_users = []
    removed_users_count = 0
    updated_users_count = 0
    
    for u in original_users:
        un = u.get('username', '')
        if is_corrupted_username(un):
            removed_users_count += 1
            continue
            
        un_lower = un.lower().strip()
        if un_lower in new_team_map:
            old_team = u.get('team', '')
            new_team = new_team_map[un_lower]
            if old_team != new_team:
                u['team'] = new_team
                updated_users_count += 1
                
        cleaned_users.append(u)
        
    state['users'] = cleaned_users
    state['_usersUpdatedAt'] = int(sys.float_info.max) # Force remote update to win in web app load
    # Actually let's just use current time but make it slightly newer
    import time
    state['_usersUpdatedAt'] = int(time.time() * 1000)
    
    print(f"Users cleanup:")
    print(f"  Removed corrupted users: {removed_users_count}")
    print(f"  Updated user teams: {updated_users_count}")
    print(f"  Remaining valid users: {len(cleaned_users)}")
    
    # 4. Clean staffInfo object
    original_staff = state.get('staffInfo', {})
    cleaned_staff = {}
    removed_staff_count = 0
    
    for uname, info in original_staff.items():
        if is_corrupted_username(uname):
            removed_staff_count += 1
            continue
        cleaned_staff[uname] = info
        
    state['staffInfo'] = cleaned_staff
    print(f"StaffInfo cleanup:")
    print(f"  Removed corrupted staffInfo entries: {removed_staff_count}")
    print(f"  Remaining valid staffInfo entries: {len(cleaned_staff)}")
    
    # 5. Push updated state back to Firebase
    print("Uploading updated state to Firebase...")
    state['_updated'] = int(time.time() * 1000)
    new_payload = {"data": json.dumps(state, ensure_ascii=False)}
    new_payload_json = json.dumps(new_payload, ensure_ascii=False).encode('utf-8')
    
    put_req = urllib.request.Request(
        url,
        data=new_payload_json,
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
        method='PUT'
    )
    
    with urllib.request.urlopen(put_req) as put_res:
        print("Firebase upload complete. Response code:", put_res.status)
        
except Exception as e:
    print("Error during database update:", e)
    sys.exit(1)
