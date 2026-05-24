const { execSync } = require('child_process');

const TOOLS = {
  // ─── Architecture ─────────────────────────────────────────────────────────
  scc: {
    layer: 'arch',
    name: 'scc',
    desc: '极速代码统计（行数、语言构成、复杂度估算）',
    check: 'scc --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'scc /path/to/repo',
    tips: '1 秒看清项目规模，支持 250+ 语言',
  },
  tokei: {
    layer: 'arch',
    name: 'tokei',
    desc: '代码行数统计（区分代码/注释/空行）',
    check: 'tokei --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'tokei /path/to/repo --output json',
    tips: 'Rust 编写，支持 400+ 语言，比 cloc 快 10x',
  },
  'code2flow': {
    layer: 'arch',
    name: 'code2flow',
    desc: 'Python/JS 调用流程图生成器（→ Graphviz dot）',
    check: 'code2flow --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'code2flow src/ --output callflow.gv',
    tips: '适合快速理解函数调用链，输出 dot 可用 graphviz 渲染',
  },
  pyan3: {
    layer: 'arch',
    name: 'pyan3',
    desc: 'Python 静态调用图（pyan 的现代维护版）',
    check: 'pyan3 --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'pyan3 **/*.py --dot --no-defines > callgraph.dot',
    tips: '无需运行，纯静态分析；--dot 输出可 graphviz 渲染',
  },
  pydeps: {
    layer: 'arch',
    name: 'pydeps',
    desc: 'Python 模块依赖图（SVG 可视化）',
    check: 'pydeps --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'pydeps mypackage --max-bacon 3 --noshow -o deps.svg',
    tips: '需在项目根目录运行，传包名而非路径',
  },
  madge: {
    layer: 'arch',
    name: 'Madge',
    desc: 'JS/TS 模块依赖可视化（循环检测）',
    check: 'madge --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'madge --circular . && madge --image deps.svg .',
    tips: '循环依赖是架构腐化的早期信号',
  },
  depcruise: {
    layer: 'arch',
    name: 'Dependency-Cruiser',
    desc: 'JS/TS 依赖规则验证 + dot 图生成',
    check: 'depcruise --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'depcruise --output-type dot . | dot -Tsvg > deps.svg',
    tips: '可定义禁止依赖规则，违反时 CI 失败',
  },
  staticcheck: {
    layer: 'arch',
    name: 'staticcheck',
    desc: 'Go 专用静态分析（超越 go vet，含废弃 API 检测）',
    check: 'staticcheck -version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'staticcheck -f json ./...',
    tips: '必装 Go 工具，发现 go vet 发现不了的 bug',
  },
  golangcilint: {
    layer: 'arch',
    name: 'golangci-lint',
    desc: 'Go lint 聚合器（50+ linter 一次跑完）',
    check: 'golangci-lint --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'golangci-lint run --out-format json ./...',
    tips: '配置 .golangci.yml 可控制启用哪些 linter',
  },
  // manual-only: heavy infra, need interactive setup
  'ast-grep': {
    layer: 'arch',
    name: 'ast-grep',
    desc: 'AST 层面的结构化搜索与 lint',
    check: 'ast-grep --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'ast-grep scan --json /path/to/repo',
    tips: '支持自定义规则，可搜索语法模式',
  },
  d2: {
    layer: 'arch',
    name: 'D2',
    desc: '声明式架构图绘制（手动工具，非自动分析）',
    check: 'd2 --version',
    versionRegex: /v(\d+\.\d+\.\d+)/,
    cmd: 'd2 input.d2 output.svg',
    tips: '[手动] 需手写 .d2 文件；不参与自动 analyze 流程',
    manual: true,
  },
  joern: {
    layer: 'arch',
    name: 'Joern',
    desc: 'Code Property Graph 深层结构分析（手动工具）',
    check: 'joern --version 2>&1 | head -1',
    versionRegex: /Version:\s*(\S+)/,
    cmd: 'joern /path/to/code',
    tips: '[手动] 需 16GB+ RAM + 交互式 shell；不参与自动 analyze 流程',
    manual: true,
  },
  codeql: {
    layer: 'arch',
    name: 'CodeQL',
    desc: 'GitHub 官方语义分析引擎（手动工具）',
    check: 'codeql --version 2>&1 | head -1',
    versionRegex: /release\s+(\S+)/,
    cmd: 'codeql database create --language=python ./db --source-root=.',
    tips: '[手动] 需先 build 数据库；不参与自动 analyze 流程',
    manual: true,
  },

  // ─── Logic / Quality ──────────────────────────────────────────────────────
  semgrep: {
    layer: 'logic',
    name: 'Semgrep',
    desc: '多语言静态分析，规则即代码（SAST）',
    check: 'semgrep --version 2>&1 | tail -1',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'semgrep --config=auto /path/to/repo --json',
    tips: '秒级扫描，30+ 语言，社区规则库 2000+',
  },
  lizard: {
    layer: 'logic',
    name: 'lizard',
    desc: '多语言圈复杂度（CCN）分析',
    check: 'lizard --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'lizard /path/to/repo --xml',
    tips: 'CCN > 15 需关注，> 50 必须重构；支持 Python/JS/Java/C++/Go 等',
  },
  jscpd: {
    layer: 'logic',
    name: 'jscpd',
    desc: '跨语言重复代码检测（克隆检测）',
    check: 'jscpd --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'jscpd /path/to/repo --reporters json,html --output ./jscpd',
    tips: '重复率 > 5% 需重构，支持 HTML 可视化报告',
  },
  pyright: {
    layer: 'logic',
    name: 'pyright',
    desc: 'Python 静态类型检查（Microsoft 出品）',
    check: 'pyright --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'pyright /path/to/repo --outputjson',
    tips: '比 mypy 更快更准，支持 pyrightconfig.json 自定义',
  },
  vulture: {
    layer: 'logic',
    name: 'vulture',
    desc: 'Python 死代码检测（未使用函数/变量/类）',
    check: 'vulture --version',
    versionRegex: /(\d+\.\d+)/,
    cmd: 'vulture /path/to/repo --min-confidence 80',
    tips: '置信度 80%+ 的基本确定，60%+ 需人工确认',
  },
  bandit: {
    layer: 'logic',
    name: 'bandit',
    desc: 'Python 安全漏洞扫描（OWASP/AST 规则集）',
    check: 'bandit --version 2>&1 | head -1',
    versionRegex: /bandit\s+(\d+\.\d+\.\d+)/,
    cmd: 'bandit -r /path/to/repo -f json -o bandit.json',
    tips: '专注安全（注入/弱密码学/不安全反序列化等），semgrep 补不上的盲区',
  },
  mypy: {
    layer: 'logic',
    name: 'mypy',
    desc: 'Python 渐进式类型检查（参考实现）',
    check: 'mypy --version',
    versionRegex: /mypy\s+(\d+\.\d+(?:\.\d+)?)/,
    cmd: 'mypy --no-incremental --ignore-missing-imports /path/to/pkg',
    tips: '比 pyright 慢但是 PEP 标准；优先看 pyright，分歧时用 mypy 双确认',
  },
  gosec: {
    layer: 'logic',
    name: 'gosec',
    desc: 'Go 安全漏洞扫描（G1xx/G2xx/G4xx 规则集）',
    check: 'gosec --version 2>&1 | head -1',
    versionRegex: /Version:\s*(\S+)/,
    cmd: 'gosec -fmt=json -out=gosec.json ./...',
    tips: 'Go 版的 bandit，覆盖 hardcoded creds / SQL 注入 / 弱 RNG 等',
  },
  tsc: {
    layer: 'logic',
    name: 'tsc',
    desc: 'TypeScript 编译器类型检查',
    check: 'tsc --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'tsc --noEmit --strict',
    tips: '需要 tsconfig.json；--noEmit 只检查不生成文件',
  },
  infer: {
    layer: 'logic',
    name: 'Infer',
    desc: 'Meta 出品深度缺陷检测（空指针/内存泄漏）',
    check: 'infer --version 2>&1 | head -1',
    versionRegex: /Infer version\s*(\S+)/,
    cmd: 'infer run -- make',
    tips: '需要构建系统（make/gradle）；仅在有 Makefile 的项目自动运行',
  },

  // ─── Efficiency / Performance ─────────────────────────────────────────────
  radon: {
    layer: 'efficiency',
    name: 'radon',
    desc: 'Python 复杂度与可维护性指数（MI/Halstead）',
    check: 'radon --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'radon cc /path/to/repo -a -nc && radon mi /path/to/repo',
    tips: 'MI < 0 极难维护，0-25 需关注，25-50 尚可，50+ 健康',
  },
  wily: {
    layer: 'efficiency',
    name: 'wily',
    desc: 'Python 代码复杂度历史追踪（基于 git）',
    check: 'wily --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'wily build . && wily report src/',
    tips: '首次 build 慢（扫描 git 历史）；能看出复杂度是否在上涨',
  },
  'py-spy': {
    layer: 'efficiency',
    name: 'py-spy',
    desc: 'Python 采样性能分析器（无侵入，生产可用）',
    check: 'py-spy --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'py-spy record -d 5 -o profile.svg -- python app.py',
    tips: '生产环境安全，无需修改代码，输出火焰图 SVG',
  },
  memray: {
    layer: 'efficiency',
    name: 'memray',
    desc: 'Python 内存分析器（Bloomberg 出品，火焰图）',
    check: 'memray --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'memray run -o memray.bin python app.py && memray flamegraph memray.bin',
    tips: '精确到行级别的内存分配追踪',
  },
  speedscope: {
    layer: 'efficiency',
    name: 'speedscope',
    desc: '通用火焰图查看器（浏览器 UI，手动工具）',
    check: 'speedscope --version',
    versionRegex: /v(\d+\.\d+\.\d+)/,
    cmd: 'speedscope profile.json',
    tips: '[手动] 是浏览器查看器，非 CLI 分析器；支持 20+ profiling 格式',
    manual: true,
  },
  pyroscope: {
    layer: 'efficiency',
    name: 'Pyroscope',
    desc: '持续性能分析平台（Grafana，服务器模式，手动工具）',
    check: 'pyroscope --version 2>&1 | head -1',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'pyroscope server',
    tips: '[手动] 是长跑服务器，非单次 CLI 工具；不参与自动 analyze 流程',
    manual: true,
  },
};

function checkTool(key) {
  const tool = TOOLS[key];
  if (!tool) return { key, found: false, version: null };
  try {
    const out = execSync(tool.check, { encoding: 'utf8', timeout: 5000, shell: true });
    const m = out.match(tool.versionRegex);
    return { key, found: true, version: m ? m[1] : 'unknown', layer: tool.layer, manual: !!tool.manual };
  } catch {
    return { key, found: false, version: null, layer: tool.layer, manual: !!tool.manual };
  }
}

function listTools() {
  return Object.keys(TOOLS).map(checkTool);
}

function getTool(key) {
  return TOOLS[key];
}

module.exports = { TOOLS, checkTool, listTools, getTool };
