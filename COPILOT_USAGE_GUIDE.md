# GitHub Copilot CLI 使用指引

> 本文件汇总当前会话中可用的所有 **/ 命令**、**快捷键**、**技能 (Skills)**、**记忆/指令机制**、**工具能力**，作为本仓库（`code_analysis_suite`）的随手手册。
> CLI 版本：`v1.0.51`　|　当前模型：Claude Opus 4.7 (`claude-opus-4.7`)

---

## 1. 全局快捷键

| 快捷键 | 作用 |
|---|---|
| `/` | 唤出 slash 命令 |
| `@` | 提及文件 |
| `#` | 提及 issue / PR |
| `!` | 执行 shell 命令 |
| `shift+tab` | 切换模式（普通 / Plan / Autopilot） |
| `ctrl+s` | 运行命令但保留输入 |
| `ctrl+o` / `ctrl+e` | 展开全部时间线 |
| `ctrl+c` | 取消当前操作 |
| `ctrl+c ×2` | 退出 CLI |
| `esc` | 取消 |
| `ctrl+d` | 关机 |
| `ctrl+l` | 清屏 |
| `ctrl+t` | 切换"推理过程"显示 |
| `ctrl+x → b` | 把当前任务丢到后台 |
| `ctrl+x → o` | 打开最近一个链接 |

### 输入编辑（emacs 风格）

`ctrl+a` 行首 ・ `ctrl+e` 行尾 ・ `ctrl+h` 删字符 ・ `ctrl+w` 删词 ・ `ctrl+u` 删到行首 ・ `ctrl+k` 删到行尾 ・ `meta+←/→` 按词移动 ・ `ctrl+g` 用 `$EDITOR` 编辑当前 prompt。

> 多行输入支持 `shift+enter`，需先跑 `/terminal-setup` 一次。

---

## 2. Slash 命令总览（按官方分组）

### 🤖 Agent 环境
| 命令 | 说明 |
|---|---|
| `/init` | 为当前仓库初始化 copilot-instructions |
| `/agent` | 浏览/选择可用 agent |
| `/skills` | 管理技能 |
| `/mcp` | 管理 MCP 服务器 |
| `/plugin` | 管理插件与插件市场 |

### 🧠 Agent / 子代理
| 命令 | 说明 |
|---|---|
| `/model` | 切换 AI 模型 |
| `/delegate` | 把会话甩给 GitHub，自动开 PR |
| `/fleet` | 开启 fleet 模式（多个子代理并行） |
| `/tasks` | 查看/管理任务（子代理 + shell） |

### 💻 代码
| 命令 | 说明 |
|---|---|
| `/ide` | 连接到 IDE workspace |
| `/diff` | 查看当前目录修改 |
| `/pr` | 操作当前分支的 PR |
| `/review` | 跑 code review 代理 |
| `/lsp` | 管理 language server 配置 |
| `/terminal-setup` | 启用 `shift+enter` 多行输入 |

### 🔐 权限
| 命令 | 说明 |
|---|---|
| `/allow-all` | 一键放开所有工具/路径/URL |
| `/add-dir` | 把目录加入文件访问白名单 |
| `/list-dirs` | 查看允许的目录 |
| `/cwd` | 切换或显示当前工作目录 |
| `/reset-allowed-tools` | 重置允许工具列表 |

### 💾 会话
| 命令 | 说明 |
|---|---|
| `/resume` | 切到另一个会话（可传 session ID / task ID / name） |
| `/rename` | 重命名当前会话（或自动生成） |
| `/context` | 显示 context 窗口 token 使用 |
| `/usage` | 显示会话指标 |
| `/session` | 会话管理（子命令） |
| `/compact` | 总结历史以节省 context |
| `/share` | 导出会话/研究报告为 md / html / gist |
| `/remote` | 切换"网页/手机端远控" |
| `/copy` | 复制上一条回复到剪贴板 |
| `/rewind` / `/undo` | 回滚上一轮并撤销文件修改 |

