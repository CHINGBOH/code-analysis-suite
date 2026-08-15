# 🔬 Code Analysis Suite - Contextual Instructions

This repository is a toolkit designed for AI agents to analyze and understand large open-source codebases. It wraps 29 best-in-class static analyzers, indexes results into a cross-repo SQLite knowledge base, and provides both a CLI and an MCP interface.

## Project Overview

- **Purpose**: Automate the "reading" and "understanding" phase of large unfamiliar codebases for AI agents.
- **Core Technologies**: 
  - **Runner**: Node.js (main orchestrator in `lib/`).
  - **Storage**: SQLite + FTS5 (`~/.cache/repo-inv/index.db`).
  - **Analyzers**: Wraps tools like `semgrep`, `lizard`, `jscpd`, `scc`, `tokei`, `pydeps`, `madge`, `radon`, `wily`, etc.
  - **Interfaces**: Commander CLI (`bin/repo-inv`) and MCP stdio server (`bin/repo-inv-mcp.mjs`).
  - **Languages Supported**: Multi-language (Node.js, Python, Go, Rust, Java, etc.).

## 🏗️ Architecture

The analysis is structured into three layers:
1.  **Architecture Layer**: Maps modules and dependencies (`scc`, `tokei`, `madge`, `pydeps`).
2.  **Logic Layer**: Identifies complexity, duplication, and security risks (`semgrep`, `lizard`, `jscpd`, `vulture`, `bandit`, `mypy`).
3.  **Efficiency Layer**: Tracks complexity evolution and performance hotspots (`radon`, `wily`).

## 🚀 Key Commands

### Installation & Setup
```bash
# Install Node.js dependencies
npm install

# Link commands globally (repo-inv, repo-inv-mcp)
sudo npm link

# Install Python analyzers
pip install -r requirements.txt

# Check which tools are installed
repo-inv tools
```

### Analysis & Usage
```bash
# Analyze a repository (parallel mode recommended)
repo-inv analyze /path/to/target/repo --parallel

# List indexed repositories
repo-inv list --by quality

# Search across all indexed repositories
repo-inv search "retry OR backoff"

# Get recommendations for a specific task
repo-inv recommend "I need a plugin system with hot-reload"

# Extract a self-contained code slice
repo-inv extract /path/to/repo file.py --out ./vendor
```

### MCP Integration
```bash
# Register MCP server with an agent host (e.g., gemini, claude-code)
repo-inv install-mcp <host>
```

## 🛠️ Development Conventions

- **Entry Points**: `bin/repo-inv` (CLI) and `bin/repo-inv-mcp.mjs` (MCP).
- **Core Logic**: Located in `lib/`:
  - `runner.js`: Orchestrates the 3-layer analysis.
  - `tools.js`: Static registry of wrapped tools.
  - `db.js`: SQLite and FTS5 interaction.
  - `patterns.js`: Architectural pattern detection using Semgrep.
- **Read-Only Targets**: The suite MUST NEVER modify the target repository being analyzed. All outputs reside in `~/.cache/repo-inv/`.
- **Skip-if-Missing**: Tools not present on the host system are silently skipped.
- **Agent Priority**: AI agents should prioritize reading `report.json` (machine-readable) over `SUMMARY.md` (human-readable).

## 📂 Repository Structure

- `bin/`: CLI and MCP entry points.
- `lib/`: Core orchestration and logic.
- `rules/`: Semgrep rules for pattern detection (`patterns.yml`).
- `docs/`: Technical documentation (Architecture, MCP, Usage).
- `cli/`, `bash/`, `finance-repos/`: Sample/target repositories for analysis and testing.

## 📝 TODOs / Future Work
- [ ] Add support for OpenAI and Anthropic API keys in `llm.js`.
- [ ] Implement robust testing suite (`npm test` is currently a placeholder).
- [ ] Expand analyzer support for Rust and Java.
