const fs = require('fs');
const path = require('path');
const { STANDARD_ARCHITECTURE, evaluateAgainstStandard, renderStandardMarkdown, renderEvaluationMarkdown } = require('./standard');

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', '.next', '.venv',
  'venv', '__pycache__', '.pytest_cache', 'coverage', '.turbo',
]);

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function readJson(file) {
  try { return JSON.parse(readText(file)); } catch { return null; }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function walkFiles(root, maxFiles = 1200) {
  const files = [];
  function walk(dir, depth) {
    if (depth > 8 || files.length >= maxFiles) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.github') continue;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else {
        files.push(path.join(dir, e.name));
      }
    }
  }
  walk(root, 0);
  return files;
}

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function addEntry(entries, root, file, kind, runtime, reason, unitHint = null) {
  entries.push({
    path: rel(root, file),
    kind,
    runtime,
    reason,
    unit: unitHint || inferUnitFromPath(root, file, kind),
  });
}

function inferUnitFromPath(root, file, kind) {
  const r = rel(root, file);
  const parts = r.split('/');
  if (parts[0] === 'cmd' && parts[1]) return `cmd/${parts[1]}`;
  if (parts[0] === 'apps' && parts[1]) return `apps/${parts[1]}`;
  if (parts[0] === 'packages' && parts[1]) return `packages/${parts[1]}`;
  if (parts[0] === 'services' && parts[1]) return `services/${parts[1]}`;
  if (['frontend', 'web', 'client'].includes(parts[0])) return parts[0];
  if (['backend', 'server', 'api'].includes(parts[0])) return parts[0];
  if (kind === 'frontend') return 'frontend';
  if (kind === 'library_export') return 'library';
  return 'root';
}

