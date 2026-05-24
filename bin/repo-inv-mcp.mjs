#!/usr/bin/env node
// MCP server exposing the repo-investigator knowledge base to agents.
//
// Tools surface:
//   - list_repos          : tabular view of every indexed repo
//   - search_knowledge    : FTS5 over LEARNINGS.md + SUMMARY.md
//   - compare_repos       : side-by-side metrics diff
//   - get_repo_details    : full row + languages + hotspots + patterns
//   - patterns_of_repo    : architectural patterns detected in a repo
//   - repos_with_pattern  : which repos exhibit a given pattern
//   - extract_code        : copy file + 1-hop intra-repo imports to a dest dir
//   - analyze_repo        : run a fresh analyze and index it
//   - recommend           : DeepSeek-powered "which repo to copy from for task X"
//
// Wire into Claude Code / any MCP client by adding to its mcp config:
//   { "mcpServers": { "repo-inv": { "command": "node", "args": ["/home/l/code_analysis_suite/bin/repo-inv-mcp"] } } }

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const db = require('../lib/db.js');
const SUITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(SUITE_ROOT, 'bin', 'repo-inv');

// .env loader (mirrors bin/repo-inv to avoid coupling)
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(SUITE_ROOT, '.env'));

const TOOLS = [
  {
    name: 'list_repos',
    description: 'List every repo currently in the cross-repo knowledge base (~/.cache/repo-inv/index.db).',
    inputSchema: {
      type: 'object',
      properties: {
        order_by: { type: 'string', enum: ['recent', 'size', 'quality', 'complexity'], default: 'recent' },
      },
    },
  },
  {
    name: 'search_knowledge',
    description: 'FTS5 full-text search across all indexed LEARNINGS.md + SUMMARY.md. Supports OR, "phrase", -term, prefix*. Returns snippets.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'FTS5 query (e.g., "retry OR backoff", "depends NOT deprecated")' },
        lang: { type: 'string', description: 'Filter by primary_lang (e.g., "Python")' },
        max_ccn: { type: 'integer', description: 'Only repos whose max CCN ≤ this' },
        limit: { type: 'integer', default: 20 },
      },
    },
  },
  {
    name: 'compare_repos',
    description: 'Side-by-side comparison of two indexed repos by name (metrics, languages, top hotspots).',
    inputSchema: {
      type: 'object',
      required: ['repo_a', 'repo_b'],
      properties: {
        repo_a: { type: 'string' },
        repo_b: { type: 'string' },
      },
    },
  },
  {
    name: 'get_repo_details',
    description: 'Full row for one indexed repo: metadata, languages, top-20 hotspots (CCN≥15), detected patterns, learnings excerpt.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string', description: 'Repo name (basename of original path)' } },
    },
  },
  {
    name: 'patterns_of_repo',
    description: 'List architectural patterns detected in a given indexed repo (from `patterns` cmd output).',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    },
  },
  {
    name: 'repos_with_pattern',
    description: 'Reverse lookup: which indexed repos exhibit a given pattern (e.g., pattern-retry-decorator)? Returns hits + sample.',
    inputSchema: {
      type: 'object',
      required: ['pattern'],
      properties: { pattern: { type: 'string', description: 'Pattern id from rules/patterns.yml (e.g., pattern-circuit-breaker)' } },
    },
  },
  {
    name: 'extract_code',
    description: 'Copy a file + its 1-hop intra-repo Python imports into a destination dir, preserving layout. Returns the manifest (files / pip deps / stdlib deps).',
    inputSchema: {
      type: 'object',
      required: ['repo_path', 'file', 'out'],
      properties: {
        repo_path: { type: 'string', description: 'Absolute path to the source repo on disk' },
        file: { type: 'string', description: 'Repo-relative file path (e.g., "fastapi/encoders.py")' },
        out: { type: 'string', description: 'Destination directory (will be created)' },
        max_hops: { type: 'integer', default: 1 },
      },
    },
  },
  {
    name: 'analyze_repo',
    description: 'Run a fresh 3-layer analysis on a repo and auto-index it. Long-running (1-10 min). Use `parallel: true` for ~3x speedup.',
    inputSchema: {
      type: 'object',
      required: ['repo_path'],
      properties: {
        repo_path: { type: 'string', description: 'Absolute path to repo' },
        parallel: { type: 'boolean', default: true },
        layer: { type: 'string', description: 'Comma-separated subset of arch,logic,efficiency', default: 'all' },
      },
    },
  },
  {
    name: 'recommend',
    description: 'Ask DeepSeek (using the full indexed catalog) which repos/files/patterns to copy from for a given user task. Returns markdown with citations.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: { task: { type: 'string', description: 'What the user wants to build / port / understand' } },
    },
  },
];

