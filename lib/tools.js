const { execSync } = require('child_process');
const path = require('path');

const TOOLS = {
  // Architecture
  d2: {
    layer: 'arch',
    name: 'D2',
    desc: '声明式架构图绘制',
    check: 'd2 --version',
    versionRegex: /v(\d+\.\d+\.\d+)/,
    cmd: 'd2 input.d2 output.svg',
    tips: '支持 300+ 主题，ELK/TALA 布局引擎',
  },
  joern: {
    layer: 'arch',
    name: 'Joern',
    desc: 'Code Property Graph 深层结构分析',
    check: 'joern --version 2>&1 | head -1',
    versionRegex: /Version:\s*(\S+)/,
    cmd: 'joern /path/to/code',
    tips: '内存消耗大，大型项目需 16GB+ RAM',
  },
  codeql: {
    layer: 'arch',
    name: 'CodeQL',
    desc: 'GitHub 官方语义分析引擎',
    check: 'codeql --version 2>&1 | head -1',
    versionRegex: /release\s+(\S+)/,
    cmd: 'codeql database create --language=python ./db --source-root=.',
    tips: '需编译的语言要能先编译通过',
  },
  'ast-grep': {
    layer: 'arch',
    name: 'ast-grep',
    desc: 'AST 层面的 grep',
    check: 'ast-grep --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'ast-grep scan /path/to/repo',
    tips: '支持搜索、lint、代码重写',
  },
  scc: {
    layer: 'arch',
    name: 'scc',
    desc: '极速代码统计',
    check: 'scc --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'scc /path/to/repo',
    tips: '1 秒看清项目规模和语言构成',
  },
  tokei: {
    layer: 'arch',
    name: 'tokei',
    desc: '代码行数统计',
    check: 'tokei --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'tokei /path/to/repo',
    tips: 'Rust 编写，支持 400+ 语言',
  },

  // Logic
  semgrep: {
    layer: 'logic',
    name: 'Semgrep',
    desc: '轻量级静态分析，规则像代码一样写',
    check: 'semgrep --version 2>&1 | tail -1',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'semgrep --config=auto /path/to/repo',
    tips: '秒级扫描，支持 30+ 语言',
  },
  infer: {
    layer: 'logic',
    name: 'Infer',
    desc: 'Meta 出品深度缺陷检测',
    check: 'infer --version 2>&1 | head -1',
    versionRegex: /Infer version\s*(\S+)/,
    cmd: 'infer run -- make',
    tips: '发现空指针、内存泄漏、资源竞争',
  },
  jscpd: {
    layer: 'logic',
    name: 'jscpd',
    desc: '复制粘贴/重复代码检测',
    check: 'jscpd --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'jscpd /path/to/repo',
    tips: '支持 HTML/JSON 报告输出',
  },
  lizard: {
    layer: 'logic',
    name: 'lizard',
    desc: '多语言圈复杂度分析',
    check: 'lizard --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'lizard /path/to/repo',
    tips: 'CCN > 15 需关注，> 50 必须重构',
  },
  depcruise: {
    layer: 'logic',
    name: 'Dependency-Cruiser',
    desc: 'JS/TS 依赖分析与规则验证',
    check: 'npx depcruise --version 2>/dev/null || echo "not found"',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'npx depcruise --output-type dot . | dot -Tsvg > deps.svg',
    tips: '可检测循环依赖和架构违规',
  },
  madge: {
    layer: 'logic',
    name: 'Madge',
    desc: 'JS/TS 依赖可视化',
    check: 'npx madge --version 2>/dev/null || echo "not found"',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'npx madge --circular .',
    tips: '可生成依赖图 SVG',
  },
  pydeps: {
    layer: 'logic',
    name: 'pydeps',
    desc: 'Python 模块依赖图',
    check: 'pydeps --version 2>/dev/null || echo "not found"',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'pydeps -o deps.svg /path/to/package',
    tips: '支持聚类显示',
  },

  // Efficiency
  'py-spy': {
    layer: 'efficiency',
    name: 'py-spy',
    desc: 'Python 采样性能分析器',
    check: 'py-spy --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'py-spy record -o profile.svg -- python app.py',
    tips: '生产环境安全，无需修改代码',
  },
  memray: {
    layer: 'efficiency',
    name: 'memray',
    desc: 'Python 内存分析器',
    check: 'memray --version 2>/dev/null || echo "not found"',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'memray run -o memray.bin python app.py',
    tips: 'Bloomberg 出品，生成火焰图',
  },
  speedscope: {
    layer: 'efficiency',
    name: 'speedscope',
    desc: '通用火焰图查看器',
    check: 'speedscope --version',
    versionRegex: /v(\d+\.\d+\.\d+)/,
    cmd: 'speedscope profile.json',
    tips: '支持 20+ 种性能分析格式',
  },
  radon: {
    layer: 'efficiency',
    name: 'radon',
    desc: 'Python 复杂度与可维护性指数',
    check: 'radon --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'radon cc /path/to/repo -a',
    tips: 'MI < 0 表示极难维护',
  },
  wily: {
    layer: 'efficiency',
    name: 'wily',
    desc: '代码复杂度历史追踪',
    check: 'wily --version 2>/dev/null || echo "not found"',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'wily report /path/to/repo',
    tips: '首次 build 较慢，需分析 git 历史',
  },
  pyroscope: {
    layer: 'efficiency',
    name: 'Pyroscope',
    desc: '持续性能分析平台',
    check: 'pyroscope --version 2>&1 | head -1',
    versionRegex: /(\d+\.\d+\.\d+)/,
    cmd: 'pyroscope server',
    tips: 'Grafana 出品，支持多语言',
  },
};

function checkTool(key) {
  const tool = TOOLS[key];
  if (!tool) return { key, found: false, version: null };
  try {
    const out = execSync(tool.check, { encoding: 'utf8', timeout: 5000 });
    const m = out.match(tool.versionRegex);
    return { key, found: true, version: m ? m[1] : 'unknown', layer: tool.layer };
  } catch {
    return { key, found: false, version: null, layer: tool.layer };
  }
}

function listTools() {
  return Object.keys(TOOLS).map(checkTool);
}

function getTool(key) {
  return TOOLS[key];
}

module.exports = { TOOLS, checkTool, listTools, getTool };