function detectPython(root, files, entrypoints, interfaces) {
  for (const file of files.filter(f => f.endsWith('.py'))) {
    const base = path.basename(file);
    const text = readText(file);
    if (['main.py', 'app.py', 'server.py', 'run.py', 'manage.py'].includes(base)) {
      const kind = base === 'manage.py' ? 'cli' : (/(FastAPI|Flask|uvicorn|app\.run)/.test(text) ? 'api_server' : 'app_entry');
      addEntry(entrypoints, root, file, kind, 'python', `conventional ${base}`);
    }
    if (/if\s+__name__\s*==\s*["']__main__["']/.test(text)) {
      addEntry(entrypoints, root, file, 'cli_or_app_entry', 'python', '__main__ guard');
    }
    if (/(Celery\(|@shared_task|rq\.Queue|APScheduler|BackgroundScheduler)/.test(text)) {
      addEntry(entrypoints, root, file, 'worker_or_scheduler', 'python', 'worker/scheduler pattern');
    }
    const routeRe = /@(?:\w+\.)?(get|post|put|patch|delete|route)\(\s*["']([^"']+)["']/g;
    let m;
    while ((m = routeRe.exec(text))) {
      interfaces.push({ type: 'http_route', method: m[1].toUpperCase(), route: m[2], file: rel(root, file) });
    }
  }

  for (const cfg of ['pyproject.toml', 'setup.py', 'setup.cfg']) {
    const file = path.join(root, cfg);
    if (!fs.existsSync(file)) continue;
    const text = readText(file);
    if (/entry[_-]?points|\[project\.scripts\]|console_scripts/.test(text)) {
      addEntry(entrypoints, root, file, 'library_or_cli_export', 'python', `${cfg} declares package entry points`, 'library');
    }
  }
}

function detectNode(root, files, entrypoints, interfaces) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = readJson(pkgPath);
  if (pkg) {
    if (pkg.main || pkg.module || pkg.exports) {
      addEntry(entrypoints, root, pkgPath, 'library_export', 'node', 'package exports', 'library');
    }
    if (pkg.bin) addEntry(entrypoints, root, pkgPath, 'cli', 'node', 'package bin scripts', 'library');
    for (const [name, script] of Object.entries(pkg.scripts || {})) {
      if (/(vite|next|react-scripts|webpack)/.test(script)) {
        entrypoints.push({ path: 'package.json', kind: 'frontend', runtime: 'node', reason: `script ${name}: ${script}`, unit: 'frontend' });
      } else if (/(node|tsx|ts-node|nest start)/.test(script) && /(server|main|api|start)/.test(name + ' ' + script)) {
        entrypoints.push({ path: 'package.json', kind: 'api_server', runtime: 'node', reason: `script ${name}: ${script}`, unit: 'root' });
      }
    }
  }

  for (const file of files.filter(f => /\.(js|jsx|ts|tsx)$/.test(f))) {
    const base = path.basename(file);
    const text = readText(file);
    if (['main.ts', 'main.tsx', 'main.jsx', 'index.tsx', 'index.jsx'].includes(base)) {
      addEntry(entrypoints, root, file, 'frontend', 'node', `conventional ${base}`);
    }
    if (['server.ts', 'server.js', 'app.ts', 'app.js', 'index.ts', 'index.js'].includes(base) &&
        /(express\(|fastify\(|NestFactory|createServer|listen\()/.test(text)) {
      addEntry(entrypoints, root, file, 'api_server', 'node', `server bootstrap in ${base}`);
    }
    const routeRe = /\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = routeRe.exec(text))) {
      interfaces.push({ type: 'http_route', method: m[1].toUpperCase(), route: m[2], file: rel(root, file) });
    }
    const nestRe = /@(Get|Post|Put|Patch|Delete)\(\s*["'`]?([^"'`)]*)["'`]?\s*\)/g;
    while ((m = nestRe.exec(text))) {
      interfaces.push({ type: 'http_route', method: m[1].toUpperCase(), route: m[2] || '/', file: rel(root, file) });
    }
  }
}

function detectGo(root, files, entrypoints, interfaces) {
  for (const file of files.filter(f => f.endsWith('.go'))) {
    const text = readText(file);
    if (/package\s+main/.test(text) && /func\s+main\s*\(/.test(text)) {
      const kind = /(gin\.Default|fiber\.New|http\.ListenAndServe|chi\.NewRouter)/.test(text) ? 'api_server' : 'app_entry';
      addEntry(entrypoints, root, file, kind, 'go', 'package main with func main');
    }
    const routeRe = /\.(GET|POST|PUT|PATCH|DELETE|HandleFunc|Handle)\(\s*["']([^"']+)["']/g;
    let m;
    while ((m = routeRe.exec(text))) {
      interfaces.push({ type: 'http_route', method: m[1].toUpperCase(), route: m[2], file: rel(root, file) });
    }
    if (/cobra\.Command/.test(text)) {
      addEntry(entrypoints, root, file, 'cli', 'go', 'cobra command');
    }
  }
}

function detectDeployFiles(root, files, entrypoints, units) {
  for (const file of files) {
    const r = rel(root, file);
    const base = path.basename(file);
    if (base === 'Dockerfile' || base.endsWith('.Dockerfile')) {
      addEntry(entrypoints, root, file, 'deploy_entry', 'container', 'Dockerfile');
    }
    if (base === 'Procfile') addEntry(entrypoints, root, file, 'deploy_entry', 'procfile', 'Procfile');
    if (/docker-compose.*\.ya?ml$/.test(base)) {
      const text = readText(file);
      const serviceNames = [...text.matchAll(/^\s{2}([a-zA-Z0-9_-]+):\s*$/gm)].map(m => m[1]);
      for (const name of serviceNames) units.add(`compose/${name}`);
      entrypoints.push({ path: r, kind: 'deploy_entry', runtime: 'compose', reason: `compose services: ${serviceNames.join(', ') || 'unknown'}`, unit: 'compose' });
    }
    if (/\.ya?ml$/.test(base) && /(kind:\s*(Deployment|Job|CronJob|StatefulSet)|apiVersion:)/.test(readText(file))) {
      addEntry(entrypoints, root, file, 'deploy_entry', 'kubernetes', 'kubernetes manifest');
    }
  }
}

function inferArchitectureShape(entrypoints, units) {
  const unitCount = units.length;
  const kinds = new Set(entrypoints.map(e => e.kind));
  if (unitCount === 0 && kinds.has('library_export')) return 'library';
  if (unitCount >= 4 && entrypoints.some(e => e.runtime === 'compose' || e.runtime === 'kubernetes')) return 'microservices';
  if (kinds.has('frontend') && kinds.has('api_server')) return 'frontend_backend';
  if (unitCount >= 2) return 'multi_entry_monolith';
  if (kinds.has('library_export') && entrypoints.length > 1) return 'plugin_runtime';
  if (entrypoints.length <= 1) return 'single_entry_monolith';
  return 'mixed_workspace';
}

function classifyBorrowables(entrypoints, interfaces) {
  const assets = [];
  if (entrypoints.some(e => e.kind === 'api_server')) assets.push({ type: 'skeleton', name: 'api bootstrap and router wiring' });
  if (entrypoints.some(e => e.kind === 'cli')) assets.push({ type: 'skeleton', name: 'cli command entry structure' });
  if (entrypoints.some(e => e.kind === 'worker_or_scheduler')) assets.push({ type: 'skeleton', name: 'worker/scheduler lifecycle' });
  if (entrypoints.some(e => e.kind === 'library_export')) assets.push({ type: 'api', name: 'package public API/export surface' });
  if (interfaces.length) assets.push({ type: 'interface', name: 'HTTP route contract', count: interfaces.length });
  return assets;
}

function buildFlows(entrypoints, interfaces) {
  return entrypoints.slice(0, 30).map(e => {
    const routes = interfaces.filter(i => i.file === e.path).slice(0, 20);
    return {
      entrypoint: e.path,
      kind: e.kind,
      main_trunk: [
        `${e.kind}:${e.path}`,
        routes.length ? 'interface:http_routes' : 'interface:unknown',
        'adapter/handler:heuristic',
        'service/use_case:needs call graph or framework-specific scan',
        'domain/infra:needs deeper extraction',
      ],
      interfaces: routes,
    };
  });
}

function renderAnatomyMd(anatomy) {
  let md = `# Anatomy: ${anatomy.repo.name}\n\n`;
  md += `Architecture shape: **${anatomy.architecture_shape}**\n\n`;
  md += '## Deployable Units\n\n';
  for (const u of anatomy.deployable_units) md += `- ${u.name}: ${u.entrypoint_count} entrypoint(s), kinds=${u.kinds.join(', ')}\n`;
  if (!anatomy.deployable_units.length) md += '- none detected\n';
  md += '\n## Entrypoints\n\n';
  for (const e of anatomy.entrypoints) md += `- ${e.kind} [${e.runtime}] ${e.path} (${e.reason}) unit=${e.unit}\n`;
  if (!anatomy.entrypoints.length) md += '- none detected; inspect library exports/examples/tests next\n';
  return md + '\n';
}

function renderFlowsMd(anatomy) {
  let md = `# Business Flows: ${anatomy.repo.name}\n\n`;
  for (const f of anatomy.business_flows) {
    md += `## ${f.entrypoint}\n\n`;
    md += f.main_trunk.map(x => `- ${x}`).join('\n') + '\n';
    if (f.interfaces.length) {
      md += '\nInterfaces:\n';
      for (const i of f.interfaces) md += `- ${i.method} ${i.route}\n`;
    }
    md += '\n';
  }
  if (!anatomy.business_flows.length) md += 'No business flow could be inferred from entrypoints.\n';
  return md;
}

function renderShapeMd(anatomy) {
  return `# Architecture Shape: ${anatomy.repo.name}\n\n` +
    `Detected shape: **${anatomy.architecture_shape}**\n\n` +
    `Judgement is based on deployable units, entrypoint kinds, route/interface evidence, and deployment manifests. ` +
    `Do not treat raw main() count as architecture by itself.\n`;
}

function renderBorrowablesMd(anatomy) {
  let md = `# Borrowables: ${anatomy.repo.name}\n\n`;
  for (const a of anatomy.borrowable_assets) md += `- ${a.type}: ${a.name}${a.count ? ` (${a.count})` : ''}\n`;
  if (!anatomy.borrowable_assets.length) md += '- no obvious borrowable assets from anatomy pass\n';
  return md;
}

function renderAuditMd(anatomy) {
  const risks = anatomy.risks;
  let md = `# Project Audit: ${anatomy.repo.name}\n\n`;
  md += `Shape: ${anatomy.architecture_shape}\n\n`;
  for (const r of risks) md += `- ${r.severity}: ${r.message}\n`;
  if (!risks.length) md += '- no major anatomy-level risk detected\n';
  return md;
}

function detectRisks(entrypoints, units, interfaces) {
  const risks = [];
  if (!entrypoints.length) risks.push({ severity: 'yellow', message: 'no entrypoint/main trunk detected' });
  for (const e of entrypoints) {
    if (e.kind === 'api_server' && !interfaces.some(i => i.file === e.path)) {
      risks.push({ severity: 'yellow', message: `api entrypoint has no route evidence in same file: ${e.path}` });
    }
  }
  if (units.length > 3 && !entrypoints.some(e => ['compose', 'kubernetes'].includes(e.runtime))) {
    risks.push({ severity: 'yellow', message: 'many units inferred without deployment manifest evidence' });
  }
  return risks;
}

function dissectRepo(repoPath, profile = "generic") {
  const root = path.resolve(repoPath);
  const files = walkFiles(root);
  const entrypoints = [];
  const interfaces = [];
  const extraUnits = new Set();

  detectPython(root, files, entrypoints, interfaces);
  detectNode(root, files, entrypoints, interfaces);
  detectGo(root, files, entrypoints, interfaces);
  detectDeployFiles(root, files, entrypoints, extraUnits);

  const unitNames = new Set([...entrypoints.map(e => e.unit), ...extraUnits].filter(Boolean));
  const deployable_units = [...unitNames].sort().map(name => {
    const eps = entrypoints.filter(e => e.unit === name);
    return {
      name,
      entrypoint_count: eps.length,
      kinds: [...new Set(eps.map(e => e.kind))].sort(),
      entrypoints: eps.map(e => e.path),
    };
  });

  const anatomy = {
    schema: 'repo-inv/anatomy@1',
    repo: { name: path.basename(root), path: root },
    generated_at: new Date().toISOString(),
    architecture_shape: inferArchitectureShape(entrypoints, deployable_units),
    deployable_units,
    entrypoints,
    interfaces,
    business_flows: buildFlows(entrypoints, interfaces),
    borrowable_assets: classifyBorrowables(entrypoints, interfaces),
    risks: detectRisks(entrypoints, deployable_units, interfaces),
    standard: STANDARD_ARCHITECTURE.name,
  };
  anatomy.standard_evaluation = evaluateAgainstStandard(anatomy, profile);
  return anatomy;
}

function writeAnatomyArtifacts(anatomy, outDir) {
  const d = path.join(outDir, '00-anatomy');
  ensureDir(d);
  fs.writeFileSync(path.join(d, 'anatomy.json'), JSON.stringify(anatomy, null, 2));
  fs.writeFileSync(path.join(d, 'ANATOMY.md'), renderAnatomyMd(anatomy));
  fs.writeFileSync(path.join(d, 'ARCHITECTURE_SHAPE.md'), renderShapeMd(anatomy));
  fs.writeFileSync(path.join(d, 'BUSINESS_FLOWS.md'), renderFlowsMd(anatomy));
  fs.writeFileSync(path.join(d, 'BORROWABLES.md'), renderBorrowablesMd(anatomy));
  fs.writeFileSync(path.join(d, 'PROJECT_AUDIT.md'), renderAuditMd(anatomy));
  fs.writeFileSync(path.join(d, 'STANDARD_ARCHITECTURE.md'), renderStandardMarkdown(anatomy.standard_evaluation?.profile || "generic"));
  fs.writeFileSync(path.join(d, 'STANDARD_EVALUATION.md'), renderEvaluationMarkdown(anatomy.standard_evaluation));
}

async function runAnatomy(repo, outDir, options = {}) {
  console.log('\n🧭 Anatomy Layer');
  const anatomy = dissectRepo(repo, options.profile || "generic");
  writeAnatomyArtifacts(anatomy, outDir);
  console.log(`  → ${anatomy.entrypoints.length} entrypoint(s), ${anatomy.deployable_units.length} unit(s), shape=${anatomy.architecture_shape}`);
  console.log('  ✅ done');
  return anatomy;
}

module.exports = {
  dissectRepo,
  runAnatomy,
  writeAnatomyArtifacts,
};
