# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 参考文档

- [Claude Code 完整使用指引](./CLAUDE_CODE_GUIDE.md) — 所有 `/` 命令、CLI 标志、快捷键及本仓库专属技能

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

# Run the CLI
node bin/repo-inv <command>

# Analyze a repository (all three layers)
node bin/repo-inv analyze /path/to/repo

# Analyze with specific layers only
node bin/repo-inv analyze /path/to/repo --layer arch,logic

# List available tools and their installation status
node bin/repo-inv tools

# Show details for a specific tool
node bin/repo-inv tool semgrep

# Show last investigation report
node bin/repo-inv report [output-dir]

# Initialize config file in current directory
node bin/repo-inv init

# Bash-based runner (alternative to Node CLI)
bash .agents/skills/repo-investigator/scripts/analyze.sh /path/to/repo
bash .agents/skills/repo-investigator/scripts/analyze.sh --layer=arch /path/to/repo
```

## Architecture

This suite wraps 20+ external static analysis tools into a unified Node.js CLI (`repo-inv`) and a companion bash script. There are no tests — the value is in the underlying tools, not the wrapper logic.

### Three-Layer Analysis Model

Every investigation runs in three stages, each writing to a numbered subdirectory under the output dir:

| Layer | Dir | Purpose | Key tools |
|-------|-----|---------|-----------|
| Architecture | `01-arch/` | Module structure, language stats, dependency graphs | scc, tokei, pydeps, madge, depcruise |
| Logic | `02-logic/` | Security patterns, duplicate code, cyclomatic complexity | semgrep, jscpd, lizard, infer, ast-grep |
| Efficiency | `03-efficiency/` | Runtime performance, memory usage, complexity trends | py-spy, memray, radon, wily |

A `SUMMARY.md` is generated at the output root by splicing the first 2000 chars of key output files.

### Source Files

- `bin/repo-inv` — Node.js CLI entry point (commander). Four subcommands: `analyze`, `tools`, `tool`, `report`, `init`.
- `lib/tools.js` — Static registry of all supported tools (`TOOLS` object). Each entry has: `layer`, `name`, `desc`, `check` (shell command to detect version), `versionRegex`, `cmd` (example command), `tips`.
- `lib/runner.js` — Async execution engine. `runArchitecture`, `runLogic`, `runEfficiency` each probe for tool availability via `hasCommand()` and run discovered tools with `spawn`. `generateSummary` builds the final markdown report.
- `.agents/skills/repo-investigator/scripts/analyze.sh` — Bash alternative to the Node CLI; same three-layer model, same output structure.
- `.agents/skills/repo-investigator/SKILL.md` — Skill descriptor used by the agent harness.
- `.agents/skills/repo-investigator/docs/TOOLS_GUIDE.md` — Detailed per-tool usage reference (Chinese).

### Tool Registry Pattern

`lib/tools.js` is the single source of truth for tool metadata. To add a new tool:
1. Add an entry to `TOOLS` with all required fields.
2. Add execution logic to the appropriate `run*` function in `lib/runner.js`.
3. Add the same to `analyze.sh` if the bash runner should support it.

Tools are detected at runtime via `hasCommand()` / `checkTool()` — missing tools are silently skipped, not errors.

### Output Structure

```
investigation-report/
├── 01-arch/         scc.json, scc.txt, tokei.json, pydeps.svg, madge-circular.txt, git-contributors.txt
├── 02-logic/        semgrep.json, jscpd/, lizard.txt, lizard.xml, ast-grep.json, infer-out/
├── 03-efficiency/   radon-cc.txt, radon-mi.txt, wily.txt, py-spy.svg, memray.bin, memray.html
└── SUMMARY.md
```

### Language Coverage

| Language | Layer support |
|----------|--------------|
| Python | All three layers (pydeps, semgrep, lizard, radon, py-spy, memray) |
| JS/TS | Arch + Logic (madge, depcruise, semgrep, jscpd, ast-grep) |
| Java/C/C++ | Logic-heavy (infer, semgrep, joern, codeql) |
| Go/Rust | Arch stats + semgrep |

### Quick triage for any repo

Always start with: `scc . && semgrep --config=auto . && lizard .`
