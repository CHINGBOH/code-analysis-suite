#!/bin/bash
#
# analyze.sh — thin shim over the Node CLI (bin/repo-inv).
#
# Historical context: this script used to be a parallel implementation of the
# three-layer investigation pipeline. That created a "two sources of truth"
# problem (analyze.sh drifted behind lib/runner.js whenever new tools were
# added). It is now a wrapper so `lib/runner.js` is the single source of truth.
#
# Usage (compat with old flags):
#   analyze.sh <repo>
#   analyze.sh --layer=arch,logic <repo>
#   analyze.sh --output=./out <repo>
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CLI="$SUITE_ROOT/bin/repo-inv"

if ! command -v node &>/dev/null; then
    echo "Error: node is required (the bash runner is deprecated; lib/runner.js is the source of truth)." >&2
    exit 1
fi

if [[ ! -x "$CLI" && ! -f "$CLI" ]]; then
    echo "Error: cannot find Node CLI at $CLI" >&2
    exit 1
fi

REPO=""
LAYER=""
OUTPUT=""

for arg in "$@"; do
    case "$arg" in
        --layer=*)  LAYER="${arg#*=}" ;;
        --output=*) OUTPUT="${arg#*=}" ;;
        --skip-deps) ;;  # legacy no-op
        -h|--help)
            cat <<'EOF'
Usage: analyze.sh [--layer=arch,logic,efficiency] [--output=DIR] <repo>

This is a compatibility shim. The real engine is `node bin/repo-inv analyze`.
Prefer calling the Node CLI directly:

  node /path/to/code_analysis_suite/bin/repo-inv analyze <repo>
EOF
            exit 0
            ;;
        -*)
            echo "Unknown option: $arg" >&2; exit 1 ;;
        *)
            REPO="$arg" ;;
    esac
done

if [[ -z "$REPO" ]]; then
    echo "Error: no repository path provided." >&2
    exit 1
fi

CMD=(node "$CLI" analyze "$REPO")
[[ -n "$LAYER"  ]] && CMD+=(--layer  "$LAYER")
[[ -n "$OUTPUT" ]] && CMD+=(--output "$OUTPUT")

exec "${CMD[@]}"
