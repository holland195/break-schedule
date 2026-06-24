import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("scratch/current_users.json", "r", encoding="utf-8") as f:
    users = json.load(f)

print(f"Loaded {len(users)} users.")

search_terms = ['cường', 'cuong', 'L1', 'DAL1']
for u in users:
    matches = False
    for field in ['username', 'name', 'team', 'role']:
        val = str(u.get(field, '')).lower()
        if any(term.lower() in val for term in search_terms):
            matches = True
            break
    if matches:
        print(f"ID: {u.get('id')} | Username: {u.get('username')} | Name: {u.get('name')} | Team: {u.get('team')} | Role: {u.get('role')}")
