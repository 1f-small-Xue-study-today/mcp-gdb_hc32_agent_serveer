# MCP Debug Project

This repository provides a scaffold for bringing up a debug environment for an
embedded target using the OpenAI Codex ecosystem.  It demonstrates how to
organise **agent instructions**, **task definitions**, **skills**, and
associated scripts so that a Codex-driven assistant can stand up, verify and
operate a hardware debug loop.

Key components include:

* **AGENTS.md** – high‑level project instructions that Codex reads before
  attempting any work.  These instructions describe the environment (such as
  where to find your ELF and J‑Link binaries) and provide global guidelines.
* **TASKS.md** – a set of explicit tasks that Codex can follow in order to
  validate tools, build the MCP server, start the GDB and J‑Link servers,
  connect to the target, and analyse your ELF file.  Each task has clear
  success criteria and references to the supporting scripts.
* **.agents/skills/** – a collection of modular skills packaged according to
  the Codex Skills specification.  Each skill contains a `SKILL.md` with
  front‑matter describing when it should be invoked and step‑by‑step
  instructions.  Skills allow you to encapsulate specialised workflows such as
  ELF analysis or debug attachment.
* **config/project.yaml** – a machine‑readable configuration file where you
  specify the absolute paths to your ELF binary and the J‑Link GDB server on
  your system as well as device‑specific parameters.  Codex reads this file to
  parameterise scripts and skills without hard‑coding paths in Markdown.
* **scripts/** – helper scripts used by tasks and skills.  These scripts
  illustrate how to perform operations such as building the MCP server,
  starting the MCP and J‑Link servers, connecting with GDB, and extracting
  symbols from an ELF file.  They are deliberately simple and deterministic so
  that Codex can call them reliably.

## Getting started

1. Copy this repository into a new directory and adjust the paths in
   `config/project.yaml` to reflect your environment.  In particular set
   `ELF_PATH` to the location of your firmware `.elf` file and
   `JLINK_GDB_SERVER_PATH` to your J‑Link GDB server executable.
2. Run Codex in the root of the repository.  Codex will load `AGENTS.md`,
   follow the tasks defined in `TASKS.md`, and leverage skills under
   `.agents/skills` to complete each step.
3. Inspect the `artifacts/` folder for logs and reports generated during
   execution.  If a step fails, consult the log files and the docs in the
   `doc/` folder for troubleshooting advice.

This scaffold is intentionally minimal; it does not include the full source
code for an MCP server nor does it bundle the J‑Link SDK.  Instead, it
provides a structure and documentation for Codex to clone, build and run
external dependencies on demand, as described in the tasks and skills.