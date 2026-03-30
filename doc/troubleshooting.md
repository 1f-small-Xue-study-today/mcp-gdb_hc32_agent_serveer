# Troubleshooting

This document collects known issues encountered during the bring‑up process
and their resolutions.  Codex should append entries to this file whenever a
task fails.  Each entry should include:

* The task that failed.
* A short description of the error (including relevant log excerpts).
* Hypothesised root causes.
* Steps taken to diagnose and resolve the problem.

By maintaining this file you build a knowledge base that can help future
debug sessions proceed more smoothly.

## Task 1: Validate environment (2026-03-30 23:46:00)

* The task that failed: Task 1: Validate environment
* Error: `GDB_PATH` is present in [`/Volumes/电子尿袋/mcp_jlink_gdb_server/mcp-gdb_hc32_agent_serveer/config/project.yaml`](/Volumes/电子尿袋/mcp_jlink_gdb_server/mcp-gdb_hc32_agent_serveer/config/project.yaml) but unset, so validation stops before any attach step.
* Relevant log: `artifacts/logs/validate_env.log`
* Hypothesised root causes:
  * The ARM GDB client is not installed on this machine.
  * The tool is installed but its absolute path has not been written into `config/project.yaml`.
* Steps taken:
  * Added deterministic config parsing so missing values fail explicitly instead of being misread from quoted YAML.
  * Re-ran validation and confirmed the first blocking condition is `Missing required configuration value: GDB_PATH`.
  * Stopped the task workflow after Task 1, per `TASKS.md`.

## Isolated J-Link startup check (2026-03-30 23:48:00)

* The task that failed: Isolated `scripts/run_jlink_gdb_server.sh` verification outside the halted workflow
* Error: The J-Link GDB server started, then reported `Connecting to J-Link failed. Connected correctly?` and shut down.
* Relevant log: `artifacts/logs/jlink_gdb_server.log`
* Hypothesised root causes:
  * The board is not reachable from this sandboxed run even if it is normally connected.
  * Another host process already owns the J-Link or USB access path.
  * The device/interface settings are correct, but power or cable state changed between checks.
* Steps taken:
  * Started the J-Link GDB server with settings from `config/project.yaml`.
  * Waited for the ready message required by `TASKS.md`.
  * Captured the full SEGGER output and recorded the exact shutdown reason.

## Resolution summary (2026-03-31 00:34:30)

* `GDB_PATH` was resolved by installing Homebrew `arm-none-eabi-gdb` and setting [`/Volumes/电子尿袋/mcp_jlink_gdb_server/mcp-gdb_hc32_agent_serveer/config/project.yaml`](/Volumes/电子尿袋/mcp_jlink_gdb_server/mcp-gdb_hc32_agent_serveer/config/project.yaml) to `/opt/homebrew/bin/arm-none-eabi-gdb`.
* The J-Link probe/target path was verified directly with `JLinkExe`, which confirmed USB probe serial `69401493`, SWD attach, reset, halt, and `PC = 00001EF8`.
* `scripts/run_jlink_gdb_server.sh` was updated to spawn the SEGGER GDB server in a detached session so Task 3 leaves the service running after the wrapper exits.
* `src/index.ts` was updated to accept the actual MI startup prompt emitted by `arm-none-eabi-gdb` (`(gdb)` with trailing space), which cleared the MCP `gdb_start` timeout.
* After these fixes, the full chain succeeded: `validate_env`, `build_mcp`, `run_jlink_gdb_server`, `run_mcp_stdio`, `test_gdb_attach`, `test_elf_symbols`, and `test_mcp_session`.
