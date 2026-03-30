---
name: elf-analysis
description: |
  Extract symbols and source mappings from an ELF binary.  Use this skill
  when you need to understand the layout of the firmware, map program
  counter values to function names, or generate symbol reports for later
  analysis.  The path to the ELF file is specified in `config/project.yaml`.
---

## Instructions

1. Read the `ELF_PATH` from `config/project.yaml`.  If the file does not
   exist, abort and log an error.
2. Run the script `scripts/test_elf_symbols.sh`.  This script invokes
   `nm` to create a sorted symbol table, `readelf -S` to summarise the
   sections, and `addr2line` to map an example address to its source
   location.  All outputs are written into `artifacts/symbol_reports/`.
3. After running the script, open the files in
   `artifacts/symbol_reports/` to inspect symbols, sections, and
   address‑to‑line mappings.  Use these reports in conjunction with
   debugger output to interpret program counter values.
4. Do not call this skill on non‑ELF binaries.  Always verify the ELF
   file exists before running any commands.