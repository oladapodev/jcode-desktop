#!/usr/bin/env bash
# Cut every prototype reference screen and the matching native screenshot into
# named component tiles (REFERENCE left, NATIVE right) under design/compare/all/.
#   scripts/compare_all.sh            uses existing native shots in target/vm/shots/cmp-*.png
#   SHOOT=1 scripts/compare_all.sh    first renders fresh native shots on the build VM
set -euo pipefail
cd "$(dirname "$0")/.."
REF=design/reference
OUT=design/compare/all
SHOTS=target/vm/shots
mkdir -p "$OUT"

# view | reference | native screenshot.py args
VIEWS=(
  "chat|chat-done|--transcript all"
  "chat-light|chat-paper|--transcript all --theme studio-light"
  "tools|chat-live|--transcript orb-tools"
  "home|home|--transcript empty"
  "agents|agents|--panels 3 --swarm"
  "agents-light|agents-paper|--panels 3 --swarm --theme studio-light"
  "code|code|--panels 2 --transcript diff-rich"
  "code-light|code-paper|--panels 2 --transcript diff-rich --theme studio-light"
  "review|review|--transcript diff-rich"
  "settings|settings-appearance|--accounts"
)

# Named component regions on the 1440x900 layout shared by both apps.
REGIONS=(
  "brand:0,0,272,52"
  "new-session:0,48,272,48"
  "nav:0,92,272,140"
  "projects:0,236,272,320"
  "machine:0,780,272,64"
  "account:0,840,272,60"
  "header-left:272,0,420,52"
  "header-center:692,0,420,52"
  "header-right:1100,0,340,52"
  "chat-top:280,52,800,230"
  "chat-mid:280,282,800,230"
  "chat-low:280,512,800,230"
  "composer:300,740,780,160"
  "right-top:1070,52,370,280"
  "right-low:1070,332,370,400"
)

if [ -n "${SHOOT:-}" ]; then
  first=1
  for v in "${VIEWS[@]}"; do
    IFS='|' read -r name ref args <<< "$v"
    if [ $first = 1 ]; then
      scripts/build-vm/build.sh shot "cmp-$name" --size 1440x900 $args | tail -1; first=0
    else
      NOSYNC=1 scripts/build-vm/build.sh shot "cmp-$name" --size 1440x900 $args | tail -1
    fi
  done
fi

for v in "${VIEWS[@]}"; do
  IFS='|' read -r name ref args <<< "$v"
  [ -f "$SHOTS/cmp-$name.png" ] || { echo "missing $SHOTS/cmp-$name.png"; continue; }
  regs=()
  for r in "${REGIONS[@]}"; do regs+=(--region "$r"); done
  python3 scripts/compare_tiles.py "$REF/$ref.png" "$SHOTS/cmp-$name.png" "$OUT/$name" "${regs[@]}" > /dev/null
  echo "$OUT/$name: ${#REGIONS[@]} tiles"
done
