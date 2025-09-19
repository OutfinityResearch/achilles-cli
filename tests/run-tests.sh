#!/bin/bash

# Exit on error
set -e

# Root directory of the project
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../" && pwd)

# Load environment variables
if [ -f "$ROOT_DIR/tests/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/tests/.env" | xargs)
fi

# Pre-test check for a valid LLM key
ROOT_DIR="$ROOT_DIR" node <<'NODE'
const path = require('path');
const rootDir = process.env.ROOT_DIR;
const { configure } = require(path.join(rootDir, 'src/services/LLMConfiguration.js'));
const { LLMAgentClient } = require(path.join(rootDir, 'src/services/LLMAgentClient.js'));

(async () => {
  try {
    await configure();
    new LLMAgentClient();
    console.log('Found valid LLM key.');
  } catch (error) {
    console.error('No valid LLM key found. Exiting tests.');
    console.error(error.message || error);
    process.exit(1);
  }
})();
NODE

run_test() {
    local test_name=$1
    local test_dir="${ROOT_DIR}/tests/basictest-${test_name}"
    local temp_dir="${test_dir}/temp"

    rm -rf "${temp_dir}"
    mkdir -p "${temp_dir}"

    echo
    echo "============================================================"
    echo "Start test: ${test_name}"

    local started_at=$(date +%s%3N)
    echo "[${test_name}] workspace: ${temp_dir}"
    echo "[${test_name}] started_at_ms: ${started_at}"

    timeout --foreground 60s node "${test_dir}/${test_name}.js" "${temp_dir}" "$ROOT_DIR"
    local exit_code=$?

    if [ ${exit_code} -eq 124 ]; then
        echo "[${test_name}] status: TIMEOUT (command exceeded 60s)"
    fi

    local finished_at=$(date +%s%3N)
    local duration=$((finished_at - started_at))

    if [ ${exit_code} -ne 0 ]; then
        echo "[${test_name}] finished_at_ms: ${finished_at}"
        echo "[${test_name}] duration_ms: ${duration}"
        echo "[${test_name}] status: FAILED"
        exit ${exit_code}
    fi

    echo "[${test_name}] finished_at_ms: ${finished_at}"
    echo "[${test_name}] duration_ms: ${duration}"
    echo "[${test_name}] status: PASSED"
    echo "End test: ${test_name}"
    echo "============================================================"
}

run_test "planner"
run_test "codegen"
run_test "docgen"

echo "All tests passed!"
