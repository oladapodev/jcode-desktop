#!/usr/bin/env bash
# One-time setup for the GCP build VM (Ubuntu 24.04). Safe to re-run.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential pkg-config clang lld mold git curl cmake \
  libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev libx11-dev libx11-xcb-dev libxcb1-dev \
  libxcb-randr0-dev libxcb-xkb-dev libxcursor-dev libxi-dev libxrandr-dev libvulkan-dev \
  libfontconfig-dev libfreetype-dev libasound2-dev libssl-dev libdbus-1-dev libzstd-dev \
  libgl1-mesa-dev xvfb mesa-vulkan-drivers poppler-utils fonts-inter >/dev/null
if ! command -v cargo >/dev/null 2>&1; then
  curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal >/dev/null
fi
source "$HOME/.cargo/env"
rustup show active-toolchain
cargo --version
echo SETUP_OK
