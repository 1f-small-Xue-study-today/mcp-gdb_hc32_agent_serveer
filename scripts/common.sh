#!/usr/bin/env bash

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_HELPER="$PROJECT_ROOT/scripts/project_config.py"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"
LOG_DIR="$ARTIFACTS_DIR/logs"
RUNTIME_DIR="$ARTIFACTS_DIR/runtime"

setup_log() {
  local log_name="$1"
  mkdir -p "$LOG_DIR" "$RUNTIME_DIR"
  : > "$LOG_DIR/$log_name"
  exec >> "$LOG_DIR/$log_name" 2>&1
}

load_project_config() {
  if [[ ! -f "$CONFIG_HELPER" ]]; then
    echo "Configuration helper not found at $CONFIG_HELPER" >&2
    return 1
  fi
  eval "$(python3 "$CONFIG_HELPER" --shell)"
}

require_config_value() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required configuration value: $key" >&2
    return 1
  fi
}

resolve_executable() {
  local candidate="${1:-}"
  if [[ -z "$candidate" ]]; then
    return 1
  fi

  if [[ "$candidate" == */* ]]; then
    [[ -x "$candidate" ]] || return 1
    printf '%s\n' "$candidate"
    return 0
  fi

  command -v "$candidate" 2>/dev/null
}

append_troubleshooting_entry() {
  local task_name="$1"
  local error_summary="$2"
  local log_path="$3"
  local troubleshooting_file="$PROJECT_ROOT/doc/troubleshooting.md"

  mkdir -p "$(dirname "$troubleshooting_file")"
  if [[ ! -f "$troubleshooting_file" ]]; then
    printf '# Troubleshooting\n\n' > "$troubleshooting_file"
  fi

  {
    printf '\n## %s (%s)\n\n' "$task_name" "$(date '+%Y-%m-%d %H:%M:%S')"
    printf '* The task that failed: %s\n' "$task_name"
    printf '* Error: %s\n' "$error_summary"
    printf '* Relevant log: `%s`\n' "$log_path"
    printf '* Hypothesised root causes:\n'
    printf '  * Missing or invalid configuration values\n'
    printf '  * Required local tooling is not installed or not executable\n'
    printf '* Steps taken:\n'
    printf '  * Executed the task script and captured stdout/stderr\n'
    printf '  * Stopped the bring-up workflow at the first failing task\n'
  } >> "$troubleshooting_file"
}
