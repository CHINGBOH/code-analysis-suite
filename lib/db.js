// SQLite-backed knowledge index for repo-inv.
//
// One row per (repo_name, commit_hash). FTS5 mirror keeps LEARNINGS.md +
// SUMMARY.md searchable. All paths are absolute so the index is portable.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(os.homedir(), '.cache', 'repo-inv', 'index.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  commit_hash TEXT,
  scanned_at TEXT NOT NULL,
  report_dir TEXT NOT NULL,
  primary_lang TEXT,
  total_files INTEGER,
  total_code INTEGER,
  total_complexity INTEGER,
  semgrep_total INTEGER,
  semgrep_error INTEGER,
  bandit_total INTEGER,
  bandit_high INTEGER,
  pyright_errors INTEGER,
  mypy_errors INTEGER,
  vulture_candidates INTEGER,
  jscpd_pct REAL,
  lizard_max_ccn INTEGER,
  lizard_hotspot_count INTEGER,
  raw_report TEXT,
  learnings TEXT,
  UNIQUE(name, commit_hash)
);

CREATE TABLE IF NOT EXISTS languages (
  repo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  files INTEGER,
  code INTEGER,
  complexity INTEGER,
  FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hotspots (
  repo_id INTEGER NOT NULL,
  location TEXT NOT NULL,
  ccn INTEGER,
  nloc INTEGER,
  FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patterns (
  repo_id INTEGER NOT NULL,
  pattern TEXT NOT NULL,
  category TEXT,
  hits INTEGER NOT NULL,
  sample_path TEXT,
  sample_line INTEGER,
  FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repos_name ON repos(name);
CREATE INDEX IF NOT EXISTS idx_repos_scanned ON repos(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_languages_repo ON languages(repo_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_repo ON hotspots(repo_id);
CREATE INDEX IF NOT EXISTS idx_patterns_repo ON patterns(repo_id);
CREATE INDEX IF NOT EXISTS idx_patterns_name ON patterns(pattern);

CREATE VIRTUAL TABLE IF NOT EXISTS repo_fts USING fts5(
  name, primary_lang, learnings, summary,
  tokenize='unicode61'
);
`;

function openDb(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

// Detect git commit hash; return null if not a git repo.
function detectCommit(repoPath) {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// Upsert a report into the index. Reads report.json + SUMMARY.md +
// (optionally) LEARNINGS.md from reportDir.
function upsertReport(reportDir, opts = {}) {
  const db = openDb(opts.dbPath);
  const reportPath = path.join(reportDir, 'report.json');
  if (!fs.existsSync(reportPath)) throw new Error(`No report.json in ${reportDir}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const summaryPath = path.join(reportDir, 'SUMMARY.md');
  const summary = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '';
  const learningsPath = path.join(reportDir, 'LEARNINGS.md');
  const learnings = fs.existsSync(learningsPath) ? fs.readFileSync(learningsPath, 'utf8') : '';

  const commit = detectCommit(report.repo.path);
  const langs = report.arch?.languages || [];
  // Primary lang = highest-complexity entry (filters out Markdown/YAML/SVG)
  const codeLangs = langs.filter(l => (l.complexity || 0) > 0);
  const primaryLang = codeLangs.length
    ? codeLangs.sort((a, b) => (b.complexity || 0) - (a.complexity || 0))[0].name
    : (langs[0]?.name || null);
  const totalFiles = langs.reduce((s, l) => s + (l.files || 0), 0) || null;
  const totalCode = langs.reduce((s, l) => s + (l.code || 0), 0) || null;
  const totalComplexity = langs.reduce((s, l) => s + (l.complexity || 0), 0) || null;
  const hotspots = report.logic?.lizard?.hotspots_ccn_ge_15 || [];

  const sevSum = (obj) => obj ? Object.values(obj).reduce((a, b) => a + (b || 0), 0) : 0;

  const row = {
    name: report.repo.name,
    path: report.repo.path,
    commit_hash: commit,
    scanned_at: report.generated_at || new Date().toISOString(),
    report_dir: reportDir,
    primary_lang: primaryLang,
    total_files: totalFiles,
    total_code: totalCode,
    total_complexity: totalComplexity,
    semgrep_total: report.logic?.semgrep?.total ?? null,
    semgrep_error: report.logic?.semgrep?.by_severity?.ERROR ?? 0,
    bandit_total: report.logic?.bandit?.total ?? null,
    bandit_high: report.logic?.bandit?.by_severity?.HIGH ?? 0,
    pyright_errors: report.logic?.pyright?.errors ?? null,
    mypy_errors: report.logic?.mypy?.errors ?? null,
    vulture_candidates: report.logic?.vulture?.candidates ?? null,
    jscpd_pct: report.logic?.jscpd?.duplication_pct ?? null,
    lizard_max_ccn: hotspots.length ? hotspots[0].ccn : null,
    lizard_hotspot_count: hotspots.length,
    raw_report: JSON.stringify(report),
    learnings,
  };

  const tx = db.transaction(() => {
    // Delete prior row with same (name, commit) so re-runs replace cleanly
    const existing = db.prepare("SELECT id FROM repos WHERE name = ? AND IFNULL(commit_hash, '') = IFNULL(?, '')").get(row.name, row.commit_hash);
    if (existing) {
      db.prepare('DELETE FROM repos WHERE id = ?').run(existing.id);
      db.prepare('DELETE FROM languages WHERE repo_id = ?').run(existing.id);
      db.prepare('DELETE FROM hotspots WHERE repo_id = ?').run(existing.id);
      db.prepare('DELETE FROM repo_fts WHERE rowid = ?').run(existing.id);
    }

    const result = db.prepare(`
      INSERT INTO repos (
        name, path, commit_hash, scanned_at, report_dir, primary_lang,
        total_files, total_code, total_complexity,
        semgrep_total, semgrep_error, bandit_total, bandit_high,
        pyright_errors, mypy_errors, vulture_candidates, jscpd_pct,
        lizard_max_ccn, lizard_hotspot_count, raw_report, learnings
      ) VALUES (
        @name, @path, @commit_hash, @scanned_at, @report_dir, @primary_lang,
        @total_files, @total_code, @total_complexity,
        @semgrep_total, @semgrep_error, @bandit_total, @bandit_high,
        @pyright_errors, @mypy_errors, @vulture_candidates, @jscpd_pct,
        @lizard_max_ccn, @lizard_hotspot_count, @raw_report, @learnings
      )
    `).run(row);
    const repoId = result.lastInsertRowid;

    const langStmt = db.prepare('INSERT INTO languages (repo_id, name, files, code, complexity) VALUES (?, ?, ?, ?, ?)');
    for (const lang of (report.arch?.languages || [])) {
      langStmt.run(repoId, lang.name, lang.files, lang.code, lang.complexity);
    }

    const hotStmt = db.prepare('INSERT INTO hotspots (repo_id, location, ccn, nloc) VALUES (?, ?, ?, ?)');
    for (const h of hotspots) hotStmt.run(repoId, h.location, h.ccn, h.nloc);

    db.prepare('INSERT INTO repo_fts (rowid, name, primary_lang, learnings, summary) VALUES (?, ?, ?, ?, ?)')
      .run(repoId, row.name, row.primary_lang || '', learnings, summary);
  });
  tx();

  const id = db.prepare("SELECT id FROM repos WHERE name = ? AND IFNULL(commit_hash, '') = IFNULL(?, '')").get(row.name, row.commit_hash).id;
  db.close();
  return { id, ...row };
}

function listRepos(opts = {}) {
  const db = openDb(opts.dbPath);
  const orderBy = opts.orderBy || 'scanned_at DESC';
  const rows = db.prepare(`
    SELECT id, name, primary_lang, total_files, total_code, total_complexity,
           semgrep_error, bandit_high, pyright_errors, lizard_max_ccn, jscpd_pct,
           scanned_at, commit_hash, report_dir
    FROM repos ORDER BY ${orderBy}
  `).all();
  db.close();
  return rows;
}

function searchRepos(query, opts = {}) {
  const db = openDb(opts.dbPath);
  // FTS5 query — caller passes query syntax directly (supports OR, "phrase", -term)
  const rows = db.prepare(`
    SELECT r.id, r.name, r.primary_lang, r.total_code, r.lizard_max_ccn,
           r.report_dir, r.scanned_at,
           snippet(repo_fts, 2, '«', '»', '…', 12) AS hit_learnings,
           snippet(repo_fts, 3, '«', '»', '…', 12) AS hit_summary,
           bm25(repo_fts) AS score
    FROM repo_fts JOIN repos r ON r.id = repo_fts.rowid
    WHERE repo_fts MATCH ?
    ORDER BY score
    LIMIT ?
  `).all(query, opts.limit || 20);
  db.close();
  return rows;
}

function getRepoByName(name, opts = {}) {
  const db = openDb(opts.dbPath);
  const repo = db.prepare(`
    SELECT * FROM repos WHERE name = ?
    ORDER BY scanned_at DESC LIMIT 1
  `).get(name);
  if (!repo) { db.close(); return null; }
  repo.languages = db.prepare('SELECT name, files, code, complexity FROM languages WHERE repo_id = ? ORDER BY code DESC').all(repo.id);
  repo.hotspots = db.prepare('SELECT location, ccn, nloc FROM hotspots WHERE repo_id = ? ORDER BY ccn DESC LIMIT 20').all(repo.id);
  repo.patterns = db.prepare('SELECT pattern, category, hits, sample_path, sample_line FROM patterns WHERE repo_id = ? ORDER BY hits DESC').all(repo.id);
  db.close();
  return repo;
}

// Replace all pattern rows for a repo with the given list.
function savePatterns(repoId, patterns, opts = {}) {
  const db = openDb(opts.dbPath);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM patterns WHERE repo_id = ?').run(repoId);
    const stmt = db.prepare('INSERT INTO patterns (repo_id, pattern, category, hits, sample_path, sample_line) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of patterns) stmt.run(repoId, p.pattern, p.category || null, p.hits, p.sample_path || null, p.sample_line || null);
  });
  tx();
  db.close();
}

// Which indexed repos exhibit a given pattern? Useful for `recommend`.
function reposByPattern(pattern, opts = {}) {
  const db = openDb(opts.dbPath);
  const rows = db.prepare(`
    SELECT r.name, r.primary_lang, p.hits, p.sample_path, p.sample_line
    FROM patterns p JOIN repos r ON r.id = p.repo_id
    WHERE p.pattern = ?
    ORDER BY p.hits DESC
  `).all(pattern);
  db.close();
  return rows;
}

// Catalog of every indexed repo with a compact summary, for LLM prompting.
function catalogForPrompt(opts = {}) {
  const db = openDb(opts.dbPath);
  const repos = db.prepare(`
    SELECT id, name, primary_lang, total_code, lizard_max_ccn,
           semgrep_error, bandit_high, pyright_errors
    FROM repos ORDER BY scanned_at DESC
  `).all();
  const patStmt = db.prepare('SELECT pattern, hits FROM patterns WHERE repo_id = ? ORDER BY hits DESC');
  const hotStmt = db.prepare('SELECT location, ccn FROM hotspots WHERE repo_id = ? ORDER BY ccn DESC LIMIT 5');
  const learnStmt = db.prepare('SELECT substr(learnings,1,1500) AS l FROM repos WHERE id = ?');
  for (const r of repos) {
    r.patterns = patStmt.all(r.id);
    r.hotspots = hotStmt.all(r.id);
    r.learnings_excerpt = (learnStmt.get(r.id)?.l) || '';
  }
  db.close();
  return repos;
}

module.exports = {
  DEFAULT_DB_PATH,
  openDb,
  upsertReport,
  listRepos,
  searchRepos,
  getRepoByName,
  savePatterns,
  reposByPattern,
  catalogForPrompt,
  detectCommit,
};
