const fs = require('fs');
const path = require('path');
const db = require('./db');
const { evaluateAgainstStandard, renderStandardMarkdown } = require('./standard');

const DEFAULT_PATTERN_LABELS = {
  'pattern-retry-decorator': 'retry/backoff wheel',
  'pattern-rate-limit': 'rate limit wheel',
  'pattern-circuit-breaker': 'resilience boundary',
  'pattern-cache': 'cache wheel',
  'pattern-plugin-registry': 'plugin architecture',
  'pattern-subclass-registry': 'extension registry',
  'pattern-depends-injection': 'dependency injection',
  'pattern-middleware': 'API middleware skeleton',
  'pattern-events': 'event-driven boundary',
  'pattern-state-machine': 'state machine business flow',
  'pattern-pydantic': 'schema/data contract',
  'pattern-dataclass': 'domain data model',
  'pattern-context-manager': 'lifecycle/resource wrapper',
  'pattern-builder': 'builder/config assembly',
  'pattern-interface': 'interface/port boundary',
};

function normalizeText(s) {
  return String(s || '').toLowerCase();
}

function topicTerms(topic) {
  return normalizeText(topic)
    .split(/[^a-z0-9_\u4e00-\u9fa5]+/u)
    .filter(t => t.length >= 2);
}

function scoreRepoForTopic(repo, terms) {
  const haystack = [
    repo.name,
    repo.primary_lang,
    ...(repo.patterns || []).map(p => `${p.pattern} ${DEFAULT_PATTERN_LABELS[p.pattern] || ''}`),
    ...(repo.hotspots || []).map(h => h.location),
    repo.learnings_excerpt,
  ].join(' ').toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (haystack.includes(t)) score += 5;
  }
  score += (repo.patterns || []).length;
  if (repo.lizard_max_ccn != null && repo.lizard_max_ccn <= 30) score += 2;
  if ((repo.semgrep_error || 0) + (repo.bandit_high || 0) === 0) score += 2;
  return score;
}

function qualityNotes(repo) {
  const notes = [];
  const securityHigh = (repo.semgrep_error || 0) + (repo.bandit_high || 0);
  if (securityHigh > 0) notes.push(`security-high=${securityHigh}`);
  if ((repo.pyright_errors || 0) > 0) notes.push(`pyright-errors=${repo.pyright_errors}`);
  if (repo.lizard_max_ccn != null && repo.lizard_max_ccn >= 50) notes.push(`max-ccn=${repo.lizard_max_ccn}, refactor before copying`);
  if (repo.jscpd_pct != null && repo.jscpd_pct >= 5) notes.push(`duplication=${repo.jscpd_pct}%`);
  return notes.length ? notes.join('; ') : 'no major indexed quality blocker';
}

function topPatterns(repo, limit = 5) {
  return (repo.patterns || [])
    .slice(0, limit)
    .map(p => `- ${p.pattern} (${DEFAULT_PATTERN_LABELS[p.pattern] || p.category || 'pattern'}) x${p.hits}${p.sample_path ? ` at ${p.sample_path}:${p.sample_line || '?'}` : ''}`)
    .join('\n') || '- no indexed patterns yet; run `repo-inv patterns <repo>`';
}

function topHotspots(repo, limit = 5) {
  const seen = new Set();
  const deduped = (repo.hotspots || []).filter(h => {
    if (seen.has(h.location)) return false;
    seen.add(h.location);
    return true;
  });
  return deduped
    .slice(0, limit)
    .map(h => "- CCN " + h.ccn + ": " + h.location)
    .join('\n') || '- no high-CCN hotspots indexed';
}

