#!/usr/bin/env bash
# Generate symbol and section reports from the ELF file.
set -euo pipefail

source "$(dirname "$0")/common.sh"
setup_log "elf_symbols.log"

load_project_config
require_config_value ELF_PATH

if [[ ! -f "$ELF_PATH" ]]; then
  echo "ELF file not found at $ELF_PATH" >&2
  exit 1
fi

OUT_DIR="$PROJECT_ROOT/artifacts/symbol_reports"
mkdir -p "$OUT_DIR"

NM_BIN="$(resolve_executable "${NM_BIN:-arm-none-eabi-nm}" || resolve_executable "${NM_BIN:-nm}" || true)"
OBJDUMP_BIN="$(resolve_executable "${OBJDUMP_BIN:-arm-none-eabi-objdump}" || resolve_executable "${OBJDUMP_BIN:-objdump}" || true)"
ADDR2LINE_BIN="$(resolve_executable "${ADDR2LINE_BIN:-arm-none-eabi-addr2line}" || resolve_executable "${ADDR2LINE_BIN:-llvm-addr2line}" || true)"
DWARFDUMP_BIN="$(resolve_executable "${DWARFDUMP_BIN:-dwarfdump}" || true)"

if [[ -z "$NM_BIN" || -z "$OBJDUMP_BIN" ]]; then
  echo "Required ELF analysis tools are missing (need nm and objdump)" >&2
  exit 1
fi

echo "Generating symbol table..."
"$NM_BIN" -n "$ELF_PATH" > "$OUT_DIR/symbols.txt"

echo "Generating section summary..."
"$OBJDUMP_BIN" -h "$ELF_PATH" > "$OUT_DIR/sections.txt"

ENTRY_ADDR="$("$OBJDUMP_BIN" -f "$ELF_PATH" | awk '/start address/ {print $3}')"
if [[ -z "$ENTRY_ADDR" ]]; then
  echo "Unable to determine ELF entry point address" >&2
  exit 1
fi

echo "Generating address-to-source report for entry point $ENTRY_ADDR..."
{
  echo "Entry point: $ENTRY_ADDR"
  if [[ -n "$ADDR2LINE_BIN" ]]; then
    echo
    echo "Resolved with $ADDR2LINE_BIN:"
    "$ADDR2LINE_BIN" -e "$ELF_PATH" -f -C "$ENTRY_ADDR"
  elif [[ -n "$DWARFDUMP_BIN" ]]; then
    echo
    echo "Resolved with $DWARFDUMP_BIN --lookup:"
    "$DWARFDUMP_BIN" --lookup="$ENTRY_ADDR" "$ELF_PATH"
  else
    echo
    echo "No addr2line-compatible lookup tool is installed."
  fi
} > "$OUT_DIR/addr2line_report.txt"

echo "ELF analysis complete.  Reports saved to $OUT_DIR."
