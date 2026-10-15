#!/usr/bin/env bash
# Build Jcode Desktop on the GCP build VM and copy results back.
#   scripts/build-vm/build.sh                 sync, release build, fetch binary
#   scripts/build-vm/build.sh check           sync and cargo check only (fast)
#   scripts/build-vm/build.sh test [FILTER]   sync and run jcode-desktop-ui lib tests (optionally filtered)
#   scripts/build-vm/build.sh shot NAME [ARGS...]
#                                             release build, render target/vm/shots/NAME.png with screenshot.py ARGS
#   scripts/build-vm/build.sh run 'CMD'       sync, then run CMD in ~/jcode-desktop on the VM
# Several agents may use this at once: cargo serialises on its own lock, and
# every screenshot gets its own NAME, so outputs never collide.
# Env: VM, PROJECT, ZONE override the defaults below. NOSYNC=1 skips rsync.
set -euo pipefail
VM=${VM:-jcode-build}
PROJECT=${PROJECT:-stay-demos-10151703}
ZONE=${ZONE:-us-central1-a}
MODE=${1:-build}
shift || true
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
G="gcloud compute"

# Wake the spot VM if it was stopped (spot VMs can also be preempted).
state=$($G instances describe "$VM" --project "$PROJECT" --zone "$ZONE" --format='value(status)')
if [ "$state" != "RUNNING" ]; then
  echo "starting $VM ($state)"; $G instances start "$VM" --project "$PROJECT" --zone "$ZONE" --quiet >/dev/null || true
  sleep 25
fi
IP=$($G instances describe "$VM" --project "$PROJECT" --zone "$ZONE" --format='value(networkInterfaces[0].accessConfigs[0].natIP)')
USER_AT="$(whoami)@$IP"
SSHOPT="-i $HOME/.ssh/google_compute_engine -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$HOME/.ssh/google_compute_known_hosts -o ConnectTimeout=20"
ssh() { command ssh $SSHOPT "$USER_AT" "$1"; }

# Sync sources (git-tracked plus untracked, minus build output and node_modules).
# Desktop crates depend on ../jcode/crates/*, so the sibling jcode checkout goes too.
if [ -z "${NOSYNC:-}" ]; then
  EXCL="--exclude target/ --exclude node_modules/ --exclude dist/ --exclude .git/"
  rsync -az --delete -e "ssh $SSHOPT" $EXCL --exclude 'design/*/dist/' "$ROOT/" "$USER_AT:~/jcode-desktop/"
  rsync -az --delete -e "ssh $SSHOPT" $EXCL --exclude ios/ --exclude telemetry-worker/ --exclude 'assets/*' --include 'assets/' "$ROOT/../jcode/" "$USER_AT:~/jcode/"
fi

release() {
  ssh 'source ~/.cargo/env && cd ~/jcode-desktop && cargo build --release --bin jcode-desktop 2>&1 | grep -E "^error|^warning: unused|Finished" -A6 | tail -40'
}

case "$MODE" in
  check) ssh 'source ~/.cargo/env && cd ~/jcode-desktop && cargo check --bin jcode-desktop 2>&1 | grep -E "^error" -A12 | head -80; echo check-done' ;;
  test)
    FILTER="${1:-}"
    ssh "source ~/.cargo/env && cd ~/jcode-desktop && timeout 1700 cargo test -p jcode-desktop-ui --lib $FILTER 2>&1 | grep -E 'panicked|test result|^error' -A4 | head -80" ;;
  build)
    release
    mkdir -p "$ROOT/target/vm"
    rsync -az -e "ssh $SSHOPT" "$USER_AT:~/jcode-desktop/target/release/jcode-desktop" "$ROOT/target/vm/jcode-desktop" ;;
  shot)
    NAME="${1:?shot needs a NAME}"; shift || true
    ARGS="${*:---size 1440x900}"
    release
    ssh "cd ~/jcode-desktop && mkdir -p target/shots && rm -f target/shots/$NAME.png && timeout 300 python3 scripts/screenshot.py target/shots/$NAME.png --no-build --binary target/release/jcode-desktop $ARGS 2>&1 | grep -vE '^(navigation|coach|layout)=' | tail -5"
    mkdir -p "$ROOT/target/vm/shots"
    rsync -az -e "ssh $SSHOPT" "$USER_AT:~/jcode-desktop/target/shots/$NAME.png" "$ROOT/target/vm/shots/$NAME.png" && echo "screenshot: $ROOT/target/vm/shots/$NAME.png" ;;
  run) ssh "source ~/.cargo/env && cd ~/jcode-desktop && $1" ;;
  *) echo "unknown mode $MODE"; exit 2 ;;
esac
