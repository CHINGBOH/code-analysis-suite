# Contributing

Thanks for considering a contribution! This project is small and the bar to enter is low.

## Setup

```bash
git clone https://github.com/<you>/code_analysis_suite
cd code_analysis_suite
npm install
sudo npm link
```

Verify everything works:

```bash
repo-inv tools                            # all wrapped tools, install status
repo-inv analyze . --parallel             # dogfood: analyze this repo itself
repo-inv manifest | jq '.commands | length'   # should print 14
```

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#source-map). TL;DR:

- `bin/repo-inv` — CLI entry (commander)
- `bin/repo-inv-mcp.mjs` — stdio MCP server
- `lib/` — single-purpose modules: `runner`, `tools`, `db`, `patterns`, `extract`, `llm`, `env`
- `rules/patterns.yml` — semgrep rules for architectural pattern detection
- `docs/` — public-facing documentation

## Common contributions

### Add a new wrapped analyzer

1. Add an entry to `TOOLS` in `lib/tools.js`:

   ```js
   {
     layer: 'logic',                 // arch | logic | efficiency
     name: 'my-tool',
     desc: 'one-line description',
     check: 'my-tool --version',     // shell command for detection
     versionRegex: /version (\d.\d.\d)/,
     cmd: 'my-tool --json .',        // example invocation
     tips: 'Optional usage tips.',
   }
   ```

2. Add the execution block to the appropriate `runArchitecture` / `runLogic` /
   `runEfficiency` function in `lib/runner.js`.
3. If the bash entry script should also run it, add to
   `.agents/skills/repo-investigator/scripts/analyze.sh`.
4. Re-run `repo-inv analyze . --parallel` and check the new output file appears.

### Add a new pattern rule

Edit `rules/patterns.yml` — standard semgrep syntax. The pattern `id` becomes the
`pattern` column in the index. Then:

```bash
repo-inv patterns .   # re-detect on this repo to see your rule trigger
```

### Add a new MCP host adapter

Add an entry to `MCP_HOSTS` in `bin/repo-inv`:

```js
'my-host': {
  label: 'My Host',
  file: path.join(os.homedir(), '.my-host', 'config.json'),
  topKey: 'mcpServers',                // or 'servers' for Copilot-style
  format: 'json',                      // or 'toml' for Codex-style
}
```

The generic `upsertJsonMcp` already handles JSON hosts. TOML or CLI-based hosts
(like Claude Code) need a custom branch in the `install-mcp` action handler.

### LLM provider abstraction (wanted!)

Currently `lib/llm.js` is DeepSeek-only. A welcome PR: detect `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` from `.env` and pick the first one set,
with a `--provider` flag override.

## Style

- Node ≥18, no transpiler. CommonJS for `bin/repo-inv` and `lib/`, ESM (`.mjs`) for the MCP server.
- No emoji-soup in code; emojis are fine in user-facing CLI output (already standard).
- Keep `lib/` modules single-purpose. New cross-cutting helpers go in `lib/util.js`.
- New subcommands must also be reflected in `repo-inv manifest`.
- Never hardcode `/home/...` paths. Use `__dirname`-relative resolution.

## Self-test before sending a PR

```bash
repo-inv analyze . --parallel             # must finish clean
repo-inv tools | grep -c ✅                # baseline of available tools
repo-inv manifest | jq -e '.commands | length >= 14'
repo-inv install-mcp copilot --dry-run    # must NOT dump file contents (regression test)
```

If you touched analyzer output parsing, also bump `report_schema` in `lib/runner.js`
(`repo-inv/report@1` → `@2`) and note the schema change in the commit message.

## License

By contributing, you agree your work is released under the [MIT License](LICENSE).
