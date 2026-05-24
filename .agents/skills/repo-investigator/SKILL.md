---
name: repo-investigator
description: |
  Full-stack open-source repository investigation toolkit. Run as `node /home/l/code_analysis_suite/bin/repo-inv <cmd>`.
  Three-layer analysis (architecture / business logic / quality) + cross-repo SQLite knowledge base
  + architectural pattern detection + code extraction + AI-powered "mix-and-match copy-from-OSS"
  recommendations. Wraps 29 best-in-class static analysis tools (semgrep / lizard / pyright / mypy /
  bandit / gosec / vulture / jscpd / scc / madge / pydeps / radon / wily / py-spy / memray / ...).
metadata:
  short-description: Analyze any cloned repo across 3 layers, index it, then mix-and-match-copy
  author: code_analysis_suite
  version: 2.0.0
  cli-prefix: node /home/l/code_analysis_suite/bin/repo-inv
---

# Repo Investigator

When the user clones an open-source project and wants to **learn from / borrow / port code out of it**,
this is the toolkit. It does three things in one CLI:

1. **Per-repo investigation** — 3 layers (arch / logic / efficiency) → `report.json` + `SUMMARY.md` + `LEARNINGS.md`
2. **Cross-repo knowledge base** — every analyzed repo is auto-indexed into `~/.cache/repo-inv/index.db` (SQLite + FTS5)
3. **Mix-and-match copy** — detect patterns, extract code with deps, and ask DeepSeek which repo's solution to borrow for a given task

## Default Workflow (use this verbatim when a user gives you a cloned repo)

```bash
CLI=node /home/l/code_analysis_suite/bin/repo-inv

# 0. Confirm tool inventory (skip-if-missing is automatic — never errors)
$CLI tools

# 1. Full investigation — parallel runs ~3x faster, auto-indexes into knowledge base
$CLI analyze /path/to/cloned/repo --parallel

# 2. Read the agent-facing report
cat ~/.cache/repo-inv/<repo-name>-<ts>/report.json   # structured (use this first!)
cat ~/.cache/repo-inv/<repo-name>-<ts>/SUMMARY.md    # human-readable

# 3. Get a synthesized learning brief (uses DeepSeek via .env)
$CLI learn

# 4. Tag the repo with architectural patterns (writes into the index too)
$CLI patterns /path/to/cloned/repo

# 5. When the user asks "how would I do X?", consult the cross-repo brain:
$CLI list --by quality                    # what's in the library
$CLI search "retry OR backoff"            # FTS5 over learnings + summaries
$CLI compare repo-a repo-b                # side-by-side diff
$CLI recommend "build feature X"          # DeepSeek picks best repos to copy from
$CLI extract /path/repo file.py --out ./vendor/x   # transplant code with imports
```

## Subcommand Reference

| Command | Purpose | When to use |
|---|---|---|
| `analyze <repo> [--parallel] [--layer arch,logic,efficiency]` | Run 3-layer scan, write report.json + SUMMARY.md, auto-index | **Always first** on a new repo |
| `tools [--layer X]` | List 29 tools with install status | Diagnose missing dependencies |
| `tool <name>` | Show install hint + sample command for one tool | Onboarding a new analyzer |
| `report [dir]` | Print SUMMARY.md (defaults to latest run) | Quick re-read |
| `learn [dir]` | DeepSeek synthesis → LEARNINGS.md (architecture / business core / quality / borrowable / risks) | After analyze, before recommend |
| `patterns <repo>` | Detect 20 architectural patterns via curated semgrep rules; persist to DB | Before `recommend`, or to characterize a repo |
| `list [--by recent\|size\|quality\|complexity]` | Tabular view of indexed repos | "What have I scanned?" |
| `search <fts5-query> [--lang X] [--max-ccn N]` | Full-text search over LEARNINGS + SUMMARY with snippets | "Which repo solves Y?" |
| `compare <repoA> <repoB>` | Metrics + language + hotspot diff, marks A/B winner per metric | Choosing between similar libs |
| `extract <repo> <file> --out <dir> [--max-hops N]` | Copy file + intra-repo Python imports; emit EXTRACT.json with pip/stdlib split | "I want to port this one function" |
| `recommend <task...>` | DeepSeek over full catalog → which repo / file / pattern to copy, what to avoid | "How should I build X?" |
| `init` | Drop a `.repo-inv.json` config in cwd | Per-project tweaks |

