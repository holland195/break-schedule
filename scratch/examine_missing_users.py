import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\current_users.json", "r", encoding="utf-8") as f:
    current_users = json.load(f)

with open(r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\extracted_jul_26_correct.json", "r", encoding="utf-8") as f:
    jul_users = json.load(f)

jul_usernames = set(u['username'] for u in jul_users)
missing = [u for u in current_users if u.get('username', '').lower().strip() not in jul_usernames]

print(f"Total missing: {len(missing)}")

# Group by role and team
roles = {}
teams = {}
for u in missing:
    r = u.get('role', 'none')
    t = u.get('team', 'none')
    roles[r] = roles.get(r, 0) + 1
    teams[t] = teams.get(t, 0) + 1

print("\nMissing users grouped by Role:")
for r, count in sorted(roles.items(), key=lambda x: x[1], reverse=True):
    print(f"  {r}: {count}")

print("\nMissing users grouped by Team:")
for t, count in sorted(teams.items(), key=lambda x: x[1], reverse=True):
    print(f"  {t}: {count}")

print("\nSample missing users (first 15):")
for u in missing[:15]:
    print(f"  {u.get('username')} | {u.get('name')} | Team: {u.get('team')} | Role: {u.get('role')}")
