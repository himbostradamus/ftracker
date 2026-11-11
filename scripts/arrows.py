#!/usr/bin/env python3
"""Set (or replace) the `arrows` field of pose entries.
Reads lines of `id: [ {arrow}, ... ]` from stdin."""
import re, sys
p = 'src/mobility/data/poses.ts'
s = open(p).read()
for line in sys.stdin.read().strip().splitlines():
    line = line.strip()
    if not line or line.startswith('#'): continue
    k, v = line.split(':', 1)
    k = k.strip()
    pat = re.compile(r"(  '" + re.escape(k) + r"': \{.*?)(, arrows: \[.*\])? \},\n")
    if not pat.search(s): sys.exit(f'unknown pose {k}')
    s = pat.sub(lambda m: f"{m.group(1)}, arrows: {v.strip()} }},\n", s, count=1)
open(p, 'w').write(s)
