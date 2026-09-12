#!/usr/bin/env bash
# SessionStart hook. Anything printed to stdout is added to Claude's context
# before the first prompt, so this is an orientation index - NOT an installer.
#
# Deliberately installs nothing: this repo holds many independent projects and
# installing all of them would cost minutes of startup for work that touches one.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$root" || exit 0

echo "sidequests - independent projects in this repo:"

found=0
for dir in */; do
  name="${dir%/}"
  case "$name" in
    .*|node_modules|scripts|dist) continue ;;
  esac
  [ -f "$dir/package.json" ] || continue
  found=1

  desc=$(sed -n 's/^[[:space:]]*"description"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' \
         "$dir/package.json" | head -1)
  [ -n "$desc" ] || desc="(no description)"

  if [ -d "$dir/node_modules" ]; then deps="deps installed"; else deps="NEEDS npm ci"; fi

  printf '  %-16s %s [%s]\n' "$name" "$desc" "$deps"
done

[ "$found" -eq 1 ] || echo "  (none yet)"

cat <<'NOTE'
Work inside exactly one folder unless told otherwise. Read that folder's
CLAUDE.md first, and run npm ci inside the folder before building or testing.
Engine default is Phaser 4 - see .claude/skills/phaser4/ and, when unsure
whether an API is v3-only, .claude/skills/phaser4-migration/.
NOTE
exit 0
