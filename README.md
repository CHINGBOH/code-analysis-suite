# 🔬 Code Analysis Suite

面向 AI Agent 的源码剖析工具箱：`repo-inv analyze <path>` 一条命令驱动 29 个静态分析器，产出四层证据（解剖 / 架构 / 逻辑 / 效率），建交叉仓库 SQLite 索引供检索、对比与反向审查。**目标仓库永不被修改。**

## 快速开始

```bash
git clone https://github.com/CHINGBOH/code-analysis-suite.git
cd code-analysis-suite && npm install && sudo npm link

repo-inv analyze /path/to/repo --parallel   # 分析任意仓库
repo-inv search "retry OR backoff"          # 分析过几个仓库后跨仓检索
```

## 常用命令

| 要回答的问题 | 命令 |
|---|---|
| 架构 — 入口、部署单元、依赖图 | `repo-inv dissect <repo>` · `analyze <repo> -l anatomy,arch` |
| 函数质量 — 复杂度、重复、死代码 | `repo-inv analyze <repo> -l logic` |
| 模块边界 — 循环依赖、分层违规 | `repo-inv patterns <repo>` |
| 效率 — 热点、演化、内存 | `repo-inv analyze <repo> -l efficiency` |
| 跨仓先例 — 「有人解决过吗」 | `repo-inv search "<q>"` · `borrow "<topic>"` · `compare <a> <b>` |
| 反向审查自己的项目 | `repo-inv review <repo>` · `audit <repo> --against <优秀仓库>` |

**Agent 规则**：能调工具就不读源码；引用工具输出按文件路径；工具缺失不是失败（`repo-inv tools` 查看已装分析器）。MCP 注册：`repo-inv install-mcp claude-code`，共 17 个工具，详见 [docs/MCP.md](docs/MCP.md)。

## 目录

- `bin/` CLI 与 MCP 入口 · `lib/` 核心实现 · `rules/` Semgrep 规则 · `docs/` 文档
- ⚠️ `linux/ bash/ snapd/ cli/ cc-haha/` 等目录是**已分析项目的源码快照**（语料），非套件代码

## 文档

[AI 开发标准](docs/AI_DEV_STANDARD.md) · [架构](docs/ARCHITECTURE.md) · [用法](docs/USAGE.md) · [MCP](docs/MCP.md) · [贡献](CONTRIBUTING.md) · [中文](docs/zh/README.md)

## License

[MIT](LICENSE)
