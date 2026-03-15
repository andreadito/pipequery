#!/usr/bin/env bash
# ============================================================================
# Smoke test: Engine library (@andreadito/pipequery-lang)
#
# Simulates a developer who wants to embed the PipeQuery engine in their
# own Node.js application — install the package, import it, run queries
# against in-memory data.
#
# NOTE: The engine is on GitHub Packages. If it's still private, you need
#       to make it public first:
#       https://github.com/andreadito/pipequery/packages → pipequery-lang
#       → Package settings → Change visibility → Public
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

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

info "Working in $TEST_DIR"
cd "$TEST_DIR"

# ── Install ─────────────────────────────────────────────────────────────────
info "Installing @andreadito/pipequery-lang..."

npm init -y --silent >/dev/null 2>&1
# Engine is on GitHub Packages (requires auth even for public packages)
echo "@andreadito:registry=https://npm.pkg.github.com" > .npmrc
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc
fi

# Set package.json to ESM
node -e "
const pkg = require('./package.json');
pkg.type = 'module';
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

if npm install @andreadito/pipequery-lang 2>&1; then
  pass "npm install @andreadito/pipequery-lang"
else
  fail "npm install @andreadito/pipequery-lang"
  echo ""
  echo -e "${YELLOW}If install failed with 404/403, the package may be private.${NC}"
  echo "Make it public at: https://github.com/andreadito/pipequery/packages"
  exit 1
fi

# ── Test: Import the module ─────────────────────────────────────────────────
info "Testing ESM import..."
cat > test-import.mjs << 'SCRIPT'
const mod = await import("@andreadito/pipequery-lang");
const keys = Object.keys(mod);
if (keys.length === 0) {
  console.error("Module exported nothing");
  process.exit(1);
}
console.log("Exports:", keys.join(", "));
SCRIPT

if node test-import.mjs 2>&1; then
  pass "ESM import works"
else
  fail "ESM import"
fi

# ── Test: Parse a query ─────────────────────────────────────────────────────
info "Testing query parsing (parseQuery)..."
cat > test-parse.mjs << 'SCRIPT'
import { parseQuery } from "@andreadito/pipequery-lang";

try {
  const ast = parseQuery("data | where(price > 100) | sort(price desc) | first(5)");
  if (ast) {
    console.log("Parsed successfully, AST type:", typeof ast);
    process.exit(0);
  } else {
    console.error("parseQuery() returned falsy");
    process.exit(1);
  }
} catch (e) {
  console.error("parseQuery failed:", e.message);
  process.exit(1);
}
SCRIPT

if node test-parse.mjs 2>&1; then
  pass "Query parsing (parseQuery)"
else
  fail "Query parsing (parseQuery)"
fi

# ── Test: Execute a query against data ──────────────────────────────────────
info "Testing query execution against in-memory data..."
cat > test-execute.mjs << 'SCRIPT'
import { query } from "@andreadito/pipequery-lang";

// Sample dataset
const data = [
  { name: "Alice", age: 30, city: "NYC" },
  { name: "Bob", age: 25, city: "LA" },
  { name: "Charlie", age: 35, city: "NYC" },
  { name: "Diana", age: 28, city: "Chicago" },
  { name: "Eve", age: 32, city: "NYC" },
];

// query(data, expression) — data first, then pipe-style expression
const result = query(data, "where(age > 28) | sort(age desc)");
console.log("Result:", JSON.stringify(result, null, 2));

if (Array.isArray(result) && result.length > 0 && result[0].name === "Charlie") {
  console.log("Query returned correct results");
  process.exit(0);
} else {
  console.error("Unexpected result");
  process.exit(1);
}
SCRIPT

if node test-execute.mjs 2>&1; then
  pass "Query execution"
else
  fail "Query execution"
fi

# ── Test: CJS require (if dual-published) ──────────────────────────────────
info "Testing CommonJS require..."
cat > test-cjs.cjs << 'SCRIPT'
try {
  const pq = require("@andreadito/pipequery-lang");
  const keys = Object.keys(pq);
  console.log("CJS exports:", keys.join(", "));
  if (keys.length > 0) {
    process.exit(0);
  } else {
    console.error("CJS module exported nothing");
    process.exit(1);
  }
} catch (e) {
  console.error("CJS require failed:", e.message);
  process.exit(1);
}
SCRIPT

if node test-cjs.cjs 2>&1; then
  pass "CommonJS require works"
else
  fail "CommonJS require"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${GREEN}All engine smoke tests passed!${NC}"
else
  echo -e "${RED}$FAILURES test(s) failed.${NC}"
fi
exit $FAILURES
