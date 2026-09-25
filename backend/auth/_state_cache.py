import time
_used = {}
def check_state(s):
    now = time.time()
    [_used.pop(k) for k in list(_used) if now-_used[k]>300]
    if s in _used: return False
    _used[s] = now
    return True
