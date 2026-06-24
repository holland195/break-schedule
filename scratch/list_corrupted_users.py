import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\mcuon\OneDrive\Documents\GitHub\break-schedule\scratch\current_users.json", "r", encoding="utf-8") as f:
    current_users = json.load(f)

corrupted = []
valid = []

for u in current_users:
    username = u.get('username', '')
    # Check if username is corrupted
    is_corrupted = False
    if ' ' in username:
        is_corrupted = True
    elif any(c.isupper() for c in username):
        is_corrupted = True
    elif any(ord(c) > 127 for c in username):
        is_corrupted = True
    elif username in ["start", "agent", "qa"]:
        is_corrupted = True
    elif ":" in username:
        is_corrupted = True
        
    if is_corrupted:
        corrupted.append(u)
    else:
        valid.append(u)

print(f"Total users: {len(current_users)}")
print(f"Corrupted users found: {len(corrupted)}")
print(f"Valid users: {len(valid)}")

print("\nCorrupted users:")
for u in corrupted:
    print(f"  username: '{u.get('username')}' | name: '{u.get('name')}' | team: '{u.get('team')}'")
