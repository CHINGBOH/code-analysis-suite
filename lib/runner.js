const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runAnatomy } = require('./anatomy');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Safe file write with error reporting (never silently swallowed)
function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content);
  } catch (err) {
    console.error(`  ⚠️  写入失败 ${path.basename(filePath)}: ${err.message}`);
  }
}

// Spawn a command and collect stdout/stderr.
// Fixes: (1) 'error' event handler prevents unhandled crash on ENOENT/EACCES
//        (2) Buffer.concat preserves multi-byte UTF-8 sequences
//        (3) stderr always captured via 'pipe' regardless of opts.silent
function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || process.cwd(),
      // Always pipe stdout/stderr so we can capture them; parent-visible output
      // is a nice-to-have, not required for correctness.
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: opts.shell || false,
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on('data', d => stdoutChunks.push(d));
    child.stderr.on('data', d => stderrChunks.push(d));

    // Handles ENOENT / EACCES — without this the process crashes
    child.on('error', err => {
      if (opts.ignoreError) resolve({ code: -1, stdout: '', stderr: err.message });
      else reject(err);
    });

    child.on('close', code => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (!opts.silent) {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      }
      if (code !== 0 && !opts.ignoreError) {
        return reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
      }
      resolve({ code, stdout, stderr });
    });
  });
}

function hasCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Junk dirs to skip across all layers/tools (single source of truth)
const SKIP_DIRS = ['node_modules', 'vendor', '.git', '__pycache__', 'dist', 'build', '.venv', 'venv', 'env', '.eggs', 'site-packages'];
const SKIP_GLOBS = SKIP_DIRS.map(d => `*/${d}/*`).join(',');

// Find files with given extension, skipping common junk dirs
function findFiles(dir, ext, maxFiles = 150) {
  const skip = new Set(SKIP_DIRS);
  const result = [];
  function walk(d, depth) {
    if (depth > 8 || result.length >= maxFiles) return;
    let entries;
    try { entries = fs.readdirSync(d); } catch { return; }
    for (const entry of entries) {
      if (skip.has(entry) || entry.startsWith('.')) continue;
      const full = path.join(d, entry);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.isDirectory()) walk(full, depth + 1);
      else if (entry.endsWith(ext)) result.push(full);
    }
  }
  walk(dir, 0);
  return result;
}

// Detect the importable Python package name from a repo root.
// pydeps takes a package name (not a path).
function detectPythonPackage(repo) {
  // Try pyproject.toml [project] or [tool.poetry] name field
  const pyproject = path.join(repo, 'pyproject.toml');
  if (fs.existsSync(pyproject)) {
    const content = fs.readFileSync(pyproject, 'utf8');
    const m = content.match(/^\[(?:project|tool\.poetry)\][^\[]*?^name\s*=\s*["']([^"']+)/ms);
    if (m) {
      const name = m[1].replace(/-/g, '_');
      if (fs.existsSync(path.join(repo, name, '__init__.py'))) return { name, dir: path.join(repo, name) };
      if (fs.existsSync(path.join(repo, 'src', name, '__init__.py'))) return { name, dir: path.join(repo, 'src', name) };
    }
  }
  // Fall back: find top-level dirs with __init__.py
  const skip = new Set(['test', 'tests', 'docs', 'doc', 'examples', 'scripts', 'tools', 'build', 'dist', 'node_modules']);
  for (const entry of fs.readdirSync(repo)) {
    if (entry.startsWith('.') || skip.has(entry)) continue;
    const full = path.join(repo, entry);
    try {
      if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, '__init__.py'))) {
        return { name: entry, dir: full };
      }
    } catch {}
  }
  // src/ layout
  const srcDir = path.join(repo, 'src');
  if (fs.existsSync(srcDir)) {
    for (const entry of fs.readdirSync(srcDir)) {
      const full = path.join(srcDir, entry);
      try {
        if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, '__init__.py'))) {
          return { name: entry, dir: full };
        }
      } catch {}
    }
  }
  return null;
}

