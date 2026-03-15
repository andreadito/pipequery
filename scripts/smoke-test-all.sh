#!/usr/bin/env bash
# ============================================================================
# Run all smoke tests: Docker, CLI, and Engine
#
# Usage:
#   ./scripts/smoke-test-all.sh          # run all
#   ./scripts/smoke-test-all.sh docker   # run only docker
#   ./scripts/smoke-test-all.sh cli      # run only cli
#   ./scripts/smoke-test-all.sh engine   # run only engine
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

FILTER="${1:-all}"
TOTAL_FAILURES=0

run_suite() {
  local name="$1"
  local script="$2"

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $name${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if bash "$script"; then
    echo ""
    echo -e "  ${GREEN}Suite passed${NC}: $name"
  else
    local exit_code=$?
    echo ""
    echo -e "  ${RED}Suite failed${NC}: $name ($exit_code failure(s))"
    TOTAL_FAILURES=$((TOTAL_FAILURES + exit_code))
  fi
}

if [[ "$FILTER" == "all" || "$FILTER" == "docker" ]]; then
  run_suite "Docker Image (ghcr.io/andreadito/pipequery)" "$SCRIPT_DIR/smoke-test-docker.sh"
fi

if [[ "$FILTER" == "all" || "$FILTER" == "cli" ]]; then
  run_suite "CLI Package (@andreadito/pq)" "$SCRIPT_DIR/smoke-test-cli.sh"
fi

if [[ "$FILTER" == "all" || "$FILTER" == "engine" ]]; then
  run_suite "Engine Library (@andreadito/pipequery-lang)" "$SCRIPT_DIR/smoke-test-engine.sh"
fi

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [[ $TOTAL_FAILURES -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}ALL SMOKE TESTS PASSED${NC}"
else
  echo -e "  ${RED}${BOLD}$TOTAL_FAILURES TOTAL FAILURE(S)${NC}"
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
exit $TOTAL_FAILURES
