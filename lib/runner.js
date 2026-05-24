const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

function generateSummary(repo, outDir) {
  const summaryPath = path.join(outDir, 'SUMMARY.md');

  // Line-based slice — avoids splitting multi-byte UTF-8 or ANSI sequences
  function snippet(filePath, maxLines = 60) {
    if (!fs.existsSync(filePath)) return null;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const head = lines.slice(0, maxLines).join('\n');
    const tail = lines.length > maxLines ? `\n… (${lines.length - maxLines} more lines)` : '';
    return head + tail;
  }

  let md = `# Investigation Report: ${path.basename(repo)}\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Path:** ${repo}\n\n---\n\n`;

  // ── Architecture ──
  md += '## 1. Architecture\n\n';

  const sccTxt = snippet(path.join(outDir, '01-arch', 'scc.txt'));
  if (sccTxt) md += `### Code Statistics (scc)\n\`\`\`\n${sccTxt}\n\`\`\`\n\n`;

  const contributors = snippet(path.join(outDir, '01-arch', 'git-contributors.txt'), 10);
  if (contributors) md += `### Top 10 Contributors\n\`\`\`\n${contributors}\n\`\`\`\n\n`;

  const gitStats = path.join(outDir, '01-arch', 'git-stats.json');
  if (fs.existsSync(gitStats)) {
    try {
      const s = JSON.parse(fs.readFileSync(gitStats, 'utf8'));
      md += `**Commits:** ${s.total_commits} | **First:** ${s.first_commit.slice(0, 10)} | **Last:** ${s.last_commit.slice(0, 10)}\n\n`;
    } catch {}
  }

  const staticcheckJson = path.join(outDir, '01-arch', 'staticcheck.json');
  if (fs.existsSync(staticcheckJson)) {
    const lines = fs.readFileSync(staticcheckJson, 'utf8').trim().split('\n').filter(Boolean);
    md += `**staticcheck (Go):** ${lines.length} findings\n\n`;
  }

  const callflowGv = path.join(outDir, '01-arch', 'code2flow.gv');
  const pyan3Dot = path.join(outDir, '01-arch', 'pyan3-callgraph.dot');
  const pydepsSvg = path.join(outDir, '01-arch', 'pydeps.svg');
  if (fs.existsSync(callflowGv)) md += `**code2flow:** 调用流程图已生成 → \`01-arch/code2flow.gv\`\n\n`;
  if (fs.existsSync(pyan3Dot)) md += `**pyan3:** 静态调用图已生成 → \`01-arch/pyan3-callgraph.dot\`\n\n`;
  if (fs.existsSync(pydepsSvg)) md += `**pydeps:** 模块依赖图已生成 → \`01-arch/pydeps.svg\`\n\n`;

  // ── Logic ──
  md += '## 2. Logic & Quality\n\n';

  const lizardTxt = snippet(path.join(outDir, '02-logic', 'lizard.txt'));
  if (lizardTxt) md += `### Cyclomatic Complexity (lizard)\n\`\`\`\n${lizardTxt}\n\`\`\`\n\n`;

  const semgrepJson = path.join(outDir, '02-logic', 'semgrep.json');
  if (fs.existsSync(semgrepJson)) {
    try {
      const sg = JSON.parse(fs.readFileSync(semgrepJson, 'utf8'));
      const findings = sg.results || [];
      const bySev = {};
      for (const f of findings) {
        const sev = f.extra?.severity || 'INFO';
        bySev[sev] = (bySev[sev] || 0) + 1;
      }
      md += `### Semgrep: ${findings.length} findings\n`;
      for (const [sev, n] of Object.entries(bySev).sort()) md += `- ${sev}: ${n}\n`;
      md += '\n';
    } catch {}
  }

  const pyrightJson = path.join(outDir, '02-logic', 'pyright.json');
  if (fs.existsSync(pyrightJson)) {
    try {
      const pr = JSON.parse(fs.readFileSync(pyrightJson, 'utf8'));
      const s = pr.summary || {};
      md += `### Pyright (类型检查): ${s.errorCount || 0} errors, ${s.warningCount || 0} warnings, ${s.informationCount || 0} info\n\n`;
    } catch {}
  }

  const vultureTxt = path.join(outDir, '02-logic', 'vulture.txt');
  if (fs.existsSync(vultureTxt)) {
    const lines = fs.readFileSync(vultureTxt, 'utf8').trim().split('\n').filter(Boolean);
    md += `### Vulture (死代码): ${lines.length} candidates\n\`\`\`\n${lines.slice(0, 15).join('\n')}\n\`\`\`\n\n`;
  }

  const banditJson = path.join(outDir, '02-logic', 'bandit.json');
  if (fs.existsSync(banditJson)) {
    try {
      const b = JSON.parse(fs.readFileSync(banditJson, 'utf8'));
      const results = b.results || [];
      const bySev = {};
      for (const r of results) {
        const sev = r.issue_severity || 'UNKNOWN';
        bySev[sev] = (bySev[sev] || 0) + 1;
      }
      md += `### Bandit (Python 安全): ${results.length} findings\n`;
      for (const [sev, n] of Object.entries(bySev).sort()) md += `- ${sev}: ${n}\n`;
      md += '\n';
    } catch {}
  }

  const mypyTxt = path.join(outDir, '02-logic', 'mypy.txt');
  if (fs.existsSync(mypyTxt)) {
    const content = fs.readFileSync(mypyTxt, 'utf8').trim();
    const errCount = (content.match(/: error:/g) || []).length;
    md += `### mypy (Python 类型): ${errCount} errors\n\n`;
  }

  const tscTxt = path.join(outDir, '02-logic', 'tsc.txt');
  if (fs.existsSync(tscTxt)) {
    const content = fs.readFileSync(tscTxt, 'utf8').trim();
    const errCount = (content.match(/error TS\d+/g) || []).length;
    md += `### TypeScript (tsc): ${errCount} errors\n\n`;
  }

  const golangciJson = path.join(outDir, '02-logic', 'golangci-lint.json');
  if (fs.existsSync(golangciJson)) {
    try {
      const gl = JSON.parse(fs.readFileSync(golangciJson, 'utf8'));
      const issues = (gl.Issues || gl.issues || []).length;
      md += `### golangci-lint: ${issues} issues\n\n`;
    } catch {}
  }

  const gosecJson = path.join(outDir, '02-logic', 'gosec.json');
  if (fs.existsSync(gosecJson)) {
    try {
      const g = JSON.parse(fs.readFileSync(gosecJson, 'utf8'));
      const issues = g.Issues || [];
      const bySev = {};
      for (const i of issues) {
        const sev = i.severity || 'UNKNOWN';
        bySev[sev] = (bySev[sev] || 0) + 1;
      }
      md += `### gosec (Go 安全): ${issues.length} findings\n`;
      for (const [sev, n] of Object.entries(bySev).sort()) md += `- ${sev}: ${n}\n`;
      md += '\n';
    } catch {}
  }

  const jscpdJson = path.join(outDir, '02-logic', 'jscpd', 'jscpd-report.json');
  if (fs.existsSync(jscpdJson)) {
    try {
      const j = JSON.parse(fs.readFileSync(jscpdJson, 'utf8'));
      const total = (j.statistics || j.statistic || {}).total || {};
      md += `### jscpd (重复代码): ${total.percentage !== undefined ? total.percentage.toFixed(1) + '%' : '见报告'} 重复率\n\n`;
    } catch {}
  }

  // ── Efficiency ──
  md += '## 3. Efficiency\n\n';

  const radonCc = snippet(path.join(outDir, '03-efficiency', 'radon-cc.txt'), 40);
  if (radonCc) md += `### Cyclomatic Complexity (radon)\n\`\`\`\n${radonCc}\n\`\`\`\n\n`;

  const radonMi = snippet(path.join(outDir, '03-efficiency', 'radon-mi.txt'), 30);
  if (radonMi) md += `### Maintainability Index (radon mi)\n\`\`\`\n${radonMi}\n\`\`\`\n\n`;

  // ── Artifacts ──
  md += '## Artifacts\n\n| Layer | Files |\n|-------|-------|\n';
  for (const sub of ['01-arch', '02-logic', '03-efficiency']) {
    const subDir = path.join(outDir, sub);
    if (fs.existsSync(subDir)) {
      const files = fs.readdirSync(subDir).join(', ');
      md += `| \`${sub}/\` | ${files || '(empty)'} |\n`;
    }
  }

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

// Aggregate per-layer metrics into a stable JSON shape for agent consumption.
function buildReportJson(repo, outDir) {
  const out = {
    schema: 'repo-inv/report@1',
    repo: { name: path.basename(repo), path: repo },
    generated_at: new Date().toISOString(),
    arch: {},
    logic: {},
    efficiency: {},
    artifacts: {},
  };

  const safeJson = (p) => {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  };
  const exists = (sub, f) => fs.existsSync(path.join(outDir, sub, f));
  const fileList = (sub) => {
    const d = path.join(outDir, sub);
    return fs.existsSync(d) ? fs.readdirSync(d) : [];
  };

  // ── arch ──
  const scc = safeJson(path.join(outDir, '01-arch', 'scc.json'));
  if (Array.isArray(scc)) {
    const total = scc.find(x => x.Name === 'Total');
    out.arch.languages = scc
      .filter(x => x.Name !== 'Total')
      .map(x => ({ name: x.Name, files: x.Count, code: x.Code, complexity: x.Complexity }))
      .sort((a, b) => b.code - a.code)
      .slice(0, 10);
    if (total) out.arch.total = { files: total.Count, code: total.Code, complexity: total.Complexity };
  }
  const gitStats = safeJson(path.join(outDir, '01-arch', 'git-stats.json'));
  if (gitStats) out.arch.git = gitStats;
  out.arch.has_pydeps_svg = exists('01-arch', 'pydeps.svg');
  out.arch.has_callgraph = exists('01-arch', 'pyan3-callgraph.dot') || exists('01-arch', 'code2flow.gv');

  // ── logic ──
  const semgrep = safeJson(path.join(outDir, '02-logic', 'semgrep.json'));
  if (semgrep && Array.isArray(semgrep.results)) {
    const bySev = {};
    for (const f of semgrep.results) {
      const s = f.extra?.severity || 'INFO';
      bySev[s] = (bySev[s] || 0) + 1;
    }
    out.logic.semgrep = { total: semgrep.results.length, by_severity: bySev };
  }
  const pyright = safeJson(path.join(outDir, '02-logic', 'pyright.json'));
  if (pyright?.summary) {
    out.logic.pyright = {
      errors: pyright.summary.errorCount || 0,
      warnings: pyright.summary.warningCount || 0,
      info: pyright.summary.informationCount || 0,
    };
  }
  const bandit = safeJson(path.join(outDir, '02-logic', 'bandit.json'));
  if (bandit?.results) {
    const bySev = {};
    for (const r of bandit.results) {
      const s = r.issue_severity || 'UNKNOWN';
      bySev[s] = (bySev[s] || 0) + 1;
    }
    out.logic.bandit = { total: bandit.results.length, by_severity: bySev };
  }
  const gosec = safeJson(path.join(outDir, '02-logic', 'gosec.json'));
  if (gosec?.Issues) {
    const bySev = {};
    for (const i of gosec.Issues) {
      const s = i.severity || 'UNKNOWN';
      bySev[s] = (bySev[s] || 0) + 1;
    }
    out.logic.gosec = { total: gosec.Issues.length, by_severity: bySev };
  }
  const mypyTxt = path.join(outDir, '02-logic', 'mypy.txt');
  if (fs.existsSync(mypyTxt)) {
    const c = fs.readFileSync(mypyTxt, 'utf8');
    out.logic.mypy = { errors: (c.match(/: error:/g) || []).length };
  }
  const vultureTxt = path.join(outDir, '02-logic', 'vulture.txt');
  if (fs.existsSync(vultureTxt)) {
    out.logic.vulture = {
      candidates: fs.readFileSync(vultureTxt, 'utf8').trim().split('\n').filter(Boolean).length,
    };
  }
  const jscpd = safeJson(path.join(outDir, '02-logic', 'jscpd', 'jscpd-report.json'));
  if (jscpd) {
    const total = (jscpd.statistics || jscpd.statistic || {}).total || {};
    out.logic.jscpd = { duplication_pct: total.percentage ?? null, clones: total.clones ?? null };
  }
  const lizardTxt = path.join(outDir, '02-logic', 'lizard.txt');
  if (fs.existsSync(lizardTxt)) {
    const lines = fs.readFileSync(lizardTxt, 'utf8').split('\n');
    const hotspots = [];
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+\d+\s+\d+\s+\d+\s+(\S+)/);
      if (m && parseInt(m[2], 10) >= 15) {
        hotspots.push({ nloc: +m[1], ccn: +m[2], location: m[3] });
      }
    }
    hotspots.sort((a, b) => b.ccn - a.ccn);
    const seen = new Set();
    const dedup = hotspots.filter(h => { if (seen.has(h.location)) return false; seen.add(h.location); return true; });
    out.logic.lizard = { hotspots_ccn_ge_15: dedup.slice(0, 20) };
  }

  // ── efficiency ──
  const radonCc = path.join(outDir, '03-efficiency', 'radon-cc.txt');
  if (fs.existsSync(radonCc)) {
    const c = fs.readFileSync(radonCc, 'utf8');
    const m = c.match(/Average complexity:\s*([A-F])\s*\(([\d.]+)\)/);
    out.efficiency.radon = m ? { grade: m[1], avg_cc: parseFloat(m[2]) } : { raw_lines: c.split('\n').length };
  }

  // ── artifacts ──
  out.artifacts = {
    arch: fileList('01-arch'),
    logic: fileList('02-logic'),
    efficiency: fileList('03-efficiency'),
  };

  return out;
}

module.exports = { runArchitecture, runLogic, runEfficiency, generateSummary };
