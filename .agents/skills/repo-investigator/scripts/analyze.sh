#!/bin/bash
#
# repo-investigate — Unified CLI for three-layer code repository investigation
#
# Usage:
#   repo-investigate /path/to/repo
#   repo-investigate --layer=arch /path/to/repo
#   repo-investigate --layer=logic /path/to/repo
#   repo-investigate --layer=efficiency /path/to/repo
#   repo-investigate --output=./report /path/to/repo
#

set -euo pipefail

REPO=""
LAYER="all"
OUTPUT_DIR="./investigation-report"
SKIP_DEPS=false

usage() {
    cat << 'EOF'
Usage: repo-investigate [OPTIONS] <repo-path>

Options:
  --layer=LAYERS    Comma-separated: arch,logic,efficiency (default: all)
  --output=DIR      Output directory (default: ./investigation-report)
  --skip-deps       Skip dependency checks
  -h, --help        Show this help

Examples:
  repo-investigate ~/projects/myapp
  repo-investigate --layer=arch,logic ~/projects/myapp
  repo-investigate --output=./reports ~/projects/myapp
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --layer=*)
                LAYER="${1#*=}"
                shift
                ;;
            --output=*)
                OUTPUT_DIR="${1#*=}"
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                echo "Unknown option: $1" >&2
                usage
                exit 1
                ;;
            *)
                REPO="$1"
                shift
                ;;
        esac
    done
}

check_tool() {
    if ! command -v "$1" &>/dev/null; then
        echo "  ⚠️  $1 not found, skipping..." >&2
        return 1
    fi
    return 0
}

detect_languages() {
    local repo="$1"
    echo "📊 Detecting languages..."
    if command -v scc &>/dev/null; then
        scc "$repo" --format json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
langs = [d['Name'] for d in data if d['Name'] != 'Total']
print('Languages found: ' + ', '.join(langs[:8]))
" || true
    fi
}

run_architecture() {
    local repo="$1"
    local out="$2"
    echo ""
    echo "🏗️  === ARCHITECTURE LAYER ==="
    mkdir -p "$out/01-arch"

    if check_tool scc; then
        echo "  → scc (code statistics)"
        scc "$repo" --format json > "$out/01-arch/scc-report.json" 2>/dev/null || true
        scc "$repo" > "$out/01-arch/scc-report.txt" 2>/dev/null || true
    fi

    if check_tool tokei; then
        echo "  → tokei (line counts)"
        tokei "$repo" --output json > "$out/01-arch/tokei-report.json" 2>/dev/null || true
    fi

    # Python dependencies
    if [[ -f "$repo/setup.py" || -f "$repo/pyproject.toml" || -d "$repo/requirements" ]]; then
        if check_tool pydeps; then
            echo "  → pydeps (Python module graph)"
            (cd "$repo" && pydeps --max-bacon=2 -o "$out/01-arch/pydeps.svg" .) 2>/dev/null || true
        fi
    fi

    # JS/TS dependencies
    if [[ -f "$repo/package.json" ]]; then
        if check_tool depcruise; then
            echo "  → dependency-cruiser (JS/TS deps)"
            (cd "$repo" && npx depcruise --output-type dot . 2>/dev/null | dot -Tsvg > "$out/01-arch/depcruise.svg") 2>/dev/null || true
        fi
        if check_tool madge; then
            echo "  → madge (JS/TS circular deps)"
            (cd "$repo" && npx madge --circular . > "$out/01-arch/madge-circular.txt" 2>/dev/null) || true
        fi
    fi

    # Git analysis
    if [[ -d "$repo/.git" ]]; then
        if check_tool git; then
            echo "  → git log analysis"
            (cd "$repo" && git log --format='%an' | sort | uniq -c | sort -rn | head -10) > "$out/01-arch/git-contributors.txt" 2>/dev/null || true
        fi
    fi

    echo "  ✅ Architecture layer done"
}

run_logic() {
    local repo="$1"
    local out="$2"
    echo ""
    echo "🧠 === BUSINESS LOGIC LAYER ==="
    mkdir -p "$out/02-logic"

    if check_tool semgrep; then
        echo "  → semgrep (security & bug patterns)"
        semgrep --config=auto "$repo" --json --output="$out/02-logic/semgrep-report.json" 2>/dev/null || true
        semgrep --config=auto "$repo" --error --quiet 2>/dev/null || true
    fi

    if check_tool jscpd; then
        echo "  → jscpd (duplicate code)"
        jscpd "$repo" --reporters json,html --output "$out/02-logic/jscpd" 2>/dev/null || true
    fi

    if check_tool lizard; then
        echo "  → lizard (complexity metrics)"
        lizard "$repo" > "$out/02-logic/lizard-report.txt" 2>/dev/null || true
        lizard "$repo" --xml > "$out/02-logic/lizard-report.xml" 2>/dev/null || true
    fi

    if check_tool infer; then
        echo "  → infer (deep static analysis for C/C++/Java/Obj-C)"
        # Only run if Makefile or build system detected
        if [[ -f "$repo/Makefile" || -f "$repo/CMakeLists.txt" || -f "$repo/build.gradle" || -f "$repo/pom.xml" ]]; then
            (cd "$repo" && infer run -- make -j$(nproc) 2>/dev/null && cp -r infer-out "$out/02-logic/infer-out" 2>/dev/null) || true
        fi
    fi

    if check_tool ast-grep; then
        echo "  → ast-grep scan"
        (cd "$repo" && ast-grep scan --json 2>/dev/null) > "$out/02-logic/ast-grep-report.json" || true
    fi

    echo "  ✅ Business logic layer done"
}

