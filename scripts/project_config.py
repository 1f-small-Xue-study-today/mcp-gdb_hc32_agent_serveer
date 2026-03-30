#!/usr/bin/env python3
"""Read and normalize project configuration values from config/project.yaml."""

from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_FILE = PROJECT_ROOT / "config" / "project.yaml"

KEY_ALIASES: dict[str, tuple[str, ...]] = {
    "ELF_PATH": ("ELF_PATH",),
    "JLINK_GDB_SERVER_PATH": ("JLINK_GDB_SERVER_PATH",),
    "JLINK_DEVICE": ("JLINK_DEVICE", "DEVICE"),
    "DEVICE": ("DEVICE", "JLINK_DEVICE"),
    "JLINK_INTERFACE": ("JLINK_INTERFACE", "INTERFACE"),
    "INTERFACE": ("INTERFACE", "JLINK_INTERFACE"),
    "JLINK_SPEED_KHZ": ("JLINK_SPEED_KHZ", "SPEED", "JLINK_SPEED"),
    "SPEED": ("SPEED", "JLINK_SPEED_KHZ", "JLINK_SPEED"),
    "GDB_PATH": ("GDB_PATH",),
}

SHELL_EXPORT_ORDER = (
    "ELF_PATH",
    "JLINK_GDB_SERVER_PATH",
    "JLINK_DEVICE",
    "DEVICE",
    "JLINK_INTERFACE",
    "INTERFACE",
    "JLINK_SPEED_KHZ",
    "SPEED",
    "GDB_PATH",
)


def load_config() -> dict[str, str]:
    if not CONFIG_FILE.is_file():
        raise FileNotFoundError(f"Missing configuration file: {CONFIG_FILE}")

    data = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Configuration file is not a YAML mapping: {CONFIG_FILE}")

    normalized: dict[str, str] = {}
    for output_key, candidates in KEY_ALIASES.items():
        value = ""
        for candidate in candidates:
            raw_value = data.get(candidate)
            if raw_value is None:
                continue
            value = str(raw_value).strip()
            if value:
                break
        normalized[output_key] = value
    return normalized


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("key", nargs="?", help="Return the normalized value for one key")
    parser.add_argument("--json", action="store_true", help="Emit normalized config as JSON")
    parser.add_argument("--shell", action="store_true", help="Emit shell-safe KEY=value lines")
    args = parser.parse_args()

    try:
        config = load_config()
    except Exception as exc:  # pragma: no cover - surfaced in shell logs
        print(str(exc), file=sys.stderr)
        return 1

    if args.shell:
        for key in SHELL_EXPORT_ORDER:
            print(f"{key}={shlex.quote(config.get(key, ''))}")
        return 0

    if args.json:
        print(json.dumps(config, indent=2, sort_keys=True))
        return 0

    if args.key:
        value = config.get(args.key, "")
        if not value:
            return 1
        print(value)
        return 0

    parser.print_help(sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