function detectEntryFile(repo) {
  for (const c of ['main.py', 'app.py', 'manage.py', 'run.py', 'server.py']) {
    const f = path.join(repo, c);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// ─── Architecture Layer ───────────────────────────────────────────────────────

async function runArchitecture(repo, outDir) {
  console.log('\n🏗️  Architecture Layer');
  const d = path.join(outDir, '01-arch');
  ensureDir(d);

  if (hasCommand('scc')) {
    console.log('  → scc');
    await runCmd('scc', [repo, '--format', 'json'], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'scc.json'), r.stdout));
    await runCmd('scc', [repo], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'scc.txt'), r.stdout));
  }

  if (hasCommand('tokei')) {
    console.log('  → tokei');
    await runCmd('tokei', [repo, '--output', 'json'], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'tokei.json'), r.stdout));
  }

  // Python call graphs (code2flow + pyan3)
  const pyFiles = findFiles(repo, '.py');
  if (pyFiles.length > 0) {
    if (hasCommand('code2flow')) {
      console.log('  → code2flow (调用流程图)');
      await runCmd('code2flow', [...pyFiles.slice(0, 100), '--output', path.join(d, 'code2flow.gv'), '--quiet'], { ignoreError: true });
    }
    if (hasCommand('pyan3')) {
      console.log('  → pyan3 (静态调用图)');
      await runCmd('pyan3', [...pyFiles.slice(0, 100), '--dot', '--no-defines'], { silent: true, ignoreError: true })
        .then(r => { if (r.stdout.trim()) writeFile(path.join(d, 'pyan3-callgraph.dot'), r.stdout); });
    }
  }

  // Python module dependency graph — pass package NAME (not path)
  const pyPkg = detectPythonPackage(repo);
  if (pyPkg && hasCommand('pydeps')) {
    console.log(`  → pydeps (模块依赖图, package="${pyPkg.name}")`);
    await runCmd('pydeps', ['--max-bacon', '3', '--noshow', '-o', path.join(d, 'pydeps.svg'), pyPkg.name], { cwd: repo, ignoreError: true });
  }

  // JS/TS dependency graph
  if (fs.existsSync(path.join(repo, 'package.json'))) {
    if (hasCommand('madge')) {
      console.log('  → madge (循环依赖)');
      await runCmd('madge', ['--circular', '.'], { cwd: repo, silent: true, ignoreError: true })
        .then(r => writeFile(path.join(d, 'madge-circular.txt'), r.stdout));
    }
    if (hasCommand('depcruise')) {
      console.log('  → depcruise (完整依赖图)');
      await runCmd('depcruise', ['--output-type', 'dot', '--exclude', '^node_modules', '.'], { cwd: repo, silent: true, ignoreError: true })
        .then(r => { if (r.stdout.trim()) writeFile(path.join(d, 'depcruise.dot'), r.stdout); });
    }
  }

  // Go static analysis
  if (fs.existsSync(path.join(repo, 'go.mod'))) {
    if (hasCommand('staticcheck')) {
      console.log('  → staticcheck (Go 静态分析)');
      await runCmd('staticcheck', ['-f', 'json', './...'], { cwd: repo, silent: true, ignoreError: true })
        .then(r => writeFile(path.join(d, 'staticcheck.json'), r.stdout));
    }
  }

  // Git contributors — use spawn args directly (no shell injection)
  if (fs.existsSync(path.join(repo, '.git'))) {
    console.log('  → git contributors');
    await runCmd('git', ['log', '--format=%an'], { cwd: repo, silent: true, ignoreError: true })
      .then(r => {
        const counts = {};
        for (const name of r.stdout.split('\n').filter(Boolean)) {
          counts[name] = (counts[name] || 0) + 1;
        }
        const top10 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        writeFile(path.join(d, 'git-contributors.txt'), top10.map(([n, c]) => `${String(c).padStart(6)}\t${n}`).join('\n') + '\n');
      });
    await runCmd('git', ['log', '--oneline', '-100'], { cwd: repo, silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'git-log.txt'), r.stdout));
    await runCmd('git', ['log', '--format=%aI', '--', '.'], { cwd: repo, silent: true, ignoreError: true })
      .then(r => {
        const dates = r.stdout.split('\n').filter(Boolean);
        const stats = {
          total_commits: dates.length,
          first_commit: dates[dates.length - 1] || '',
          last_commit: dates[0] || '',
        };
        writeFile(path.join(d, 'git-stats.json'), JSON.stringify(stats, null, 2));
      });
  }

  console.log('  ✅ done');
}

// ─── Logic / Quality Layer ────────────────────────────────────────────────────

