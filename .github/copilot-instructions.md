# Code Analysis Suite — Copilot Instructions

A Node.js CLI (`repo-inv`) plus a parallel bash script that wrap 20+ external static-analysis
tools (scc, semgrep, lizard, madge, depcruise, pydeps, radon, py-spy, memray, …) into a
unified three-layer investigation pipeline. There are **no tests** — the value is in the
wrapped tools, not the wrapper logic.

## Commands

```bash
npm install                                  # install Node deps (chalk, commander, madge, depcruise, ora)

node bin/repo-inv analyze <repo>             # run all 3 layers, writes ./investigation-report/
node bin/repo-inv analyze <repo> -l arch,logic   # subset of layers
node bin/repo-inv analyze <repo> -o <outdir>
node bin/repo-inv tools                      # list tools and detect which are installed
node bin/repo-inv tool <name>                # detail + install tips for one tool
node bin/repo-inv report [outdir]            # print last SUMMARY.md
node bin/repo-inv init                       # write .repo-inv.json

# Bash alternative (same 3-layer model, same output layout)
bash .agents/skills/repo-investigator/scripts/analyze.sh [--layer=arch] /path/to/repo
```

There is no test/lint script (`npm test` is a stub). The "quick triage" recipe used
throughout the codebase docs is: `scc . && semgrep --config=auto . && lizard .`.

## Architecture — the big picture

Three-layer analysis model. Every `analyze` run writes to numbered subdirs and then
splices the first ~2000 chars of key outputs into a top-level `SUMMARY.md`:

| Layer       | Dir              | Purpose                              | Representative tools                          |
|-------------|------------------|--------------------------------------|-----------------------------------------------|
| Architecture| `01-arch/`       | Module structure, dep graphs, LOC    | scc, tokei, pydeps, madge, depcruise          |
| Logic       | `02-logic/`      | Security, duplication, complexity    | semgrep, jscpd, lizard, infer, ast-grep       |
| Efficiency  | `03-efficiency/` | Perf, memory, complexity trend       | radon, wily, py-spy, memray                   |

Source layout (small — read these directly, don't grep blindly):

- `bin/repo-inv` — commander CLI entry, 5 subcommands (`analyze`, `tools`, `tool`, `report`, `init`).
- `lib/tools.js` — **single source of truth** for tool metadata. The `TOOLS` registry
  object holds each tool's `layer`, `name`, `desc`, `check` (detection shell command),
  `versionRegex`, example `cmd`, and install `tips`.
- `lib/runner.js` — async execution engine. `runArchitecture` / `runLogic` /
  `runEfficiency` probe with `hasCommand()` and shell out via `spawn`. `generateSummary`
  builds the final markdown. Missing tools are **silently skipped, not errors**.
- `.agents/skills/repo-investigator/` — agent-harness skill mirror: `SKILL.md`,
  `scripts/analyze.sh` (bash port of the Node runner), `docs/TOOLS_GUIDE.md` (per-tool
  reference, Chinese).

## Project-specific conventions

- **Adding a tool requires 3 edits in lockstep**: (1) new entry in `TOOLS` in
  `lib/tools.js`; (2) execution branch in the matching `run*` function in
  `lib/runner.js`; (3) the same in `.agents/skills/repo-investigator/scripts/analyze.sh`
  if the bash runner should support it. Keep the Node CLI and bash script behaviorally
  in sync.
- **Tool absence is not an error** — `runCmd` is called with `ignoreError: true` /
  `silent: true` for optional tools, and `hasCommand()` gates execution. Preserve this
  pattern so partial toolchains still produce a report.
- **`runCmd` in `lib/runner.js` has three deliberate fixes** documented in its header
  comment: ENOENT/EACCES `'error'` handler, `Buffer.concat` for multi-byte UTF-8, and
  always-piped stderr. Don't regress these when editing.
- **File discovery** uses `findFiles()` with a hard skip-set: `node_modules`, `vendor`,
  `.git`, `__pycache__`, `dist`, `build`, `.venv`, `venv`, `env`, `.eggs`,
  `site-packages`, plus any dotfile. Reuse it instead of writing new walkers.
- **Output contract**: anything new must drop a file into the correct `0N-*/` subdir so
  that `generateSummary` can pick it up. Prefer stable filenames (`scc.json`,
  `semgrep.json`, `lizard.txt`, …) — `SUMMARY.md` references them by name.
- Language coverage is uneven by design: Python gets all three layers; JS/TS gets arch +
  logic; Java/C/C++ is logic-heavy (infer, semgrep); Go/Rust gets arch stats + semgrep.
  Don't "fix" a layer being empty for a language unless a real tool exists.

## Code-review graph (MCP)

This project is itself indexed by the **code-review-graph** MCP server. When exploring
or reviewing changes, prefer graph tools over Grep/Glob/Read:

- `semantic_search_nodes`, `query_graph` (callers_of / callees_of / imports_of /
  tests_for) for navigation.
- `detect_changes` + `get_review_context` for code review.
- `get_impact_radius`, `get_affected_flows` for blast-radius analysis.
- `get_architecture_overview`, `list_communities` for high-level structure.

Fall back to grep/view only when the graph doesn't cover the question.

## Further reading inside the repo

- `README.md` — one-screen tool list.
- `CLAUDE.md` — fuller architecture notes (the source of much of this file).
- `CLAUDE_CODE_GUIDE.md` — slash commands, CLI flags, repo-specific skills.
- `GITHUB_CODE_ANALYSIS_TOOLS_SURVEY.md` — background survey of the wrapped ecosystem.
- `.agents/skills/repo-investigator/docs/TOOLS_GUIDE.md` — per-tool usage reference.
- `COPILOT_USAGE_GUIDE.md` — full Copilot CLI cheat-sheet (slash commands, skills, tools, models, workflows).
