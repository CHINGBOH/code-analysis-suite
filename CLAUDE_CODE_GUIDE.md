# Claude Code 完整使用指引

> 基于官方文档整理，覆盖所有 `/` 命令、CLI 标志、快捷键及本仓库专属技能。
> 最后更新：2026-05-25

---

## 目录

1. [会话内 / 命令（完整清单）](#会话内--命令完整清单)
2. [本仓库专属技能](#本仓库专属技能)
3. [CLI 启动命令](#cli-启动命令)
4. [CLI 常用标志](#cli-常用标志)
5. [快捷键速查](#快捷键速查)
6. [输入技巧](#输入技巧)
7. [权限模式](#权限模式)

---

## 会话内 / 命令（完整清单）

在会话中输入 `/` 可弹出命令菜单，输入 `/` + 字母可过滤。  
标注 **[技能]** 的是 bundled skill，底层是 prompt，其余是内置命令。  
部分命令依赖平台/套餐，不一定对所有用户可见。

### 会话管理

| 命令 | 说明 |
|------|------|
| `/clear [name]` | 开始新对话（清空上下文），旧对话可用 `/resume` 找回。别名：`/reset`、`/new` |
| `/compact [说明]` | 压缩对话历史以节省 token，可传压缩焦点说明 |
| `/context [all]` | 可视化当前 context 用量，显示优化建议；传 `all` 展开详情 |
| `/resume [session]` | 按 ID/名称恢复历史会话，或打开选择器。别名：`/continue` |
| `/branch [name]` | 在当前节点创建对话分支（相当于 fork 一条新时间线）。别名：`/fork` |
| `/rewind` | 回滚代码和对话到某个检查点，或对选定消息生成摘要。别名：`/checkpoint`、`/undo` |
| `/export [filename]` | 将当前对话导出为纯文本，可指定文件名或复制到剪贴板 |
| `/copy [N]` | 复制最近一条 AI 回复到剪贴板，传 N 复制第 N 条 |
| `/rename [name]` | 给当前会话命名，不传参数则自动生成名称 |
| `/recap` | 生成当前会话的一行摘要（离开一段时间后也会自动显示） |
| `/exit` | 退出 CLI（后台会话中是"分离"而非停止）。别名：`/quit` |

### 模型与性能

| 命令 | 说明 |
|------|------|
| `/model [model]` | 切换模型；不传参打开选择器，按 `d` 设为默认 |
| `/effort [level\|auto]` | 设置推理力度：`low/medium/high/xhigh/max`；不传参打开滑块 |
| `/fast [on\|off]` | 切换快速模式（Opus + 更快输出） |

### 代码审查与质量

| 命令 | 说明 |
|------|------|
| `/code-review [level] [--comment] [target]` | **[技能]** 审查当前 diff 的正确性 bug；`--comment` 将结果发为 GitHub PR 行内评论。别名原为 `/simplify` |
| `/security-review` | 对当前分支的改动做安全漏洞分析（注入、认证、数据暴露等） |
| `/review [PR]` | 审查 Pull Request（本地会话内） |
| `/ultrareview [PR]` | 深度多 agent 云端代码审查（Pro/Max 含 3 次免费额度） |
| `/diff` | 交互式查看未提交改动及每轮 diff，左右切换 git diff 和 Claude turn diff |

### 工作流与并行任务

| 命令 | 说明 |
|------|------|
| `/plan [description]` | 进入计划模式，Claude 在执行前先展示每步操作等待确认 |
| `/batch <instruction>` | **[技能]** 大规模并行修改：分解为 5-30 个独立单元，各自开 worktree + 跑测试 + 开 PR |
| `/background [prompt]` | 将当前会话降级为后台 agent，释放终端。别名：`/bg` |
| `/agents` | 管理 subagent 配置 |
| `/tasks` | 列出并管理当前会话的后台任务。别名：`/bashes` |
| `/goal [condition\|clear]` | 设置目标：Claude 持续工作直到条件满足 |
| `/autofix-pr [prompt]` | 在云端监视当前分支 PR，CI 失败或有 review comment 时自动推送修复 |
| `/loop [interval] [prompt]` | **[技能]** 循环执行 prompt；省略 interval 则 Claude 自定节奏；省略 prompt 则运行内置维护检查。别名：`/proactive` |
| `/schedule [description]` | 创建/管理定时 routine（云端执行）。别名：`/routines` |
| `/ultraplan <prompt>` | 在 ultraplan 会话中起草计划，浏览器审查后远端执行或发回终端 |

### 项目初始化与记忆

| 命令 | 说明 |
|------|------|
| `/init` | 为当前仓库生成 `CLAUDE.md`；设置 `CLAUDE_CODE_NEW_INIT=1` 开启交互式向导 |
| `/memory` | 编辑 `CLAUDE.md` 记忆文件、管理 auto-memory 条目 |
| `/add-dir <path>` | 临时添加工作目录（文件访问权限，非配置发现） |
| `/team-onboarding` | 根据过去 30 天用法生成团队入门指引 Markdown，Pro/Max 含分享链接 |

### 配置与设置

| 命令 | 说明 |
|------|------|
| `/config` | 打开设置界面（主题、模型、输出风格等）。别名：`/settings` |
| `/theme` | 更换颜色主题，含 auto/light/dark/色盲优化/ANSI/自定义主题 |
| `/permissions` | 管理工具权限的 allow/ask/deny 规则。别名：`/allowed-tools` |
| `/hooks` | 查看 hook 配置（工具事件的钩子） |
| `/keybindings` | 打开或创建键盘绑定配置文件 |
| `/statusline` | 配置 Claude Code 的状态行显示 |
| `/terminal-setup` | 为 VS Code/Cursor/Windsurf/Alacritty/Zed 配置 Shift+Enter 等快捷键 |
| `/tui [default\|fullscreen]` | 切换终端 UI 渲染器（fullscreen 为无闪烁全屏模式） |
| `/color [color\|default]` | 设置当前会话的 prompt bar 颜色 |
| `/scroll-speed` | 调整鼠标滚轮速度（仅全屏模式） |
| `/focus` | 切换聚焦视图（仅显示最后一条 prompt + 工具摘要 + 回复，仅全屏模式） |

### 技能管理

| 命令 | 说明 |
|------|------|
| `/skills` | 列出所有可用技能，按 `t` 按 token 数排序，按 `Space` 隐藏技能 |
| `/plugin` | 管理 Claude Code 插件。别名：`/plugins` |
| `/reload-plugins` | 热重载所有插件（无需重启） |
| `/fewer-permission-prompts` | **[技能]** 扫描历史记录，自动将常用只读命令加入白名单，减少权限弹窗 |
| `/update-config` | **[本仓库技能]** 修改 `settings.json`，配置自动化行为、权限、hooks、环境变量 |
| `/keybindings-help` | **[本仓库技能]** 自定义键盘快捷键，修改 `~/.claude/keybindings.json` |

### 运行与验证

| 命令 | 说明 |
|------|------|
| `/run` | **[技能]** 启动并驱动项目应用，实际观察改动效果（非依赖测试） |
| `/verify` | **[技能]** 构建+运行+观察，验证改动是否符合预期 |
| `/run-skill-generator` | **[技能]** 为 `/run` 和 `/verify` 生成项目专属的启动技能文件 |
| `/debug [description]` | **[技能]** 开启 debug 日志并分析当前会话的调试日志 |
| `/doctor` | 诊断 Claude Code 安装和配置问题，按 `f` 自动修复 |

### 集成与连接

| 命令 | 说明 |
|------|------|
| `/mcp` | 管理 MCP 服务器连接和 OAuth 认证 |
| `/ide` | 管理 IDE 集成状态 |
| `/remote-control` | 将当前会话暴露给 claude.ai 远程控制。别名：`/rc` |
| `/teleport` | 将 claude.ai 上的 web 会话拉取到本地终端。别名：`/tp` |
| `/install-github-app` | 为仓库安装 Claude GitHub Actions |
| `/install-slack-app` | 安装 Claude Slack 机器人 |
| `/web-setup` | 连接 GitHub 账户到 Claude Code on the web |
| `/remote-env` | 配置 `--remote` 启动的默认远端环境 |
| `/chrome` | 配置 Claude in Chrome 设置 |
| `/desktop` | 在 Claude Code 桌面应用中继续当前会话（macOS/Windows）。别名：`/app` |
| `/mobile` | 显示下载 Claude 移动端的二维码。别名：`/ios`、`/android` |
| `/setup-bedrock` | 配置 Amazon Bedrock 认证向导（需设 `CLAUDE_CODE_USE_BEDROCK=1`） |
| `/setup-vertex` | 配置 Google Vertex AI 认证向导（需设 `CLAUDE_CODE_USE_VERTEX=1`） |

### Claude API 开发

| 命令 | 说明 |
|------|------|
| `/claude-api [migrate\|managed-agents-onboard]` | **[技能]** 加载 Claude API 参考资料（工具调用、流式、批处理、结构化输出）；`migrate` 升级旧模型代码；`managed-agents-onboard` 交互式创建 Managed Agent |

### 杂项

| 命令 | 说明 |
|------|------|
| `/btw <question>` | 快速旁问（不计入对话历史，可在 Claude 工作时提问） |
| `/context [all]` | 查看当前 context 使用详情 |
| `/usage` | 查看本次会话费用、套餐用量和活动统计。别名：`/cost`、`/stats` |
| `/usage-credits` | 配置超额用量额度（原 `/extra-usage`） |
| `/privacy-settings` | 查看和更新隐私设置（Pro/Max 订阅者） |
| `/insights` | 生成会话分析报告（项目区域、交互模式、摩擦点） |
| `/release-notes` | 查看版本更新日志的交互式选择器 |
| `/status` | 查看版本、模型、账户、连接状态（可在 Claude 回复时使用） |
| `/login` | 登录 Anthropic 账户 |
| `/logout` | 退出登录 |
| `/help` | 显示帮助和可用命令列表 |
| `/heapdump` | 写出 JS 堆快照到桌面，用于诊断高内存占用 |
| `/feedback [report]` | 提交 bug 报告或分享对话。别名：`/bug`、`/share` |
| `/sandbox` | 切换沙盒模式（仅支持的平台） |
| `/powerup` | 通过交互式动画课程发现 Claude Code 特性 |
| `/radio` | 在浏览器中打开 Claude FM lo-fi 电台 |
| `/passes` | 赠送好友一周免费 Claude Code（仅符合条件的账户可见） |
| `/upgrade` | 打开升级计划页面 |
| `/stickers` | 订购 Claude Code 贴纸 |
| `/stop` | 停止当前后台会话（仅在附加到后台会话时可用） |

---

## 本仓库专属技能

除上述内置命令外，本仓库还提供以下专属技能：

| 技能 | 触发方式 | 说明 |
|------|---------|------|
| `update-config` | `/update-config` | 配置 settings.json（hooks、权限、自动化行为） |
| `keybindings-help` | `/keybindings-help` | 自定义键盘快捷键 |
| `verify` | `/verify` | 运行并验证改动在真实应用中的效果 |
| `code-review` | `/code-review` | 审查 diff，支持 `--comment` 发为 PR 行内评论 |
| `fewer-permission-prompts` | `/fewer-permission-prompts` | 减少权限弹窗 |
| `loop` | `/loop` | 循环/定时执行任务 |
| `schedule` | `/schedule` | 创建云端定时 routine |
| `claude-api` | `/claude-api` | Claude API / Anthropic SDK 开发助手 |
| `run` | `/run` | 启动项目应用验证效果 |
| `init` | `/init` | 生成 CLAUDE.md |
| `review` | `/review` | 审查 PR |
| `security-review` | `/security-review` | 安全审查当前分支改动 |
| `repo-investigator` | 由 Claude 自动调用或手动触发 | 三层代码库分析框架（架构/逻辑/效率） |

---

## CLI 启动命令

在终端直接执行的命令（非会话内）：

| 命令 | 说明 |
|------|------|
| `claude` | 启动交互会话 |
| `claude "query"` | 启动并传入初始 prompt |
| `claude -p "query"` | 非交互模式：输出结果后退出 |
| `cat file \| claude -p "query"` | 处理管道内容 |
| `claude -c` | 继续当前目录最近的会话 |
| `claude -r "<session>" "query"` | 按 ID 或名称恢复指定会话 |
| `claude -w feature-auth` | 在独立 git worktree 中启动（隔离工作区） |
| `claude --bg "task"` | 以后台 agent 模式启动，立即返回终端 |
| `claude --remote "task"` | 在 claude.ai 创建 web 会话 |
| `claude agents` | 打开 agent 管理视图 |
| `claude attach <id>` | 连接到后台会话 |
| `claude logs <id>` | 查看后台会话的输出日志 |
| `claude stop <id>` | 停止后台会话（别名：`claude kill`) |
| `claude rm <id>` | 从列表移除后台会话（对话记录保留） |
| `claude respawn <id>` | 重启后台会话（对话保留）；`--all` 重启全部 |
| `claude update` | 更新到最新版本 |
| `claude install [version]` | 安装或重装指定版本（如 `stable`、`latest`、`2.1.118`） |
| `claude auth login` | 登录（`--console` 用 API key 计费，`--sso` 强制 SSO） |
| `claude auth logout` | 登出 |
| `claude auth status` | 查看认证状态（`--text` 人类可读格式） |
| `claude mcp` | 配置 MCP 服务器 |
| `claude plugin` | 管理插件 |
| `claude project purge [path]` | 删除项目的所有本地状态（对话、任务、日志等） |
| `claude remote-control` | 以远程控制服务器模式启动 |
| `claude ultrareview [target]` | 非交互模式运行 ultrareview，输出到 stdout |
| `claude daemon status` | 查看后台 supervisor 进程状态 |
| `claude auto-mode defaults` | 打印内置 auto 模式分类规则（JSON） |
| `claude setup-token` | 生成长效 OAuth token（用于 CI/脚本） |

---

## CLI 常用标志

| 标志 | 说明 |
|------|------|
| `-p` / `--print` | 非交互模式，输出后退出 |
| `-c` / `--continue` | 继续当前目录最近会话 |
| `-r` / `--resume <name>` | 恢复指定会话 |
| `-n` / `--name <name>` | 为会话设置显示名 |
| `-w` / `--worktree <name>` | 在独立 git worktree 中启动 |
| `--model <model>` | 指定模型（如 `sonnet`、`opus`、`claude-sonnet-4-6`） |
| `--effort <level>` | 设置推理力度（`low/medium/high/xhigh/max`） |
| `--permission-mode <mode>` | 初始权限模式（`default/acceptEdits/plan/auto/bypassPermissions`） |
| `--bg` | 以后台 agent 模式启动 |
| `--bare` | 精简模式：跳过 hooks/skills/MCP/memory 自动发现，启动更快 |
| `--verbose` | 详细日志，显示完整 turn-by-turn 输出 |
| `--debug [categories]` | 开启 debug 模式，可过滤类别（如 `"api,hooks"`） |
| `--add-dir <path>` | 添加额外工作目录 |
| `--tools <list>` | 限制可用工具（`""` 禁用全部，`"Bash,Edit,Read"` 指定） |
| `--allowedTools <rules>` | 无需确认直接执行的工具规则 |
| `--disallowedTools <rules>` | 拒绝执行的工具规则 |
| `--system-prompt <text>` | 替换默认 system prompt |
| `--append-system-prompt <text>` | 追加到默认 system prompt |
| `--mcp-config <file>` | 从 JSON 文件加载 MCP 服务器配置 |
| `--max-turns <N>` | 限制 agentic turns 数量（非交互模式） |
| `--max-budget-usd <N>` | 限制 API 费用上限（非交互模式） |
| `--output-format <fmt>` | 输出格式：`text`、`json`、`stream-json` |
| `--chrome` | 启用 Chrome 浏览器集成 |
| `--tmux` | 为 worktree 创建 tmux 会话 |
| `--remote-control` / `--rc` | 启动时开启远程控制 |

---

## 快捷键速查

### 通用控制

| 快捷键 | 说明 |
|--------|------|
| `Ctrl+C` | 中断当前操作；输入为空时两次退出 |
| `Ctrl+D` | 退出会话 |
| `Ctrl+L` | 强制重绘终端 |
| `Ctrl+O` | 切换 transcript 查看器（展开工具调用详情） |
| `Ctrl+R` | 反向搜索命令历史 |
| `Ctrl+B` | 将 bash 命令移到后台（tmux 用户按两次） |
| `Ctrl+T` | 切换任务列表显示 |
| `Ctrl+G` 或 `Ctrl+X Ctrl+E` | 在外部编辑器中编辑当前 prompt |
| `Ctrl+X Ctrl+K` | 终止所有后台 subagent（3 秒内按两次确认） |
| `Shift+Tab` | 循环切换权限模式（default → acceptEdits → plan → auto…） |
| `Esc` | 中断 Claude 当前回复 |
| `Esc` + `Esc` | 清空输入草稿；输入为空时打开回溯菜单 |
| `Option/Alt+P` | 切换模型（不清空 prompt） |
| `Option/Alt+T` | 切换 extended thinking 模式 |
| `Option/Alt+O` | 切换快速模式 |

### 文本编辑

| 快捷键 | 说明 |
|--------|------|
| `Ctrl+A` / `Ctrl+E` | 光标移到行首/行尾 |
| `Ctrl+K` | 删除到行尾 |
| `Ctrl+U` | 删除到行首 |
| `Ctrl+W` | 删除前一个单词 |
| `Ctrl+Y` | 粘贴上次删除的内容 |
| `Alt+B` / `Alt+F` | 按单词向前/向后移动光标（macOS 需设 Option 为 Meta） |

### 多行输入

| 方式 | 快捷键 |
|------|--------|
| 通用（任何终端）| `\` + `Enter` 或 `Ctrl+J` |
| macOS（Option 为 Meta）| `Option+Enter` |
| 主流终端原生支持 | `Shift+Enter`（iTerm2/WezTerm/Ghostty/Kitty 等） |

### Transcript 查看器（Ctrl+O 后）

| 快捷键 | 说明 |
|--------|------|
| `Ctrl+E` | 切换显示全部内容 |
| `{` / `}` | 跳到上/下一条用户 prompt（全屏模式） |
| `[` | 将对话写入终端原生滚动缓冲（全屏模式） |
| `v` | 在 `$EDITOR` 中打开对话（全屏模式） |
| `q` / `Ctrl+C` / `Esc` | 退出查看器 |

---

## 输入技巧

| 前缀 | 说明 |
|------|------|
| `/` | 命令/技能（弹出菜单或过滤） |
| `!` | Shell 模式：直接执行 shell 命令并将输出加入对话上下文 |
| `@` | 文件路径自动补全 |
| `Tab` / `→` | 接受 prompt 建议 |

**`!` shell 模式示例：**
```bash
! git status
! npm test
! ls -la
```

---

## 权限模式

通过 `Shift+Tab` 循环切换，或启动时用 `--permission-mode` 指定：

| 模式 | 说明 |
|------|------|
| `default` | 每次写文件/执行命令前询问 |
| `acceptEdits` | 自动接受文件编辑，命令仍需确认 |
| `plan` | 计划模式：Claude 展示计划等待确认后才执行 |
| `auto` | 自动模式：基于内置规则自动判断是否需要确认 |
| `bypassPermissions` | 跳过所有权限检查（危险，仅用于受控环境） |

---

## MCP 命令

已连接的 MCP 服务器会自动将其 prompts 暴露为命令，格式为：

```
/mcp__<server>__<prompt>
```

本仓库已启用的 MCP 服务器：`code-review-graph`（见 `.claude/settings.local.json`）。

---

Sources:
- [Commands reference — Claude Code Docs](https://code.claude.com/docs/en/commands)
- [CLI reference — Claude Code Docs](https://code.claude.com/docs/en/cli-reference)
- [Interactive mode — Claude Code Docs](https://code.claude.com/docs/en/interactive-mode)
