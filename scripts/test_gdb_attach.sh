#!/usr/bin/env bash
# Use GDB to attach to the running J‑Link GDB server and perform a simple
# inspection.  Assumes the GDB server is listening on localhost:2331 and that
# the ELF_PATH is configured in project.yaml.
set -euo pipefail

source "$(dirname "$0")/common.sh"
setup_log "gdb_attach.log"

load_project_config
require_config_value ELF_PATH
require_config_value GDB_PATH

GDB_BIN="$(resolve_executable "$GDB_PATH" || true)"

if [[ ! -f "$ELF_PATH" ]]; then
  echo "ELF file not found at $ELF_PATH" >&2
  exit 1
fi

if [[ -z "$GDB_BIN" ]]; then
  echo "GDB executable not found or not executable at $GDB_PATH" >&2
  exit 1
fi

GDB_CMDS="$(mktemp "$RUNTIME_DIR/gdb_cmds.XXXXXX")"
cleanup() {
  rm -f "$GDB_CMDS"
}
trap cleanup EXIT

echo "Launching GDB and connecting to target..."
cat > "$GDB_CMDS" <<'GDBEOF'
set confirm off
set pagination off
target remote localhost:2331
monitor halt
info registers pc
x/4wx $pc
quit
GDBEOF

"$GDB_BIN" "$ELF_PATH" -batch -x "$GDB_CMDS"

if ! grep -Eq '\bpc\b[[:space:]]+0x[0-9a-fA-F]+' "$LOG_DIR/gdb_attach.log"; then
  echo "GDB output did not contain a valid PC register value" >&2
  exit 1
fi

echo "GDB attach script completed."
