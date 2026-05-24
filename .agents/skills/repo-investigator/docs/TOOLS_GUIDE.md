# Repo Investigator — 工具技术文档

> 本文档覆盖三层分析框架中所有已安装工具的安装、配置与使用方法。

---

## 目录

- [架构层面工具](#架构层面工具-architecture-layer)
- [业务逻辑层面工具](#业务逻辑层面工具-logic-layer)
- [代码效率层面工具](#代码效率层面工具-efficiency-layer)
- [通用辅助工具](#通用辅助工具)

---

## 架构层面工具 (Architecture Layer)

### 1. D2 — 声明式架构图

**用途**：用代码画架构图，替代 Mermaid/PlantUML，适合复杂系统。

```bash
# 基础用法
echo 'x -> y -> z' > test.d2
d2 test.d2 test.svg

# 指定主题和布局引擎
d2 --theme 300 --layout elk test.d2 test.svg

# 实时预览
d2 --watch test.d2 test.svg
```

**常用参数**：
| 参数 | 说明 |
|------|------|
| `--theme N` | 主题编号 (1-301) |
| `--layout elk` | 使用 ELK 布局引擎 |
| `--layout tala` | 使用 TALA 布局（需单独安装）|
| `--watch` | 文件变更自动重绘 |
| `--dark-theme N` | 暗色主题 |

---

### 2. Joern — Code Property Graph 分析

**用途**：基于 CPG（AST+CFG+PDG）的深层代码结构分析，安全研究神器。

```bash
# 启动交互式 Shell
joern /path/to/code

# 常用 CPG 查询（在 joern shell 中）
importCode("/path/to/code")          # 导入代码
cpg.method.name.l                     # 列出所有方法名
cpg.call.code.l                       # 列出所有调用点
cpg.method.where(_.name == "main").call.name.l   # main 函数调用了什么
cpg.method.parameter.name.l           # 列出所有参数名
cpg.file.name.l                       # 列出所有文件

# 扫描已知漏洞模式
joern-scan --list-query-names         # 列出内置查询
joern-scan /path/to/code              # 运行扫描
```

**注意**：Joern 内存消耗大，大型项目需 16GB+ RAM。

---

### 3. CodeQL — 语义代码查询

**用途**：GitHub 官方语义分析引擎，深层数据流追踪。

```bash
# 创建数据库（需编译的语言要先能编译）
codeql database create --language=python ./codeql-db --source-root=/path/to/repo

# 分析（Java 示例）
codeql database analyze ./codeql-db java-security-and-quality.qls \
  --format=sarifv2.1.0 --output=results.sarif

# 查看支持的 language
codeql resolve languages

# 查看可用查询包
codeql resolve qlpacks
```

**支持语言**：`python`, `javascript`, `java`, `go`, `ruby`, `cpp`, `csharp`, `swift`

---

### 4. ast-grep — AST 层面的 grep

**用途**：基于语法树搜索、lint、重写代码，比正则更精准。

```bash
# 扫描整个项目
ast-grep scan /path/to/repo

# 交互式扫描（可逐个确认修复）
ast-grep scan --interactive /path/to/repo

# 单行搜索模式
ast-grep -p 'console.log($$$ARGS)' -l js /path/to/repo

# 重写代码
ast-grep -p 'var $A = $B' -r 'let $A = $B' -l js /path/to/repo --dry-run
```

---

### 5. Structurizr Lite — C4 模型架构图

**用途**：C4 模型官方工具，用 DSL 描述架构。

```bash
# Docker 运行（workspace.dsl 放当前目录）
docker run -it --rm -p 8080:8080 \
  -v $(pwd):/usr/local/structurizr \
  structurizr/lite

# 然后浏览器打开 http://localhost:8080
```

**DSL 示例** (`workspace.dsl`)：
```dsl
workspace {
  model {
    user = person "User"
    softwareSystem = softwareSystem "MyApp" {
      webapp = container "Web App"
      database = container "Database" {
        tags "Database"
      }
    }
    user -> webapp "Uses"
    webapp -> database "Reads/Writes"
  }
  views {
    systemContext softwareSystem {
      include *
      autolayout lr
    }
    container softwareSystem {
      include *
      autolayout lr
    }
  }
}
```

---

### 6. Backstage — 开发者门户

**用途**：Spotify 开源的开发者门户框架，服务目录 + 技术文档。

```bash
# 已创建骨架在 ~/tools/backstage-app
cd ~/tools/backstage-app
yarn install    # 首次需安装依赖
yarn start      # 开发模式启动
```

**配置服务目录**：编辑 `app-config.yaml` 添加实体。

---

### 7. ArchUnit — Java 架构测试

**用途**：用单元测试写架构规则。

```java
// Maven/Gradle 添加依赖后编写测试
@ArchTest
static final ArchRule layer_dependencies_are_respected = layeredArchitecture()
    .layer("Controller").definedBy("..controller..")
    .layer("Service").definedBy("..service..")
    .layer("Persistence").definedBy("..persistence..")
    .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
    .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
    .whereLayer("Persistence").mayOnlyBeAccessedByLayers("Service");

@ArchTest
static final ArchRule no_cycles = slices()
    .matching("com.myapp.(*)..")
    .should().beFreeOfCycles();
```

**Jar 位置**：`~/tools/archunit-1.4.2.jar`

---

## 业务逻辑层面工具 (Logic Layer)

### 8. Semgrep — 轻量级静态分析

**用途**：规则像代码一样写，秒级扫描，安全漏洞 + 代码规范。

```bash
# 自动规则扫描（推荐入门）
semgrep --config=auto /path/to/repo

# 指定规则集
semgrep --config=p/security-audit /path/to/repo
semgrep --config=p/owasp-top-ten /path/to/repo
semgrep --config=p/cwe-top-25 /path/to/repo

# 输出格式
semgrep --config=auto --json --output=results.json /path/to/repo
semgrep --config=auto --sarif --output=results.sarif /path/to/repo

# 仅显示错误级别
semgrep --config=auto --error --quiet /path/to/repo
```

**常用规则集**：
| 规则集 | 用途 |
|--------|------|
| `p/default` | 通用安全 + 质量 |
| `p/security-audit` | 安全审计 |
| `p/owasp-top-ten` | OWASP Top 10 |
| `p/cwe-top-25` | CWE Top 25 |
| `p/ci` | CI 快速检查 |

---

### 9. Infer — 深度缺陷检测

**用途**：Meta 出品，发现空指针、内存泄漏、资源竞争。

```bash
# 编译型项目（需能编译）
cd /path/to/repo
infer run -- make

# 查看报告
infer explore          # 交互式浏览
infer report           # 文本报告
infer report --html    # HTML 报告

# 增量分析
infer run --incremental -- make

# 指定输出目录
infer run -o ./infer-out -- make
```

**支持语言**：Java, C, C++, Objective-C

---

### 10. jscpd — 复制粘贴检测

**用途**：发现重复代码、 copy-paste 编程。

```bash
# 基础扫描
jscpd /path/to/repo

# 输出 JSON + HTML 报告
jscpd /path/to/repo --reporters json,html --output ./jscpd-report

# 设置最小重复行数/令牌数
jscpd /path/to/repo --min-lines 5 --min-tokens 25

# 忽略文件
jscpd /path/to/repo --ignore "**/test/**,**/*.spec.ts"
```

---

### 11. lizard — 圈复杂度分析

**用途**：多语言圈复杂度、参数数、行数统计。

```bash
# 基础扫描
lizard /path/to/repo

# XML 输出（CI 友好）
lizard /path/to/repo --xml > lizard.xml

# 只显示复杂度超过 15 的函数
lizard /path/to/repo -C 15

# 排除测试目录
lizard /path/to/repo -x "*/test/*" -x "*/tests/*"

# 输出 JSON
lizard /path/to/repo --json > lizard.json
```

**复杂度阈值参考**：
| CCN | 含义 |
|-----|------|
| 1-10 | 简单，低风险 |
| 11-20 | 较复杂，需关注 |
| 21-50 | 复杂，建议重构 |
| 50+ | 极复杂，必须重构 |

---

### 12. Dependency-Cruiser — JS/TS 依赖分析

**用途**：你已有。验证 JS/TS 依赖规则，生成依赖图。

```bash
# 初始化配置
npx depcruise --init

# 检查循环依赖
npx depcruise --output-type dot . | dot -Tsvg > deps.svg

# 验证规则
npx depcruise --validate .dependency-cruiser.js .
```

---

### 13. Madge — JS/TS 依赖可视化

**用途**：你已有。检测循环依赖，生成依赖图。

```bash
# 检测循环依赖
npx madge --circular .

# 生成依赖图
npx madge --image graph.svg .

# 只显示外部依赖
npx madge --exclude "^\\." --image external.svg .
```

---

### 14. pydeps — Python 模块依赖图

**用途**：你已有。生成 Python 模块的 import 依赖图。

```bash
pydeps --max-bacon 2 -o deps.svg /path/to/package
pydeps --show-deps /path/to/package          # 文本输出
pydeps --cluster -o deps.svg /path/to/package # 聚类显示
```

---

## 代码效率层面工具 (Efficiency Layer)

### 15. py-spy — Python 采样分析器

**用途**：生产环境安全的 Python 性能分析，Rust 编写，极低开销。

```bash
# 记录火焰图（按 PID）
py-spy record -o profile.svg --pid 12345

# 记录火焰图（启动新进程）
py-spy record -o profile.svg -- python app.py

# 实时 top 视图
py-spy top --pid 12345

# 导出为 speedscope 格式
py-spy record -f speedscope -o profile.json -- python app.py

# 只采样持有 GIL 的线程
py-spy record --gil -o profile.svg -- python app.py

# 包含原生扩展（C/Cython）
py-spy record --native -o profile.svg -- python app.py
```

**特点**：无需修改代码，无需重启程序，可 attach 到运行中的进程。

---

### 16. memray — Python 内存分析器

**用途**：Bloomberg 出品，追踪 Python 内存分配。

```bash
# 记录内存分配
memray run -o memray.bin python app.py

# 生成火焰图
memray flamegraph memray.bin -o memray.html

# 生成表格报告
memray table memray.bin -o memray-table.html

# 追踪特定模块的泄漏
memray run --trace python app.py
```

**查看报告**：用浏览器打开生成的 HTML 文件。

---

### 17. speedscope — 通用火焰图查看器

**用途**：支持 20+ 种性能分析格式的交互式火焰图。

```bash
# 打开本地文件
speedscope profile.json

# 支持的格式：py-spy, rbspy, pprof, perf, Chrome, Firefox, Node.js, Java...
# 纯浏览器运行，不上传数据
```

**三种视图**：
- **Time Order**：时间轴顺序，看时序行为
- **Left Heavy**：相同调用栈聚合，找热点
- **Sandwich**：表格视图，看 callers + callees

---

### 18. FlameGraph — 经典火焰图

**用途**：Brendan Gregg 经典火焰图生成脚本。

```bash
# Linux perf 生成火焰图
perf record -F 99 -g -- ./myapp
perf script | stackcollapse-perf.pl | flamegraph.pl > graph.svg

# 差异火焰图（对比两个版本）
perf script | stackcollapse-perf.pl > base.folded
# ... 修改代码后再次记录 ...
perf script | stackcollapse-perf.pl > new.folded
./difffolded.pl base.folded new.folded | flamegraph.pl > diff.svg
```

---

### 19. Pyroscope — 持续性能分析

**用途**：Grafana 出品，持续采集性能数据。

```bash
# 启动服务器
pyroscope server

# 采集 Go 应用
pyroscope exec ./my-go-app

# 采集 Python 应用
pyroscope exec python app.py

# 查看 UI：http://localhost:4040
```

---

### 20. scc — 极速代码统计

**用途**：替代 cloc，支持复杂度估算，极快。

```bash
# 基础统计
scc /path/to/repo

# JSON 输出
scc /path/to/repo --format json > stats.json

# 按文件输出
scc /path/to/repo --by-file

# 只统计特定语言
scc /path/to/repo --include-lang "Python,Go"

# 复杂度估算
scc /path/to/repo --complexity

# 与 git 集成（估算成本）
scc /path/to/repo --avg-wage 80000 --currency CNY
```

---

### 21. tokei — 代码行数统计

**用途**：Rust 编写，极速，支持 400+ 语言。

```bash
# 基础统计
tokei /path/to/repo

# JSON 输出
tokei /path/to/repo --output json

# 排序
tokei /path/to/repo --sort lines

# 排除目录
tokei /path/to/repo --exclude "target/" --exclude "node_modules/"
```

---

### 22. radon — Python 复杂度分析

**用途**：圈复杂度、Halstead 度量、可维护性指数。

```bash
# 圈复杂度（只显示复杂度 >= C 的）
radon cc /path/to/repo -a -nc

# 圈复杂度（显示所有）
radon cc /path/to/repo -a

# 可维护性指数
radon mi /path/to/repo

# Halstead 度量
radon hal /path/to/repo

# 按文件输出
radon cc /path/to/repo --show-closures
```

**等级说明**：
| 等级 | MI 值 | 含义 |
|------|-------|------|
| A | 100-20 | 可维护 |
| B | 19-10 | 中等 |
| C | 9-0 | 难以维护 |
| D | < 0 | 极难维护 |

---

### 23. wily — 复杂度历史追踪

**用途**：追踪代码复杂度随时间的变化趋势。

```bash
# 初始化（分析 git 历史，首次较慢）
cd /path/to/repo
wily build

# 查看当前报告
wily report .

# 查看特定文件历史
wily report src/core.py

# 查看趋势图
wily graph src/core.py cyclomatic

# 对比两个提交
wily diff HEAD~5 -- metrics
```

---

## 通用辅助工具

### 24. SonarQube (Docker)

**用途**：最全面的代码质量平台。

```bash
# 启动 SonarQube Community
docker run -d --name sonarqube \
  -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data \
  sonarqube:community

# 然后浏览器打开 http://localhost:9000
# 默认账号: admin / admin
```

---

### 25. code2flow — 流程图生成

**用途**：你已有。生成函数调用流程图。

```bash
code2flow /path/to/*.py -o flow.svg
code2flow /path/to/*.js -o flow.svg
```

---

### 26. pyan3 — Python 静态调用图

**用途**：你已有。Python 调用关系图。

```bash
pyan3 /path/to/package/*.py --uses --no-defines --colored \
  --grouped --annotated --dot > callgraph.dot
dot -Tsvg callgraph.dot > callgraph.svg
```

---

## 快速决策表

| 你想做什么 | 推荐工具 | 命令 |
|-----------|---------|------|
| 1 秒了解项目规模 | scc | `scc .` |
| 看代码由哪些语言组成 | tokei | `tokei .` |
| 扫安全漏洞 | semgrep | `semgrep --config=auto .` |
| 找重复代码 | jscpd | `jscpd .` |
| 测圈复杂度 | lizard | `lizard .` |
| Python 性能分析 | py-spy | `py-spy record -o p.svg -- python app.py` |
| Python 内存分析 | memray | `memray run python app.py` |
| 看火焰图 | speedscope | `speedscope profile.json` |
| JS/TS 循环依赖 | madge | `npx madge --circular .` |
| Python 模块依赖 | pydeps | `pydeps -o deps.svg .` |
| C/C++/Java 深层分析 | infer | `infer run -- make` |
| 代码结构图查询 | joern | `joern .` |
| 语义查询 | CodeQL | `codeql database create ...` |
| 画架构图 | D2 | `d2 arch.d2 arch.svg` |
| 复杂度趋势 | wily | `wily report .` |
| Python 质量评分 | radon | `radon cc . -a` |
