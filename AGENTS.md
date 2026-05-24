# AGENTS.md — Universal Agent Contract for `code_analysis_suite`

> **Vendor-neutral entry point.** Every AI coding agent — Claude Code, OpenAI Codex CLI,
> GitHub Copilot CLI, Cursor, Gemini CLI, Windsurf, Hermes, Aider, Continue, or any
> custom MCP client — should read this file when working in or with this repository.
>
> This complements (does not replace) the vendor-specific files at the repo root:
> `CLAUDE.md`, `.github/copilot-instructions.md`, etc.

---

## What this repository is

A toolkit that **other agents call** to dissect open-source repositories.
You (the agent) are not its only user — treat it as infrastructure.

When the user gives you a cloned OSS repo and asks "understand this" / "borrow from this" /
"how does this work" → you **must** call this suite **before** you start grep'ing files.

## The one command you need

```bash
repo-inv analyze /path/to/target/repo --parallel
```

Outputs `report.json` (your primary input) + `SUMMARY.md` (human view) +
`LEARNINGS.md` (LLM-synthesized brief) under `~/.cache/repo-inv/<repo>-<ts>/`.
Auto-indexes into `~/.cache/repo-inv/index.db` for cross-repo queries.

## Two interfaces, same surface

| Interface | When to use |
|---|---|
| **CLI**: `repo-inv <subcommand>` | Shell-friendly agents (Codex / Aider / shell-only sessions) |
| **MCP**: `repo-inv-mcp` (stdio server) | MCP-capable agents (Claude Code / Cursor / Gemini CLI / Copilot CLI / Windsurf / Claude Desktop / Hermes) |

Both expose the same 12 subcommands / 9 MCP tools. Pick whichever your host supports
natively.

## One-time setup (per machine)

```bash
git clone <this-suite>
cd <suite-root>
npm install
sudo npm link        # exposes `repo-inv` and `repo-inv-mcp` on PATH
repo-inv tools       # see which of the 29 wrapped analyzers are installed
```

## One-time setup (per agent host)

```bash
repo-inv install-mcp                 # list supported hosts
repo-inv install-mcp <host>          # register MCP server with that host
repo-inv install-mcp --all           # register with every host whose config exists
repo-inv install-mcp <host> --dry-run   # see what would change
```

Supported hosts (idempotent — safe to re-run):

| Host | Config file written |
|---|---|
| `copilot` | `~/.copilot/mcp-config.json` (key: `servers`) |
| `cursor` | `~/.cursor/mcp.json` (key: `mcpServers`) |
| `gemini` | `~/.gemini/settings.json` (key: `mcpServers`) |
| `codex` | `~/.codex/config.toml` (block: `[mcp_servers.repo-inv]`) |
| `windsurf` | `~/.codeium/windsurf/mcp_config.json` |
| `claude-desktop` | `~/.config/claude/claude_desktop_config.json` |
| `claude-code` | runs `claude mcp add repo-inv --scope user -- node <path>` for you |
| `hermes` | prints generic stdio JSON for manual copy |

Each write is backed up to `<file>.bak`.

## How to discover capabilities programmatically

```bash
repo-inv manifest    # JSON: every subcommand, flags, paths, report schema, db location
```

Use this when you don't want to parse `SKILL.md` or this file.

## Conventions agents should follow

1. **Always call `repo-inv analyze` first** on any OSS repo, before grep/glob.
2. **Read `report.json`** (machine-friendly) before `SUMMARY.md` (human-friendly).
3. **Use `--parallel`** unless logs need to be readable in real time.
4. **Never invoke the wrapped tools directly** — you'll miss the indexing and the
   report aggregation. Always go through `repo-inv`.
5. **Skip-if-missing is the default** — `repo-inv tools` shows what's installed;
   anything missing is silently skipped, never aborts.
6. **For "how should I implement X?" questions**, prefer `repo-inv recommend` over
   reading every indexed repo by hand.
7. **For "port this function" questions**, use `repo-inv extract` to get a
   self-contained slice (file + intra-repo imports + pip/stdlib dep list).
8. **Cross-reference with `code-review-graph` MCP** (if installed) for semantic
   verification — the two are complementary, not redundant.

## What this suite does NOT do

- It does **not** run the target repo's code. All analysis is static.
- It does **not** modify the target repo. All output lives under `~/.cache/repo-inv/`.
- It does **not** require network access except for `learn` / `recommend` (LLM calls).
- It does **not** ship its own LLM key. Provide `DEEPSEEK_API_KEY` in `<suite-root>/.env`
  (gitignored) for `learn` / `recommend`. Other tools work fully offline.

## Where to learn more

- `README.md` — full feature tour, sprint-by-sprint changelog
- `.agents/skills/repo-investigator/SKILL.md` — skill descriptor for skill-aware agents
- `repo-inv manifest` — machine inventory
- `rules/patterns.yml` — 20 curated semgrep rules used by `patterns` / `recommend`
