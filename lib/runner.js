const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || process.cwd(),
      stdio: opts.silent ? 'pipe' : 'inherit',
      shell: opts.shell || false,
    });
    let stdout = '';
    let stderr = '';
    if (opts.silent && child.stdout) child.stdout.on('data', d => stdout += d);
    if (opts.silent && child.stderr) child.stderr.on('data', d => stderr += d);
    child.on('close', code => {
      if (code !== 0 && !opts.ignoreError) {
        return reject(new Error(`${cmd} exited ${code}: ${stderr}`));
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

function detectEntryFile(repo) {
  const candidates = ['main.py', 'app.py', 'manage.py', 'run.py'];
  for (const c of candidates) {
    if (fs.existsSync(path.join(repo, c))) return path.join(repo, c);
  }
  return null;
}

async function runArchitecture(repo, outDir) {
  console.log('\n🏗️  Architecture Layer');
  const d = path.join(outDir, '01-arch');
  ensureDir(d);

  if (hasCommand('scc')) {
    console.log('  → scc');
    await runCmd('scc', [repo, '--format', 'json'], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'scc.json'), r.stdout))
      .catch(() => {});
    await runCmd('scc', [repo], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'scc.txt'), r.stdout))
      .catch(() => {});
  }

  if (hasCommand('tokei')) {
    console.log('  → tokei');
    await runCmd('tokei', [repo, '--output', 'json'], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'tokei.json'), r.stdout))
      .catch(() => {});
  }

  // Python deps
  if (fs.existsSync(path.join(repo, 'setup.py')) || fs.existsSync(path.join(repo, 'pyproject.toml'))) {
    if (hasCommand('pydeps')) {
      console.log('  → pydeps');
      await runCmd('pydeps', ['--max-bacon', '2', '-o', path.join(d, 'pydeps.svg'), repo], { ignoreError: true });
    }
  }

  // JS/TS deps
  if (fs.existsSync(path.join(repo, 'package.json'))) {
    console.log('  → madge (circular deps)');
    await runCmd('npx', ['madge', '--circular', '.'], { cwd: repo, silent: true, ignoreError: true, shell: true })
      .then(r => fs.writeFileSync(path.join(d, 'madge-circular.txt'), r.stdout))
      .catch(() => {});
  }

  // Git contributors
  if (fs.existsSync(path.join(repo, '.git'))) {
    console.log('  → git contributors');
    await runCmd('bash', ['-c', `cd "${repo}" && git log --format='%an' | sort | uniq -c | sort -rn | head -10`], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'git-contributors.txt'), r.stdout))
      .catch(() => {});
  }

  console.log('  ✅ done');
}

async function runLogic(repo, outDir) {
  console.log('\n🧠 Logic Layer');
  const d = path.join(outDir, '02-logic');
  ensureDir(d);

  if (hasCommand('semgrep')) {
    console.log('  → semgrep');
    await runCmd('semgrep', ['--config=auto', repo, '--json', '--output', path.join(d, 'semgrep.json'), '--exclude=node_modules', '--exclude=vendor', '--exclude=.git'], { ignoreError: true });
  }

  if (hasCommand('jscpd')) {
    console.log('  → jscpd');
    await runCmd('jscpd', [repo, '--reporters', 'json,html', '--output', path.join(d, 'jscpd'), '--ignore', 'node_modules, vendor, .git, dist, build'], { ignoreError: true });
  }

  if (hasCommand('lizard')) {
    console.log('  → lizard');
    await runCmd('lizard', [repo], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'lizard.txt'), r.stdout))
      .catch(() => {});
    await runCmd('lizard', [repo, '--xml'], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'lizard.xml'), r.stdout))
      .catch(() => {});
  }

  if (hasCommand('infer')) {
    const hasBuild = ['Makefile', 'CMakeLists.txt', 'build.gradle', 'pom.xml'].some(f => fs.existsSync(path.join(repo, f)));
    if (hasBuild) {
      console.log('  → infer');
      await runCmd('infer', ['run', '-o', path.join(d, 'infer-out'), '--', 'make', `-j${require('os').cpus().length}`], { cwd: repo, ignoreError: true });
    }
  }

  if (hasCommand('ast-grep')) {
    console.log('  → ast-grep');
    await runCmd('ast-grep', ['scan', '--json', repo], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'ast-grep.json'), r.stdout))
      .catch(() => {});
  }

  console.log('  ✅ done');
}

async function runEfficiency(repo, outDir) {
  console.log('\n⚡ Efficiency Layer');
  const d = path.join(outDir, '03-efficiency');
  ensureDir(d);

  if (hasCommand('radon')) {
    console.log('  → radon');
    await runCmd('radon', ['cc', repo, '-a', '-nc'], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'radon-cc.txt'), r.stdout))
      .catch(() => {});
    await runCmd('radon', ['mi', repo], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'radon-mi.txt'), r.stdout))
      .catch(() => {});
  }

  if (hasCommand('wily')) {
    console.log('  → wily');
    await runCmd('wily', ['report', repo], { silent: true, ignoreError: true })
      .then(r => fs.writeFileSync(path.join(d, 'wily.txt'), r.stdout))
      .catch(() => {});
  }

  const entry = detectEntryFile(repo);
  if (entry && hasCommand('py-spy')) {
    console.log('  → py-spy (5s sample)');
    await runCmd('timeout', ['6', 'py-spy', 'record', '-d', '5', '-o', path.join(d, 'py-spy.svg'), '--', 'python', entry], { ignoreError: true });
  }

  if (entry && hasCommand('memray')) {
    console.log('  → memray');
    const bin = path.join(d, 'memray.bin');
    await runCmd('memray', ['run', '-o', bin, '--', 'python', entry], { ignoreError: true });
    if (fs.existsSync(bin)) {
      await runCmd('memray', ['flamegraph', bin, '-o', path.join(d, 'memray.html')], { ignoreError: true });
    }
  }

  console.log('  ✅ done');
}

function generateSummary(repo, outDir) {
  const summaryPath = path.join(outDir, 'SUMMARY.md');
  let md = `# Investigation Report: ${path.basename(repo)}\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `**Path:** ${repo}\n\n`;

  md += '## 1. Architecture\n\n';
  const sccFile = path.join(outDir, '01-arch', 'scc.txt');
  if (fs.existsSync(sccFile)) {
    md += '```\n' + fs.readFileSync(sccFile, 'utf8').slice(0, 2000) + '\n```\n\n';
  }

  md += '## 2. Logic & Quality\n\n';
  const lizardFile = path.join(outDir, '02-logic', 'lizard.txt');
  if (fs.existsSync(lizardFile)) {
    md += '```\n' + fs.readFileSync(lizardFile, 'utf8').slice(0, 2000) + '\n```\n\n';
  }

  md += '## 3. Efficiency\n\n';
  const radonFile = path.join(outDir, '03-efficiency', 'radon-cc.txt');
  if (fs.existsSync(radonFile)) {
    md += '```\n' + fs.readFileSync(radonFile, 'utf8').slice(0, 2000) + '\n```\n\n';
  }

  md += '## Artifacts\n\n';
  md += '| Layer | Path |\n|-------|------|\n';
  md += '| Architecture | `01-arch/` |\n';
  md += '| Logic | `02-logic/` |\n';
  md += '| Efficiency | `03-efficiency/` |\n';

  fs.writeFileSync(summaryPath, md);
  console.log(`\n📝 Summary: ${summaryPath}`);
}

module.exports = { runArchitecture, runLogic, runEfficiency, generateSummary };
