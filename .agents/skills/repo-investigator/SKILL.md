---
name: repo-investigator
description: |
  Full-stack code repository investigation toolkit. Covers architecture (folder/module level), 
  business logic (file/call-graph level), and code efficiency (function/performance level).
  Integrates 20+ open-source tools into a unified CLI for rapid open-source library analysis.
metadata:
  short-description: Investigate any codebase in 3 layers
  author: code_analysis_suite
  version: 1.0.0
---

# Repo Investigator

A three-layer investigation framework for analyzing any software repository:

1. **Architecture Layer** — folder structure, module dependencies, system design
2. **Business Logic Layer** — control flow, data flow, code quality, security
3. **Efficiency Layer** — performance hotspots, complexity, memory usage

## Quick Start

```bash
# Run full investigation on a repo
repo-investigate /path/to/repo

# Run single layer
repo-investigate --layer=arch /path/to/repo
repo-investigate --layer=logic /path/to/repo
repo-investigate --layer=efficiency /path/to/repo
```

## Prerequisites

All tools are pre-installed on this machine. If missing, run:

```bash
# Architecture tools
which d2 joern codeql ast-grep docker

# Logic tools  
which semgrep infer jscpd lizard

# Efficiency tools
which py-spy scc tokei speedscope radon memray
```

## Core Workflow

### Step 1: Architecture Overview (30 seconds)

```bash
cd /path/to/repo
scc .                    # code size & language mix
tokei .                  # line count breakdown
npx madge --circular .   # JS/TS circular deps (if applicable)
pydeps .                 # Python deps (if applicable)
```

### Step 2: Logic & Quality (2 minutes)

```bash
semgrep --config=auto .  # security & bug patterns
jscpd .                  # duplicate code detection
lizard .                 # complexity metrics
infer run -- make        # C/C++/Java/Obj-C deep analysis
```

### Step 3: Efficiency Profile (if runnable)

```bash
py-spy record -o profile.svg -- python main.py
speedscope profile.svg
memray run python main.py
memray flamegraph memray-*.bin
```

### Step 4: Deep Architecture (optional, 10 min)

```bash
# Joern CPG analysis (C/C++/Java)
joern /path/to/repo
# Then in joern shell:
#   importCode("/path/to/repo")
#   cpg.method.name.l
#   cpg.call.code.l

# CodeQL database (requires compilation for compiled languages)
codeql database create --language=java ./codeql-db --source-root=.
codeql database analyze ./codeql-db java-security-and-quality.qls --format=sarifv2.1.0 --output=results.sarif

# D2 architecture diagram
cat > arch.d2 << 'EOF'
service: {
  api: API
  db: Database
}
user -> service.api: requests
service.api -> service.db: queries
EOF
d2 arch.d2 arch.svg
```

## Tool Mapping by Language

| Language | Arch | Logic | Efficiency |
|----------|------|-------|------------|
| Python | pydeps, scc | semgrep, lizard | py-spy, memray, radon |
| JavaScript/TS | madge, depcruise, scc | semgrep, jscpd, ast-grep | speedscope (chrome profiles) |
| Java | jQAssistant, ArchUnit | CodeQL, Infer, Semgrep | async-profiler, jvisualvm |
| C/C++ | Joern, CodeQL | Infer, CodeQL, Semgrep | perf, FlameGraph, valgrind |
| Go | scc, tokei | semgrep, ast-grep | pprof, speedscope |
| Rust | scc, tokei | semgrep | flamescope, cargo-flamegraph |

## Output Artifacts

A full investigation produces:

```
investigation-report/
├── 01-arch/
│   ├── scc-report.json
│   ├── dependency-graph.svg
│   └── architecture.d2
├── 02-logic/
│   ├── semgrep-findings.sarif
│   ├── jscpd-report.json
│   ├── lizard-complexity.xml
│   └── infer-report.json
├── 03-efficiency/
│   ├── py-spy-profile.svg
│   ├── memray-flamegraph.html
│   └── radon-report.txt
└── SUMMARY.md
```

## Tips

- **Start with `scc`** — 1 second tells you language mix, scale, rough complexity
- **Use `semgrep --config=auto`** — zero-config security scan
- **`speedscope`** accepts profiles from Chrome, Firefox, Node.js, Python, Go, Java, Rust, etc.
- **`joern`** is powerful but has a learning curve; start with `joern-scan --list-query-names`
- For **quick triage**, always run: `scc + semgrep + lizard`
