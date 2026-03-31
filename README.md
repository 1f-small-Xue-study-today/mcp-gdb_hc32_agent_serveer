# MCP J-Link GDB Debug Runtime

This repository packages a deterministic embedded debug pipeline for an AI agent or a human operator:

`ELF -> GDB -> J-Link GDB Server -> target hardware`

The project is built around `config/project.yaml`, the task order in `TASKS.md`, and the scripts in `scripts/`. The current implementation has been verified on a real target and can:

- load an ELF with symbols
- start a SEGGER J-Link GDB server
- attach with `arm-none-eabi-gdb`
- read registers and memory from hardware
- map program counters back to symbols from the ELF
- expose GDB-backed operations through an MCP stdio server

## What Changed In This Project

Compared with the upstream generic MCP GDB package flow, this repository now includes a reproducible board-oriented runtime:

- deterministic config loading from `config/project.yaml`
- deterministic shell entrypoints for validation, build, J-Link startup, GDB attach, MCP smoke testing, and ELF analysis
- centralized logging in `artifacts/logs/`
- ELF symbol reports in `artifacts/symbol_reports/`
- an offline-buildable MCP server in `src/index.ts` that does not depend on fetching the npm MCP SDK at runtime
- service launch wrappers that keep the J-Link GDB server and MCP stdio server alive after the wrapper script exits
- documented bring-up and troubleshooting history in `doc/bringup_plan.md` and `doc/troubleshooting.md`

## Repository Layout

- `config/project.yaml`: local machine and target configuration
- `scripts/validate_env.sh`: verify toolchain, config, and required files
- `scripts/build_mcp.sh`: build the MCP server into `dist/index.js`
- `scripts/run_jlink_gdb_server.sh`: start the SEGGER J-Link GDB server on port `2331`
- `scripts/run_mcp_stdio.sh`: start the MCP server in stdio mode
- `scripts/test_gdb_attach.sh`: attach directly with GDB and read `pc`
- `scripts/test_mcp_session.py`: exercise the MCP server over stdio and read register/memory data
- `scripts/test_elf_symbols.sh`: generate ELF symbol and section reports
- `artifacts/logs/`: raw execution logs
- `artifacts/symbol_reports/`: symbol table and address-to-source reports

## Requirements

Before running the workflow, make sure the following are installed on the host:

- Node.js and `npm`
- Python 3 with `PyYAML`
- SEGGER J-Link tools
- an ARM-capable GDB client such as `arm-none-eabi-gdb`
- ELF analysis tools such as `arm-none-eabi-nm` and `arm-none-eabi-objdump`, or compatible fallbacks available in `PATH`

This project does not hardcode local tool paths. The actual binaries are taken from `config/project.yaml`.

## Configure The Project

Edit `config/project.yaml` and set the absolute paths and target settings for your machine:

- `ELF_PATH`: firmware ELF with symbols
- `JLINK_GDB_SERVER_PATH`: J-Link GDB server executable
- `JLINK_DEVICE` or `DEVICE`: SEGGER device name
- `JLINK_INTERFACE` or `INTERFACE`: `SWD` or `JTAG`
- `JLINK_SPEED_KHZ` or `SPEED`: link speed in kHz
- `GDB_PATH`: absolute path to `arm-none-eabi-gdb`

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
GDB_PATH: '/absolute/path/to/arm-none-eabi-gdb'
```

## Quick Start For A New Teammate

Run the workflow from the repository root in the same order as `TASKS.md`.

### 1. Validate the local environment

```bash
./scripts/validate_env.sh
```

Success criteria:

- exits with code `0`
- confirms the configured ELF exists
- resolves the J-Link GDB server binary
- resolves the GDB binary

Log:

- `artifacts/logs/validate_env.log`

### 2. Build the MCP server

```bash
./scripts/build_mcp.sh
```

Success criteria:

- `dist/index.js` exists
- `node --check dist/index.js` passes

Log:

- `artifacts/logs/build_mcp.log`

### 3. Start the J-Link GDB server

```bash
./scripts/run_jlink_gdb_server.sh
```

Success criteria:

- the process stays alive
- `artifacts/logs/jlink_gdb_server.log` contains `Waiting for GDB connection`

Notes:

- the script writes a PID file under `artifacts/runtime/`
- if the board is disconnected or busy, this step fails and the workflow should stop

### 4. Start the MCP server in stdio mode

```bash
./scripts/run_mcp_stdio.sh
```

Success criteria:

- the process stays alive
- `artifacts/logs/mcp_stdio.log` contains `GDB MCP server running on stdio`

### 5. Verify direct GDB attach

```bash
./scripts/test_gdb_attach.sh
```

What it does:

- loads the configured ELF into GDB
- connects to `localhost:2331`
- halts the target
- prints the `pc` register
- reads four words at `$pc`

Success criteria:

- the log contains a valid `pc` value
- there are no attach errors from GDB

Log:

- `artifacts/logs/gdb_attach.log`

### 6. Verify the MCP path

```bash
python3 scripts/test_mcp_session.py
```

What it does:

- starts an MCP stdio session
- initializes the MCP protocol
- calls `gdb_start`
- calls `gdb_load`
- calls `gdb_connect`
- calls `gdb_read_register` for `pc`
- calls `gdb_read_memory` at `$pc`
- terminates the session cleanly

Success criteria:

- each MCP request returns a JSON-RPC success response
- the session returns real register and memory data from the target

Log:

- `artifacts/logs/mcp_session.log`

### 7. Generate ELF reports

```bash
./scripts/test_elf_symbols.sh
```

Outputs:

- `artifacts/symbol_reports/symbols.txt`
- `artifacts/symbol_reports/sections.txt`
- `artifacts/symbol_reports/addr2line_report.txt`

## Typical End-to-End Usage

If you want the full sequence in one manual session:

```bash
./scripts/validate_env.sh
./scripts/build_mcp.sh
./scripts/run_jlink_gdb_server.sh
./scripts/run_mcp_stdio.sh
./scripts/test_gdb_attach.sh
python3 scripts/test_mcp_session.py
./scripts/test_elf_symbols.sh
```

## Using The MCP Server From Another Agent Or Client

The MCP server entrypoint is:

```bash
node dist/index.js
```

It uses stdio JSON-RPC framing and exposes GDB-backed tools including:

- `gdb_start`
- `gdb_load`
- `gdb_command`
- `gdb_connect`
- `gdb_read_register`
- `gdb_read_memory`
- `gdb_terminate`

For a working example of the protocol flow, use `scripts/test_mcp_session.py`.

## Logs And Debug Artifacts

The project writes runtime evidence under `artifacts/`:

- `artifacts/logs/validate_env.log`
- `artifacts/logs/build_mcp.log`
- `artifacts/logs/jlink_gdb_server.log`
- `artifacts/logs/mcp_stdio.log`
- `artifacts/logs/gdb_attach.log`
- `artifacts/logs/mcp_session.log`
- `artifacts/logs/elf_symbols.log`
- `artifacts/symbol_reports/`

If a task fails, check the matching log first, then review:

- `doc/bringup_plan.md`
- `doc/troubleshooting.md`

## Known Notes

- Source paths embedded in the current ELF point to a Windows build machine, so GDB may warn that source files are missing locally even when symbol resolution works correctly.
- This repository is intended for non-intrusive debug operations. Do not add flashing or persistent target reconfiguration without explicit approval.
- The scripts do not assume the board is always connected. If hardware access is unavailable, the workflow is expected to fail during J-Link startup or attach validation.

## License

MIT
