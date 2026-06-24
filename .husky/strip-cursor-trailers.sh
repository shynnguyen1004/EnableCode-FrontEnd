#!/usr/bin/env sh

MSG_FILE="$1"
[ -f "$MSG_FILE" ] || exit 0

tmp_file="$(mktemp)"
grep -viE '^[[:space:]]*Co-authored-by:[[:space:]]*Cursor([[:space:]]*<|$)' "$MSG_FILE" \
  | grep -viE '^[[:space:]]*Co-authored-by:.*cursoragent@cursor\.com' >"$tmp_file"
mv "$tmp_file" "$MSG_FILE"
