# TASKS.md

This document enumerates a sequence of tasks that the Codex agent should
execute to bring up the MCP debug environment.  Each task lists a unique
identifier, a description, the script to invoke, and the expected success
criteria.  Codex should run these tasks in the order presented unless
overridden by an explicit user instruction.

## Task 1: Validate environment

**Description:** Ensure that the host machine has the required toolchain
installed and that the configuration file `config/project.yaml` is complete.

**Steps:**

1. Read `config/project.yaml` and confirm that `ELF_PATH`,
   `JLINK_GDB_SERVER_PATH`, `JLINK_DEVICE`, `JLINK_INTERFACE`, and
   `JLINK_SPEED_KHZ` are set.
2. Verify that the ELF file exists at `ELF_PATH`.
3. Verify that the J‑Link GDB server executable exists at
   `JLINK_GDB_SERVER_PATH` and is executable.
4. Check that Node.js is installed (`node --version`).
5. Check that npm is installed (`npm --version`).

**Script:** `scripts/validate_env.sh`

**Success criteria:** The script exits with status 0 and prints messages
indicating that all prerequisites are present.  Log output to
`artifacts/logs/validate_env.log`.

---

## Task 2: Build the MCP server

**Description:** Build the TypeScript MCP GDB server using npm.  The source
code lives in `src/index.ts` and uses the `@modelcontextprotocol/sdk`.

**Steps:**

1. Run `scripts/build_mcp.sh`.  This script runs `npm install` and
   `npm run build` to compile the TypeScript source.
2. Verify that the compiled output exists at `dist/index.js`.

**Script:** `scripts/build_mcp.sh`

**Success criteria:** The file `dist/index.js` exists.  Log output to
`artifacts/logs/build_mcp.log`.

---

## Task 3: Start the J‑Link GDB server

**Description:** Launch the J‑Link GDB server using the parameters defined
in `config/project.yaml`.  This server bridges GDB to the target hardware.

**Steps:**

1. Read the values from `config/project.yaml`.
2. Execute `scripts/run_jlink_gdb_server.sh`.  This script constructs a command like:

   ```
   $JLINK_GDB_SERVER_PATH -device $JLINK_DEVICE -if $JLINK_INTERFACE -speed $JLINK_SPEED_KHZ -port 2331 -silent
   ```

   and writes output to `artifacts/logs/jlink_gdb_server.log`.
3. Wait up to 5 seconds for the server to report that it is listening.

**Success criteria:** The log file contains a line such as `Waiting for
GDB connection...` and the process remains running.  If not, mark the task
as failed.

---

## Task 4: Start the MCP server (stdio)

**Description:** Launch the compiled MCP server in standard I/O mode.  This
task should be run in the background; subsequent tasks that require the MCP
server should verify that it is running and listening on its default
transport.

**Steps:**

1. Execute `scripts/run_mcp_stdio.sh`.  This script starts the MCP server
   in stdio mode and redirects its output to `artifacts/logs/mcp_stdio.log`.
2. Wait up to 5 seconds for the server to print its readiness message.

**Success criteria:** The log file contains a line indicating that the
transport is ready (for example, `GDB MCP server running on stdio`).  If the
message is not present after the timeout, mark the task as failed.

---

## Task 5: Verify end-to-end

**Description:** Verify that the MCP server can communicate with the J‑Link
GDB server and perform basic debug operations.  This uses the MCP tools to:
create a GDB session, connect to the target, halt the core, and read the PC
register.

**Steps:**

1. Execute `scripts/test_gdb_attach.sh`.  The script connects GDB to
   `localhost:2331`, halts the core, and prints the PC register.
2. Alternatively, use the MCP tools directly:
   - Call `gdb_start` to create a GDB session
   - Call `gdb_command` with `target remote localhost:2331` to connect
   - Call `gdb_command` with `monitor reset halt` to halt the target
   - Call `gdb_info_registers` to read registers including PC
3. Capture output to `artifacts/logs/gdb_attach.log`.

**Success criteria:** The output contains a valid PC value and no error
messages.  GDB reports that the connection is established and the target is
halted.

---

## Completion

After completing all tasks successfully, Codex should update
`doc/bringup_plan.md` with a summary of the operations performed,
highlighting any issues encountered and how they were resolved.  If any
task fails, Codex should write a detailed description of the failure and
mitigation steps to `doc/troubleshooting.md` before stopping.
