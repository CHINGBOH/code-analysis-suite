# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🟢 Standing iteration mandate (applies to EVERY invocation in this repo)

`docs/AI_DEV_STANDARD.md` is the **living core** of this repo — the scoreboard
this codebase exists to maintain. In addition to whatever the user asked, every
AI invoked inside `code_analysis_suite/` MUST, before declaring done:

1. **Read at least one section** of `docs/AI_DEV_STANDARD.md`.
2. **Pick one row** that is *either* an open citation in §8.1 (rule missing a Tier 0–5 basis), *or* an open gap in §8.2 (`[gap]` rules from §3 awaiting toolkit support).
3. **Close it or propose it**:
   - **Close** → commit an inline edit adding the real citation (Linux kernel / Intel SDM / CPython / Tier-3 OSS / engineering canon / empirical `repo-inv` percentile) or implementing the toolkit gap; flip the §8 row to `closed-<sha>`.
   - **Propose** → append a new one-line row to §8 with the suggested basis from the §0.4(a) tier table.

The standard sharpens monotonically only if every visit contributes. Skipping
this counts as the very anti-pattern the doc forbids (§0.2 rule #5).

When the user's primary task is small and doesn't naturally touch the standard,
**still pick a row** — even a one-line citation upgrade is a valid contribution.

## 参考文档

- [Claude Code 完整使用指引](./CLAUDE_CODE_GUIDE.md) — 所有 `/` 命令、CLI 标志、快捷键及本仓库专属技能
- [AI Development Standard](./docs/AI_DEV_STANDARD.md) — the living yardstick (see iteration mandate above)

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## Commands

```bash
# Install dependencies
npm install

# ── Analysis ──────────────────────────────────────────────────────────
node bin/repo-inv analyze /path/to/repo               # all 4 layers → ~/.cache/repo-inv/<repo>-<ts>/
node bin/repo-inv analyze /path/to/repo -l anatomy,arch,logic # subset of layers
node bin/repo-inv analyze /path/to/repo -o <outdir>   # custom output dir
node bin/repo-inv analyze /path/to/repo --parallel    # ~3x faster (layers run concurrently)
node bin/repo-inv analyze /path/to/repo --profile rag_agent  # architecture profile

# ── Anatomy-first workflow ─────────────────────────────────────────────
node bin/repo-inv dissect /path/to/repo               # entrypoints, deployable units, interfaces, flows
node bin/repo-inv standard                            # print the entrypoint-first architecture standard
node bin/repo-inv standard --profile rag_agent -o standard.md  # write profile to file

# ── Knowledge base (SQLite index at ~/.cache/repo-inv/index.db) ───────
node bin/repo-inv list                  # all indexed repos (sort: recent/size/quality/complexity)
node bin/repo-inv list --by complexity
node bin/repo-inv search "retry OR backoff"           # FTS5 over LEARNINGS.md + SUMMARY.md
node bin/repo-inv search "cache" --lang Python --max-ccn 20
node bin/repo-inv compare <repoA> <repoB>             # side-by-side metrics diff

# ── Learning workflow ─────────────────────────────────────────────────
node bin/repo-inv borrow "retry backoff"              # find borrowable wheels in indexed repos
node bin/repo-inv borrow "DI container" --limit 3 -o borrow.md
node bin/repo-inv review <repoOrReport>               # audit own project vs. architecture standard
node bin/repo-inv audit  <repoOrReport>               # alias for review
node bin/repo-inv review <repo> --against <excellent-repo> --profile rag_agent

# ── AI features (require DEEPSEEK_API_KEY in .env) ────────────────────
node bin/repo-inv learn [outdir]        # synthesize LEARNINGS.md from latest report
node bin/repo-inv recommend "<task>"    # DeepSeek recommends which indexed repo to copy from

# ── Targeted scans ────────────────────────────────────────────────────
node bin/repo-inv patterns /path/to/repo              # detect arch patterns (retry, DI, cache, …)
node bin/repo-inv extract /path/to/repo src/foo.py --out ./extracted   # copy file + 1-hop imports

# ── Toolchain & MCP ───────────────────────────────────────────────────
node bin/repo-inv tools [-l arch]       # list tools and detect which are installed
node bin/repo-inv tool semgrep          # detail + install tips for one tool
node bin/repo-inv report [outdir]       # print SUMMARY.md of latest (or specified) run
node bin/repo-inv init                  # write .repo-inv.json config
node bin/repo-inv manifest              # machine-readable JSON of every subcommand
node bin/repo-inv install-mcp [host]    # register MCP server (cursor/claude-code/codex/…)
node bin/repo-inv install-mcp --all     # install to every detected host

# ── Bash alternative (same 3-layer model, same output layout) ─────────
bash .agents/skills/repo-investigator/scripts/analyze.sh /path/to/repo
bash .agents/skills/repo-investigator/scripts/analyze.sh --layer=arch /path/to/repo
```

There is no test/lint script (`npm test` is a stub). Quick triage: `scc . && semgrep --config=auto . && lizard .`

## Architecture

This suite wraps 20+ external static analysis tools into a unified Node.js CLI (`repo-inv`) and a companion bash script. There are **no tests** — the value is in the underlying tools, not the wrapper logic.

### Four-Layer Analysis Model

Every `analyze` run writes to numbered subdirs, produces `report.json` + `SUMMARY.md`, and auto-indexes the result into SQLite:

| Layer | Dir | Purpose | Key tools / modules |
|-------|-----|---------|-----------|
| Anatomy | `00-anatomy/` | Entrypoints, deployable units, HTTP interfaces, business flows | `lib/anatomy.js` (pure JS, no external tools) |
| Architecture | `01-arch/` | Module structure, language stats, dependency graphs | scc, tokei, pydeps, madge, depcruise |
| Logic | `02-logic/` | Security patterns, duplicate code, cyclomatic complexity | semgrep, jscpd, lizard, infer, ast-grep |
| Efficiency | `03-efficiency/` | Runtime performance, memory usage, complexity trends | py-spy, memray, radon, wily |

The `anatomy` layer is always fast (no external tools) and runs first; use `dissect` to run it in isolation.

### Source Files

- `bin/repo-inv` — Node.js CLI entry point (commander). Subcommands: `analyze`, `dissect`, `standard`, `tools`, `tool`, `report`, `init`, `learn`, `list`, `search`, `compare`, `borrow`, `review`, `audit`, `patterns`, `extract`, `recommend`, `manifest`, `install-mcp`.
- `lib/tools.js` — Static registry of all supported tools (`TOOLS` object). Each entry has: `layer`, `name`, `desc`, `check` (shell command to detect version), `versionRegex`, `cmd` (example command), `tips`.
- `lib/runner.js` — Async execution engine. `runAnatomy`, `runArchitecture`, `runLogic`, `runEfficiency` each probe for tool availability via `hasCommand()` and run discovered tools with `spawn`. `generateSummary` builds the final markdown report.
- `lib/anatomy.js` — Pure-JS entrypoint detector. `dissectRepo()` walks the repo and classifies entrypoints (Python/Node/Go/Rust/Java/Docker/etc.), HTTP routes, deployable units, and business-flow skeletons without any external tools. Writes `00-anatomy/ANATOMY.md`.
- `lib/standard.js` — `STANDARD_ARCHITECTURE` definition: the "entrypoint-first" canonical trunk and anti-pattern rules. `evaluateAgainstStandard()` scores a dissected repo's anatomy.
- `lib/insights.js` — Higher-level report builders: `buildStandardGuide()` (renders the architecture standard), `buildBorrowGuide()` (heuristic "what to steal" from indexed repos), `buildProjectReview()` (anatomy-based code review of own project).
- `lib/db.js` — SQLite index (`~/.cache/repo-inv/index.db`). `upsertReport` is called automatically after every `analyze` run. Provides `listRepos`, `searchRepos` (FTS5), `getRepoByName`, `savePatterns`, `catalogForPrompt` for the `recommend` LLM prompt.
- `lib/env.js` — Reads `DEEPSEEK_API_KEY` and other vars from the suite's `.env` file.
- `bin/repo-inv-mcp.mjs` — MCP server (stdio) exposing the knowledge base to agents: `list_repos`, `search_knowledge`, `compare_repos`, `get_repo_details`, `patterns_of_repo`, `repos_with_pattern`, `extract_code`, `analyze_repo`, `recommend`, `borrow_guide`, `project_review`. Wire into Claude Code once: `node bin/repo-inv install-mcp claude-code`.
- `.agents/skills/repo-investigator/` — Agent-harness skill mirror: `SKILL.md`, `scripts/analyze.sh` (bash port of the Node runner), `docs/TOOLS_GUIDE.md` (per-tool reference, Chinese).

### Tool Registry Pattern

`lib/tools.js` is the single source of truth for tool metadata. **Adding a tool requires 3 edits in lockstep:**
1. New entry in `TOOLS` in `lib/tools.js`
2. Execution branch in the matching `run*` function in `lib/runner.js`
3. Same in `.agents/skills/repo-investigator/scripts/analyze.sh` if bash runner should support it

### Key Invariants

- **Tool absence is not an error** — `runCmd` is called with `ignoreError: true`/`silent: true` for optional tools, and `hasCommand()` gates execution. Preserve this so partial toolchains still produce a report.
- **`runCmd` in `lib/runner.js` has three deliberate fixes** in its header comment: ENOENT/EACCES `'error'` handler, `Buffer.concat` for multi-byte UTF-8, always-piped stderr. Don't regress these.
- **File discovery** uses `findFiles()` with a hard skip-set: `node_modules`, `vendor`, `.git`, `__pycache__`, `dist`, `build`, `.venv`, `venv`, `env`, `.eggs`, `site-packages`, plus dotfiles. Reuse it instead of writing new walkers. `lib/anatomy.js` uses its own `walkFiles()` with the same skip logic.
- **Output contract**: new tools must drop files into the correct `0N-*/` subdir so `generateSummary` can pick them up. Use stable filenames (`scc.json`, `semgrep.json`, …) — `SUMMARY.md` references them by name.

### Architecture Profiles

`analyze`, `dissect`, `review`, and `audit` accept `--profile <name>`. Profiles customize the architecture standard applied during anatomy evaluation:

| Profile | Use case |
|---------|----------|
| `generic` | Default — general-purpose projects |
| `pure_agent` | LLM agent runtimes with no persistent state |
| `rag_agent` | RAG pipelines with retrieval and embedding layers |
| `crm_agent` | CRM/workflow automation agents |

### Output Structure

```
~/.cache/repo-inv/<repo>-<ts>/
├── 00-anatomy/      ANATOMY.md (entrypoints, deployable units, interfaces, business flows)
├── 01-arch/         scc.json, scc.txt, tokei.json, pydeps.svg, madge-circular.txt, git-contributors.txt
├── 02-logic/        semgrep.json, jscpd/, lizard.txt, lizard.xml, ast-grep.json, infer-out/
├── 03-efficiency/   radon-cc.txt, radon-mi.txt, wily.txt, py-spy.svg, memray.bin, memray.html
├── report.json      structured metrics (indexed by lib/db.js)
├── SUMMARY.md       spliced first ~2000 chars of each key file
└── LEARNINGS.md     generated by `learn` command (DeepSeek synthesis)
```

### Language Coverage

| Language | Layer support |
|----------|--------------|
| Python | All four layers (anatomy, pydeps, semgrep, lizard, radon, py-spy, memray) |
| JS/TS | Anatomy + Arch + Logic (madge, depcruise, semgrep, jscpd, ast-grep) |
| Java/C/C++ | Logic-heavy (infer, semgrep, joern, codeql) |
| Go/Rust | Anatomy + Arch stats + semgrep |

Don't "fix" a layer being empty for a language unless a real tool exists.

### DeepSeek integration

`learn` and `recommend` call the DeepSeek API. Add `DEEPSEEK_API_KEY=sk-...` to `.env` in the suite root. The `lib/env.js` loader picks it up at startup.
