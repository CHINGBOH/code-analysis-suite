# GitHub 开源代码分析工具全景调研报告

> 调研目的：全方位调研某个感兴趣的开源库
> 三个层面：① 文件夹/架构层面 → ② 文件/业务逻辑层面 → ③ 函数参数/代码效率层面

---

## 第一层：文件夹 / 架构层面（Architecture & Module Level）

> **关注问题**：项目如何组织？模块间依赖关系？架构是否清晰？有无循环依赖？是否符合分层设计？

### 1.1 架构文档与建模（C4 模型、声明式架构图）

| 工具 | Stars | 语言/类型 | 核心能力 |
|------|-------|----------|----------|
| **[Structurizr DSL](https://github.com/structurizr/dsl)** | ~1.1k | Java/DSL | **C4 模型官方实现**。用代码定义系统上下文、容器、组件、代码四级架构，一个模型生成多张图，支持交互式探索 |
| **[D2](https://github.com/terrastruct/d2)** | ~19k | Go/DSL | **声明式架构图绘制**。比 Mermaid 更适合复杂系统架构，支持 ELK/TALA 布局引擎，可导出 SVG/PNG/PDF |
| **[Backstage](https://github.com/backstage/backstage)** | ~28k | TypeScript | **Spotify 开发者门户**。软件目录、服务地图、技术文档统一，适合微服务/多仓库架构调研 |
| **[C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML)** | ~4.5k | PlantUML | C4 模型的 PlantUML 实现，轻量级，可直接在 Markdown 中使用 |

### 1.2 架构约束验证（Architecture as Test）

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[ArchUnit](https://github.com/TNG/ArchUnit)** | ~3.5k | Java | **用单元测试写架构规则**。如 *"domain 层禁止依赖 infrastructure 层"*、检测循环依赖、包结构合规 |
| **[ArchUnitNET](https://github.com/TNG/ArchUnitNET)** | ~500 | .NET | ArchUnit 的 C# 移植版 |
| **[ts-arch](https://github.com/ts-arch/ts-arch)** | ~300 | TypeScript | 检查 TS 项目模块依赖方向 |
| **[deptrac](https://github.com/qossmic/deptrac)** | ~2.5k | PHP | 定义架构层，检测非法跨层依赖 |
| **[Modulith](https://github.com/spring-projects/spring-modulith)** | ~1.5k | Java/Spring | Spring 官方模块化验证，自动检测模块边界违规 |
| **[import-linter](https://github.com/seddonym/layer_linter)** | ~800 | Python | Python 分层依赖检查 |

### 1.3 代码结构图谱化（图数据库查询架构）

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[jQAssistant](https://github.com/jqassistant/jqassistant)** | ~1.5k | **最强推荐**。扫描代码生成 Neo4j 图谱，用 Cypher 查询架构问题：*"哪些包被超过 10 个其他包依赖？"*、*"是否存在循环依赖？"* |
| **[Joern](https://github.com/joernio/joern)** | ~3k | 基于 Code Property Graph (CPG) 的代码分析平台，融合 AST+CFG+PDG，用 Scala DSL 查询代码结构 |
| **[Sourcegraph](https://github.com/sourcegraph/sourcegraph)** | ~10k | 大规模代码搜索与导航，跨仓库跳转、引用追踪，理解巨型代码库的架构依赖 |

### 1.4 依赖与模块可视化（自动化生成）

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[Emerge](https://github.com/glato/emerge)** | ~500 | Python | 浏览器交互式依赖可视化，支持 C/C++/Java/JS/TS/Python/Go/Ruby/Swift，生成力导向图 + Louvain 聚类 |
| **[Dependency-Cruiser](https://github.com/sverweij/dependency-cruiser)** | ~5k | JS/TS | 你已有。验证 JS/TS 依赖规则，生成依赖图，检测循环依赖 |
| **[Madge](https://github.com/pahen/madge)** | ~4k | JS/TS | 你已有。可视化 JS/TS 依赖，检测循环依赖 |
| **[pydeps](https://github.com/thebjorn/pydeps)** | ~1.5k | Python | 你已有。Python 模块依赖图 |
| **[Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail)** | ~14k | 多语言 | **交互式代码浏览器**（项目已归档但仍可用）。可视化类、函数、调用关系，像 Google Maps 一样浏览代码 |
| **[Code-Review-Graph](https://github.com/...)** | - | 通用 | 你已有。基于 MCP 的知识图谱分析工具 |

### 1.5 3D/城市隐喻架构可视化

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[CodeCity](https://wettel.github.io/codecity.html)** | 学术项目 | **经典 3D 代码城市**。类=建筑，包=街区，建筑高度=代码量。Smalltalk 实现，有 Eclipse 插件 |
| **[JSCity](https://github.com/aserg-ufmg/JSCity)** | ~200 | JavaScript 代码城市，文件夹=街区，文件=小区，函数=建筑 |
| **[SoftVis3D](https://github.com/sdbs-csyt/softvis3d)** | ~200 | SonarQube 插件，3D 代码城市可视化，建筑高度=复杂度 |
| **[gource](https://github.com/acaudwell/Gource)** | ~11k | 时间轴上的 3D 代码城市演化（侧重历史而非静态架构）|

### 1.6 开发者门户 / 系统架构（宏观）

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[Backstage](https://github.com/backstage/backstage)** | ~28k | 软件目录、API 目录、服务依赖图、技术文档统一门户 |
| **[ContextMapper](https://github.com/ContextMapper)** | ~800 | DDD 战略设计，生成上下文映射图、服务契约 |

---

## 第二层：文件 / 业务逻辑层面（File & Business Logic Level）

> **关注问题**：文件内部逻辑如何流转？控制流、数据流、调用链、业务规则如何？有无死代码、重复逻辑？

### 2.1 通用静态分析 / 安全漏洞（多语言）

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[Semgrep](https://github.com/semgrep/semgrep)** | ~14.6k | 多语言(30+) | **规则像代码一样写**。AST 模式匹配，支持过程内污点追踪，秒级扫描万行项目 |
| **[CodeQL](https://github.com/github/codeql)** | ~7k | 多语言 | **GitHub 官方语义分析引擎**。基于关系数据库的深层语义查询，发现复杂漏洞模式 |
| **[Infer](https://github.com/facebook/infer)** | ~14.3k | Java/C/C++/Obj-C | **Meta 出品**。发现空指针、内存泄漏、资源竞争，分析速度快 |
| **[Joern](https://github.com/joernio/joern)** | ~3k | C/C++/Java | CPG 图查询，深层数据流分析，适合安全研究 |
| **[PMD](https://github.com/pmd/pmd)** | ~5k | Java/JS/Apex/PLSQL | 静态规则分析，可扩展自定义规则 |
| **[ast-grep](https://github.com/ast-grep/ast-grep)** | ~6k | 多语言 | **AST 层面的 grep**。基于语法树搜索、lint、重写代码，像正则但懂语法 |
| **[OpenStaticAnalyzer](https://github.com/sed-inf-u-szeged/OpenStaticAnalyzer)** | ~300 | C/C++/Java | 深度静态分析，生成调用图、继承图、控制流图 |

### 2.2 控制流与业务逻辑可视化

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[code2flow](https://github.com/carterbox/code2flow)** | ~2k | Python/JS/Ruby/PHP | 你已有。生成函数调用流程图 |
| **[CodeVisualizer](https://github.com/DucPhamNgoc08/CodeVisualizer)** | ~200 | 多语言(VS Code 插件) | 函数级控制流图 + 代码库依赖图，支持 8+ 语言，AI 增强标签 |
| **[pyan3](https://github.com/Technologicat/pyan)** | ~500 | Python | 你已有。Python 静态调用图 |
| **[CallFlow](https://github.com/LLNL/CallFlow)** | ~100 | C/C++/Python | 交互式调用树/图可视化，D3 渲染，支持比较可视化 |
| **[LLVM-FLOW](https://github.com/kc-ml2/llvm-flow)** | ~100 | LLVM IR | LLVM IR 控制流图交互式可视化，支持优化前后对比 |

### 2.3 代码克隆 / 重复检测（业务逻辑重复）

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[jscpd](https://github.com/kucherenko/jscpd)** | ~5k | 多语言复制粘贴检测，发现重复/坏味道代码 |
| **[PMD CPD](https://github.com/pmd/pmd)** | ~5k | PMD 内置的 Copy-Paste Detector |
| **[jsinspect](https://github.com/danielstjules/jsinspect)** | ~2k | JS 结构相似性检测 |

### 2.4 代码质量与异味（文件级）

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[SonarQube](https://github.com/SonarSource/sonarqube)** | ~8k | 多语言 | **最流行代码质量平台**。代码异味、漏洞、技术债、覆盖率，有免费社区版 |
| **[Mega-Linter](https://github.com/oxsecurity/megalinter)** | ~2k | 多语言 | 聚合 70+ 种 linter，一站式代码质量检查 |
| **[codemetrics](https://github.com/kisstkondoros/gocodemetrics)** | - | Go | 代码复杂度度量 |

### 2.5 数据流与污点分析（安全逻辑）

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[CodeQL](https://github.com/github/codeql)** | ~7k | 深层数据流分析，跨过程污点追踪 |
| **[Semgrep](https://github.com/semgrep/semgrep)** | ~14.6k | 过程内污点追踪，规则生态庞大 |
| **[Joern](https://github.com/joernio/joern)** | ~3k | CPG 数据流分析，安全研究友好 |

---

## 第三层：函数参数 / 代码效率层面（Function & Efficiency Level）

> **关注问题**：函数跑得快不快？参数是否合理？时间花在哪里？内存泄漏？复杂度多高？

### 3.1 采样性能分析器（生产环境安全）

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[py-spy](https://github.com/benfred/py-spy)** | ~11k | Python | **Python 采样分析器**。Rust 编写，极低开销，无需修改代码，生成火焰图/Speedscope |
| **[rbspy](https://github.com/rbspy/rbspy)** | ~3k | Ruby | Ruby 采样分析器，py-spy 的灵感来源 |
| **[phpspy](https://github.com/adsr/phpspy)** | ~500 | PHP | PHP 采样分析器 |
| **[Austin](https://github.com/P403n1x87/austin)** | ~1.5k | Python | C 编写的 Python 采样分析器，超低开销 |
| **[pyinstrument](https://github.com/joerick/pyinstrument)** | ~6k | Python | Python 调用栈分析器，输出调用时间统计 |
| **[async-profiler](https://github.com/jvm-profiling-tools/async-profiler)** | ~7k | Java/JVM | JVM 采样分析器，无 Safepoint 偏差问题 |
| **[pprof](https://github.com/google/pprof)** | ~7k | Go | Go 官方性能分析工具，火焰图可视化 |
| **[0x](https://github.com/davidmarkclements/0x)** | ~2k | Node.js | Node.js 火焰图生成 |

### 3.2 火焰图可视化（通用）

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[speedscope](https://github.com/jlfwong/speedscope)** | ~11k | **通用火焰图查看器**。支持 Python/Ruby/Go/JS/Java/perf 等 20+ 格式，三种视图（时序/左重/三明治），纯浏览器运行 |
| **[FlameGraph](https://github.com/brendangregg/FlameGraph)** | ~17k | Brendan Gregg 经典火焰图生成脚本，Linux perf 数据 |
| **[flamebearer](https://github.com/mapbox/flamebearer)** | ~1k | Node.js 快速火焰图渲染 |

### 3.3 持续性能分析（Continuous Profiling）

| 工具 | Stars | 核心能力 |
|------|-------|----------|
| **[Pyroscope](https://github.com/grafana/pyroscope)** | ~9k | Grafana 出品，持续性能分析平台，支持 Go/Python/Java/Ruby/Node/.NET/PHP/Rust/eBPF |
| **[Parca](https://github.com/parca-dev/parca)** | ~4k | 开源持续性能分析，支持 eBPF |
| **[pprof](https://github.com/google/pprof)** | ~7k | Go 持续分析生态核心 |

### 3.4 圈复杂度与代码度量

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[lizard](https://github.com/terryyin/lizard)** | ~3.5k | 多语言 | 圈复杂度(CCN)、token 数、参数数分析，支持 C/C++/Java/JS/Python/Go 等 |
| **[radon](https://github.com/rubik/radon)** | ~1k | Python | Python 圈复杂度、Halstead 度量、可维护性指数 |
| **[wily](https://github.com/tonybaloney/wily)** | ~500 | Python | Python 代码复杂度历史追踪，看复杂度趋势 |
| **[xenon](https://github.com/rubik/xenon)** | ~200 | Python | 基于 radon 的复杂度监控，CI 集成 |
| **[scc](https://github.com/boyter/scc)** | ~19k | Go | **极速代码统计**，支持复杂度估算，替代 cloc |
| **[tokei](https://github.com/XAMPPRocky/tokei)** | ~11k | Rust | 超快代码行数统计 |

### 3.5 内存分析

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[memray](https://github.com/bloomberg/memray)** | ~12k | Python | Bloomberg 出品，Python 内存分析器，追踪内存分配 |
| **[pprof](https://github.com/google/pprof)** | ~7k | Go | Go 内存分析 |
| **[Massif](https://valgrind.org/info/tools.html)** | - | C/C++ | Valgrind 内存使用分析 |

### 3.6 函数参数分析

| 工具 | Stars | 语言 | 核心能力 |
|------|-------|------|----------|
| **[lizard](https://github.com/terryyin/lizard)** | ~3.5k | 多语言 | 统计函数参数数量，标记参数过多的函数 |
| **[CodeQL](https://github.com/github/codeql)** | ~7k | 多语言 | 可自定义查询统计函数参数、返回值等 |
| **[Joern](https://github.com/joernio/joern)** | ~3k | C/C++/Java | CPG 查询函数签名、参数类型、调用点 |
| **[pylint](https://github.com/PyCQA/pylint)** | ~5k | Python | 内置规则检查函数参数数量、复杂度 |
| **[mccabe](https://github.com/PyCQA/mccabe)** | ~500 | Python | Python 圈复杂度计算 |

---

## 跨层通用工具（安全 / 依赖 / Git）

| 工具 | Stars | 层面 | 核心能力 |
|------|-------|------|----------|
| **[Trivy](https://github.com/aquasecurity/trivy)** | ~24k | 全层 | 漏洞扫描、密钥检测、配置错误、许可证检查 |
| **[Gitleaks](https://github.com/gitleaks/gitleaks)** | ~18k | 文件层 | 检测代码库中的密钥、token、密码泄露 |
| **[OSV-Scanner](https://github.com/google/osv-scanner)** | ~6k | 架构层 | Google 出品，扫描依赖中的已知 CVE |
| **[Syft](https://github.com/anchore/syft)** | ~12k | 架构层 | 生成 SBOM（软件物料清单）|
| **[Grype](https://github.com/anchore/grype)** | ~8k | 架构层 | 基于 Syft 的漏洞扫描 |
| **[git-fame](https://github.com/casperdcl/git-fame)** | ~1k | 架构层 | 贡献者统计，判断项目活跃度 |
| **[code-maat](https://github.com/adamtornhill/code-maat)** | ~2.5k | 架构层 | Git 日志分析代码热点、演化趋势 |
| **[SARIF](https://github.com/oasis-tcs/sarif-spec)** | - | 全层 | 静态分析结果标准格式，统一各工具输出 |

---

## 推荐组合（按场景）

### 快速了解一个陌生项目（5 分钟）
```bash
scc .                    # 代码规模与语言构成
git-fame .               # 贡献者活跃度
pydeps / madge / depcruise  # 依赖关系图
Trivy filesystem .       # 安全漏洞快照
```

### 深度架构分析（1 小时）
```bash
Structurizr DSL          # 手动建模或用工具提取 C4 图
jQAssistant              # 导入 Neo4j，查询架构问题
Joern / CodeQL           # CPG 深层结构分析
ArchUnit (Java)          # 验证架构规则
deptrac / Nx boundaries  # 分层依赖检查
```

### 性能热点排查（30 分钟）
```bash
py-spy record -o profile.svg -- python app.py   # Python
rbspy record -p PID                              # Ruby
perf record -g ./app                             # C/C++
speedscope profile.svg                           # 可视化分析
```

### 安全审计（1 小时）
```bash
Semgrep --config=auto .     # 快速规则扫描
CodeQL database create ...  # 深层语义分析
Trivy filesystem .          # 依赖漏洞
Gitleaks detect .           # 密钥泄露
```

---

## 现有工具集缺口分析

你现有的 `code_analysis_suite` 已覆盖：
- ✅ 流程图：code2flow
- ✅ Python 依赖：pydeps, pyan3
- ✅ JS/TS 依赖：Dependency-Cruiser, Madge
- ✅ 语义搜索：Semgrep
- ✅ 知识图谱：CRG

**建议补充**（优先级排序）：

| 优先级 | 工具 | 层面 | 理由 |
|--------|------|------|------|
| P0 | **scc** | 全层 | 1 秒了解项目规模和语言 |
| P0 | **Trivy** | 全层 | 1 条命令扫漏洞+密钥+配置 |
| P1 | **jQAssistant** | 架构层 | 最强自动架构分析 |
| P1 | **Structurizr** | 架构层 | 架构文档标准化 |
| P1 | **py-spy + speedscope** | 效率层 | 性能分析黄金组合 |
| P2 | **Joern / CodeQL** | 业务层 | 深层语义分析 |
| P2 | **jscpd** | 业务层 | 重复代码检测 |
| P2 | **lizard** | 效率层 | 圈复杂度度量 |
| P3 | **Backstage** | 架构层 | 多服务架构门户（大型项目）|

---

*报告生成时间：2026-05-24*
*数据来源：GitHub 官方仓库、Awesome Static Analysis、Awesome Open Source Security*
