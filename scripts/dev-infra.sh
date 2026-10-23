#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/.dev/bin"
mkdir -p "$BIN"

if [ ! -x "$BIN/nats-server" ]; then
  echo "Downloading NATS server..."
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/nats.zip" "https://github.com/nats-io/nats-server/releases/download/v2.10.24/nats-server-v2.10.24-linux-amd64.zip"
  unzip -q "$tmp/nats.zip" -d "$tmp"
  mv "$tmp/nats-server-v2.10.24-linux-amd64/nats-server" "$BIN/nats-server"
  chmod +x "$BIN/nats-server"
  rm -rf "$tmp"
fi

if ! curl -sf http://localhost:4222/healthz >/dev/null 2>&1; then
  echo "Starting NATS on :4222..."
  "$BIN/nats-server" -js -m 8222 &
fi

echo "Dev infrastructure ready (NATS :4222)"