const server = new Server({ name: 'repo-inv', version: '2.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

// Shell out to the CLI for commands that already produce well-formatted output
// (compare, extract, analyze, recommend). DB-only reads go direct via lib/db.
function runCli(args, opts = {}) {
  const res = spawnSync('node', [CLI, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case 'list_repos': {
        const orderMap = {
          recent: 'scanned_at DESC',
          size: 'total_code DESC',
          quality: '(IFNULL(semgrep_error,0)+IFNULL(bandit_high,0)+IFNULL(pyright_errors,0)) ASC',
          complexity: 'lizard_max_ccn DESC',
        };
        return jsonResult(db.listRepos({ orderBy: orderMap[args.order_by] || orderMap.recent }));
      }

      case 'search_knowledge': {
        let rows = db.searchRepos(args.query, { limit: args.limit || 20 });
        if (args.lang) rows = rows.filter(r => (r.primary_lang || '').toLowerCase() === args.lang.toLowerCase());
        if (args.max_ccn != null) rows = rows.filter(r => r.lizard_max_ccn != null && r.lizard_max_ccn <= args.max_ccn);
        return jsonResult({ count: rows.length, query: args.query, hits: rows });
      }

      case 'get_repo_details': {
        const r = db.getRepoByName(args.name);
        if (!r) return textResult(`Repo "${args.name}" not in index. Run analyze_repo first.`);
        // Strip the heavyweight raw_report blob; agent can ask explicitly if needed
        const { raw_report, ...slim } = r;
        return jsonResult(slim);
      }

      case 'patterns_of_repo': {
        const r = db.getRepoByName(args.name);
        if (!r) return textResult(`Repo "${args.name}" not in index.`);
        return jsonResult({ name: r.name, patterns: r.patterns });
      }

      case 'repos_with_pattern':
        return jsonResult({ pattern: args.pattern, repos: db.reposByPattern(args.pattern) });

      case 'compare_repos': {
        const out = runCli(['compare', args.repo_a, args.repo_b]);
        return textResult((out.stdout + out.stderr).trim());
      }

      case 'extract_code': {
        const cliArgs = ['extract', args.repo_path, args.file, '--out', args.out];
        if (args.max_hops) cliArgs.push('--max-hops', String(args.max_hops));
        const out = runCli(cliArgs);
        const manifestPath = path.join(args.out, 'EXTRACT.json');
        const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
        return jsonResult({ cli_output: out.stdout, status: out.status, manifest });
      }

      case 'analyze_repo': {
        const cliArgs = ['analyze', args.repo_path];
        if (args.parallel !== false) cliArgs.push('--parallel');
        if (args.layer && args.layer !== 'all') cliArgs.push('--layer', args.layer);
        const out = runCli(cliArgs);
        return textResult(`status=${out.status}\n\n${out.stdout}\n${out.stderr}`);
      }

      case 'recommend': {
        const out = runCli(['recommend', args.task]);
        return textResult(out.stdout || out.stderr);
      }

      default:
        return textResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return textResult(`ERROR ${name}: ${err.message}\n${err.stack || ''}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[repo-inv-mcp] ready on stdio');