async function runLogic(repo, outDir) {
  console.log('\n🧠 Logic Layer');
  const d = path.join(outDir, '02-logic');
  ensureDir(d);

  if (hasCommand('semgrep')) {
    console.log('  → semgrep (SAST)');
    await runCmd('semgrep', [
      '--config=auto', repo, '--json',
      '--output', path.join(d, 'semgrep.json'),
      '--exclude=node_modules', '--exclude=vendor', '--exclude=.git',
      '--exclude=dist', '--exclude=build', '--exclude=__pycache__',
    ], { ignoreError: true });

    // Curated wtfpython gotcha rules (Python only). Cheap to run after the main
    // semgrep pass; output is consumed by generateSummary + report.json.
    const wtfRules = path.join(__dirname, '..', 'rules', 'wtfpython.yml');
    if (fs.existsSync(wtfRules) && findFiles(repo, '.py').length > 0) {
      console.log('  → semgrep (wtfpython gotchas)');
      await runCmd('semgrep', [
        '--config', wtfRules, repo, '--json', '-q', '--metrics', 'off',
        '--output', path.join(d, 'wtfpython.json'),
        '--exclude=node_modules', '--exclude=vendor', '--exclude=.git',
        '--exclude=dist', '--exclude=build', '--exclude=__pycache__',
      ], { ignoreError: true });
    }

    // Curated cpython-pitfalls rules distilled from
    // ~/.copilot/skills/cpython-idiomatic-patterns/. Same shape as wtfpython.
    const cpyRules = path.join(__dirname, '..', 'rules', 'cpython-pitfalls.yml');
    if (fs.existsSync(cpyRules) && findFiles(repo, '.py').length > 0) {
      console.log('  → semgrep (cpython pitfalls)');
      await runCmd('semgrep', [
        '--config', cpyRules, repo, '--json', '-q', '--metrics', 'off',
        '--output', path.join(d, 'cpython-pitfalls.json'),
        '--exclude=node_modules', '--exclude=vendor', '--exclude=.git',
        '--exclude=dist', '--exclude=build', '--exclude=__pycache__',
      ], { ignoreError: true });
    }
  }

  if (hasCommand('jscpd')) {
    console.log('  → jscpd (重复代码)');
    // Note: no spaces after commas in --ignore pattern
    await runCmd('jscpd', [
      repo,
      '--reporters', 'json,html',
      '--output', path.join(d, 'jscpd'),
      '--ignore', 'node_modules,vendor,.git,dist,build,__pycache__',
    ], { ignoreError: true });
  }

  if (hasCommand('lizard')) {
    console.log('  → lizard (圈复杂度)');
    await runCmd('lizard', [repo], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'lizard.txt'), r.stdout));
    await runCmd('lizard', [repo, '--xml'], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'lizard.xml'), r.stdout));
  }

  // Python-specific quality tools
  const pyFiles = findFiles(repo, '.py');
  const pyPkg = detectPythonPackage(repo);
  if (pyFiles.length > 0) {
    if (hasCommand('pyright')) {
      console.log('  → pyright (类型检查)');
      await runCmd('pyright', [repo, '--outputjson'], { silent: true, ignoreError: true })
        .then(r => writeFile(path.join(d, 'pyright.json'), r.stdout));
    }
    if (hasCommand('vulture')) {
      console.log('  → vulture (死代码)');
      await runCmd('vulture', [repo, '--min-confidence', '80'], { silent: true, ignoreError: true })
        .then(r => writeFile(path.join(d, 'vulture.txt'), r.stdout));
    }
    if (hasCommand('bandit')) {
      console.log('  → bandit (Python 安全扫描)');
      await runCmd('bandit', ['-r', repo, '-f', 'json', '-q', '-x', SKIP_GLOBS], { silent: true, ignoreError: true })
        .then(r => { if (r.stdout.trim()) writeFile(path.join(d, 'bandit.json'), r.stdout); });
    }
    if (hasCommand('mypy')) {
      const mypyTarget = pyPkg ? pyPkg.dir : repo;
      console.log(`  → mypy (类型检查参考实现, target=${path.relative(repo, mypyTarget) || '.'})`);
      await runCmd('mypy', ['--no-incremental', '--ignore-missing-imports', '--no-error-summary', mypyTarget], { cwd: repo, silent: true, ignoreError: true })
        .then(r => writeFile(path.join(d, 'mypy.txt'), (r.stdout + r.stderr).trim() || 'no issues'));
    }
  }

  // TypeScript type checking
  if (fs.existsSync(path.join(repo, 'tsconfig.json')) && hasCommand('tsc')) {
    console.log('  → tsc (TypeScript 类型检查)');
    await runCmd('tsc', ['--noEmit'], { cwd: repo, silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'tsc.txt'), (r.stdout + r.stderr).trim()));
  }

  // Go lint
  if (fs.existsSync(path.join(repo, 'go.mod'))) {
    if (hasCommand('golangci-lint')) {
      console.log('  → golangci-lint (Go lint)');
      await runCmd('golangci-lint', ['run', '--out-format', 'json', './...'], { cwd: repo, silent: true, ignoreError: true })
        .then(r => writeFile(path.join(d, 'golangci-lint.json'), r.stdout));
    }
    if (hasCommand('gosec')) {
      console.log('  → gosec (Go 安全扫描)');
      await runCmd('gosec', ['-fmt=json', '-quiet', './...'], { cwd: repo, silent: true, ignoreError: true })
        .then(r => { if (r.stdout.trim()) writeFile(path.join(d, 'gosec.json'), r.stdout); });
    }
  }

  // Infer (only for compiled languages with a build system)
  if (hasCommand('infer')) {
    const hasBuild = ['Makefile', 'CMakeLists.txt', 'build.gradle', 'pom.xml'].some(f => fs.existsSync(path.join(repo, f)));
    if (hasBuild) {
      console.log('  → infer (深度缺陷检测)');
      await runCmd('infer', ['run', '-o', path.join(d, 'infer-out'), '--', 'make', `-j${os.cpus().length}`], { cwd: repo, ignoreError: true });
    }
  }

  if (hasCommand('ast-grep')) {
    console.log('  → ast-grep (AST 模式扫描)');
    await runCmd('ast-grep', ['scan', '--json', repo], { silent: true, ignoreError: true })
      .then(r => { if (r.stdout.trim()) writeFile(path.join(d, 'ast-grep.json'), r.stdout); });
  }

  console.log('  ✅ done');
}

