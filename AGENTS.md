# AGENTS.md — Universal Agent Contract for `code_analysis_suite`

> **Vendor-neutral entry point.** Every AI coding agent — Claude Code, OpenAI Codex CLI,
> GitHub Copilot CLI, Cursor, Gemini CLI, Windsurf, Hermes, Aider, Continue, or any
> custom MCP client — should read this file when working in or with this repository.
>
> This complements (does not replace) the vendor-specific files at the repo root:
> `CLAUDE.md`, `.github/copilot-instructions.md`, etc.

---

## What this repository is

A Node.js toolkit that **other agents call** to dissect open-source repositories.
You (the agent) are not its only user — treat it as infrastructure.

When the user gives you a cloned OSS repo and asks "understand this" / "borrow from this" /
"how does this work" → you **must** call this suite **before** you start grep'ing files.

## Technology stack

- **Runtime**: Node.js ≥18 (no transpiler). CommonJS for the CLI and `lib/` modules; ESM (`.mjs`) for the MCP server.
- **Key dependencies**: `commander` (CLI), `chalk` / `ora` (terminal output), `better-sqlite3` (knowledge base), `@modelcontextprotocol/sdk` (MCP server), `madge`, `dependency-cruiser` (JS analysis).
- **External analyzers**: The suite wraps 29 best-in-class static-analysis tools (Python, Go, JS/TS, and generic). They are auto-detected at runtime; missing tools are silently skipped.
  - Architecture: `scc`, `tokei`, `madge`, `pydeps`, `pyan3`, `code2flow`, `depcruise`, `staticcheck`, `golangci-lint`, `ast-grep`
  - Logic / Quality: `semgrep`, `lizard`, `jscpd`, `pyright`, `vulture`, `bandit`, `mypy`, `gosec`, `tsc`, `infer`
  - Efficiency: `radon`, `wily`, `py-spy`, `memray`
  - Manual-only (not run automatically): `d2`, `joern`, `codeql`, `speedscope`, `pyroscope`
- **LLM integration**: Optional. `DEEPSEEK_API_KEY` in a gitignored `.env` at the suite root powers `learn` and `recommend`.

## Code organization

```
code_analysis_suite/
├── bin/
│   ├── repo-inv              # Commander CLI (959 lines, 14+ subcommands)
│   └── repo-inv-mcp.mjs      # stdio MCP server (352 lines, 17 tools)
├── lib/
│   ├── runner.js             # 3-layer orchestrator + SUMMARY.md/report.json builder
│   ├── anatomy.js            # Entrypoint-first repo dissection + standard evaluation
│   ├── tools.js              # Registry and runtime detection for all 29 wrapped tools
│   ├── db.js                 # SQLite + FTS5 wrappers (upsert, search, catalog)
│   ├── insights.js           # Borrow guide, project review, standard guide builders
│   ├── standard.js           # Entrypoint-first architecture standard + profile scoring
│   └── env.js                # Minimal .env loader (no extra deps)
├── rules/
│   ├── patterns.yml          # Curated semgrep architectural-pattern rules
│   ├── wtfpython.yml         # Python gotcha rules
│   └── cpython-pitfalls.yml  # CPython idiomatic-pitfall rules
├── docs/                     # Public docs (ARCHITECTURE.md, USAGE.md, MCP.md, ...)
├── .github/workflows/ci.yml  # Smoke-test matrix (Node 18/20/22)
├── package.json              # Node manifest; exposes repo-inv + repo-inv-mcp binaries
└── .env                      # Local secrets (gitignored)
```

### Module responsibilities

| Module | Role |
|--------|------|
| `bin/repo-inv` | Parses CLI arguments, dispatches to `lib/` functions, handles `install-mcp` logic for 8 host types. |
| `bin/repo-inv-mcp.mjs` | STDIO MCP server that re-exposes the same surface as the CLI via 17 tools. |
| `lib/runner.js` | Orchestrates the **Anatomy → Architecture → Logic → Efficiency** pipeline. Writes `00-anatomy/`, `01-arch/`, `02-logic/`, `03-efficiency/` under the output directory, then aggregates `SUMMARY.md` + `report.json`. |
| `lib/anatomy.js` | Static repo walk. Detects entrypoints, deployable units, HTTP interfaces, and business-flow skeletons for Python, Node, and Go. Evaluates against built-in architecture profiles (`generic`, `rag_agent`, `pure_agent`, `crm_agent`). |
| `lib/tools.js` | Single source of truth for the 29 wrapped tools. Each entry defines detection command, version regex, target layer, and usage tip. |
| `lib/db.js` | SQLite schema + CRUD. Default DB path: `~/.cache/repo-inv/index.db`. Supports FTS5 search across `SUMMARY.md` and `LEARNINGS.md`. |
| `lib/insights.js` | High-level report generators used by `borrow`, `review`, `audit`, and `standard` commands. |
| `lib/standard.js` | The `entrypoint-first-standard` definition: canonical trunk, anti-patterns, shape taxonomy, and scoring weights. |

## Build and setup commands

```bash
# One-time install
git clone <this-suite>
cd <suite-root>
npm install
sudo npm link        # exposes repo-inv and repo-inv-mcp on PATH

# Verify
repo-inv tools       # see which of the 29 wrapped analyzers are installed
repo-inv manifest | jq -e '.commands | length >= 14'
```

