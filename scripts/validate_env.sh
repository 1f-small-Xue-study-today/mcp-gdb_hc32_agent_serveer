#!/usr/bin/env bash
# Validate that the build and debug environment is correctly configured.
set -euo pipefail

LOG_DIR="$(dirname "$0")/../artifacts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/validate_env.log"

exec > >(tee "$LOG_FILE") 2>&1

echo "Validating environment..."

# Read configuration
CONFIG_FILE="$(dirname "$0")/../config/project.yaml"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Configuration file $CONFIG_FILE not found" >&2
  exit 1
fi

ELF_PATH=$(grep '^ELF_PATH:' "$CONFIG_FILE" | awk '{print $2}')
JLINK_GDB_SERVER_PATH=$(grep '^JLINK_GDB_SERVER_PATH:' "$CONFIG_FILE" | awk '{print $2}')

echo "ELF_PATH=$ELF_PATH"
echo "JLINK_GDB_SERVER_PATH=$JLINK_GDB_SERVER_PATH"

if [[ ! -f "$ELF_PATH" ]]; then
  echo "ELF file not found at $ELF_PATH" >&2
  exit 1
fi

if [[ ! -x "$JLINK_GDB_SERVER_PATH" ]]; then
  echo "J‑Link GDB server not found or not executable at $JLINK_GDB_SERVER_PATH" >&2
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

echo "Environment validation succeeded."