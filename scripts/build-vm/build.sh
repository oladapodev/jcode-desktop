#!/usr/bin/env bash
# Build Jcode Desktop on the GCP build VM and copy the binary back.
#   scripts/build-vm/build.sh            sync, build, fetch binary
#   scripts/build-vm/build.sh check      sync and cargo check only (fast)
#   scripts/build-vm/build.sh shot       build, then render screenshots headlessly on the VM
# Env: VM, PROJECT, ZONE override the defaults below.
set -euo pipefail
VM=${VM:-jcode-build}
PROJECT=${PROJECT:-stay-demos-10151703}
ZONE=${ZONE:-us-central1-a}
MODE=${1:-build}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
G="gcloud compute"
ssh() { $G ssh "$VM" --project "$PROJECT" --zone "$ZONE" --quiet --command "$1"; }

# Wake the spot VM if it was stopped.
state=$($G instances describe "$VM" --project "$PROJECT" --zone "$ZONE" --format='value(status)')
if [ "$state" != "RUNNING" ]; then
  echo "starting $VM ($state)"; $G instances start "$VM" --project "$PROJECT" --zone "$ZONE" --quiet >/dev/null
  sleep 20
fi
IP=$($G instances describe "$VM" --project "$PROJECT" --zone "$ZONE" --format='value(networkInterfaces[0].accessConfigs[0].natIP)')
USER_AT="$(whoami)@$IP"
SSHOPT="-i $HOME/.ssh/google_compute_engine -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$HOME/.ssh/google_compute_known_hosts"

# Sync sources (git-tracked plus untracked, minus build output and node_modules).
# Desktop crates depend on ../jcode/crates/*, so the sibling jcode checkout goes too.
EXCL="--exclude target/ --exclude node_modules/ --exclude dist/ --exclude .git/"
rsync -az --delete -e "ssh $SSHOPT" $EXCL --exclude 'design/*/dist/' "$ROOT/" "$USER_AT:~/jcode-desktop/"
rsync -az --delete -e "ssh $SSHOPT" $EXCL --exclude ios/ --exclude telemetry-worker/ --exclude 'assets/*' --include 'assets/' "$ROOT/../jcode/" "$USER_AT:~/jcode/"

case "$MODE" in
  check) ssh 'source ~/.cargo/env && cd ~/jcode-desktop && cargo check --bin jcode-desktop 2>&1 | tail -40' ;;
  build|shot)
    ssh 'source ~/.cargo/env && cd ~/jcode-desktop && time cargo build --release --bin jcode-desktop 2>&1 | grep -E "^(error|warning: unused)|Finished|Compiling jcode" | tail -30'
    mkdir -p "$ROOT/target/vm"
    rsync -az -e "ssh $SSHOPT" "$USER_AT:~/jcode-desktop/target/release/jcode-desktop" "$ROOT/target/vm/jcode-desktop"
    ls -la "$ROOT/target/vm/jcode-desktop"
    if [ "$MODE" = shot ]; then
      shift || true
      ARGS="${*:---size 1440x900}"
      ssh "cd ~/jcode-desktop && rm -f target/shot.png && python3 scripts/screenshot.py target/shot.png --no-build --binary target/release/jcode-desktop $ARGS 2>&1 | tail -5"
      rsync -az -e "ssh $SSHOPT" "$USER_AT:~/jcode-desktop/target/shot.png" "$ROOT/target/vm/shot.png" && echo "screenshot: $ROOT/target/vm/shot.png"
    fi ;;
esac
