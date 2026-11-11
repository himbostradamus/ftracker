#!/bin/sh
# Render a contact sheet of the given pose ids (comma separated) to a PNG.
# Usage: scripts/view.sh <ids> <out.png> [size] [rows]
size=${3:-230}; rows=${4:-2}
SHEET_OUT=/tmp/ftracker-sheet.html npx vite-node scripts/sheet.tsx "$1" "$size" >/dev/null && google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --screenshot="$2" --window-size=$(( (size + 6) * 8 + 12 )),$(( (size + 22) * rows + 12 )) file:///tmp/ftracker-sheet.html >/dev/null 2>&1
