#!/usr/bin/env bash
# Use GDB to attach to the running J‑Link GDB server and perform a simple
# inspection.  Assumes the GDB server is listening on localhost:2331 and that
# the ELF_PATH is configured in project.yaml.
set -euo pipefail

LOG_DIR="$(dirname "$0")/../artifacts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gdb_attach.log"

exec > >(tee "$LOG_FILE") 2>&1

CONFIG_FILE="$(dirname "$0")/../config/project.yaml"
ELF_PATH=$(grep '^ELF_PATH:' "$CONFIG_FILE" | awk '{print $2}')

if [[ ! -f "$ELF_PATH" ]]; then
  echo "ELF file not found at $ELF_PATH" >&2
  exit 1
fi

GDB=${GDB:-gdb}

if ! command -v "$GDB" &>/dev/null; then
  echo "GDB not found in PATH" >&2
  exit 1
fi

echo "Launching GDB and connecting to target..."
cat >gdb_cmds.txt <<'GDBEOF'
target remote localhost:2331
monitor reset halt
info registers pc
quit
GDBEOF

"$GDB" "$ELF_PATH" -batch -x gdb_cmds.txt

rm -f gdb_cmds.txt

echo "GDB attach script completed."