### ❓ 帮助 & 配置
| 命令 | 说明 |
|---|---|
| `/help` | 完整帮助 |
| `/changelog` | 版本变更（加 `summarize` 让 AI 总结） |
| `/feedback` | 反馈 |
| `/theme` | 切换/查看主题 |
| `/statusline` / `/footer` | 配置状态栏 |
| `/update` | 升级 CLI |
| `/version` | 版本 & 检查更新 |
| `/experimental` | 实验功能开关 |
| `/memory` | 记忆功能开关与状态 |
| `/clear` | 抛弃会话从头开始 |
| `/instructions` | 查看/切换自定义指令文件 |
| `/streamer-mode` | 直播模式（隐藏模型名/配额） |

### 🪄 其它
| 命令 | 说明 |
|---|---|
| `/after` | 单次延时调用，如 `/after 30s ping me`、`/after 10m /tuikit-new` |
| `/every` | 周期任务，如 `/every 5m run tests` |
| `/ask` | 问个不影响历史的小问题 |
| `/autopilot` | 切换 autopilot 模式 |
| `/chronicle` | 会话历史工具与洞察 |
| `/env` | 显示当前加载的 instructions / MCP / skills / agents / plugins / LSP / extensions |
| `/exit` | 退出 CLI（加 `print` 可在退出后打印会话） |
| `/keep-alive` | 防系统休眠 |
| `/login` / `/logout` / `/user` | 账号管理 |
| `/new` | 新建会话 |
| `/plan` | 写实现计划再动手 |
| `/research` | 深度研究（GitHub + 网络） |
| `/restart` | 重启 CLI 但保留会话 |
| `/search` | 在时间线里搜索 |
| `/sidekicks` | 查看运行中的 sidekick agent |

---

## 3. 指令文件（自动读取，按顺序）

Copilot 启动时会按下列路径收集 instructions：