// ─── Efficiency / Performance Layer ──────────────────────────────────────────

async function runEfficiency(repo, outDir) {
  console.log('\n⚡ Efficiency Layer');
  const d = path.join(outDir, '03-efficiency');
  ensureDir(d);

  if (hasCommand('radon')) {
    console.log('  → radon (复杂度 + 可维护性)');
    // -e/--exclude: skip node_modules / venv / etc. so we don't scan vendored test fixtures
    await runCmd('radon', ['cc', repo, '-a', '-nc', '-e', SKIP_GLOBS], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'radon-cc.txt'), r.stdout));
    await runCmd('radon', ['mi', repo, '-e', SKIP_GLOBS], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'radon-mi.txt'), r.stdout));
    await runCmd('radon', ['hal', repo, '-e', SKIP_GLOBS], { silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'radon-hal.txt'), r.stdout));
  }

  // wily requires: (1) a git repo, (2) wily build first, (3) a Python package target
  const wilyPkg = detectPythonPackage(repo);
  if (hasCommand('wily') && fs.existsSync(path.join(repo, '.git')) && wilyPkg) {
    console.log(`  → wily (复杂度趋势, package="${wilyPkg.name}")`);
    // Build the wily index (limit to 50 revisions to avoid multi-minute hangs)
    await runCmd('timeout', ['90', 'wily', 'build', wilyPkg.name, '--max-revisions', '50'], { cwd: repo, ignoreError: true });
    await runCmd('timeout', ['30', 'wily', 'report', wilyPkg.name], { cwd: repo, silent: true, ignoreError: true })
      .then(r => writeFile(path.join(d, 'wily.txt'), r.stdout));
  }

  const entry = detectEntryFile(repo);
  if (entry && hasCommand('py-spy')) {
    console.log('  → py-spy (5s 采样 profiling)');
    await runCmd('timeout', ['6', 'py-spy', 'record', '-d', '5', '-o', path.join(d, 'py-spy.svg'), '--', 'python', entry], { ignoreError: true });
  }

  if (entry && hasCommand('memray')) {
    console.log('  → memray (内存分析)');
    const bin = path.join(d, 'memray.bin');
    await runCmd('memray', ['run', '-o', bin, '--', 'python', entry], { ignoreError: true });
    if (fs.existsSync(bin)) {
      await runCmd('memray', ['flamegraph', bin, '-o', path.join(d, 'memray.html')], { ignoreError: true });
    }
  }

  console.log('  ✅ done');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

