#!/usr/bin/env bash
# Validate that the build and debug environment is correctly configured.
set -euo pipefail

source "$(dirname "$0")/common.sh"
setup_log "validate_env.log"

echo "Validating environment..."
load_project_config

require_config_value ELF_PATH
require_config_value JLINK_GDB_SERVER_PATH
require_config_value DEVICE
require_config_value INTERFACE
require_config_value SPEED
require_config_value GDB_PATH

JLINK_GDB_SERVER_BIN="$(resolve_executable "$JLINK_GDB_SERVER_PATH" || true)"
GDB_BIN="$(resolve_executable "$GDB_PATH" || true)"

echo "ELF_PATH=$ELF_PATH"
echo "JLINK_GDB_SERVER_PATH=$JLINK_GDB_SERVER_PATH"
echo "DEVICE=$DEVICE"
echo "INTERFACE=$INTERFACE"
echo "SPEED=$SPEED"
echo "GDB_PATH=$GDB_PATH"

if [[ ! -f "$ELF_PATH" ]]; then
  echo "ELF file not found at $ELF_PATH" >&2
  exit 1
fi

if [[ -z "$JLINK_GDB_SERVER_BIN" ]]; then
  echo "J‑Link GDB server not found or not executable at $JLINK_GDB_SERVER_PATH" >&2
  exit 1
fi

if [[ -z "$GDB_BIN" ]]; then
  echo "GDB executable not found or not executable at $GDB_PATH" >&2
  exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "node (Node.js runtime) not found" >&2
  exit 1
fi
echo "node version: $(node --version)"

# Check npm
if ! command -v npm &>/dev/null; then
  echo "npm not found" >&2
  exit 1
fi
echo "npm version: $(npm --version)"

if ! command -v python3 &>/dev/null; then
  echo "python3 not found" >&2
  exit 1
fi
echo "python version: $(python3 --version)"

if ! python3 - <<'PY'
import importlib.util
import sys
sys.exit(0 if importlib.util.find_spec("yaml") else 1)
PY
then
  echo "PyYAML module not found for python3" >&2
  exit 1
fi
echo "python yaml module: available"

echo "Resolved J-Link server: $JLINK_GDB_SERVER_BIN"
echo "Resolved GDB binary: $GDB_BIN"
echo "Environment validation succeeded."