function buildBorrowGuide(topic, opts = {}) {
  const catalog = db.catalogForPrompt(opts);
  const terms = topicTerms(topic);
  const ranked = catalog
    .map(repo => ({ repo, score: scoreRepoForTopic(repo, terms) }))
    .filter(x => x.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit || 5);

  let md = `# Borrow Guide: ${topic || 'general'}\n\n`;
  md += 'This guide is for choosing learning targets and borrowable wheels from indexed repositories. It is heuristic and uses indexed reports, patterns, hotspots, and learnings.\n\n';

  if (ranked.length === 0) {
    md += 'No indexed repository matched the topic. Run `repo-inv analyze <excellent-repo> --parallel` and `repo-inv patterns <excellent-repo>` first.\n';
    return { markdown: md, repos: [] };
  }

  md += '## Best Learning Targets\n\n';
  for (const [i, item] of ranked.entries()) {
    const r = item.repo;
    md += `### ${i + 1}. ${r.name}\n`;
    md += `- Language/size: ${r.primary_lang || 'unknown'}, ${r.total_code || '?'} LOC\n`;
    md += `- Match score: ${item.score}\n`;
    md += `- Copy risk: ${qualityNotes(r)}\n\n`;
    md += 'Borrowable patterns:\n';
    md += topPatterns(r) + '\n\n';
    md += 'Business/code hotspots to inspect before copying:\n';
    md += topHotspots(r) + '\n\n';
    if (r.learnings_excerpt) {
      md += 'Indexed learning excerpt:\n';
      md += `${r.learnings_excerpt.slice(0, 500).trim()}\n\n`;
    }
  }

  md += '## Action\n\n';
  md += '- Study the top repository first for architecture and skeleton shape.\n';
  md += '- Use `repo-inv extract <repo-path> <file> --out <dir>` only for small wheels with clear dependencies.\n';
  md += '- Use `repo-inv compare <excellent-repo> <my-project>` after your project is indexed to check whether the borrowed idea still fits.\n';

  return { markdown: md, repos: ranked.map(x => ({ name: x.repo.name, score: x.score })) };
}

function reportFromRepoNameOrPath(input, opts = {}) {
  const abs = path.resolve(input);
  let report = null;
  let reportDir = null;

  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const reportPath = path.join(abs, 'report.json');
    if (fs.existsSync(reportPath)) {
      reportDir = abs;
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      return { report, reportDir };
    }
  }

  const name = fs.existsSync(abs) ? path.basename(abs) : input;
  const row = db.getRepoByName(name, opts);
  if (!row) return null;
  report = row.raw_report ? JSON.parse(row.raw_report) : null;
  return { report, reportDir: row.report_dir, row };
}

function healthGrade(report) {
  const logic = report.logic || {};
  const highSecurity = (logic.semgrep?.by_severity?.ERROR || 0) + (logic.bandit?.by_severity?.HIGH || 0);
  const typeErrors = (logic.pyright?.errors || 0) + (logic.mypy?.errors || 0) + (logic.tsc?.errors || 0);
  const hotspots = logic.lizard?.hotspots_ccn_ge_15 || [];
  if (highSecurity > 0 || hotspots.some(h => h.ccn >= 80)) return 'red';
  if (typeErrors > 0 || hotspots.some(h => h.ccn >= 50) || (logic.jscpd?.duplication_pct || 0) >= 5) return 'yellow';
  return 'green';
}

function inferSkeleton(report, row = null) {
  if (report.anatomy && report.anatomy.schema) {
    const a = report.anatomy;
    const notes = [
      "architecture shape: " + a.architecture_shape,
      "deployable units: " + a.deployable_units.length,
      "entrypoints: " + a.entrypoints.length,
      "interfaces: " + a.interfaces.length,
    ];
    for (const r of (a.risks || []).slice(0, 5)) notes.push(r.severity + ": " + r.message);
    return { lang: row?.primary_lang || "unknown", notes, anatomy: a };
  }
  const artifacts = report.artifacts || {};
  const hasCallgraph = report.arch?.has_callgraph;
  const hasPydeps = report.arch?.has_pydeps_svg;
  const codeLang = (report.arch?.languages || []).find(l => (l.complexity || 0) > 0);
  const lang = row?.primary_lang || codeLang?.name || report.arch?.languages?.[0]?.name || 'unknown';
  const notes = [];
  if (hasCallgraph) notes.push('call graph exists: inspect entry-to-business flow before refactoring');
  if (hasPydeps) notes.push('module dependency graph exists: use it to check skeleton boundaries');
  if ((artifacts.logic || []).includes('madge-circular.txt')) notes.push('JS/TS circular dependency report exists');
  if (!notes.length) notes.push('no architecture graph artifact was generated; add framework-specific entrypoint scanning next');
  return { lang, notes };
}