// ── SUMMARY.md helpers ─────────────────────────────────────────────────────
// Each section returns a markdown chunk (may be ''). Keeps generateSummary
// readable and each section's CCN trivially low.

function snippetFile(filePath, maxLines = 60) {
  if (!fs.existsSync(filePath)) return null;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const head = lines.slice(0, maxLines).join('\n');
  const tail = lines.length > maxLines ? `\n… (${lines.length - maxLines} more lines)` : '';
  return head + tail;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function mdBlock(title, body) {
  if (!body) return '';
  return `### ${title}\n\`\`\`\n${body}\n\`\`\`\n\n`;
}

function bySeverity(items, getSev) {
  const bySev = {};
  for (const it of items) {
    const s = getSev(it) || 'UNKNOWN';
    bySev[s] = (bySev[s] || 0) + 1;
  }
  return bySev;
}

function formatSeverityList(label, total, bySev) {
  let md = `### ${label}: ${total} findings\n`;
  for (const [sev, n] of Object.entries(bySev).sort()) md += `- ${sev}: ${n}\n`;
  return md + '\n';
}

function sectionAnatomy(outDir) {
  const anatomy = readJson(path.join(outDir, "00-anatomy", "anatomy.json"));
  if (!anatomy) return "";
  let md = "## 0. Anatomy\n\n";
  md += "**Shape:** " + anatomy.architecture_shape + "\n\n";
  md += "**Entrypoints:** " + anatomy.entrypoints.length + " | **Deployable units:** " + anatomy.deployable_units.length + " | **Interfaces:** " + anatomy.interfaces.length + "\n\n";
  md += mdBlock("Entrypoint Trunk", snippetFile(path.join(outDir, "00-anatomy", "ANATOMY.md"), 80));
  return md;
}

function sectionArchitecture(outDir) {
  let md = '## 1. Architecture\n\n';
  md += mdBlock('Code Statistics (scc)', snippetFile(path.join(outDir, '01-arch', 'scc.txt')));
  md += mdBlock('Top 10 Contributors', snippetFile(path.join(outDir, '01-arch', 'git-contributors.txt'), 10));

  const gitStats = readJson(path.join(outDir, '01-arch', 'git-stats.json'));
  if (gitStats) {
    md += `**Commits:** ${gitStats.total_commits} | **First:** ${gitStats.first_commit.slice(0, 10)} | **Last:** ${gitStats.last_commit.slice(0, 10)}\n\n`;
  }

  const staticcheckJson = path.join(outDir, '01-arch', 'staticcheck.json');
  if (fs.existsSync(staticcheckJson)) {
    const lines = fs.readFileSync(staticcheckJson, 'utf8').trim().split('\n').filter(Boolean);
    md += `**staticcheck (Go):** ${lines.length} findings\n\n`;
  }

  const artifacts = [
    ['code2flow.gv', '**code2flow:** 调用流程图已生成 → `01-arch/code2flow.gv`'],
    ['pyan3-callgraph.dot', '**pyan3:** 静态调用图已生成 → `01-arch/pyan3-callgraph.dot`'],
    ['pydeps.svg', '**pydeps:** 模块依赖图已生成 → `01-arch/pydeps.svg`'],
  ];
  for (const [f, msg] of artifacts) {
    if (fs.existsSync(path.join(outDir, '01-arch', f))) md += `${msg}\n\n`;
  }
  return md;
}

function sectionLogic(outDir) {
  let md = '## 2. Logic & Quality\n\n';
  md += mdBlock('Cyclomatic Complexity (lizard)', snippetFile(path.join(outDir, '02-logic', 'lizard.txt')));

  const semgrep = readJson(path.join(outDir, '02-logic', 'semgrep.json'));
  if (semgrep?.results) {
    md += formatSeverityList('Semgrep', semgrep.results.length, bySeverity(semgrep.results, f => f.extra?.severity || 'INFO'));
  }

  const wtf = readJson(path.join(outDir, '02-logic', 'wtfpython.json'));
  if (wtf?.results && wtf.results.length > 0) {
    const byRule = {};
    for (const r of wtf.results) {
      const id = r.check_id.split('.').pop();
      byRule[id] = (byRule[id] || 0) + 1;
    }
    const top = Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 10);
    md += `### wtfpython gotchas: ${wtf.results.length} finding(s)\n`;
    for (const [rule, count] of top) md += `- \`${rule}\` × ${count}\n`;
    md += '\n';
  }

  const cpy = readJson(path.join(outDir, '02-logic', 'cpython-pitfalls.json'));
  if (cpy?.results && cpy.results.length > 0) {
    const byRule = {};
    for (const r of cpy.results) {
      const id = r.check_id.split('.').pop();
      byRule[id] = (byRule[id] || 0) + 1;
    }
    const top = Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 10);
    md += `### cpython pitfalls: ${cpy.results.length} finding(s)\n`;
    for (const [rule, count] of top) md += `- \`${rule}\` × ${count}\n`;
    md += '\n';
  }

  const pyright = readJson(path.join(outDir, '02-logic', 'pyright.json'));
  if (pyright?.summary) {
    const s = pyright.summary;
    md += `### Pyright (类型检查): ${s.errorCount || 0} errors, ${s.warningCount || 0} warnings, ${s.informationCount || 0} info\n\n`;
  }

  const vultureTxt = path.join(outDir, '02-logic', 'vulture.txt');
  if (fs.existsSync(vultureTxt)) {
    const lines = fs.readFileSync(vultureTxt, 'utf8').trim().split('\n').filter(Boolean);
    md += `### Vulture (死代码): ${lines.length} candidates\n\`\`\`\n${lines.slice(0, 15).join('\n')}\n\`\`\`\n\n`;
  }

  const bandit = readJson(path.join(outDir, '02-logic', 'bandit.json'));
  if (bandit?.results) {
    md += formatSeverityList('Bandit (Python 安全)', bandit.results.length, bySeverity(bandit.results, r => r.issue_severity));
  }

  const mypyTxt = path.join(outDir, '02-logic', 'mypy.txt');
  if (fs.existsSync(mypyTxt)) {
    const errCount = (fs.readFileSync(mypyTxt, 'utf8').match(/: error:/g) || []).length;
    md += `### mypy (Python 类型): ${errCount} errors\n\n`;
  }

  const tscTxt = path.join(outDir, '02-logic', 'tsc.txt');
  if (fs.existsSync(tscTxt)) {
    const errCount = (fs.readFileSync(tscTxt, 'utf8').match(/error TS\d+/g) || []).length;
    md += `### TypeScript (tsc): ${errCount} errors\n\n`;
  }

  const golangci = readJson(path.join(outDir, '02-logic', 'golangci-lint.json'));
  if (golangci) {
    const issues = (golangci.Issues || golangci.issues || []).length;
    md += `### golangci-lint: ${issues} issues\n\n`;
  }

  const gosec = readJson(path.join(outDir, '02-logic', 'gosec.json'));
  if (gosec?.Issues) {
    md += formatSeverityList('gosec (Go 安全)', gosec.Issues.length, bySeverity(gosec.Issues, i => i.severity));
  }

  const jscpd = readJson(path.join(outDir, '02-logic', 'jscpd', 'jscpd-report.json'));
  if (jscpd) {
    const total = (jscpd.statistics || jscpd.statistic || {}).total || {};
    md += `### jscpd (重复代码): ${total.percentage !== undefined ? total.percentage.toFixed(1) + '%' : '见报告'} 重复率\n\n`;
  }
  return md;
}

