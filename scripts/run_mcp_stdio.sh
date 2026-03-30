#!/usr/bin/env bash
# Start the MCP server in stdio mode.
set -euo pipefail

LOG_DIR="$(dirname "$0")/../artifacts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/mcp_stdio.log"

exec > >(tee -a "$LOG_FILE") 2>&1

PROJECT_ROOT="$(dirname "$0")/.."
BINARY="$PROJECT_ROOT/bin/mcp-server-gdb"

if [[ ! -x "$BINARY" ]]; then
  echo "MCP server binary not found at $BINARY" >&2
  exit 1
fi

echo "Starting MCP server in stdio mode..."

# Launch the server.  Use exec so the script can forward signals.
"$BINARY" --transport stdio &
MCP_PID=$!
echo "MCP server started with PID $MCP_PID"

# Wait a few seconds for readiness
sleep 3

# Optionally, you could grep the log for a readiness message here.
exit 0