## What Goes Into the Knowledge Base

Every `analyze` auto-upserts into `~/.cache/repo-inv/index.db`:

- **repos** — name, commit, language, LOC, complexity, semgrep ERROR / bandit HIGH / pyright errors / mypy errors / vulture / jscpd %, max CCN, full report.json blob, LEARNINGS.md text
- **languages** — per-language breakdown (files / code / complexity)
- **hotspots** — top-20 functions with CCN ≥ 15 (location / ccn / nloc)
- **patterns** (after `patterns` cmd) — detected pattern × hits + sample location
- **repo_fts** — FTS5 over name / primary_lang / learnings / summary (snippets work)

## Pattern Vocabulary (rules/patterns.yml)

20 hand-tuned semgrep rules organized by category:

- **resilience**: retry, circuit_breaker, rate_limit
- **async**: async_context, fanout (asyncio.gather)
- **lifecycle**: context_manager
- **perf**: cache (lru_cache / cached_property)
- **extensibility**: plugin_registry, subclass_registry
- **di**: depends_injection (FastAPI Depends)
- **typing**: interface (Protocol / ABC / @abstractmethod)
- **data**: pydantic, dataclass
- **arch**: middleware, state_machine, events, singleton, builder
- **testing**: pytest_fixture, hypothesis

Add custom rules: edit `/home/l/code_analysis_suite/rules/patterns.yml` (standard semgrep syntax),
or pass `--rules <other.yml>` to override.

## report.json Schema (`repo-inv/report@1`)

Agent-friendly aggregator. Key fields:

```json
{
  "repo": { "name": "...", "path": "/abs/path" },
  "generated_at": "ISO",
  "arch": {
    "languages": [{ "name": "Python", "files": N, "code": N, "complexity": N }],
    "git": { ... },
    "has_pydeps_svg": true,
    "has_callgraph": true
  },
  "logic": {
    "semgrep":  { "total": N, "by_severity": { "ERROR": N, "WARNING": N, "INFO": N } },
    "pyright":  { "errors": N, "warnings": N, "informations": N },
    "bandit":   { "total": N, "by_severity": { "HIGH": N, "MEDIUM": N, "LOW": N } },
    "gosec":    { "total": N, "by_severity": { ... } },
    "mypy":     { "errors": N },
    "vulture":  { "candidates": N },
    "jscpd":    { "duplication_pct": N, "clones": N },
    "lizard":   { "hotspots_ccn_ge_15": [{ "nloc": N, "ccn": N, "location": "..." }] }
  },
  "efficiency": { "radon": { "grade": "A-F", "avg_cc": N } },
  "artifacts": { "arch": [...], "logic": [...], "efficiency": [...] }
}
```

## Hard Rules for Agents

- **Always run via the suite CLI**, never manually invoke the wrapped tools (you'll miss the indexing).
- **Use `--parallel`** unless logs need to be readable in real time.
- **Read `report.json` first**, only fall back to per-tool raw outputs when you need detail.
- **Skip-if-missing is the default** — a missing tool prints a `⚠️` and continues; never abort.
- **DeepSeek key lives in** `/home/l/code_analysis_suite/.env` (gitignored). Don't ask the user to re-paste it.
- **For "how should I implement X?" questions**, prefer `recommend` over reading every repo by hand.
- **For "port this function" questions**, use `extract` to get a self-contained slice.

## When NOT to use this skill

- Live debugging of a running service → use the runtime trio (shell + LSP + tail logs) instead.
- Editing the user's own code → use the language-specific batch-check CLIs (tsc / gopls / pyright / shellcheck).
- Reading docs of a published library → just `pip show` / `npm view` / web search.

This skill shines on **cloned OSS repos that need to be reverse-engineered**, not on freshly written code.
