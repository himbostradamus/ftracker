#!/usr/bin/env python3
"""Replace pose entries in src/mobility/data/poses.ts.
Reads lines of `id: { ...pose... }` from stdin."""
import re, sys
p = 'src/mobility/data/poses.ts'
s = open(p).read()
for line in sys.stdin.read().strip().splitlines():
    line = line.strip()
    if not line or line.startswith('#'): continue
    k, v = line.split(':', 1)
    k = k.strip().strip("'")
    pat = re.compile(r"  '" + re.escape(k) + r"': \{.*\},\n")
    if not pat.search(s): sys.exit(f'unknown pose {k}')
    s = pat.sub(lambda m: f"  '{k}': {v.strip().rstrip(',')},\n", s, count=1)
open(p, 'w').write(s)
