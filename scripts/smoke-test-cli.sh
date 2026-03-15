#!/usr/bin/env bash
# ============================================================================
# Smoke test: CLI package (@andreadito/pq)
#
# Simulates a developer installing the CLI from GitHub Packages (or npm)
# and running through the basic workflow: init, serve, add source, query, stop.
# ============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "${YELLOW}▶${NC} $1"; }

FAILURES=0
TEST_DIR=$(mktemp -d)
PORT=3098  # non-standard port to avoid conflicts

cleanup() {
  # Stop any server we started
  cd "$TEST_DIR" 2>/dev/null && npx pq stop --force 2>/dev/null || true
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

info "Working in $TEST_DIR"
cd "$TEST_DIR"

# ── Install ─────────────────────────────────────────────────────────────────
info "Installing @andreadito/pq..."

# Try installing from npmjs.org first (no auth needed, best UX for end users)
# Fall back to GitHub Packages if not on npmjs yet (requires GITHUB_TOKEN)
npm init -y --silent >/dev/null 2>&1

# Clear any scope overrides so we hit npmjs.org
echo "registry=https://registry.npmjs.org" > .npmrc

if npm install @andreadito/pq 2>&1; then
  pass "npm install @andreadito/pq (from npmjs.org)"
else
  info "Not on npmjs.org yet, trying GitHub Packages (requires auth)..."
  echo "@andreadito:registry=https://npm.pkg.github.com" > .npmrc
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc
  fi
  if npm install @andreadito/pq 2>&1; then
    pass "npm install @andreadito/pq (from GitHub Packages)"
  else
    fail "npm install @andreadito/pq (set GITHUB_TOKEN for GH Packages auth)"
    exit 1
  fi
fi

# ── pq --help ───────────────────────────────────────────────────────────────
info "Checking pq --help..."
if npx pq --help 2>&1 | grep -qi "pipequery\|usage\|serve"; then
  pass "pq --help"
else
  fail "pq --help"
fi

# ── pq --version ────────────────────────────────────────────────────────────
info "Checking pq --version..."
VERSION=$(npx pq --version 2>&1 || true)
if [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  pass "pq --version ($VERSION)"
else
  fail "pq --version (got: $VERSION)"
fi

# ── pq init ─────────────────────────────────────────────────────────────────
info "Scaffolding project with pq init..."
if npx pq init 2>&1; then
  if [[ -f pipequery.yaml ]]; then
    pass "pq init (created pipequery.yaml)"
  else
    fail "pq init (no pipequery.yaml created)"
  fi
else
  fail "pq init"
fi

# ── pq serve ────────────────────────────────────────────────────────────────
info "Starting server on port $PORT..."
npx pq serve -p "$PORT" -d 2>&1 || true
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|404)$ ]]; then
  pass "pq serve -d (server responding, HTTP $HTTP_CODE)"
else
  fail "pq serve -d (HTTP $HTTP_CODE)"
fi

# ── pq source add ───────────────────────────────────────────────────────────
info "Adding a REST data source..."
if npx pq source add todos \
  -t rest \
  -u "https://jsonplaceholder.typicode.com/todos" \
  -i 60s 2>&1; then
  pass "pq source add todos"
else
  fail "pq source add todos"
fi

sleep 2  # let the source fetch

# ── pq source list ──────────────────────────────────────────────────────────
info "Listing sources..."
if npx pq source list 2>&1 | grep -q "todos"; then
  pass "pq source list (shows todos)"
else
  fail "pq source list"
fi

# ── pq endpoint add ────────────────────────────────────────────────────────
info "Adding an API endpoint..."
if npx pq endpoint add /api/top-todos \
  -q "todos | where(completed == true) | first(5)" 2>&1; then
  pass "pq endpoint add /api/top-todos"
else
  fail "pq endpoint add /api/top-todos"
fi

sleep 1

# ── curl the endpoint ───────────────────────────────────────────────────────
info "Querying endpoint via curl..."
RESPONSE=$(curl -s "http://localhost:$PORT/api/top-todos" 2>/dev/null)
if echo "$RESPONSE" | grep -q "title"; then
  pass "curl /api/top-todos returns data"
else
  fail "curl /api/top-todos — response: $RESPONSE"
fi

# ── pq query (ad-hoc) ──────────────────────────────────────────────────────
info "Running ad-hoc query..."
if npx pq query "todos | count()" -f json 2>&1 | grep -qE "[0-9]"; then
  pass "pq query (ad-hoc)"
else
  fail "pq query (ad-hoc)"
fi

# ── pq stop ─────────────────────────────────────────────────────────────────
info "Stopping server..."
if npx pq stop 2>&1; then
  pass "pq stop"
else
  fail "pq stop"
fi

sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "000" || "$HTTP_CODE" == "000000" ]]; then
  pass "Server stopped (connection refused)"
else
  fail "Server still running after stop (HTTP $HTTP_CODE)"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${GREEN}All CLI smoke tests passed!${NC}"
else
  echo -e "${RED}$FAILURES test(s) failed.${NC}"
fi
exit $FAILURES