1. `CLAUDE.md`
2. `GEMINI.md`
3. `AGENTS.md`（git 根 + cwd）
4. `.github/instructions/**/*.instructions.md`（git 根 + cwd）
5. `.github/copilot-instructions.md`
6. `$HOME/.copilot/copilot-instructions.md`
7. `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 环境变量指定的目录

> 本仓库已经有：`CLAUDE.md`、`.github/copilot-instructions.md`、`$HOME/.copilot/copilot-instructions.md`（用户全局规则）。

---

## 4. 当前可用 Skills

Skills 通过 `~/.copilot/skills/<name>/SKILL.md` 自动发现，frontmatter 含 `name` + `description`。外挂技能可以 symlink 进来。

### 4.1 项目级（`.agents/skills/` 或仓库技能）
| 技能 | 说明 |
|---|---|
| `repo-investigator` | 本仓库自带：架构 / 逻辑 / 性能三层调研工具链（20+ 工具的统一封装） |

### 4.2 用户级 (`~/.copilot/skills/`)

调用方式：`skill` 工具 + 技能名（无参数），例 `skill: "deep-research"`。完整状态用 `/env` 或 `/skills` 查看。

#### 📚 学术 & 研究
| 技能 | 何时触发 |
|---|---|
| `academic-paper` | 写论文、学术写作、写摘要、文献回顾、AI 披露；中文触发"寫論文"。12 个 agent 流水线 |
| `academic-paper-reviewer` | 同行评审模拟（EIC + 3 reviewers + Devil's Advocate），re-review、calibration |
| `academic-pipeline` | 端到端论文流水线：research → write → integrity → review → revise → finalize |
| `deep-research` | 深度研究、系统性回顾、PRISMA、meta-analysis、事实查核、苏格拉底引导 |
| `writing-qmd-scientific` | 写科学性 `.qmd` 文档 |

#### 🧹 代码治理（"破除幻想"三件套 + 周边）
| 技能 | 何时触发 |
|---|---|
| `llm-garbage-philosophy` | 清理前先看：3 类 LLM 垃圾（字典错误 / 语义死码 / 幻觉）哲学框架 |
| `dead-code-treatment` | 实际清理执行；只用真实安装工具，禁止臆造 flag；触发词 cleanup / 死码 / 孤儿文件 |
| `skill-tool-registry` | 查"哪个技能对应哪个工具" |
| `lsp-usage` | TS/Go/Py/Bash 错误诊断；用 tsc/gopls/pyright/shellcheck 代替 grep 猜 |
| `log-tailing` | 追日志（文件 / Docker / compose / systemd / journalctl / k8s），抗 rotation |
| `repo-investigator` | 仓库三层调研（架构 / 逻辑 / 性能），即本仓库 |

#### 📊 R / Quarto / 数据
| 技能 | 何时触发 |
|---|---|
| `cli` | 在 R 里用 cli 包做样式化输出、错误提示、进度条 |
| `developing-r-packages` / `r-package-development` | 创建或维护 R 包 |
| `testing-r-packages` | 用 testthat 测 R 包 |
| `writing-r-code` | 写 R 代码（风格、惯例） |
| `quarto-authoring` | 写 Quarto / .qmd / `_quarto.yml`、callouts、交叉引用、迁移自 Rmd |
| `brand-yml` | 创建 / 使用 `_brand.yml` 统一 Shiny + Quarto 品牌 |
| `ggsql` | 写 ggsql 查询（SQL 的 grammar of graphics） |
| `alt-text` | 给 R 包 / Quarto 文档的图加无障碍 alt-text |
| `creating-analysis-projects` | 搭新分析项目（init / refactor messy scripts / 立 pipeline） |
| `shiny-bslib` / `shiny-bslib-theming` | Shiny + bslib 主题化 |
| `spss-equivalent-mapping` | SPSS → R 对照 |
| `streamlit-data-app` | 搭 Streamlit 数据应用 |
| `survey-statistical-audit` | 调查类统计审计 |

#### 🖥️ 前后端 & 架构
| 技能 | 何时触发 |
|---|---|
| `api-design` | REST API 设计（命名、状态码、分页、版本、限流） |
| `fastapi-patterns` | FastAPI 异步 API、依赖注入、Pydantic、OpenAPI |
| `frontend-patterns` | React / Next.js / 状态管理 / 性能 |
| `frontend-design-direction` | 给 ECC 项目定 frontend 设计方向 |
| `motion-ui` | React/Next.js 的动效系统 |
| `nextjs-turbopack` | Next.js 16+ 与 Turbopack 选型 |
| `visual-presentation-design` | 视觉演示设计 |

#### 🤝 工程协作 / 流程
| 技能 | 何时触发 |
|---|---|
| `handling-pr-comments` | 系统化处理 PR 评审（含 outside-diff、解决 thread） |
| `orchestrated-execution` | 4 阶段执行环：IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW → COMMIT |
| `plan-review-gate` | 起完 plan 后自动开 3 个独立 reviewer 并行审查 |
| `design-review-gate` | brainstorming 完成后自动 PM + Architect + Designer + Security + CTO 评审 |

#### ☁️ Azure / Microsoft 生态
按场景拆：`azure-ai` / `azure-aigateway`（AI Gateway）/ `azure-cloud-migrate`（迁移）/ `azure-compliance` / `azure-compute` / `azure-cost`（成本） / `azure-deploy` / `azure-diagnostics` / `azure-enterprise-infra-planner` / `azure-hosted-copilot-sdk` / `azure-kubernetes` / `azure-kusto` / `azure-messaging` / `azure-prepare` / `azure-quotas` / `azure-rbac` / `azure-reliability` / `azure-resource-lookup` / `azure-resource-visualizer` / `azure-storage` / `azure-upgrade` / `azure-validate`；身份：`entra-agent-id` / `entra-app-registration`；Foundry：`microsoft-foundry`；混合：`airunway-aks-setup`、`appinsights-instrumentation`、`customize-cloud-agent`。

#### 🧱 Agent Infra Hub（必看）
| 技能 | 何时触发 |
|---|---|
| `agent-infra-hub` | **设计 agent/skill/MCP/hooks/subagent 前必先查**：本机 `/home/l/projects/agent-infra-hub` 索引 31 个仓库 |
| `agent-infra-hub-architect` | 用 hub 资料做架构 |
| `agent-infra-hub-curator` | 维护/扩充 hub |
| `agent-infra-hub-kb-query` | 在 hub 知识库里检索 |

#### 🔭 可观测
| 技能 | 何时触发 |
|---|---|
| `langfuse` | 查询/修改 Langfuse traces/prompts/datasets/scores，或查 Langfuse 文档 |

#### 🧪 rag-dashboard 项目专属（在该仓库才用）
| 技能 | 何时触发 |
|---|---|
| `rag-dashboard-branch-hygiene` | 会话开始时检查 HEAD 是否在 canonical main 上 |
| `rag-dashboard-config-precedence-lint` | 加 / 改任何 config（端口、URL、阈值、模型名）时按 R4 precedence 检查 |
| `rag-dashboard-dual-write-audit` | 新增/改 `/api/*` 路径时强制 vite 代理 + Go gateway 双写 |
| `rag-dashboard-runtime-trio` | 诊断任何 runtime 异常（502 / agent 卡 / 检索空 / 前端白屏）时走"shell + LSP + tail logs"三件套 |
| `rag-dashboard-vite-log-gate` | 把前端 URL 交给用户前，必须先 `tail /tmp/vite.log` 确认 0 errors |

---

## 5. 工具能力（在对话里直接可调用）

下面是会话中**已注入**的工具，按用途分组。`<tool>` 形式即工具名。

### 5.1 Shell / 进程
- `bash`：同步或异步执行；`mode=async` + `detach=true` 用于服务/守护进程。
- `read_bash` / `write_bash` / `stop_bash` / `list_bash`：操作已启动的 async 会话。

### 5.2 文件 & 代码
- `view`：读文件/目录（>50KB 自动截断，建议用 `view_range`）。
- `create`：创建新文件（已存在则失败）。
- `edit`：精确字符串替换（同回合可多次调用并按序生效）。
- `glob`：按 glob 找文件。
- `grep`：ripgrep 包装，支持 `multiline / -A/-B/-C / output_mode`。

### 5.3 代码智能
- `lsp`：`goToDefinition / findReferences / rename / hover / documentSymbol / workspaceSymbol / goToImplementation / incomingCalls / outgoingCalls`，目前覆盖 `.ts / .go / .py / .sh`。

### 5.4 子代理 / 委派
- `task`：开 sub-agent。类型：`explore`（轻量调研）/ `task`（跑命令）/ `general-purpose`（全工具 + Sonnet）/ `code-review` / `research`；支持 `mode=background` + `model` 覆盖。
- `read_agent` / `list_agents`：读取/列出后台 agent。

### 5.5 Web / 文档
- `web_fetch`：抓取 URL，可选 markdown 或 raw HTML。
- `web_search`：AI 驱动的带引用网络搜索。
- `fetch_copilot_cli_documentation`：拉 CLI 自身文档（被问到能力时必须先调）。

### 5.6 记忆 & 检索
- `store_memory` / `vote_memory`：写入 / 投票（scope 仅 `user`）。
- `sql`：会话 SQLite (`session`，可写) + 全局只读 (`session_store`，全部历史 + FTS5)。
  - 内置表：`todos`、`todo_deps`、`inbox_entries`
  - `session_store` schema：`sessions / turns / checkpoints / session_files / session_refs / search_index`

### 5.7 工作流 & UI
- `report_intent`：每个用户消息后第一次工具调用必须带（≤4 字），表达当前阶段意图。
- `ask_user`：向用户提问（带 choices 时是 MCQ）。
- `exit_plan_mode`：从 plan 模式退出并请求批准。
- `skill`：调用某个技能。
- `tool_search_tool_regex`：用正则在所有工具里搜能力。

---

## 6. 模型清单（`/model` 或 `task` 的 `model` 参数）

| ID | 名称 | 档位 |
|---|---|---|
| `gpt-5.5` | GPT-5.5 | premium |
| `gpt-5.4` | GPT-5.4 | standard |
| `gpt-5.3-codex` | GPT-5.3-Codex | standard |
| `gpt-5.2-codex` | GPT-5.2-Codex | standard |
| `gpt-5.2` | GPT-5.2 | standard |
| `gpt-5.4-mini` | GPT-5.4 mini | fast/cheap |
| `gpt-5-mini` | GPT-5 mini | fast/cheap |
| `gpt-4.1` | GPT-4.1 | fast/cheap |
| `claude-sonnet-4.6` | Claude Sonnet 4.6 | standard |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | standard |
| `claude-haiku-4.5` | Claude Haiku 4.5 | fast/cheap |
| `claude-opus-4.7` | Claude Opus 4.7 | premium（当前） |

---

## 7. 常用工作流

### 7.1 进入新仓库
```text
/init                       # 让 Copilot 写 .github/copilot-instructions.md
/env                        # 查看已加载的 instructions / skills / MCP
/skills                     # 看哪些技能匹配该仓库
/mcp                        # 看 MCP 配置
```

### 7.2 调研 & 写代码
```text
/plan                       # 进入 plan 模式
/research <题目>            # 深度调研（GitHub + Web）
/review                     # 跑 code review agent
/diff                       # 看本地改动
/pr                         # 操作当前分支 PR
```

### 7.3 会话管理
```text
/context                    # 看 token 用量
/compact                    # 历史过长时压缩
/rewind 或 /undo            # 撤销上一轮（含文件修改）
/share md|html|gist         # 导出会话
/resume <id>                # 切别的会话
/chronicle                  # 翻历史
```

### 7.4 提速 / 并行
```text
/fleet                      # 开 fleet 并行子代理
/autopilot                  # 让我自动批准
/delegate                   # 整段甩到 GitHub 跑 PR
/after 30m run tests        # 延时任务
/every 1h /my-skill         # 周期任务
```

### 7.5 本机三件套（用户自定义规则）
- **代码诊断**：`tsc --noEmit` / `go vet + go build` / `pyright --outputjson` / `shellcheck`（详见 `~/.copilot/skills/lsp-usage/SKILL.md`）
- **日志追踪**：`tail -F`（不要 `-f`）、`grep --line-buffered`、`journalctl --no-pager -o cat`、`docker logs --since 5m --tail 200`，详见 `~/.copilot/skills/log-tailing/SKILL.md`
- **Shell + LSP + tail logs**：用户钦定的"破除幻想"三件套，runtime 调试必走

---

## 8. 本仓库专属备忘

- 主要文档：`README.md`、`CLAUDE.md`、`CLAUDE_CODE_GUIDE.md`、`GITHUB_CODE_ANALYSIS_TOOLS_SURVEY.md`、`.agents/skills/repo-investigator/docs/TOOLS_GUIDE.md`
- 入口：`node bin/repo-inv ...` 或 `bash .agents/skills/repo-investigator/scripts/analyze.sh ...`
- 没有测试 / 没有 lint，`npm test` 是占位
- **探索本仓库优先使用 code-review-graph MCP 工具**（`semantic_search_nodes / query_graph / detect_changes / get_impact_radius` 等），不要直接 grep
- 加新工具要在三处同步：`lib/tools.js` 的 `TOOLS` 注册表、`lib/runner.js` 的 `run*` 函数、`analyze.sh`

---

*Generated by Copilot CLI（数据来源：`fetch_copilot_cli_documentation` + 当前会话注入的 `<available_skills>` + 工具 schema）。*