function buildProjectReview(input, opts = {}) {
  const loaded = reportFromRepoNameOrPath(input, opts);
  if (!loaded || !loaded.report) {
    throw new Error(`No indexed report found for ${input}. Run repo-inv analyze <repo> --parallel first.`);
  }

  const report = loaded.report;
  const logic = report.logic || {};
  const hotspots = logic.lizard?.hotspots_ccn_ge_15 || [];
  if (report.anatomy && opts.profile) report.anatomy.standard_evaluation = evaluateAgainstStandard(report.anatomy, opts.profile);
  const skeleton = inferSkeleton(report, loaded.row);
  const grade = healthGrade(report);

  let md = `# Project Review: ${report.repo?.name || input}\n\n`;
  md += `Source: ${report.repo?.path || input}\n`;
  if (loaded.reportDir) md += `Report: ${loaded.reportDir}\n`;
  md += "Health: " + grade + "\n";
  if (report.anatomy?.standard_evaluation) {
    const ev = report.anatomy.standard_evaluation;
    md += "Standard score: " + ev.score + "/" + ev.max_score + " (" + ev.grade + ")\n";
  }
  md += "\n";

  md += '## Architecture And Skeleton\n\n';
  md += `- Primary language signal: ${skeleton.lang}\n`;
  for (const note of skeleton.notes) md += `- ${note}\n`;
  if (skeleton.anatomy) {
    md += "\nEntrypoint trunks:\n";
    for (const f of skeleton.anatomy.business_flows.slice(0, 8)) md += "- " + f.main_trunk.join(" -> ") + "\n";
  }
  md += '- Review question: is each deployable unit keeping startup/bootstrap thin and reusing service/domain trunks?\n\n';

  md += '## Business Logic Risk\n\n';
  if (hotspots.length) {
    const seen = new Set();
    const deduped = hotspots.filter(h => {
      if (seen.has(h.location)) return false;
      seen.add(h.location);
      return true;
    });
    for (const h of deduped.slice(0, 10)) md += "- CCN " + h.ccn + ": " + h.location + "\n";
  } else {
    md += '- No CCN>=15 hotspots indexed.\n';
  }
  md += '\n';

  md += '## Quality Signals\n\n';
  md += `- Semgrep ERROR: ${logic.semgrep?.by_severity?.ERROR || 0}\n`;
  md += `- Bandit HIGH: ${logic.bandit?.by_severity?.HIGH || 0}\n`;
  md += `- Type errors: ${(logic.pyright?.errors || 0) + (logic.mypy?.errors || 0) + (logic.tsc?.errors || 0)}\n`;
  md += `- Duplication: ${logic.jscpd?.duplication_pct ?? 'unknown'}%\n\n`;

  if (report.anatomy?.standard_evaluation) {
    const ev = report.anatomy.standard_evaluation;
    md += "## Standard Gaps\n\n";
    if (ev.gaps.length) {
      for (const g of ev.gaps) md += "- " + g.id + ": " + g.message + "\n";
    } else {
      md += "- no standard gaps detected\n";
    }
    md += "\n## Standard Recommendations\n\n";
    for (const r of ev.recommendations) md += "- " + r + "\n";
    md += "\n";
  }

  md += '## Refactor Direction\n\n';
  if (grade === 'red') {
    md += '- Stop copying new code into this project until the red signals are isolated.\n';
    md += '- First split unsafe or very high-CCN paths behind explicit service/domain boundaries.\n';
  } else if (grade === 'yellow') {
    md += '- Keep the current skeleton, but reduce hotspot functions before adding new features.\n';
    md += '- Compare against a cleaner indexed project before borrowing a wheel.\n';
  } else {
    md += '- This project is a reasonable target for comparison against excellent repos.\n';
    md += '- Use borrow/recommend to choose specific architecture or wheel references.\n';
  }

  if (opts.against) {
    md += `\n## Comparison Target\n\n- Intended reference: ${opts.against}\n- Run \`repo-inv compare ${opts.against} ${report.repo.name}\` after both repos are indexed.\n`;
  }

  return { markdown: md, grade, reportDir: loaded.reportDir };
}

function buildStandardGuide(profile = "generic") {
  return renderStandardMarkdown(profile);
}

module.exports = {
  buildStandardGuide,
  buildBorrowGuide,
  buildProjectReview,
  reportFromRepoNameOrPath,
};
