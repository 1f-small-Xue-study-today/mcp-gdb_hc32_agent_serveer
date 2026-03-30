#!/usr/bin/env bash
# Build the MCP GDB server TypeScript project using npm.
set -euo pipefail

LOG_DIR="$(dirname "$0")/../artifacts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/build_mcp.log"

exec > >(tee "$LOG_FILE") 2>&1

echo "Building MCP GDB server..."

PROJECT_ROOT="$(dirname "$0")/.."

cd "$PROJECT_ROOT"
echo "Running npm install..."
npm install

echo "Running npm run build..."
npm run build

if [[ ! -f "$PROJECT_ROOT/dist/index.js" ]]; then
  echo "Build failed: dist/index.js not found" >&2
  exit 1
fi

echo "MCP GDB server built successfully"