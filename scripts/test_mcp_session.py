#!/usr/bin/env python3
"""Exercise the MCP server over stdio using JSON-RPC framing."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "project.yaml"
LOG_PATH = PROJECT_ROOT / "artifacts" / "logs" / "mcp_session.log"
SERVER_PATH = PROJECT_ROOT / "dist" / "index.js"


def log(message: str) -> None:
    print(message)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(message + "\n")


def load_config() -> dict[str, str]:
    raw = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise RuntimeError(f"Configuration file is not a mapping: {CONFIG_PATH}")
    return {key: str(value) for key, value in raw.items() if value is not None}


def normalized_config(raw: dict[str, str]) -> dict[str, str]:
    device = raw.get("DEVICE") or raw.get("JLINK_DEVICE") or ""
    interface = raw.get("INTERFACE") or raw.get("JLINK_INTERFACE") or ""
    speed = raw.get("SPEED") or raw.get("JLINK_SPEED_KHZ") or ""
    return {
        "ELF_PATH": raw.get("ELF_PATH", ""),
        "GDB_PATH": raw.get("GDB_PATH", ""),
        "DEVICE": device,
        "INTERFACE": interface,
        "SPEED": speed,
    }


def encode_message(payload: dict[str, Any]) -> bytes:
    body = json.dumps(payload).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    return header + body


def read_message(stream) -> dict[str, Any]:
    headers: dict[str, str] = {}
    while True:
      line = stream.readline()
      if not line:
          raise RuntimeError("MCP server closed stdout unexpectedly")
      if line in (b"\r\n", b"\n"):
          break
      name, _, value = line.decode("ascii").partition(":")
      headers[name.strip().lower()] = value.strip()

    content_length = int(headers["content-length"])
    body = stream.read(content_length)
    if not body:
        raise RuntimeError("MCP server returned an empty response body")
    return json.loads(body.decode("utf-8"))


def send_request(process: subprocess.Popen[bytes], request_id: int, method: str, params: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": params,
    }
    assert process.stdin is not None
    process.stdin.write(encode_message(payload))
    process.stdin.flush()
    return read_message(process.stdout)


def send_notification(process: subprocess.Popen[bytes], method: str, params: dict[str, Any]) -> None:
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    }
    assert process.stdin is not None
    process.stdin.write(encode_message(payload))
    process.stdin.flush()


def main() -> int:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text("", encoding="utf-8")

    if not SERVER_PATH.is_file():
        log(f"[MCP] Server entrypoint missing: {SERVER_PATH}")
        return 1

    config = normalized_config(load_config())
    elf_path = config["ELF_PATH"]
    gdb_path = config["GDB_PATH"]

    log("[MCP] Starting stdio MCP session")
    process = subprocess.Popen(
        ["node", str(SERVER_PATH)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        init_response = send_request(
            process,
            1,
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "codex-smoke-test", "version": "1.0.0"},
            },
        )
        log(f"[MCP] initialize => {json.dumps(init_response)}")
        send_notification(process, "notifications/initialized", {})

        tools_response = send_request(process, 2, "tools/list", {})
        log(f"[MCP] tools/list => {json.dumps(tools_response)}")

        start_response = send_request(
            process,
            3,
            "tools/call",
            {
                "name": "gdb_start",
                "arguments": {
                    "gdbPath": gdb_path,
                    "workingDir": str(PROJECT_ROOT),
                },
            },
        )
        log(f"[MCP] gdb_start => {json.dumps(start_response)}")

        start_result_text = json.dumps(start_response)
        if "Failed to start GDB" in start_result_text:
            return 1

        session_id = None
        content = start_response.get("result", {}).get("content", [])
        for item in content:
            text = item.get("text", "")
            if "GDB session started with ID:" in text:
                session_id = text.split("GDB session started with ID:", 1)[1].splitlines()[0].strip()
                break

        if not session_id:
            log("[MCP] Unable to extract session ID from gdb_start response")
            return 1

        load_response = send_request(
            process,
            4,
            "tools/call",
            {
                "name": "gdb_load",
                "arguments": {"sessionId": session_id, "program": elf_path},
            },
        )
        log(f"[MCP] gdb_load => {json.dumps(load_response)}")

        connect_response = send_request(
            process,
            5,
            "tools/call",
            {
                "name": "gdb_connect",
                "arguments": {"sessionId": session_id, "target": "localhost:2331"},
            },
        )
        log(f"[MCP] gdb_connect => {json.dumps(connect_response)}")

        register_response = send_request(
            process,
            6,
            "tools/call",
            {
                "name": "gdb_read_register",
                "arguments": {"sessionId": session_id, "register": "pc"},
            },
        )
        log(f"[MCP] gdb_read_register => {json.dumps(register_response)}")

        memory_response = send_request(
            process,
            7,
            "tools/call",
            {
                "name": "gdb_read_memory",
                "arguments": {"sessionId": session_id, "address": "$pc", "count": 4, "format": "wx"},
            },
        )
        log(f"[MCP] gdb_read_memory => {json.dumps(memory_response)}")

        terminate_response = send_request(
            process,
            8,
            "tools/call",
            {"name": "gdb_terminate", "arguments": {"sessionId": session_id}},
        )
        log(f"[MCP] gdb_terminate => {json.dumps(terminate_response)}")
        return 0
    finally:
        process.terminate()
        try:
            stderr_output, _ = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            stderr_output, _ = process.communicate()
        if stderr_output:
            log(f"[MCP] stderr => {stderr_output.decode('utf-8', errors='replace')}")


if __name__ == "__main__":
    raise SystemExit(main())
