#!/usr/bin/env bash
# Start the J‑Link GDB server using parameters from project.yaml.
set -euo pipefail

LOG_DIR="$(dirname "$0")/../artifacts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/jlink_gdb_server.log"

exec > >(tee -a "$LOG_FILE") 2>&1

CONFIG_FILE="$(dirname "$0")/../config/project.yaml"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Configuration file $CONFIG_FILE not found" >&2
  exit 1
fi

read_config() {
  grep "^$1:" "$CONFIG_FILE" | awk '{print $2}'
}

JLINK_GDB_SERVER_PATH=$(read_config JLINK_GDB_SERVER_PATH)
JLINK_DEVICE=$(read_config JLINK_DEVICE)
JLINK_INTERFACE=$(read_config JLINK_INTERFACE)
JLINK_SPEED_KHZ=$(read_config JLINK_SPEED_KHZ)

if [[ ! -x "$JLINK_GDB_SERVER_PATH" ]]; then
  echo "J‑Link GDB server not found or not executable: $JLINK_GDB_SERVER_PATH" >&2
  exit 1
fi

PORT=2331

echo "Starting J‑Link GDB server..."
"$JLINK_GDB_SERVER_PATH" -device "$JLINK_DEVICE" -if "$JLINK_INTERFACE" -speed "$JLINK_SPEED_KHZ" -port "$PORT" -silent &
JLINK_PID=$!
echo "J‑Link GDB server started with PID $JLINK_PID on port $PORT"
sleep 3
exit 0