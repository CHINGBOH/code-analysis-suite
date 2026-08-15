# Code Analysis Suite — Copilot Instructions

This repo is **infrastructure for other AI agents**: a Node.js CLI (`repo-inv`) +
stdio MCP server (`repo-inv-mcp`) that wrap ~29 external static-analysis tools
(scc, tokei, semgrep, lizard, jscpd, madge, depcruise, pydeps, radon, wily,
py-spy, memray, ast-grep, infer, …) into a 4-layer investigation pipeline and
index every run into a cross-repo SQLite knowledge base.

There are **no unit tests** — the value lives in the wrapped tools, not the
wrapper. "Dogfood" the suite on itself to validate changes (see below).

## Commands

```bash
npm install
sudo npm link        # exposes `repo-inv` and `repo-inv-mcp` on PATH

# Smoke-test after any change to lib/runner.js or lib/tools.js:
node bin/repo-inv tools                      # which of ~29 tools are installed
node bin/repo-inv analyze . --parallel       # dogfood on this repo
node bin/repo-inv manifest | jq '.commands | length'   # sanity: ~14 subcommands

# Core workflow
node bin/repo-inv analyze <repo> --parallel             # all 4 layers (~3× faster)
node bin/repo-inv analyze <repo> -l anatomy,arch,logic  # subset
node bin/repo-inv analyze <repo> --profile rag_agent    # architecture profile
node bin/repo-inv dissect <repo>             # anatomy layer only (no external tools, always fast)

# Knowledge base over ~/.cache/repo-inv/index.db
node bin/repo-inv list --by quality
node bin/repo-inv search "retry OR backoff" --lang Python
node bin/repo-inv compare <repoA> <repoB>
node bin/repo-inv borrow "DI container"
node bin/repo-inv review <repoOrReport> --profile rag_agent

# AI features (require DEEPSEEK_API_KEY in .env at suite root)
node bin/repo-inv learn [outdir]
node bin/repo-inv recommend "<task description>"

# Bash port of the runner (kept behaviorally in sync)
bash .agents/skills/repo-investigator/scripts/analyze.sh [--layer=arch] <repo>
```

`npm test` is a stub. There is no lint script. Validate by re-running
`analyze . --parallel` and inspecting `~/.cache/repo-inv/<repo>-<ts>/`.

## Architecture — the big picture

Four-layer model. Every `analyze` run writes numbered subdirs under
`~/.cache/repo-inv/<repo>-<ts>/`, produces `report.json` + `SUMMARY.md`, then
auto-indexes into SQLite via `lib/db.js#upsertReport`.

| Layer        | Dir              | Purpose                              | Implementation                                |
|--------------|------------------|--------------------------------------|-----------------------------------------------|
| Anatomy      | `00-anatomy/`    | Entrypoints, deployable units, HTTP routes, business flows | `lib/anatomy.js` (**pure JS, no external tools**) |
| Architecture | `01-arch/`       | Module structure, dep graphs, LOC    | scc, tokei, pydeps, madge, depcruise          |
| Logic        | `02-logic/`      | Security, duplication, complexity    | semgrep, jscpd, lizard, ast-grep, infer       |
| Efficiency   | `03-efficiency/` | Perf, memory, complexity trend       | radon, wily, py-spy, memray                   |

Anatomy is always fast and runs first; the other three probe each tool with
`hasCommand()` and silently skip missing ones.

