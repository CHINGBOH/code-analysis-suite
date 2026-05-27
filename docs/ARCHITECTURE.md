# Architecture

> How `code_analysis_suite` maps source code around the main trunk: deployable units, entrypoints, exposed interfaces, business-flow skeletons, and reusable assets.

## High-level

```mermaid
flowchart TB
    subgraph User["👤 User"]
        U[Run repo-inv via CLI or<br/>ask their agent in natural language]
    end

    subgraph Agents["🤖 AI Agents"]
        A1[Claude Code]
        A2[Codex CLI]
        A3[Copilot CLI]
        A4[Cursor]
        A5[Gemini CLI]
        A6[Windsurf]
    end

    subgraph Suite["🔬 code_analysis_suite"]
        CLI[bin/repo-inv<br/>commander CLI]
        MCP[bin/repo-inv-mcp.mjs<br/>stdio MCP server]
        Runner[lib/runner.js<br/>anatomy + 3-layer orchestrator]
        Tools[lib/tools.js<br/>29-tool registry]
        DB[(SQLite + FTS5<br/>~/.cache/repo-inv/index.db)]
        Env[lib/env.js<br/>.env loader]
    end

    subgraph Externals["🛠️ External analyzers (auto-detected)"]
        T1[semgrep · lizard · jscpd]
        T2[scc · tokei · madge · pydeps]
        T3[vulture · bandit · mypy · pyright]
        T4[radon · wily · py-spy · memray]
    end

    subgraph LLM["☁️ LLM (optional)"]
        L1[DeepSeek API<br/>learn / recommend]
    end

    U --> CLI
    U --> Agents
    Agents -- MCP stdio --> MCP
    CLI --> Runner
    MCP --> Runner
    Runner --> Anatomy[lib/anatomy.js<br/>entrypoint-first trunk mapper + profile standards]
        Runner --> Tools
    Tools --> T1 & T2 & T3 & T4
    Runner --> DB
    Runner -- learn/recommend --> L1
    CLI -.reads.-> Env
    MCP -.reads.-> Env
```

## The `analyze` pipeline

```mermaid
sequenceDiagram
    participant U as User/Agent
    participant CLI as repo-inv CLI
    participant R as runner.js
    participant T as Wrapped tools
    participant FS as ~/.cache/repo-inv/
    participant DB as index.db

    U->>CLI: repo-inv analyze /target --parallel
    CLI->>R: orchestrate(target, layers, parallel=true)

    par Anatomy layer
        R->>T: static repo walk, package manifests, deployment files
        T-->>R: entrypoints, units, interfaces, flows
    and Architecture layer
        R->>T: scc, tokei, pydeps, madge, ...
        T-->>R: JSON/SVG/dot outputs
    and Logic layer
        R->>T: semgrep, lizard, jscpd, vulture, ...
        T-->>R: JSON/text outputs
    and Efficiency layer
        R->>T: radon, wily
        T-->>R: text outputs
    end

    R->>FS: write 00-anatomy/, 01-arch/, 02-logic/, 03-efficiency/
    R->>R: aggregate → report.json + SUMMARY.md
    R->>FS: write report.json, SUMMARY.md
    R->>DB: upsertReport(report.json)
    R-->>CLI: paths
    CLI-->>U: ✅ done + indexed
```

## Three layers, three questions

| Layer | Dir | Question | Primary outputs |
|---|---|---|---|
| **Standards** | built-in | *Which benchmark profile applies? generic, pure-agent, RAG-agent, CRM-agent* | `STANDARD_ARCHITECTURE.md`, `STANDARD_EVALUATION.md` |
| **Anatomy** | `00-anatomy/` | *What is the main trunk? Which deployable units and entrypoints exist?* | `anatomy.json`, `ANATOMY.md`, `BUSINESS_FLOWS.md`, `BORROWABLES.md` |
| **Architecture** | `01-arch/` | *What modules exist? How do they connect?* | `scc.json`, `tokei.json`, `pydeps.svg`, `madge-circular.txt`, `code2flow.gv`, `git-contributors.txt` |
| **Logic** | `02-logic/` | *Where's the complexity, duplication, risk?* | `semgrep.json`, `lizard.txt`, `jscpd/`, `vulture.txt`, `bandit.json`, `pyright.json` |
| **Efficiency** | `03-efficiency/` | *How does complexity evolve over time?* | `radon-cc.txt`, `radon-mi.txt`, `wily.txt`, optional `py-spy.svg`, `memray.html` |

The aggregator splices the first 2000 chars of each key file into `SUMMARY.md` (human view)
and structures the same data into `report.json` (machine view, schema = `repo-inv/report@1`).

## Knowledge base schema

```mermaid
erDiagram
    repos ||--o{ languages : has
    repos ||--o{ hotspots : has
    repos ||--o{ patterns : has
    repos ||--o| learnings : has
    repos {
        int id PK
        text name
        text path
        text report_path
        int total_loc
        int total_files
        real quality_score
        int complexity_avg
        text indexed_at
    }
    languages {
        int repo_id FK
        text language
        int loc
        int files
    }
    hotspots {
        int repo_id FK
        text file
        text function
        int ccn
        int nloc
    }
    patterns {
        int repo_id FK
        text pattern
        text file
        text snippet
    }
    learnings {
        int repo_id FK
        text content
    }
    search_fts {
        text content
        text repo_name
        text source
    }
```

`search_fts` is a FTS5 virtual table indexing `SUMMARY.md` + `LEARNINGS.md` of every
analyzed repo. Powers `repo-inv search` and `MCP search_knowledge`.

## Source map

```
code_analysis_suite/
├── bin/
│   ├── repo-inv              # commander CLI, 12 subcommands, install-mcp logic
│   └── repo-inv-mcp.mjs      # stdio MCP server, 17 tools
├── lib/
│   ├── runner.js             # 3-layer orchestrator + SUMMARY/report builders
│   ├── tools.js              # static registry of all 29 wrapped tools
│   ├── env.js                # .env loader (gitignored secrets)
│   ├── db.js                 # SQLite + FTS5 wrappers (upsertReport, search, ...)
│   ├── patterns.js           # semgrep-driven architectural pattern detection
│   ├── extract.js            # 1-hop import-aware code transplant
│   └── llm.js                # DeepSeek client for learn/recommend
├── rules/
│   └── patterns.yml          # 20 curated semgrep rules (retry, DI, plugin, ...)
├── .agents/skills/repo-investigator/
│   ├── SKILL.md              # skill descriptor for skill-aware agents
│   └── scripts/analyze.sh    # thin bash wrapper around the Node CLI
├── docs/                     # YOU ARE HERE
├── AGENTS.md                 # vendor-neutral agent contract
└── README.md                 # public face
```

## Design principles

1. **Skip-if-missing, never abort.** Any wrapped tool that isn't installed is silently
   skipped. `repo-inv tools` is the single place to check availability.
2. **The target repo is read-only.** All output goes under `~/.cache/repo-inv/`.
3. **Two interfaces, one truth.** CLI and MCP both call into `lib/runner.js`. No
   capability is CLI-only or MCP-only.
4. **Machine-readable first.** `report.json` is the agent's primary input; `SUMMARY.md`
   is the human's. Both come from the same aggregator.
5. **Persistent memory.** Every analysis is indexed. The cross-repo `search` /
   `compare` / `recommend` commands are what make this more than a wrapper.
6. **Vendor-neutral.** Configuration paths are runtime-resolved (`__dirname` after
   `npm link`). No `/home/l/...` strings anywhere in source or docs.
