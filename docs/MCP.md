# MCP integration

`code_analysis_suite` ships a stdio MCP server (`repo-inv-mcp`) that exposes the
suite's capabilities as 9 tools any MCP-capable agent can call without shelling out.

## One command, every host

```bash
repo-inv install-mcp                  # list all hosts + which have config files
repo-inv install-mcp <host>           # idempotent register (writes .bak)
repo-inv install-mcp --all            # every host whose config already exists
repo-inv install-mcp <host> --dry-run # preview the entry that would be upserted
```

The upsert is surgical: it only touches the `repo-inv` entry within `servers` /
`mcpServers` / `[mcp_servers.repo-inv]`. Other entries — and any API keys you've
already stored — are preserved verbatim.

## Supported hosts

| Host alias | Config file | Format | Notes |
|---|---|---|---|
| `copilot` | `~/.copilot/mcp-config.json` | JSON (key: `servers`) | GitHub Copilot CLI |
| `cursor` | `~/.cursor/mcp.json` | JSON (key: `mcpServers`) | Cursor IDE |
| `gemini` | `~/.gemini/settings.json` | JSON (key: `mcpServers`) | Gemini CLI |
| `codex` | `~/.codex/config.toml` | TOML block | OpenAI Codex CLI |
| `windsurf` | `~/.codeium/windsurf/mcp_config.json` | JSON | Windsurf / Codeium |
| `claude-desktop` | `~/.config/claude/claude_desktop_config.json` | JSON | Anthropic Claude Desktop |
| `claude-code` | n/a — wraps `claude mcp add` | CLI call | Anthropic Claude Code |
| `hermes` | (prints template) | manual | User maps to their loader |

## The 9 tools

| Tool | Args | Returns |
|---|---|---|
| `list_repos` | `order_by` (recent\|size\|quality\|complexity) | rows from `repos` table |
| `search_knowledge` | `query`, `lang?`, `max_ccn?` | FTS5 matches across SUMMARY + LEARNINGS |
| `compare_repos` | `repo_a`, `repo_b` | side-by-side metric diff |
| `get_repo_details` | `repo_name_or_id` | full record + languages + hotspots + patterns |
| `patterns_of_repo` | `repo_name_or_id` | architectural patterns detected |
| `repos_with_pattern` | `pattern_name` | reverse lookup |
| `extract_code` | `repo`, `file`, `out`, `max_hops?` | file + 1-hop imports + dep manifest |
| `analyze_repo` | `path`, `layers?`, `parallel?` | runs `repo-inv analyze`, returns paths (long) |
| `recommend` | `task` (free text) | DeepSeek picks best repos/files to copy from |

## Manual config (if `install-mcp` doesn't fit your host)

The canonical stdio entry, in any JSON-based MCP host:

```jsonc
{
  "mcpServers": {
    "repo-inv": {
      "command": "node",
      "args": ["<absolute path>/bin/repo-inv-mcp.mjs"],
      "cwd": "<absolute path>",
      "type": "stdio"
    }
  }
}
```

For Codex (TOML):

```toml
[mcp_servers.repo-inv]
command = "node"
args = ["<absolute path>/bin/repo-inv-mcp.mjs"]
cwd = "<absolute path>"
```

After `sudo npm link`, `<absolute path>` is whatever `repo-inv manifest | jq -r .suite_root`
prints.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `repo-inv: command not found` | Run `sudo npm link` in the suite root |
| MCP server starts but tools missing | Restart the agent — MCP server list is cached at agent boot |
| `install-mcp <host>` says `·` (no config) | Host isn't installed on this machine; install the agent first |
| Want to undo | `mv ~/.codex/config.toml.bak ~/.codex/config.toml` (same pattern for every host) |
| Codex TOML has duplicate blocks | The regex replace is marker-based; if you renamed the block manually, delete it and re-run `install-mcp codex` |