Optional Python analyzers:
```bash
pip install semgrep lizard radon vulture bandit
npm install -g jscpd madge
```

For LLM-powered subcommands (`learn`, `recommend`), add a `.env` in the suite root:
```bash
DEEPSEEK_API_KEY=sk-...
```

## Testing instructions

**There is no local unit-test suite yet.** `package.json` contains a placeholder test script.

Validation is performed by the CI smoke test (`.github/workflows/ci.yml`) and by manual dogfooding:

```bash
# Dogfood: analyze this repo itself
repo-inv analyze . --parallel

# Smoke tests used in CI
repo-inv tools
repo-inv manifest | jq -e '.commands | length >= 14'
repo-inv install-mcp copilot --dry-run   # must NOT dump file contents
repo-inv analyze . --layer arch -o /tmp/self-report
test -f /tmp/self-report/report.json
jq -e '.schema == "repo-inv/report@1"' /tmp/self-report/report.json
```

If you add a new subcommand or change the report schema, you **must**:
1. Ensure `repo-inv manifest` includes it.
2. Bump `report_schema` in `lib/runner.js` if the JSON shape changes.
3. Run `repo-inv analyze . --parallel` to verify the pipeline still completes cleanly.

## Development conventions

- **Node ≥18, no transpiler.** Use native Node APIs. CommonJS for `bin/repo-inv` and `lib/*.js`; ESM (`.mjs`) for the MCP server.
- **No emoji-soup in source code.** Emojis are reserved for user-facing CLI output.
- **Keep `lib/` modules single-purpose.** New cross-cutting helpers should go in `lib/util.js`.
- **Never hardcode home-directory paths.** Use `__dirname`-relative resolution so `npm link` works everywhere.
- **Skip-if-missing is the default.** Any wrapped tool that isn't installed is silently skipped; the pipeline never aborts because of a missing analyzer.
- **Target repo is read-only.** All output goes under `~/.cache/repo-inv/<repo>-<ts>/`. Never modify the analyzed repository.
- **Machine-readable first.** `report.json` (schema `repo-inv/report@1`) is the agent's primary input; `SUMMARY.md` is the human-readable view. Both are produced by the same aggregator in `lib/runner.js`.
- **Safe process spawning.** `lib/runner.js` uses `spawn(cmd, args, { shell: false })` with explicit arg arrays to avoid shell injection. `runCmd` always captures stderr and handles `ENOENT` / `EACCES` gracefully.

## Security considerations

- **Secrets**: The only secret source is a gitignored `.env` file at the repo root (loaded by `lib/env.js`). It is never bundled or committed.
- **MCP registration safety**: `repo-inv install-mcp` backs up existing host configs to `<file>.bak` before mutating them. Use `--dry-run` to preview changes without writing.
- **No code execution**: This suite performs **static analysis only**. It does not run the target repo's code (with the exception of `py-spy` / `memray` profiling, which require a runnable entrypoint supplied by the user).
- **No network dependency**: All wrapped tools work offline. Only `learn` and `recommend` call the DeepSeek API.
- **Child-process safety**: Tool invocations run in isolated child processes with timeouts where applicable (e.g., `timeout 90 wily build`).

## How to discover capabilities programmatically

```bash
repo-inv manifest    # JSON: every subcommand, flags, paths, report schema, db location
```

Use this when you don't want to parse `SKILL.md` or this file.

## Conventions agents should follow

1. **Always call `repo-inv analyze` first** on any OSS repo, before grep/glob.
2. **Read `report.json`** (machine-friendly) before `SUMMARY.md` (human-friendly).
3. **Use `--parallel`** unless logs need to be readable in real time.
4. **Never invoke the wrapped tools directly** — you'll miss the indexing and the report aggregation. Always go through `repo-inv`.
5. **Skip-if-missing is the default** — `repo-inv tools` shows what's installed; anything missing is silently skipped, never aborts.
6. **For "how should I implement X?" questions**, prefer `repo-inv recommend` over reading every indexed repo by hand.
7. **For "port this function" questions**, use `repo-inv extract` to get a self-contained slice (file + intra-repo imports + pip/stdlib dep list).
8. **Cross-reference with `code-review-graph` MCP** (if installed) for semantic verification — the two are complementary, not redundant.

## What this suite does NOT do

- It does **not** run the target repo's code. All analysis is static.
- It does **not** modify the target repo. All output lives under `~/.cache/repo-inv/`.
- It does **not** require network access except for `learn` / `recommend` (LLM calls).
- It does **not** ship its own LLM key. Provide `DEEPSEEK_API_KEY` in `<suite-root>/.env` for `learn` / `recommend`. Other tools work fully offline.

## Where to learn more

- `README.md` — full feature tour, sprint-by-sprint changelog
- `docs/ARCHITECTURE.md` — pipeline diagrams, data flow, SQLite schema, source map
- `docs/USAGE.md` — end-to-end walkthroughs of all subcommands
- `docs/MCP.md` — per-agent setup and tool reference
- `CONTRIBUTING.md` — how to add analyzers, pattern rules, or MCP host adapters
- `.agents/skills/repo-investigator/SKILL.md` — skill descriptor for skill-aware agents
- `rules/patterns.yml` — 20 curated semgrep rules used by `patterns` / `recommend`