Source map (small — read these directly, don't grep blindly):

- `bin/repo-inv` — commander CLI entry; ~14 subcommands.
- `bin/repo-inv-mcp.mjs` — stdio MCP server exposing the KB to agent hosts
  (`list_repos`, `search_knowledge`, `analyze_repo`, `recommend`, …).
- `lib/tools.js` — **single source of truth** for tool metadata (`TOOLS` registry:
  `layer`, `name`, `desc`, `check`, `versionRegex`, `cmd`, `tips`).
- `lib/runner.js` — async execution engine. `runAnatomy` / `runArchitecture` /
  `runLogic` / `runEfficiency` + `generateSummary`.
- `lib/anatomy.js` — pure-JS entrypoint/route/flow detector; uses its own
  `walkFiles()` with the same skip-set as `findFiles()`.
- `lib/standard.js` — `STANDARD_ARCHITECTURE` + `evaluateAgainstStandard()`
  (entrypoint-first canonical trunk used by `review`/`audit`).
- `lib/insights.js` — `buildStandardGuide`, `buildBorrowGuide`,
  `buildProjectReview`.
- `lib/db.js` — SQLite + FTS5 index at `~/.cache/repo-inv/index.db`.
- `lib/patterns.js` — semgrep-driven architectural pattern detection over
  `rules/patterns.yml`.
- `lib/env.js` — loads `.env` (e.g. `DEEPSEEK_API_KEY`) from the suite root.
- `.agents/skills/repo-investigator/scripts/analyze.sh` — bash port of the
  Node runner; **must stay in sync** when tools are added.

## Project-specific conventions

- **Adding a tool requires 3 edits in lockstep**: (1) new entry in `TOOLS` in
  `lib/tools.js`; (2) execution branch in the matching `run*` function in
  `lib/runner.js`; (3) same in `.agents/skills/repo-investigator/scripts/analyze.sh`.
  Then dogfood with `repo-inv analyze . --parallel` and confirm the new output
  file appears in the right `0N-*/` subdir.
- **Tool absence is never an error.** `runCmd` is called with `ignoreError:true`
  / `silent:true` and gated by `hasCommand()`. Partial toolchains must still
  produce a report.
- **`runCmd` in `lib/runner.js` has three deliberate fixes** (see its header
  comment): ENOENT/EACCES `'error'` handler, `Buffer.concat` for multi-byte
  UTF-8, always-piped stderr. Don't regress these.
- **File discovery** uses `findFiles()` (and the parallel `walkFiles()` in
  `anatomy.js`) with a hard skip-set: `node_modules`, `vendor`, `.git`,
  `__pycache__`, `dist`, `build`, `.venv`, `venv`, `env`, `.eggs`,
  `site-packages`, plus dotfiles. Reuse it instead of writing new walkers.
- **Output contract**: drop files into the correct `0N-*/` subdir with stable
  filenames (`scc.json`, `semgrep.json`, `lizard.txt`, `ANATOMY.md`, …) —
  `generateSummary` and `lib/db.js#upsertReport` reference them by name.
- **Read-only on targets**: the suite must never modify the repo being analyzed.
  All output goes under `~/.cache/repo-inv/`.
- **Language coverage is uneven by design**: Python gets all four layers; JS/TS
  gets anatomy+arch+logic; Java/C/C++ is logic-heavy (infer, semgrep, joern,
  codeql); Go/Rust gets anatomy+arch stats+semgrep. Don't "fix" an empty layer
  unless a real tool exists for that language.
- **Architecture profiles** (`generic`, `pure_agent`, `rag_agent`, `crm_agent`)
  are passed through `analyze`, `dissect`, `review`, `audit` via `--profile`
  and customize the standard applied by `evaluateAgainstStandard()`.
- **DeepSeek-only LLM**: `learn` and `recommend` read `DEEPSEEK_API_KEY` from
  `.env`. No OpenAI/Anthropic wired in yet (see `lib/llm.js` TODO).
- **MCP registration is idempotent**: `repo-inv install-mcp <host>` writes a
  `.bak` next to each config. Supported hosts: `copilot`, `cursor`, `gemini`,
  `codex`, `windsurf`, `claude-desktop`, `claude-code`, `hermes`, or `--all`.

## When working *with* this suite (analyzing another repo)

If the user points at a cloned OSS repo, run `repo-inv analyze <repo> --parallel`
**before** grep/glob. Then read `report.json` (machine-readable) before
`SUMMARY.md` (human). For "how should I implement X?" use `recommend`; for "port
this function" use `extract`; for "what's worth stealing?" use `borrow`.

## code-review-graph MCP (when available)

This project is itself indexed by the `code-review-graph` MCP server. Prefer
`semantic_search_nodes`, `query_graph` (callers_of/callees_of/imports_of/
tests_for), `detect_changes` + `get_review_context`, `get_impact_radius`,
`get_architecture_overview` over grep/view when navigating this codebase.

## Further reading

- `README.md` — feature tour, sprint changelog
- `CLAUDE.md` — exhaustive architecture notes (source of much of this file)
- `AGENTS.md` — vendor-neutral agent contract + MCP host install matrix
- `CONTRIBUTING.md` — step-by-step recipes for the common change types
- `docs/ARCHITECTURE.md` — source map and layer contracts
- `.agents/skills/repo-investigator/docs/TOOLS_GUIDE.md` — per-tool reference (CN)
- `rules/patterns.yml` — the 20 curated semgrep pattern rules
- `repo-inv manifest` — machine-readable inventory of every subcommand
