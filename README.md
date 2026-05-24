# Code Analysis Suite

> **这是一个面向 AI Agent 的"开源仓库解剖工具箱"。**
> 用法：克隆任意一个想研究的开源仓库 → 在 Claude Code / GitHub Copilot CLI 里指向这个 suite →
> Agent 会自动调用本仓库内 20+ 个静态分析工具，把目标仓库的**架构、业务逻辑、代码质量**全部扒出来，
> 输出结构化材料供你借鉴、学习、引用。

**不是给人手动跑的 CLI**，而是给 agent 当"侦察兵"——你只负责选目标，让 agent 跑工具读结果。

---

## 给 Agent 的使用入口（必读）

Agent 接到"分析这个开源仓库"类任务时，**第一步必须用这个 suite**，不要直接 grep 目标仓库。

### 三层扫描（默认全跑）

```bash
# Node.js CLI（唯一引擎）
node /home/l/code_analysis_suite/bin/repo-inv analyze <target-repo>

# 并行模式（三层同时跑，~3x 速度，日志会交织）
node /home/l/code_analysis_suite/bin/repo-inv analyze <target-repo> --parallel

# bash 兼容入口（已退化为 Node CLI 的薄包装，不再独立维护）
bash /home/l/code_analysis_suite/.agents/skills/repo-investigator/scripts/analyze.sh <target-repo>
```

输出目录默认 `~/.cache/repo-inv/<repo>-<timestamp>/`（不会污染目标仓库），分三层：

| 目录 | 关注 | 给 agent 的解读建议 |
|---|---|---|
| `01-arch/` | 模块结构、依赖图、语言构成、代码量 | 看 `scc.json` 定规模 → `pydeps.svg` / `madge-*` 定模块边界 → `code2flow.gv` / `pyan3-callgraph.dot` 定调用链 |
| `02-logic/` | 安全规则、重复代码、圈复杂度、类型问题、死代码 | `lizard.txt` top-10 是热点 → `semgrep.json` 是风险 → `vulture.txt` / `jscpd` 是可删/可重构面 |
| `03-efficiency/` | 性能、复杂度趋势、内存 | `radon-cc.txt` / `wily.txt` 看演化，py-spy/memray 需可运行场景 |

最终 `SUMMARY.md`（人读）+ `report.json`（机器读，agent 友好）在输出根目录。

### 推荐工作流（agent 拿到一个新仓库时）

1. **`node bin/repo-inv tools`** — 先看本机哪些工具可用（缺的会跳过，不会报错）
2. **`node bin/repo-inv analyze <target> --parallel`** — 三层并行跑全量（~3x 速度），结束后自动入库到 `~/.cache/repo-inv/index.db`
3. **读 `report.json`**（agent 主入口）+ `SUMMARY.md`（人读视图）—— 形成第一印象
4. **`node bin/repo-inv learn`** — 让 DeepSeek 综合 report.json + SUMMARY 输出"学习指南"（架构速读 / 业务核心 / 质量画像 / 可借鉴点 / 风险盲区），结果存为 `LEARNINGS.md` 并刷新到索引库
5. **结合 code-review-graph MCP**（`semantic_search_nodes` / `query_graph` / `get_architecture_overview`）做交叉验证
6. **挑 `lizard` top-10 复杂函数 + 调用图入口** —— 这两个加起来就是"业务逻辑骨架"
7. **把 `semgrep.json` + `bandit.json` + `vulture.txt` + `jscpd` 当成"质量画像"** 输出给用户

### 跨仓库知识库（Sprint 1 新增）

每次 `analyze` 都会自动落到 SQLite 索引（`~/.cache/repo-inv/index.db`），随后可跨仓库检索、对比、排序——这是"抄作业要排列组合地抄"的基础：

```bash
# 列出所有已索引仓库（按 recent/size/quality/complexity 排序）
node bin/repo-inv list --by quality

# 全文搜索 LEARNINGS.md + SUMMARY.md（FTS5 语法，支持 OR / "短语" / -排除 / 前缀*）
node bin/repo-inv search "async OR await OR coroutine" --lang python --max-ccn 30

# 两个仓库并排对比：语言分布 / 复杂度 / 安全 / 重复率 / hotspot
node bin/repo-inv compare repo-fastapi repo-crewai
```

`compare` 输出会自动标记每个指标"A better / B better"，帮你判断哪个项目在某个维度更值得抄。

### 单工具补救

如果某层的关键工具在目标机器缺失，agent 应主动安装而不是绕开：

```bash
node bin/repo-inv tool <name>     # 看安装提示
# 例：pip install vulture / brew install scc / npm i -g madge
```

---

## 工具清单（按层）