function sectionEfficiency(outDir) {
  let md = '## 3. Efficiency\n\n';
  md += mdBlock('Cyclomatic Complexity (radon)', snippetFile(path.join(outDir, '03-efficiency', 'radon-cc.txt'), 40));
  md += mdBlock('Maintainability Index (radon mi)', snippetFile(path.join(outDir, '03-efficiency', 'radon-mi.txt'), 30));
  return md;
}

function sectionArtifacts(outDir) {
  let md = '## Artifacts\n\n| Layer | Files |\n|-------|-------|\n';
  for (const sub of ['00-anatomy', '01-arch', '02-logic', '03-efficiency']) {
    const subDir = path.join(outDir, sub);
    if (fs.existsSync(subDir)) {
      const files = fs.readdirSync(subDir).join(', ');
      md += `| \`${sub}/\` | ${files || '(empty)'} |\n`;
    }
  }
  return md;
}

function generateSummary(repo, outDir) {
  const summaryPath = path.join(outDir, 'SUMMARY.md');

  let md = `# Investigation Report: ${path.basename(repo)}\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Path:** ${repo}\n\n---\n\n`;
  md += sectionAnatomy(outDir);
  md += sectionArchitecture(outDir);
  md += sectionLogic(outDir);
  md += sectionEfficiency(outDir);
  md += sectionArtifacts(outDir);

  try {
    fs.writeFileSync(summaryPath, md);
  } catch (err) {
    console.error(`  ⚠️  写入 SUMMARY.md 失败: ${err.message}`);
    return;
  }
  console.log(`\n📝 Summary: ${summaryPath}`);

  // Machine-readable counterpart for agents — single object with key metrics
  // from each layer, so downstream tools don't need to re-parse SUMMARY.md.
  const reportJson = buildReportJson(repo, outDir);
  const reportJsonPath = path.join(outDir, 'report.json');
  try {
    fs.writeFileSync(reportJsonPath, JSON.stringify(reportJson, null, 2));
    console.log(`📊 Machine report: ${reportJsonPath}`);
  } catch (err) {
    console.error(`  ⚠️  写入 report.json 失败: ${err.message}`);
  }
}

