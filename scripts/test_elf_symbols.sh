#!/usr/bin/env bash
# Generate symbol and section reports from the ELF file.
set -euo pipefail

LOG_DIR="$(dirname "$0")/../artifacts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/elf_symbols.log"

exec > >(tee "$LOG_FILE") 2>&1

CONFIG_FILE="$(dirname "$0")/../config/project.yaml"
ELF_PATH=$(grep '^ELF_PATH:' "$CONFIG_FILE" | awk '{print $2}')

if [[ ! -f "$ELF_PATH" ]]; then
  echo "ELF file not found at $ELF_PATH" >&2
  exit 1
fi

OUT_DIR="$(dirname "$0")/../artifacts/symbol_reports"
mkdir -p "$OUT_DIR"

echo "Generating symbol table..."
nm -C --defined-only "$ELF_PATH" | sort > "$OUT_DIR/symbols.txt"

echo "Generating section summary..."
readelf -S "$ELF_PATH" > "$OUT_DIR/sections.txt"

# Example addr2line usage: resolve a handful of addresses
echo "Generating address‑to‑line report..."
{
  echo "Entry point:"
  readelf -h "$ELF_PATH" | awk '/Entry point address:/ {print $4}'
} | while read -r addr; do
  if [[ -n "$addr" ]]; then
    echo "$addr -> $(addr2line -e "$ELF_PATH" "$addr")" >> "$OUT_DIR/addr2line_report.txt"
  fi
done

echo "ELF analysis complete.  Reports saved to $OUT_DIR."