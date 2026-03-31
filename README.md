# MCP J-Link GDB Debug Runtime

This repository gives you a reproducible embedded debug path:

`ELF -> GDB -> J-Link GDB Server -> hardware`

Use this README for two things only:

- bring the project up quickly on a new machine
- understand where to implement or extend the runtime

## Quick Bring-Up

### 1. Install the required tools

You need these available on the host:

- Node.js and `npm`
- Python 3 with `PyYAML`
- SEGGER J-Link tools
- `arm-none-eabi-gdb`
- `arm-none-eabi-nm`
- `arm-none-eabi-objdump`
- `arm-none-eabi-addr2line`

### 2. Fill in the project config

Edit `config/project.yaml` and set absolute paths for:

- `ELF_PATH`
- `JLINK_GDB_SERVER_PATH`
- `JLINK_DEVICE` or `DEVICE`
- `JLINK_INTERFACE` or `INTERFACE`
- `JLINK_SPEED_KHZ` or `SPEED`
- `GDB_PATH`

Example:

```yaml
ELF_PATH: '/absolute/path/to/firmware.elf'
JLINK_GDB_SERVER_PATH: '/absolute/path/to/JLinkGDBServerCLExe'
JLINK_DEVICE: 'HC32F460XE'
DEVICE: 'HC32F460XE'
JLINK_INTERFACE: 'SWD'
INTERFACE: 'SWD'
JLINK_SPEED_KHZ: 4000
SPEED: 4000
GDB_PATH: '/opt/homebrew/bin/arm-none-eabi-gdb'
```

### 3. Run the workflow in order

From the repository root:

```bash
./scripts/validate_env.sh
./scripts/build_mcp.sh
./scripts/run_jlink_gdb_server.sh
./scripts/test_gdb_attach.sh
./scripts/test_elf_symbols.sh
./scripts/run_mcp_stdio.sh
python3 scripts/test_mcp_session.py
```

### 4. Check the logs

The scripts currently write their output to log files instead of printing much to the terminal. After each step, check:

- `artifacts/logs/validate_env.log`
- `artifacts/logs/build_mcp.log`
- `artifacts/logs/jlink_gdb_server.log`
- `artifacts/logs/gdb_attach.log`
- `artifacts/logs/elf_symbols.log`
- `artifacts/logs/mcp_stdio.log`
- `artifacts/logs/mcp_session.log`

Generated ELF reports are written to:

- `artifacts/symbol_reports/symbols.txt`
- `artifacts/symbol_reports/sections.txt`
- `artifacts/symbol_reports/addr2line_report.txt`

### 5. What success looks like

Bring-up is healthy when:

- `validate_env.sh` resolves the ELF, J-Link server, and GDB binaries
- `build_mcp.sh` produces `dist/index.js`
- `run_jlink_gdb_server.sh` leaves the SEGGER server running on `localhost:2331`
- `test_gdb_attach.sh` reads a valid `pc` register and memory at `$pc`
- `test_mcp_session.py` completes `initialize`, `tools/list`, `gdb_start`, `gdb_load`, `gdb_connect`, `gdb_read_register`, `gdb_read_memory`, and `gdb_terminate`

If a step fails, stop there and check:

- `doc/troubleshooting.md`
- `doc/bringup_plan.md`

## How To Implement It

The implementation is split into four layers. Extend them in this order.

### 1. Configuration layer

Files:

- `config/project.yaml`
- `scripts/project_config.py`
- `scripts/common.sh`

Purpose:

- keep all machine-specific paths and target settings in one place
- normalize aliases like `DEVICE` and `JLINK_DEVICE`
- give every script the same config contract

Rule:

- do not hardcode tool paths anywhere else

### 2. Deterministic workflow layer

Files:

- `scripts/validate_env.sh`
- `scripts/build_mcp.sh`
- `scripts/run_jlink_gdb_server.sh`
- `scripts/run_mcp_stdio.sh`
- `scripts/test_gdb_attach.sh`
- `scripts/test_elf_symbols.sh`
- `scripts/test_mcp_session.py`

Purpose:

- provide one script per operation
- make bring-up reproducible
- leave a log for every step

Rule:

- if you add a new capability, add a deterministic script or smoke test for it

### 3. MCP server layer

Files:

- `src/index.ts`
- `dist/index.js`

Purpose:

- accept MCP stdio JSON-RPC requests
- advertise tools through `tools/list`
- manage one live GDB process per session
- translate MCP tool calls into GDB commands

Key flow:

1. MCP client sends `initialize`
2. MCP client sends `tools/list`
3. MCP client sends `tools/call`
4. the server dispatches to a handler like `gdb_start` or `gdb_read_memory`
5. the handler runs a GDB command and returns text output as the MCP result

Rule:

- prove the direct GDB path first, then add new MCP tools on top

### 4. Hardware bridge layer

Files:

- `scripts/run_jlink_gdb_server.sh`
- J-Link GDB Server configured in `config/project.yaml`

Purpose:

- bridge GDB to the target hardware

Important distinction:

- the MCP server does not talk to hardware directly
- GDB talks to J-Link
- J-Link talks to the board

## Where To Extend The Project

If you want to add features, these are the normal places:

- new MCP tool: add a tool definition and handler in `src/index.ts`
- new validation rule: add it to `scripts/validate_env.sh`
- new attach or smoke test: add a script under `scripts/`
- new ELF report: extend `scripts/test_elf_symbols.sh`
- new troubleshooting guidance: update `doc/troubleshooting.md`

Good next additions:

- better operator-facing console output while keeping logs
- richer MCP tools like `gdb_backtrace`, `gdb_print`, and `gdb_continue`
- clearer error handling for missing hardware or dead sessions

## Minimal Mental Model

```text
MCP client
  -> MCP server (src/index.ts)
  -> GDB process
  -> J-Link GDB server
  -> target hardware
```

The ELF is loaded by GDB so register values, addresses, and PCs can be mapped back to symbols and source information.

## License

MIT
