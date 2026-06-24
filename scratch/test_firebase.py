import urllib.request
import json

url = 'https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app/bsched.json?auth=W0kg0YX5okfaQzWLFBiZwrY69WeK1YJufBQySZsK'

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode('utf-8')
        wrapper = json.loads(res_data)
        if wrapper and 'data' in wrapper:
            state = json.loads(wrapper['data'])
            print("Successfully loaded Firebase state.")
            print("Keys:", list(state.keys()))
            if 'users' in state:
                print("Num users:", len(state['users']))
                if len(state['users']) > 0:
                    print("Sample user:", state['users'][0])
            if 'staffInfo' in state:
                print("Num staffInfo entries:", len(state['staffInfo']))
                # print some usernames
                print("Sample usernames:", list(state['staffInfo'].keys())[:5])
        else:
            print("Wrapper doesn't contain 'data' key.")
except Exception as e:
    print("Error fetching from Firebase:", e)