### 01 Architecture — "这个仓库长什么样"
| 工具 | 干什么 |
|---|---|
| `scc` / `tokei` | 极速代码统计，定项目规模与语言构成 |
| `pydeps` | Python 模块依赖 SVG（自动检测包名） |
| `madge` / `depcruise` | JS/TS 模块依赖图 + 循环检测 |
| `code2flow` / `pyan3` | Python/JS 调用流程图（→ Graphviz dot） |
| `ast-grep` | AST 模式搜索 |
| `staticcheck` / `golangci-lint` | Go 静态分析 |
| `d2` / `joern` / `codeql` | 标记为 `manual`，需交互式/重型环境，不参与自动 analyze |

### 02 Logic — "代码质量与风险"
| 工具 | 干什么 |
|---|---|
| `semgrep` | 多语言 SAST，规则即代码（含 `--config=auto`） |
| `lizard` | 多语言圈复杂度（CCN > 15 关注，> 50 必重构） |
| `jscpd` | 跨语言重复代码检测 |
| `pyright` | Python 静态类型检查 |
| `mypy` | Python 类型检查参考实现（与 pyright 双确认） |
| `bandit` | Python 安全扫描（OWASP，semgrep 补盲） |
| `vulture` | Python 死代码检测 |
| `gosec` | Go 安全扫描（hardcoded creds / SQL 注入 / 弱 RNG） |

### 03 Efficiency — "性能与演化"
| 工具 | 干什么 |
|---|---|
| `radon` | Python 圈复杂度 / 可维护性 |
| `wily` | Python 复杂度随 git 演化 |
| `py-spy` / `memray` | 运行时性能/内存采样（需可运行的入口） |

完整每工具用法见 **`.agents/skills/repo-investigator/docs/TOOLS_GUIDE.md`**。

---

## 系统依赖（必装）

工具链本身用 npm/pip 装即可，但有一个**系统级依赖**容易漏：

```bash
# graphviz —— pydeps / code2flow / pyan3 生成 SVG/DOT 时硬依赖
sudo apt install -y graphviz       # Debian/Ubuntu
brew install graphviz              # macOS
```

不装 graphviz 不会报错，但 `pydeps.svg` 会静默缺失。`repo-inv tools` 不检测它（它是间接依赖）。

### LLM 配置（用 `repo-inv learn` 时需要）

在仓库根目录创建 `.env`（已 gitignore）：

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

`repo-inv learn` 会读取 `.env` 或环境变量，把 `report.json + SUMMARY.md` 喂给 DeepSeek，产出 `LEARNINGS.md`。

---

## 仓库自身结构

| 路径 | 作用 |
|---|---|
| `bin/repo-inv` | commander CLI，5 个子命令（`analyze` / `tools` / `tool` / `report` / `init`） |
| `lib/tools.js` | **工具元数据唯一来源**（注册表 + 检测命令 + 示例 + tips） |
| `lib/runner.js` | **三层执行引擎（唯一）**，`hasCommand` 探测 → `spawn` 调用 → 写文件 → `generateSummary` 汇总 |
| `.agents/skills/repo-investigator/` | Skill 元数据 + `analyze.sh`（Node CLI 的薄包装兼容入口）+ per-tool 中文 docs |
| `.github/copilot-instructions.md` | Copilot agent 进入本仓库后的工作约定 |
| `CLAUDE.md` / `CLAUDE_CODE_GUIDE.md` | Claude Code agent 的工作约定与命令参考 |
| `COPILOT_USAGE_GUIDE.md` | Copilot CLI 全命令 / Skills / 工具速查 |

> **代码改动约定**：加新工具只需两处同步——`lib/tools.js` 注册表 + `lib/runner.js` 对应 `run*` 函数。`analyze.sh` 是 Node CLI 的薄包装，无需改动。

---

## Agent 行为规则（重要）

1. **不要绕过 suite 直接 grep 目标仓库** —— 浪费 token，且会漏掉调用图/复杂度等结构化信息。
2. **不存在的工具 silently skip 是设计** —— 不要尝试"修复"，缺工具就提示用户安装。
3. **跑完务必读 `SUMMARY.md`** —— 它是工具产物的人读切片，里面已经把关键指标摘出来了。
4. **目标仓库为 Python 项目**：优先看 `pydeps.svg + pyan3-callgraph.dot + lizard + vulture + pyright`。
5. **目标仓库为 JS/TS**：优先看 `madge-circular.txt + depcruise.dot + jscpd + semgrep`。
6. **目标仓库为 Go**：优先看 `scc + staticcheck.json + golangci-lint.json + semgrep`。
7. **任何时候都可调** `code-review-graph` MCP 工具（`semantic_search_nodes` / `detect_changes` / `get_impact_radius`）做语义层验证——见 `CLAUDE.md` 顶部说明。
