#!/usr/bin/env bash
# Build the MCP GDB server TypeScript project using npm.
set -euo pipefail

source "$(dirname "$0")/common.sh"
setup_log "build_mcp.log"

echo "Building MCP GDB server..."

cd "$PROJECT_ROOT"
echo "Running npm install..."
npm install --no-fund --no-audit

echo "Running npm run build..."
npm run build

if [[ ! -f "$PROJECT_ROOT/dist/index.js" ]]; then
  echo "Build failed: dist/index.js not found" >&2
  exit 1
fi

echo "Checking generated dist/index.js syntax..."
node --check "$PROJECT_ROOT/dist/index.js"

echo "MCP GDB server built successfully"
