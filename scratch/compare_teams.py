import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Load current Firebase users
with open(r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\current_users.json", "r", encoding="utf-8") as f:
    current_users = json.load(f)

# Load extracted Jul_26 users
with open(r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\extracted_jul_26.json", "r", encoding="utf-8") as f:
    jul_users = json.load(f)

# Create lookup maps by username
current_map = {u['username'].lower().strip(): u for u in current_users if 'username' in u}
jul_map = {u['username'].lower().strip(): u for u in jul_users if u.get('username')}

# Compare
differences = []
added = []
removed = []

for username, jul_u in jul_map.items():
    if username in current_map:
        curr_u = current_map[username]
        curr_team = curr_u.get('team', '')
        jul_team = jul_u.get('team', '')
        if curr_team != jul_team:
            differences.append({
                "username": username,
                "name": curr_u.get('name', ''),
                "curr_team": curr_team,
                "new_team": jul_team
            })
    else:
        added.append(jul_u)

for username, curr_u in current_map.items():
    if username not in jul_map:
        removed.append(curr_u)

print(f"Total users in Firebase: {len(current_users)}")
print(f"Total users in Jul_26: {len(jul_users)}")
print(f"Differences in team assignment: {len(differences)}")
print(f"New users to add: {len(added)}")
print(f"Users in Firebase but not in Jul_26: {len(removed)}")

if differences:
    print("\n--- Team Assignment Changes (sample first 10) ---")
    for diff in differences[:10]:
        print(f"User: {diff['username']} ({diff['name']}) | Team: {diff['curr_team']} -> {diff['new_team']}")

if added:
    print("\n--- New Users to Add (first 10) ---")
    for add in added[:10]:
        print(f"User: {add['username']} ({add['name']}) | Team: {add['team']} | Role: {add['role']}")

if removed:
    print("\n--- Users in Firebase but not in Jul_26 (first 10) ---")
    for rem in removed[:10]:
        print(f"User: {rem['username']} ({rem['name']}) | Team: {rem.get('team', '')} | Role: {rem.get('role', '')}")