run_efficiency() {
    local repo="$1"
    local out="$2"
    echo ""
    echo "⚡ === EFFICIENCY LAYER ==="
    mkdir -p "$out/03-efficiency"

    if check_tool radon; then
        echo "  → radon (Python complexity)"
        radon cc "$repo" -a -nc > "$out/03-efficiency/radon-cc.txt" 2>/dev/null || true
        radon mi "$repo" > "$out/03-efficiency/radon-mi.txt" 2>/dev/null || true
    fi

    if check_tool wily; then
        echo "  → wily (complexity history)"
        wily report "$repo" > "$out/03-efficiency/wily-report.txt" 2>/dev/null || true
    fi

    # Only profile if we can detect an entry point
    local entry=""
    if [[ -f "$repo/main.py" ]]; then
        entry="$repo/main.py"
    elif [[ -f "$repo/app.py" ]]; then
        entry="$repo/app.py"
    elif [[ -f "$repo/manage.py" ]]; then
        entry="$repo/manage.py"
    fi

    if [[ -n "$entry" && -x "$entry" ]]; then
        if check_tool py-spy; then
            echo "  → py-spy profile (sampling, 5 seconds)"
            timeout 6 py-spy record -d 5 -o "$out/03-efficiency/py-spy-profile.svg" -- python "$entry" 2>/dev/null || true
        fi

        if check_tool memray; then
            echo "  → memray (memory profile)"
            memray run -o "$out/03-efficiency/memray.bin" -- python "$entry" 2>/dev/null || true
            if [[ -f "$out/03-efficiency/memray.bin" ]]; then
                memray flamegraph "$out/03-efficiency/memray.bin" -o "$out/03-efficiency/memray-flamegraph.html" 2>/dev/null || true
            fi
        fi
    else
        echo "  ⏭️  No Python entry point detected, skipping runtime profiling"
    fi

    echo "  ✅ Efficiency layer done"
}

generate_summary() {
    local repo="$1"
    local out="$2"
    echo ""
    echo "📝 Generating SUMMARY.md..."

    cat > "$out/SUMMARY.md" << EOF
# Investigation Report: $(basename "$repo")

**Date:** $(date -Iseconds)
**Path:** $repo
**Layers:** $LAYER

## 1. Architecture Overview

EOF

    if [[ -f "$out/01-arch/scc-report.txt" ]]; then
        echo '```' >> "$out/SUMMARY.md"
        head -30 "$out/01-arch/scc-report.txt" >> "$out/SUMMARY.md"
        echo '```' >> "$out/SUMMARY.md"
    fi

    cat >> "$out/SUMMARY.md" << 'EOF'

## 2. Logic & Quality Findings

EOF

    if [[ -f "$out/02-logic/lizard-report.txt" ]]; then
        echo '```' >> "$out/SUMMARY.md"
        head -20 "$out/02-logic/lizard-report.txt" >> "$out/SUMMARY.md"
        echo '```' >> "$out/SUMMARY.md"
    fi

    cat >> "$out/SUMMARY.md" << 'EOF'

## 3. Efficiency Notes

EOF

    if [[ -f "$out/03-efficiency/radon-cc.txt" ]]; then
        echo '```' >> "$out/SUMMARY.md"
        head -20 "$out/03-efficiency/radon-cc.txt" >> "$out/SUMMARY.md"
        echo '```' >> "$out/SUMMARY.md"
    fi

    cat >> "$out/SUMMARY.md" << 'EOF'

## Artifacts

| Layer | Files |
|-------|-------|
| Architecture | \`01-arch/\` |
| Logic | \`02-logic/\` |
| Efficiency | \`03-efficiency/\` |
EOF

    echo "  ✅ Summary written to $out/SUMMARY.md"
}

main() {
    parse_args "$@"

    if [[ -z "$REPO" ]]; then
        echo "Error: No repository path provided." >&2
        usage
        exit 1
    fi

    if [[ ! -d "$REPO" ]]; then
        echo "Error: $REPO is not a directory." >&2
        exit 1
    fi

    REPO="$(cd "$REPO" && pwd)"
    OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"

    echo "🔍 Repo Investigator"
    echo "   Target: $REPO"
    echo "   Output: $OUTPUT_DIR"
    echo "   Layers: $LAYER"

    detect_languages "$REPO"

    if [[ "$LAYER" == "all" || "$LAYER" == *"arch"* ]]; then
        run_architecture "$REPO" "$OUTPUT_DIR"
    fi

    if [[ "$LAYER" == "all" || "$LAYER" == *"logic"* ]]; then
        run_logic "$REPO" "$OUTPUT_DIR"
    fi

    if [[ "$LAYER" == "all" || "$LAYER" == *"efficiency"* ]]; then
        run_efficiency "$REPO" "$OUTPUT_DIR"
    fi

    generate_summary "$REPO" "$OUTPUT_DIR"

    echo ""
    echo "✅ Investigation complete. Report: $OUTPUT_DIR/SUMMARY.md"
}

main "$@"
