#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/.dev/bin"
CH="$ROOT/.dev/clickhouse"

mkdir -p "$BIN" "$CH/data" "$CH/logs"

if [ ! -x "$BIN/nats-server" ]; then
  echo "Downloading NATS server..."
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/nats.zip" "https://github.com/nats-io/nats-server/releases/download/v2.10.24/nats-server-v2.10.24-linux-amd64.zip"
  unzip -q "$tmp/nats.zip" -d "$tmp"
  mv "$tmp/nats-server-v2.10.24-linux-amd64/nats-server" "$BIN/nats-server"
  chmod +x "$BIN/nats-server"
  rm -rf "$tmp"
fi

if [ ! -x "$CH/clickhouse" ]; then
  echo "Downloading ClickHouse..."
  curl -fsSL -o "$CH/clickhouse" "https://builds.clickhouse.com/master/amd64/clickhouse"
  chmod +x "$CH/clickhouse"
fi

if ! curl -sf http://localhost:4222/healthz >/dev/null 2>&1; then
  echo "Starting NATS on :4222..."
  "$BIN/nats-server" -js -m 8222 &
fi

if ! curl -sf http://localhost:8123/ping >/dev/null 2>&1; then
  echo "Starting ClickHouse on :8123..."
  "$CH/clickhouse" server -- --path="$CH/data" --logger.log="$CH/logs/clickhouse-server.log" &
  for _ in $(seq 1 30); do
    curl -sf http://localhost:8123/ping >/dev/null 2>&1 && break
    sleep 1
  done
fi

curl -sf "http://localhost:8123/" --data "CREATE DATABASE IF NOT EXISTS soonwhy" >/dev/null
echo "Dev infrastructure ready (NATS :4222, ClickHouse :8123, db=soonwhy)"