// ── report.json builders ───────────────────────────────────────────────────
// Each builder mutates a section of the output. All tolerant of missing files.

function bjAnatomy(out, outDir) {
  const anatomy = readJson(path.join(outDir, "00-anatomy", "anatomy.json"));
  if (anatomy) out.anatomy = anatomy;
}

function bjArch(out, outDir) {
  const scc = readJson(path.join(outDir, '01-arch', 'scc.json'));
  if (Array.isArray(scc)) {
    const total = scc.find(x => x.Name === 'Total');
    out.arch.languages = scc
      .filter(x => x.Name !== 'Total')
      .map(x => ({ name: x.Name, files: x.Count, code: x.Code, complexity: x.Complexity }))
      .sort((a, b) => b.code - a.code)
      .slice(0, 10);
    if (total) out.arch.total = { files: total.Count, code: total.Code, complexity: total.Complexity };
  }
  const gitStats = readJson(path.join(outDir, '01-arch', 'git-stats.json'));
  if (gitStats) out.arch.git = gitStats;
  out.arch.has_pydeps_svg = fs.existsSync(path.join(outDir, '01-arch', 'pydeps.svg'));
  out.arch.has_callgraph =
    fs.existsSync(path.join(outDir, '01-arch', 'pyan3-callgraph.dot')) ||
    fs.existsSync(path.join(outDir, '01-arch', 'code2flow.gv'));
}

function bjSemgrep(out, outDir) {
  const semgrep = readJson(path.join(outDir, '02-logic', 'semgrep.json'));
  if (semgrep?.results) {
    out.logic.semgrep = {
      total: semgrep.results.length,
      by_severity: bySeverity(semgrep.results, f => f.extra?.severity || 'INFO'),
    };
  }
}

function bjWtfpython(out, outDir) {
  const wtf = readJson(path.join(outDir, '02-logic', 'wtfpython.json'));
  if (!wtf?.results) return;
  const byRule = {};
  for (const r of wtf.results) {
    const id = r.check_id.split('.').pop();
    byRule[id] = (byRule[id] || 0) + 1;
  }
  out.logic.wtfpython = { total: wtf.results.length, by_rule: byRule };
}

function bjCpythonPitfalls(out, outDir) {
  const cpy = readJson(path.join(outDir, '02-logic', 'cpython-pitfalls.json'));
  if (!cpy?.results) return;
  const byRule = {};
  for (const r of cpy.results) {
    const id = r.check_id.split('.').pop();
    byRule[id] = (byRule[id] || 0) + 1;
  }
  out.logic.cpython_pitfalls = { total: cpy.results.length, by_rule: byRule };
}

function bjPyright(out, outDir) {
  const pyright = readJson(path.join(outDir, '02-logic', 'pyright.json'));
  if (pyright?.summary) {
    out.logic.pyright = {
      errors: pyright.summary.errorCount || 0,
      warnings: pyright.summary.warningCount || 0,
      info: pyright.summary.informationCount || 0,
    };
  }
}

