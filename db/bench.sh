#!/usr/bin/env bash
# Owner-run only. Creates an isolated disposable container, never drops an existing database.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
exec node --experimental-strip-types db/bench.ts
