#!/usr/bin/env bash
# Start the MCP server in stdio mode.
set -euo pipefail

source "$(dirname "$0")/common.sh"
setup_log "mcp_stdio.log"

SERVER_JS="$PROJECT_ROOT/dist/index.js"
PID_FILE="$RUNTIME_DIR/mcp_stdio.pid"
KEEPALIVE_PID_FILE="$RUNTIME_DIR/mcp_stdio_keepalive.pid"
FIFO_PATH="$RUNTIME_DIR/mcp_stdio.stdin"

if [[ ! -f "$SERVER_JS" ]]; then
  echo "MCP server entrypoint not found at $SERVER_JS" >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "MCP stdio server already running with PID $EXISTING_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [[ -f "$KEEPALIVE_PID_FILE" ]]; then
  KEEPALIVE_PID="$(cat "$KEEPALIVE_PID_FILE")"
  if kill -0 "$KEEPALIVE_PID" 2>/dev/null; then
    kill "$KEEPALIVE_PID" 2>/dev/null || true
  fi
  rm -f "$KEEPALIVE_PID_FILE"
fi

rm -f "$FIFO_PATH"
mkfifo "$FIFO_PATH"

echo "Starting MCP server in stdio mode..."
tail -f /dev/null > "$FIFO_PATH" &
KEEPALIVE_PID=$!
echo "$KEEPALIVE_PID" > "$KEEPALIVE_PID_FILE"

node "$SERVER_JS" < "$FIFO_PATH" &
MCP_PID=$!
echo "$MCP_PID" > "$PID_FILE"
echo "MCP server started with PID $MCP_PID"

for _ in {1..10}; do
  if ! kill -0 "$MCP_PID" 2>/dev/null; then
    echo "MCP server exited before it reported readiness" >&2
    exit 1
  fi

  if grep -q 'GDB MCP server running on stdio' "$LOG_DIR/mcp_stdio.log"; then
    echo "MCP server reported ready state"
    exit 0
  fi

  sleep 0.5
done

echo "MCP server did not report ready state within 5 seconds" >&2
exit 1