function bjSeverityTool(out, outDir, key, file, listKey, sevKey) {
  const data = readJson(path.join(outDir, '02-logic', file));
  const items = data?.[listKey];
  if (!items) return;
  out.logic[key] = { total: items.length, by_severity: bySeverity(items, x => x[sevKey]) };
}

function bjLineMatch(out, outDir, key, file, pattern) {
  const p = path.join(outDir, '02-logic', file);
  if (!fs.existsSync(p)) return;
  const c = fs.readFileSync(p, 'utf8');
  out.logic[key] = { errors: (c.match(pattern) || []).length };
}

function bjVulture(out, outDir) {
  const p = path.join(outDir, '02-logic', 'vulture.txt');
  if (!fs.existsSync(p)) return;
  out.logic.vulture = {
    candidates: fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).length,
  };
}

function bjJscpd(out, outDir) {
  const jscpd = readJson(path.join(outDir, '02-logic', 'jscpd', 'jscpd-report.json'));
  if (!jscpd) return;
  const total = (jscpd.statistics || jscpd.statistic || {}).total || {};
  out.logic.jscpd = { duplication_pct: total.percentage ?? null, clones: total.clones ?? null };
}

function bjLizard(out, outDir) {
  const p = path.join(outDir, '02-logic', 'lizard.txt');
  if (!fs.existsSync(p)) return;
  const hotspots = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+\d+\s+\d+\s+\d+\s+(\S+)/);
    if (m && parseInt(m[2], 10) >= 15) {
      hotspots.push({ nloc: +m[1], ccn: +m[2], location: m[3] });
    }
  }
  hotspots.sort((a, b) => b.ccn - a.ccn);
  const seen = new Set();
  const dedup = hotspots.filter(h => {
    if (seen.has(h.location)) return false;
    seen.add(h.location);
    return true;
  });
  out.logic.lizard = { hotspots_ccn_ge_15: dedup.slice(0, 20) };
}

function bjEfficiency(out, outDir) {
  const p = path.join(outDir, '03-efficiency', 'radon-cc.txt');
  if (!fs.existsSync(p)) return;
  const c = fs.readFileSync(p, 'utf8');
  const m = c.match(/Average complexity:\s*([A-F])\s*\(([\d.]+)\)/);
  out.efficiency.radon = m
    ? { grade: m[1], avg_cc: parseFloat(m[2]) }
    : { raw_lines: c.split('\n').length };
}

function bjArtifacts(out, outDir) {
  const listDir = (sub) => {
    const d = path.join(outDir, sub);
    return fs.existsSync(d) ? fs.readdirSync(d) : [];
  };
  out.artifacts = {
    anatomy: listDir('00-anatomy'),
    arch: listDir('01-arch'),
    logic: listDir('02-logic'),
    efficiency: listDir('03-efficiency'),
  };
}

// Aggregate per-layer metrics into a stable JSON shape for agent consumption.
function buildReportJson(repo, outDir) {
  const out = {
    schema: 'repo-inv/report@1',
    repo: { name: path.basename(repo), path: repo },
    generated_at: new Date().toISOString(),
    anatomy: {},
    arch: {},
    logic: {},
    efficiency: {},
    artifacts: {},
  };

  bjAnatomy(out, outDir);
  bjArch(out, outDir);
  bjSemgrep(out, outDir);
  bjWtfpython(out, outDir);
  bjCpythonPitfalls(out, outDir);
  bjPyright(out, outDir);
  bjSeverityTool(out, outDir, 'bandit', 'bandit.json', 'results', 'issue_severity');
  bjSeverityTool(out, outDir, 'gosec', 'gosec.json', 'Issues', 'severity');
  bjLineMatch(out, outDir, 'mypy', 'mypy.txt', /: error:/g);
  bjLineMatch(out, outDir, 'tsc', 'tsc.txt', /error TS\d+/g);
  bjVulture(out, outDir);
  bjJscpd(out, outDir);
  bjLizard(out, outDir);
  bjEfficiency(out, outDir);
  bjArtifacts(out, outDir);

  return out;
}

module.exports = { runAnatomy, runArchitecture, runLogic, runEfficiency, generateSummary };
