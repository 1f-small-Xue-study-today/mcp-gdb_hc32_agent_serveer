#!/usr/bin/env bash
# Start the J‑Link GDB server using parameters from project.yaml.
set -euo pipefail

source "$(dirname "$0")/common.sh"
setup_log "jlink_gdb_server.log"

load_project_config
require_config_value JLINK_GDB_SERVER_PATH
require_config_value DEVICE
require_config_value INTERFACE
require_config_value SPEED

JLINK_GDB_SERVER_BIN="$(resolve_executable "$JLINK_GDB_SERVER_PATH" || true)"
PID_FILE="$RUNTIME_DIR/jlink_gdb_server.pid"

if [[ -z "$JLINK_GDB_SERVER_BIN" ]]; then
  echo "J‑Link GDB server not found or not executable: $JLINK_GDB_SERVER_PATH" >&2
  exit 1
fi

PORT=2331

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "J‑Link GDB server already running with PID $EXISTING_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

echo "Starting J‑Link GDB server..."
JLINK_PID="$(
python3 - "$JLINK_GDB_SERVER_BIN" "$DEVICE" "$INTERFACE" "$SPEED" "$PORT" "$LOG_DIR/jlink_gdb_server.log" <<'PY'
import os
import subprocess
import sys

binary, device, interface, speed, port, log_path = sys.argv[1:]
with open(log_path, "ab", buffering=0) as log_file:
    process = subprocess.Popen(
        [
            binary,
            "-device",
            device,
            "-if",
            interface,
            "-speed",
            speed,
            "-port",
            port,
        ],
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )
    print(process.pid)
PY
)"
echo "$JLINK_PID" > "$PID_FILE"
echo "J‑Link GDB server started with PID $JLINK_PID on port $PORT"

READY_PATTERN='Waiting for GDB connection'
for _ in {1..10}; do
  if ! kill -0 "$JLINK_PID" 2>/dev/null; then
    echo "J‑Link GDB server exited before reaching ready state" >&2
    exit 1
  fi

  if grep -q "$READY_PATTERN" "$LOG_DIR/jlink_gdb_server.log"; then
    echo "J‑Link GDB server reported ready state"
    exit 0
  fi

  sleep 0.5
done

echo "J‑Link GDB server did not report ready state within 5 seconds" >&2
exit 1
