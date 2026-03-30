---
name: debug-attach
description: |
  Attach to the target microcontroller via a J‑Link GDB server and perform
  basic debugging operations.  Use this skill when you need to halt the
  core, inspect registers or memory, or verify that the debug chain is
  working end‑to‑end.  It relies on the J‑Link parameters defined in
  `config/project.yaml` and assumes the MCP server and J‑Link GDB server
  are already started.
---

## Instructions

1. Read `JLINK_GDB_SERVER_PATH`, `JLINK_DEVICE`, `JLINK_INTERFACE` and
   `JLINK_SPEED_KHZ` from `config/project.yaml`.
2. Ensure that the J‑Link GDB server is running on port 2331.  If it is not
   running, call `scripts/run_jlink_gdb_server.sh` to start it.  Capture
   the log under `artifacts/logs/jlink_gdb_server.log`.
3. Ensure that the MCP server is running in stdio mode.  If not, start it
   using `scripts/run_mcp_stdio.sh`.
4. Use the MCP tools to create a GDB session and connect to the target:
   - Call `gdb_start` to create a new GDB session
   - Call `gdb_command` with `target remote localhost:2331` to connect
   - Call `gdb_command` with `monitor reset halt` to halt the target
   - Call `gdb_info_registers` to read PC and verify connection
5. Capture the session output to `artifacts/logs/debug_attach.log`.
6. Verify that the log contains a valid PC value and no error messages.
   If errors occur, append an entry to `doc/troubleshooting.md` and
   abort the task.
