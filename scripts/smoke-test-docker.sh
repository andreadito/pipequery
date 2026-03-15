#!/usr/bin/env bash
# ============================================================================
# Smoke test: Docker image (ghcr.io/andreadito/pipequery)
#
# Simulates a developer who discovers pipequery and wants to run the server
# via Docker, then interact with it using curl.
# ============================================================================
set -euo pipefail

IMAGE="ghcr.io/andreadito/pipequery:latest"
CONTAINER_NAME="pq-smoke-test"
PORT=3099  # non-standard port to avoid conflicts

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "${YELLOW}▶${NC} $1"; }

FAILURES=0

cleanup() {
  docker rm -f "$CONTAINER_NAME" &>/dev/null || true
}
trap cleanup EXIT

# ── Pull image ──────────────────────────────────────────────────────────────
info "Pulling Docker image..."
if docker pull "$IMAGE" 2>&1; then
  pass "docker pull $IMAGE"
else
  fail "docker pull $IMAGE"
  exit 1
fi

# ── Start container ─────────────────────────────────────────────────────────
info "Starting container on port $PORT..."
cleanup
docker run -d --name "$CONTAINER_NAME" -p "$PORT:3000" "$IMAGE"
sleep 3  # give the server time to boot

# Check the container is running
if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
  pass "Container is running"
else
  fail "Container is not running"
  echo "Container logs:"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20
  exit 1
fi

# ── Test: pq --help works inside container ──────────────────────────────────
info "Checking pq --help inside container..."
if docker exec "$CONTAINER_NAME" pq --help &>/dev/null; then
  pass "pq --help"
else
  fail "pq --help"
fi

# ── Test: Server is responding ──────────────────────────────────────────────
info "Checking server health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|404)$ ]]; then
  pass "Server is responding (HTTP $HTTP_CODE)"
else
  fail "Server not responding (HTTP $HTTP_CODE)"
  echo "Container logs:"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20
fi

# ── Test: Add a source at runtime ───────────────────────────────────────────
info "Adding a data source via CLI inside container..."
if docker exec "$CONTAINER_NAME" pq source add testapi \
  -t rest \
  -u "https://jsonplaceholder.typicode.com/todos" \
  -i 60s 2>&1; then
  pass "pq source add"
else
  fail "pq source add"
fi

# ── Test: List sources ──────────────────────────────────────────────────────
info "Listing sources..."
if docker exec "$CONTAINER_NAME" pq source list 2>&1 | grep -q "testapi"; then
  pass "pq source list (shows testapi)"
else
  fail "pq source list"
fi

sleep 2  # let the source fetch data

# ── Test: Add an endpoint ───────────────────────────────────────────────────
info "Adding an API endpoint..."
if docker exec "$CONTAINER_NAME" pq endpoint add /api/todos \
  -q "testapi | first(3)" 2>&1; then
  pass "pq endpoint add /api/todos"
else
  fail "pq endpoint add /api/todos"
fi

# ── Test: Query the endpoint via curl ───────────────────────────────────────
info "Querying endpoint via curl..."
sleep 1
RESPONSE=$(curl -s "http://localhost:$PORT/api/todos" 2>/dev/null)
if echo "$RESPONSE" | grep -q "title"; then
  pass "curl /api/todos returns data"
else
  fail "curl /api/todos — response: $RESPONSE"
fi

# ── Test: Ad-hoc query ──────────────────────────────────────────────────────
info "Running ad-hoc query..."
if docker exec "$CONTAINER_NAME" pq query "testapi | count()" -f json 2>&1 | grep -qE "[0-9]"; then
  pass "pq query (ad-hoc)"
else
  fail "pq query (ad-hoc)"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${GREEN}All Docker smoke tests passed!${NC}"
else
  echo -e "${RED}$FAILURES test(s) failed.${NC}"
fi
exit $FAILURES
