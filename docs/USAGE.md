# Usage

> End-to-end walkthroughs for every `repo-inv` subcommand.

## Subcommand cheat-sheet

| Command | Purpose |
|---|---|
| `analyze <repo>` | Run 3-layer investigation, auto-index into knowledge base |
| `tools` | List all 29 wrapped analyzers + install status |
| `tool <name>` | Show details + install hint for one analyzer |
| `report [dir]` | Re-print last (or specified) report |
| `init` | Drop a config file in cwd |
| `list` | List all indexed repos (sort by recent/size/quality/complexity) |
| `search <q>` | FTS5 search over LEARNINGS + SUMMARY of every indexed repo |
| `compare <a> <b>` | Side-by-side diff of two indexed repos |
| `learn` | LLM-synthesize a learning brief from last analysis |
| `patterns <repo>` | Detect 20 architectural patterns via semgrep, index them |
| `extract <repo> <file>` | Lift a file + its 1-hop imports + dep list |
| `recommend "<task>"` | LLM picks which indexed repos/files to copy from |
| `manifest` | Machine-readable inventory of every command + path |
| `install-mcp [host]` | Register the MCP server with an agent host |

## 1 · First-time analysis

```bash
$ repo-inv analyze ~/projects/fastapi --parallel
🚀 Running 3 layers in parallel...
  → 01-arch    scc · tokei · madge · pydeps   ✓
  → 02-logic   semgrep · lizard · jscpd · vulture · bandit · mypy  ✓
  → 03-efficiency  radon · wily   ✓
📝 Summary: ~/.cache/repo-inv/fastapi-20260524-1830/SUMMARY.md
📊 Machine report: ~/.cache/repo-inv/fastapi-20260524-1830/report.json
   Indexed as #7 in ~/.cache/repo-inv/index.db
```

Flags:

- `--parallel` — run all three layers concurrently (~3× faster; logs interleave)
- `--layer arch,logic` — restrict to specific layers
- `--output <dir>` — override default `~/.cache/repo-inv/<repo>-<ts>/`

## 2 · Discover what's installed

```bash
$ repo-inv tools
🏗️ ARCH
  ✅ scc 3.5.0 — fast LOC counter
  ✅ madge 8.0.0 — JS/TS dep visualizer
  ❌ pyan3 — not installed (run: pipx install pyan3)
...
```

Per-tool detail:

```bash
$ repo-inv tool semgrep
Name:    Semgrep
Layer:   logic
Version: 1.161.0
Install: pip install semgrep   # or brew install semgrep
Example: semgrep --config=auto .
Tips:    Use --config=p/security-audit for SAST baselines.
```

## 3 · Read the report

The human view (`SUMMARY.md`) splices the most important findings into one markdown.

The machine view (`report.json`) is what agents should read:

```json
{
  "schema": "repo-inv/report@1",
  "repo": { "name": "fastapi", "path": "/home/.../fastapi", "git_sha": "abc123..." },
  "stats": { "total_loc": 28430, "files": 312, "languages": [...] },
  "layers": {
    "arch": { "scc": {...}, "madge_circular": [...] },
    "logic": { "semgrep": {...}, "lizard_top10": [...], "jscpd_pct": 1.8 },
    "efficiency": { "radon_mi_avg": 78.4, "wily_trend": [...] }
  },
  "hotspots": [ { "file": "...", "function": "...", "ccn": 42 } ],
  "indexed_at": "2026-05-24T18:30:00Z"
}
```

## 4 · Cross-repo brain

Once you've analyzed a handful of repos:

```bash
# List by quality (composite: low CCN + high MI + low dup% + few semgrep findings)
$ repo-inv list --by quality
ID  NAME       LOC      QUALITY  CCN  LANG
3   tenacity   2.1k     91       4.2  python
7   fastapi    28k      86       6.1  python
12  litestar   34k      82       7.0  python
...

# FTS5 search (OR / "phrase" / -exclude / prefix*)
$ repo-inv search "retry OR backoff" --lang python --max-ccn 30
[tenacity] tenacity/_utils.py: exponential backoff strategy ...
[fastapi]  fastapi/middleware/...

# Side-by-side
$ repo-inv compare tenacity fastapi
                          tenacity  fastapi   winner
LOC                       2,100     28,430    -
Avg CCN                   4.2       6.1       tenacity
Duplication %             0.3       1.8       tenacity
Languages                 python    python+ts -
Top hotspot CCN           18        42        tenacity
```

## 5 · Mix-and-match copy

```bash
# Tag a repo with architectural patterns (writes into patterns table)
$ repo-inv patterns ~/projects/fastapi
Detected: middleware, dependency-injection, plugin-loader, async-context-manager (×4)

# What other repos use the same pattern?
$ repo-inv search-patterns dependency-injection
fastapi, litestar, faststream

# Lift a file with its 1-hop imports
$ repo-inv extract ~/projects/fastapi fastapi/encoders.py --out ./vendor/enc --max-hops 2
Wrote 4 files + EXTRACT.json
External deps: pydantic>=2, typing-extensions
Stdlib deps: dataclasses, datetime, decimal

# Ask the LLM
$ repo-inv recommend "I need a retry+ratelimit HTTP layer for my agent"
🤖 DeepSeek:
  1. Primary: tenacity — pure-Python, exponential backoff
  2. Pattern to borrow: fastapi/Middleware
  3. Avoid hotspot: requests_cache/sqlite_backend.py (CCN 67)
  4. Action: repo-inv extract ~/projects/tenacity tenacity/_utils.py --out ./vendor
```

## 6 · Agent integration

```bash
# What can I do from my agent?
$ repo-inv manifest | jq '.commands[].name'
"analyze" "tools" "tool" "report" "init" "list" "search"
"compare" "learn" "patterns" "extract" "recommend" "manifest" "install-mcp"

# Register MCP server (writes to ~/.codex/config.toml, backs up to .bak)
$ repo-inv install-mcp codex
✓ Wrote /home/user/.codex/config.toml (backup: .bak)
```

Then in Codex / Claude Code / Cursor:

> *"Analyze the cloned repo at /tmp/some-oss, then recommend which file to copy
> for adding a plugin system."*

The agent will call `analyze_repo` → `patterns_of_repo` → `recommend` via MCP without
shelling out.

## Wrapped tools

| Layer | Tool | Language coverage |
|---|---|---|
| arch | scc, tokei | all |
| arch | pydeps, pyan3, code2flow | Python |
| arch | madge, dependency-cruiser | JS/TS |
| arch | staticcheck, golangci-lint | Go |
| arch | ast-grep, D2, Joern, CodeQL | multi (manual) |
| logic | semgrep | multi |
| logic | lizard | multi (CCN) |
| logic | jscpd | multi (duplication) |
| logic | pyright, mypy, vulture, bandit | Python |
| logic | gosec | Go |
| logic | tsc | TypeScript |
| logic | Infer | C/C++/Java/Obj-C |
| efficiency | radon, wily, py-spy, memray | Python |
| efficiency | speedscope, Pyroscope | multi (manual) |

Missing tools are silently skipped at run time. Install hints come from `repo-inv tool <name>`.
