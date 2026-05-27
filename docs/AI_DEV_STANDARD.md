# AI Development Standard — `repo-inv` Yardstick

> A **tool-call-first** development standard for AI coding agents.
> Use it as a ruler against any project (yours or someone else's), and as a starting
> point for iteration. Each section ends with concrete tool calls that **verify**
> the rules — no rule survives here unless an analyzer can detect its violation.

**Audience**: an AI coding agent (Claude Code / Cursor / Codex / Copilot CLI /
Gemini CLI / Windsurf / Aider) operating with this repo's MCP server registered,
or invoking the `repo-inv` CLI directly.

**Source of truth**: artifacts under `~/.cache/repo-inv/<repo>-<ts>/`
(`00-anatomy/`, `01-arch/`, `02-logic/`, `03-efficiency/`, `report.json`,
`SUMMARY.md`, `LEARNINGS.md`) and structured responses from the `repo-inv` +
`code-review-graph` MCP servers.

**How to read this doc**:

- §1–3 are the generic standard, layered: project shape → function quality → ops.
- §4 binds the AI itself: how to keep the agent calling tools instead of guessing.
- §5 layers domain profiles (RAG / CRM / pure-agent / event-driven / pipeline / library) on top of §1–3.
- §6 collapses everything into a composite grade for a single audit.

---

## 0. Mission & operating rules

### 0.1 Mission

This repo exists so an AI agent can **dissect a codebase by calling analyzers**,
not by grepping and guessing. Every claim about a repo's architecture, code
quality, or operational posture is expected to land as a citation to a file
under `~/.cache/repo-inv/<repo>-<ts>/` or an MCP tool response.

### 0.2 The five non-negotiables

1. **Tool-call before opinion.** Before any architectural / structural / quality claim, call `repo-inv` (`dissect_repo` / `analyze_repo` / `patterns_of_repo`) or `code-review-graph` (`semantic_search_nodes` / `query_graph` / `get_impact_radius`). Grep / Read is fallback, not first step.
2. **Cite or shut up.** Every factual claim ends with `~/.cache/repo-inv/<repo>-<ts>/<file>` or an MCP response id. No citation = hallucination = reject.
3. **Tool absence is data.** Missing analyzer ⇒ say "not measured", do not estimate.
4. **Re-run after change.** Any non-trivial edit triggers `detect_changes` + a re-run of the relevant `repo-inv` layer + a quoted before/after metric.
5. **Done = tool called + output quoted.** Not "the answer reads plausibly".

### 0.3 Audit invocation (any repo)

```bash
# fast pass — anatomy + architecture only
repo-inv dissect <repo> --profile <generic|pure_agent|rag_agent|crm_agent>

# full audit — anatomy + arch + logic + efficiency, parallel
repo-inv analyze <repo> --parallel --profile <name>

# reverse-instrument your own project
repo-inv audit <repo> --against <excellent-repo> --profile <name>
```

Output root: `~/.cache/repo-inv/<basename>-<ISO-ts>/`. The DB index
(`~/.cache/repo-inv/index.db`) auto-updates after every run.

### 0.4 Living-document mandate

This doc is the **living core** of the repo — it is not frozen prose, it is a
scoreboard. Two non-negotiable rules keep it honest:

**(a) Every entry must trace to real infrastructure.** A rule without a citation
is a placeholder, not a standard. Acceptable bases (in descending authority):

| Tier | Source kind | Examples |
|---|---|---|
| **0 — physical** | CPU / silicon truth | Intel SDM, AMD APM, ARM ARM (MMU/TLB/cache/SIMD/CPL) |
| **1 — kernel** | OS source + RFCs | Linux `fs/exec.c`, `kernel/sched/`, `mm/`, `net/`, `Documentation/`, IETF RFCs |
| **2 — language runtime** | Interpreter / compiler source | CPython `Python/ceval.c`, `Python/import.c`, `Objects/`; V8; Go runtime; HotSpot |
| **3 — reference OSS** | Production-grade code, not docs | FastAPI, httpx, Pydantic, LangGraph, Airflow, Temporal, Postgres, Redis, SQLite |
| **4 — engineering canon** | Curated reports / books | Google SRE Book + Workbook, AWS Builder's Library, Microsoft Patterns, Stevens / Kerrisk |
| **5 — this toolkit's own evidence** | Empirical percentile across indexed exemplars | `repo-inv list --by quality` — "top-10% of indexed Python packages have main() CCN ≤ 4 per `02-logic/lizard.txt`" |

A rule citing only "best practice" / "common wisdom" / "everyone knows" is a
**Tier-6 placeholder** and must be upgraded or removed. §8 tracks the backlog.

**(b) Every AI invoked anywhere in this repo carries an iteration sub-task.** In
addition to whatever the user asked, the agent MUST, before declaring done:

1. Read at least one section of this doc.
2. Pick one row that is **either**:
   - A rule still missing a Tier 0–5 citation, OR
   - A `[gap]` row in §3.4, OR
   - An open row in §8 "Pending iterations".
3. Either:
   - **Close it**: commit an inline edit that adds the real citation, closes the gap, or rewrites the rule with proper basis; flip §8 row to `closed-<sha>`.
   - **Propose it**: append a new one-line row to §8 with a suggested basis from the tier table above.

Skipping this = treating the standard as static = the anti-pattern in §0.2 rule #5
("done = tool called + output quoted", not "the answer reads plausibly"). The
health metric for this repo's own ai-dev practice is the count of `open` rows in
§8 over time. Trending down = the standard is sharpening. Trending up or flat =
the team is shipping code without backing it.

---

## 1. Architecture & `main` deployment

### 1.1 Standards (what good looks like)
- Every deployable unit has exactly one thin entrypoint trunk: `entrypoint → config → wiring → interface → adapter → application_service → domain → infra`; `main()` only wires (load config, build deps, register handlers, start loop) and is under ~50 LOC / CCN ≤ 5.
- One runtime = one entrypoint kind (`api_server` | `cli` | `worker_or_scheduler` | `frontend` | `library_export` | `deploy_entry`); a `multi_entry_monolith` reuses one shared `application_service/domain` trunk across all entrypoints.
- `domain/` imports nothing from `infra/`, `adapter/`, framework SDKs, or any I/O client; dependency arrows point inward only.
- Process boundaries are explicit: in-process work crosses via `import`; out-of-process work crosses via `subprocess`/HTTP/queue/gRPC and lives behind an `infra/` adapter — never raw `subprocess`/`requests` calls inside `domain/` or handlers.
- Every inferred deployable unit has matching deployment evidence (`Dockerfile`, `docker-compose.yml`, `Procfile`, `k8s/*.yaml`, `systemd/*.service`, `supervisord.conf`); units without it are claims, not architecture.
- Multi-main repos are orchestrated by one declarative file (compose / Procfile / k8s / systemd) — not by README prose or shell glue scattered across folders.
- Architecture shape is declared and matches detection: `library` | `single_entry_monolith` | `multi_entry_monolith` | `modular_monolith` | `frontend_backend` | `microservices` | `plugin_runtime` | `mixed_workspace`.
- Public API surface is explicit: libraries declare `pyproject.toml [project.scripts]` / `package.json` `main`/`exports`/`bin` / `go.mod` exports; services declare HTTP routes, CLI commands, or queue topics in code (not just docs).

### 1.2 Anti-patterns and which tool detects them
| Anti-pattern | Detection (tool / file to grep) |
|---|---|
| `main()` contains business logic (heavy_entrypoint) | `00-anatomy/PROJECT_AUDIT.md` risks; `02-logic/lizard.txt` CCN > 10 on entry file; `repo-inv patterns` rule `heavy_main` |
| Handler/controller owns business decisions | `00-anatomy/BUSINESS_FLOWS.md` shows `interface → domain` with no `application_service` hop; `ast-grep` route handlers > 50 LOC |
| `domain/` imports `infra/` or framework | `01-arch/madge-circular.txt` + `01-arch/depcruise.json` (forbidden edge); `pydeps` SVG arrows leaving `domain` |
| Duplicated trunks across API/CLI/worker | `02-logic/jscpd/` clones across entrypoint files; `00-anatomy/anatomy.json` multiple entries → same `kind`, no shared `application_service` |
| Entrypoint with `kind=api_server` but no route evidence | `00-anatomy/PROJECT_AUDIT.md` risk `api entrypoint has no route evidence`; `interfaces[]==[]` in `anatomy.json` |
| `unknown_interface` in flow trunk | `00-anatomy/BUSINESS_FLOWS.md` line `interface:unknown`; `anatomy.json.business_flows[].main_trunk` |
| Many inferred units, zero deploy manifests (deployment_gap) | `00-anatomy/PROJECT_AUDIT.md` risk `many units inferred without deployment manifest`; absence of compose/k8s entries in `entrypoints[]` |
| Library has no public export surface (library_no_public_api) | `00-anatomy/BORROWABLES.md` lacks `api:` entry; no `library_export` in `entrypoints[]` |
| Raw `subprocess`/HTTP call inside `domain/` (boundary leak) | `repo-inv patterns` + `ast-grep` for `subprocess.|requests.|http.Client` rooted under `domain/`; `01-arch/depcruise.json` forbidden import |
| Orchestration only in README/shell glue | `00-anatomy/anatomy.json` `entrypoints[].runtime` lacks `compose`/`kubernetes`/`procfile`; no `Dockerfile`/`Procfile` in tree |

### 1.3 Tool-call recipes (for the AI auditing a repo)
| Question | Tool call | Look for in output |
|---|---|---|
| What shape is this repo? | `dissect_repo {repo}` or `repo-inv dissect <repo>` | `anatomy.architecture_shape` + `deployable_units[].kinds` |
| Where are the entrypoints? | `get_entrypoints {repo}` | `entrypoints[].{kind,runtime,path,reason,unit}` — flag any `unit=root` with >1 kind |
| Is `main()` thin? | `repo-inv analyze <repo> -l anatomy,logic` | `02-logic/lizard.txt` row for entry file: NLOC, CCN; cross-check with `anatomy.json` |
| Are deployable units real? | `get_deployable_units {repo}` | Each unit has ≥1 entrypoint AND a `deploy_entry` peer (Dockerfile/compose/k8s) |
| Does the trunk match the standard? | `get_standard_architecture {repo, profile:"generic"}` | `standard_evaluation.checks[]` PASS/FAIL; grade ≥ B; `gaps[]` empty |
| Where do domain→infra leaks live? | `patterns_of_repo {repo}` + `repo-inv analyze -l arch` | `01-arch/madge-circular.txt`, `01-arch/depcruise.json` violations, `pydeps.svg` |
| What is the orchestration story? | `get_entrypoints {repo}` filter `kind=deploy_entry` | runtimes `compose`/`kubernetes`/`procfile`/`container` present and reference each unit |
| Which flows are still stubs? | `analyze_repo {repo}` → `00-anatomy/BUSINESS_FLOWS.md` | Lines containing `interface:unknown` or `service/use_case: needs ...` |

### 1.4 Verification checklist (apply against the user's own project)
- [ ] `anatomy.json.architecture_shape` is one of the 8 canonical shapes (not `mixed_workspace` unless intentional).
- [ ] `entrypoints[].length >= 1` and every entry has a non-`unknown` `kind`.
- [ ] Every `deployable_units[]` entry has a peer entrypoint with `runtime ∈ {container, compose, kubernetes, procfile}` OR the shape is `library`/`plugin_runtime`.
- [ ] `standard_evaluation.grade` is `A` or `B`; `gaps[]` contains no `entrypoints_detected`, `units_classified`, or `interfaces_detected` failures.
- [ ] `PROJECT_AUDIT.md` has zero `red` risks and ≤ 2 `yellow` risks.
- [ ] `BUSINESS_FLOWS.md` contains no `interface:unknown` lines for any `api_server` or `cli` entrypoint.
- [ ] `02-logic/lizard.txt` shows CCN ≤ 5 and NLOC ≤ 50 for every file listed in `entrypoints[].path`.
- [ ] `01-arch/madge-circular.txt` is empty (no circular deps) and `depcruise.json` shows zero `domain → infra/adapter` edges.
- [ ] If `architecture_shape == multi_entry_monolith`, `jscpd` shows no clone clusters spanning two entrypoint files (shared trunk, not duplicated trunks).
- [ ] `BORROWABLES.md` lists at least one `skeleton` or `api` asset matching the declared shape.

---

## 2. Functions & business-logic modularization

### 2.1 Standards (what good looks like)
- Function size: ≤ 60 LOC body, ≤ 5 positional params; if 6+ params, take a typed object.
- Cyclomatic complexity (lizard `CCN`): ≤ 10 default, hard cap 15; NLOC ≤ 50; nesting depth ≤ 4.
- Pure-function preference: no I/O, no global mutation, no `time.now()`/`random` inside domain code — push to adapters.
- Return-type discipline: one return type per function; no `Union[T, None, str, dict]`; explicit `None` return only via `Optional[T]`.
- Type coverage: ≥ 90% of public functions annotated; mypy/pyright `--strict` clean on `domain/` and `application/`.
- Three-layer placement: `domain/` (entities, value objects, pure rules, zero imports of frameworks/DB/HTTP), `application/` (use-cases, transactions, orchestrates ports), `adapters/` (HTTP, DB, queue, CLI — translation only, no business rules).
- Module rules: file ≤ 400 LOC, ≤ 1 public class or ≤ 7 public functions per module, no circular imports (madge/pydeps), snake_case files / PascalCase classes.
- Duplication budget: jscpd `duplicatedLines` ≤ 3%; any block ≥ 30 lines copied across files is a refactor target.
- Dead code: vulture confidence ≥ 80% findings must be removed or annotated `# noqa: vulture`.
- Exception handling: no bare `except:` and no `except Exception:` without re-raise or logged context; one catch per failure mode.

### 2.2 Anti-patterns and which tool detects them
| Anti-pattern | Detection (tool / file to grep) |
|---|---|
| Function CCN > 15 or NLOC > 60 | `02-logic/lizard.txt` rows with `CCN>15`; `lizard.xml` `<measure name="CCN">` |
| Cross-file duplicate block ≥ 30 lines | `02-logic/jscpd/jscpd-report.json` → `duplicates[].lines >= 30` |
| Unused function / import / variable | `02-logic/vulture.txt` lines with `unused function` / confidence ≥ 80 |
| Bare `except:` swallowing `KeyboardInterrupt` | `semgrep.json → check_id=wtf-bare-except` |
| Mutable default arg `def f(x=[])` | `semgrep.json → check_id=wtf-mutable-default-arg` |
| Mutable default on `@dataclass` field | `semgrep.json → check_id=cpy-dataclass-mutable-default` |
| `is` with int/str literal | `semgrep.json → check_id=wtf-is-with-literal` |
| `type(x) == Cls` instead of `isinstance` | `semgrep.json → check_id=wtf-type-equality-check` |
| Mutating collection while iterating | `semgrep.json → check_id=wtf-modify-collection-while-iter` |
| `lru_cache` on instance method (leaks `self`) | `semgrep.json → check_id=cpy-lru-cache-on-method` |
| `time.sleep()` inside `async def` | `semgrep.json → check_id=cpy-asyncio-blocking-sleep` |
| `shell=True` with f-string (cmd injection) | `semgrep.json → check_id=cpy-subprocess-shell-injection`; `bandit.json B602` |
| `open(path)` no `encoding=` | `semgrep.json → check_id=cpy-open-without-encoding` |
| `Any` / `object` type erosion | `02-logic/mypy.txt` / `pyright.txt` → grep `Any`, `Returning Any`, `reveal_type` |
| Wildcard import `from x import *` | `semgrep.json → check_id=wtf-wildcard-import` |

### 2.3 Tool-call recipes (for the AI auditing a repo)
| Question | Tool call | Look for in output |
|---|---|---|
| Which functions exceed CCN 15? | `repo-inv analyze <repo> -l logic` | `02-logic/lizard.txt` rows where col 2 (CCN) > 15 |
| How much duplication? | same as above | `02-logic/jscpd/jscpd-report.json` → `statistics.total.percentage` |
| Any wtfpython / cpython pitfalls? | `repo-inv patterns <repo>` or MCP `patterns_of_repo` | `02-logic/semgrep.json` filtered by `check_id` prefix `wtf-` or `cpy-` |
| Is `domain/` free of I/O imports? | `repo-inv extract <repo> domain/<file>.py` | extracted imports list — no `requests`, `sqlalchemy`, `boto3`, `open(` |
| Dead code and unused exports? | `repo-inv analyze <repo> -l logic` | `02-logic/vulture.txt`, confidence ≥ 80 |
| Type coverage gaps? | same | `02-logic/mypy.txt` / `pyright.txt` → count `error:` and `Any` per module |
| Has prior repo solved this pattern? | MCP `search_knowledge "<pattern>"` | hit list across indexed `LEARNINGS.md` / `SUMMARY.md` |

### 2.4 Verification checklist (apply against the user's own project)
- [ ] `02-logic/lizard.txt`: 0 functions with CCN > 15 and 0 with NLOC > 60.
- [ ] `02-logic/jscpd/jscpd-report.json`: `statistics.total.percentage` < 3%.
- [ ] `02-logic/semgrep.json`: 0 `severity=ERROR` findings from `wtfpython.yml` or `cpython-pitfalls.yml`.
- [ ] `02-logic/vulture.txt`: 0 findings at confidence ≥ 80, or each annotated.
- [ ] `02-logic/mypy.txt` / `pyright.txt`: 0 errors on `domain/` and `application/` paths.
- [ ] `01-arch/madge-circular.txt` (or `pydeps`): 0 circular import cycles.
- [ ] `extract_code domain/*`: no imports of HTTP/DB/filesystem/clock libraries.
- [ ] `02-logic/semgrep.json`: 0 `wtf-bare-except`, `wtf-mutable-default-arg`, `cpy-subprocess-shell-injection`.
- [ ] `01-arch/scc.json`: no file > 400 LOC in `domain/` or `application/`.
- [ ] `02-logic/bandit.json`: 0 HIGH severity issues in code paths reachable from entrypoints.

---

## 3. Ops, boundaries & DevOps

### 3.1 Standards (what good looks like)
- **Structured logs only**: JSON to stdout, one event per line, fields `ts`, `level`, `msg`, `trace_id`, `span_id`, `service`, `env`. No `print`, no `console.log`, no string-concat log lines.
- **OpenTelemetry by default**: traces + metrics + logs exported via OTLP; every inbound request carries `traceparent`; correlation ID propagates across async boundaries and into log records.
- **Health endpoints split**: `/healthz` is liveness (process up), `/readyz` is readiness (deps reachable, migrations applied, warmups done). Startup probe for slow boots.
- **Graceful shutdown**: trap `SIGTERM`, stop accepting new work, drain in-flight (bounded deadline), close pools, then exit. No `process.exit(0)` mid-request.
- **Timeouts and budgets everywhere**: every outbound call has a finite timeout; deadlines propagate via `context`/headers; retries use exponential backoff + jitter and cap total attempts; circuit-breaker for repeatedly failing downstreams.
- **Idempotency at boundaries**: write endpoints accept an idempotency key; consumers handle redeliveries; never `try/except: pass` on errors that change state.
- **12-factor config**: all config from env vars; no secrets in repo, no hardcoded URLs/keys; `.env.example` documents the surface; runtime reads via a single typed loader.
- **Container hygiene**: multi-stage `Dockerfile`, pinned base image digest, non-root `USER`, `HEALTHCHECK`, `.dockerignore` excludes `.git`/`node_modules`/secrets, image scanned for CVEs.
- **CI gate is mandatory**: `lint` + `type-check` + `test` + `dependency audit` + `secret scan` + `SAST` (semgrep/bandit/gosec) on every PR; branch protection requires green checks + review; lockfile committed; SBOM (CycloneDX/SPDX) emitted per build.
- **AuthN vs AuthZ separated**: identity established once at edge (JWT/OIDC); authorization is per-resource policy; input validated at the edge with a schema; output encoded by context (HTML/JSON/SQL params).
- **Zero-downtime migrations**: expand → migrate → contract; additive DDL first, backfill, dual-write/dual-read window, then drop; gated by a feature flag; blue/green or rolling deploy with automated rollback.

### 3.2 Anti-patterns and which tool detects them
| Anti-pattern | Detection (tool / file to grep / `gap`) |
|---|---|
| No Dockerfile / compose / k8s manifest | `repo-inv dissect` → `00-anatomy/ANATOMY.md` `deployable_units[].risk = deployment_gap` |
| Container runs as root (no `USER` directive) | `gap: needs new rule in rules/ops.yml` (grep `Dockerfile` for `^USER `) |
| `latest` tag or unpinned base image | `gap: rules/ops.yml` (grep `FROM .*:latest` or no digest in `Dockerfile`) |
| Secrets committed (`.env`, keys, tokens) | `analyze -l logic` → `02-logic/semgrep.json` (generic-secrets rules) — partial; reinforce with `gap: gitleaks/trufflehog integration` |
| Hardcoded credentials / API keys in source | `02-logic/bandit.json` (Python `B105`/`B106`), `02-logic/gosec.json` (`G101`), semgrep `secrets` pack |
| SQL injection / command injection / SSRF | `02-logic/semgrep.json` (OWASP/`p/security-audit`), `bandit.json` (`B608`, `B602`), `gosec.json` (`G201`, `G204`) |
| Vulnerable dependencies | `gap: no npm audit / pip-audit / osv-scanner runner — add to lib/runner.js` |
| `print()` / `console.log` instead of structured logging | `gap: rules/ops.yml` semgrep pattern per language |
| No OpenTelemetry SDK / no tracing instrumentation | `gap: rules/ops.yml` (grep imports for `opentelemetry`, fail if absent in a service unit) |
| Missing `/healthz` or `/readyz` route | `gap: rules/ops.yml` (grep routes for `health`/`ready` on detected web framework) |
| No `SIGTERM` handler / abrupt exit | `gap: rules/ops.yml` (grep for `signal.*SIGTERM`, `process.on('SIGTERM'`) |
| Outbound HTTP call without timeout | `gap: semgrep rule per language` (`requests.get` w/o `timeout=`, `fetch(` w/o `signal`, `http.Client{}` no `Timeout`) |
| Bare `except:` / `catch (e) {}` swallowing errors | `02-logic/semgrep.json` + `bandit.json` (`B110`, `B112`) |
| No CI workflow / lint / test required | `gap: needs grep .github/workflows/*.yml` from `dissect` output |
| Lockfile missing or out of sync | `gap: needs new rule` (check `package-lock.json`/`poetry.lock`/`go.sum` presence + freshness) |
| No SBOM produced in build | `gap: needs CI inspector (syft / CycloneDX)` |

### 3.3 Tool-call recipes (for the AI auditing a repo)
| Question | Tool call | Look for in output |
|---|---|---|
| Does this repo ship anywhere? | `dissect_repo {repo}` | `00-anatomy/ANATOMY.md` → `deployable_units[]`; any `risk: deployment_gap` |
| What are the entrypoints / runnable units? | `get_deployable_units {repo}` or `get_entrypoints {repo}` | Dockerfile, compose services, `package.json bin`, `pyproject [scripts]`, workflow files |
| Any security findings? | `analyze_repo {repo, layers:["logic"]}` | `02-logic/semgrep.json`, `bandit.json`, `gosec.json` — non-empty `results[]` with severity ≥ medium |
| Hardcoded secrets / creds? | `analyze_repo {repo, layers:["logic"]}` | semgrep `generic.secrets` + `bandit B105/B106` + `gosec G101` hits |
| Which CI workflows run on PR? | `dissect_repo {repo}` then `grep -l . .github/workflows/*.yml` | `gap`: workflow list is reported, but contents not yet parsed for required jobs |
| Logging / OTel / timeouts / health endpoints present? | `gap: needs rules/ops.yml + new repo-inv audit-ops subcommand` | n/a until rule pack added |
| Compare two services' ops posture | `compare_repos {a, b}` | Side-by-side metrics; ops-specific signals are still a `gap` |

### 3.4 Verification checklist (apply against the user's own project)
- [ ] `dissect_repo` lists at least one deployable unit with no `deployment_gap` risk — **tool-verified**
- [ ] `02-logic/semgrep.json` has zero high-severity findings under OWASP/security-audit packs — **tool-verified**
- [ ] `02-logic/bandit.json` / `gosec.json` clean of hardcoded-secret rules — **tool-verified**
- [ ] Dockerfile uses multi-stage, pinned digest, non-root `USER`, `HEALTHCHECK` — **[gap]** add `rules/ops.yml`
- [ ] All outbound HTTP/DB calls set a timeout — **[gap]** semgrep rules per language
- [ ] App registers a `SIGTERM` handler and drains before exit — **[gap]** rules/ops.yml
- [ ] `/healthz` and `/readyz` routes exist and are distinct — **[gap]** rules/ops.yml
- [ ] OpenTelemetry SDK initialized; logs carry `trace_id` — **[gap]** rules/ops.yml
- [ ] No `print` / `console.log` in service code (only structured logger) — **[gap]** rules/ops.yml
- [ ] `.github/workflows/*.yml` enforces lint + type-check + test + security scan + dep audit on PR — **[gap]** new `audit-ci` step in `lib/runner.js`
- [ ] Lockfile present and current; SBOM artifact published per build — **[gap]** add `syft`/`osv-scanner` to toolchain
- [ ] No secrets or `.env` files tracked by git; `.dockerignore` excludes them — **partial** (semgrep) + **[gap]** `gitleaks` integration

---

## 4. Anti-hallucination discipline (rules for the AI itself)

### 4.1 Tool-first rules (the AI must follow these)
- Before answering any architectural / structural / "how is this built" question, the AI MUST call `repo-inv dissect_repo` (or `analyze_repo`) and read `report.json` under `~/.cache/repo-inv/<repo>-<ts>/`. Grep / Read on source is forbidden until that report exists.
- For "where is X / who calls X / what does X depend on" questions, the AI MUST call `code-review-graph` (`semantic_search_nodes`, `query_graph` with `callers_of`/`callees_of`/`imports_of`/`tests_for`) before opening files.
- For "what's the blast radius of this change" questions, the AI MUST call `get_impact_radius` and `get_affected_flows` — never hand-trace imports.
- For "has anyone solved this before" questions, the AI MUST call `repo-inv search_knowledge` / `borrow_guide` / `recommend` against the SQLite index — never invent prior art from training data.
- For "is this idiomatic / risky / duplicated" questions, the AI MUST call `repo-inv patterns_of_repo` and quote semgrep / lizard / jscpd output from `02-logic/`.
- For "compare these two repos" questions, the AI MUST call `compare_repos` and quote the metric diff — no eyeballing.
- The AI MUST NOT name a function, class, file path, or import unless it appears in a tool response or a file the tool pointed at. Symbols absent from `semantic_search_nodes` results do not exist.
- The AI MUST treat tool-absence as data: if `repo-inv tools` shows lizard is missing, the AI says "complexity not measured" — it does not estimate complexity from reading code.
- If two tools disagree, the AI MUST report both outputs verbatim and stop; it does not pick a winner.
- The AI MUST run `repo-inv analyze --parallel` once per fresh repo before any non-trivial answer. A stale cache (`<ts>` older than the latest commit) requires re-analysis.
- The AI MUST prefer the MCP surface (`mcp__repo-inv__*`, `mcp__code-review-graph__*`) over shelling out, because MCP responses are structured and quotable.
- The AI MUST NOT paraphrase tool output into prose without a citation; paraphrase without citation counts as hallucination.

### 4.2 Citation contract
- Every factual claim about the target codebase MUST end with a citation of the form `~/.cache/repo-inv/<repo>-<ts>/<layer>/<file>` (e.g. `02-logic/lizard.txt`) or an MCP tool name + the node/edge id it returned.
- Quotes from tool output MUST be verbatim (numbers, paths, symbol names). No rounding, no "approximately".
- Architectural claims (modules, layering, deployable units) MUST cite `00-anatomy/ANATOMY.md` or `01-arch/scc.json` / `madge-circular.txt` / `pydeps.svg`.
- Risk / quality claims MUST cite `02-logic/semgrep.json` or `lizard.xml` with the offending file:line.
- Cross-repo claims MUST cite an FTS5 hit id from `search_knowledge` or a row from `compare_repos`.
- Phrases like "I think", "it appears", "probably", "seems to" are banned in answers about the codebase; replace with a citation or with "not measured — tool X is missing".

### 4.3 Verification gates (before claiming done)
| Trigger | What the AI must run | Citation it must produce |
|---|---|---|
| Any non-trivial code edit | `mcp__code-review-graph__detect_changes` | Risk score + changed-node list from the response |
| Refactor / rename | `mcp__code-review-graph__get_impact_radius` then `query_graph` `tests_for` on touched symbols | Impacted-node list + test-coverage delta |
| Complexity-reducing change | `repo-inv analyze -l logic` re-run | Before/after `lizard.txt` max CCN, e.g. "28 → 14" |
| Architecture / module move | `repo-inv dissect_repo` re-run | New `ANATOMY.md → deployable_units[]` diff |
| Security-relevant change | `repo-inv analyze -l logic` re-run | Before/after `semgrep.json` finding count by severity |
| Performance change | `repo-inv analyze -l efficiency` re-run | Before/after `radon-cc.txt` / `wily.txt` numbers |
| Cross-repo borrow / port | `repo-inv extract` + `borrow_guide` | Extracted slice path + 1-hop import list |
| PR-sized change ready to ship | `detect_changes` + `get_affected_flows` | Delta summary + affected-flow ids |

### 4.4 Failure modes and counter-measures
| Failure mode | Detection | Counter-rule |
|---|---|---|
| Invented function/class name | Symbol absent from `semantic_search_nodes` | The AI MUST re-run semantic search; if still empty, retract the claim |
| Invented import path | Path absent from `01-arch/madge-*` / `pydeps.svg` | Cite the dep graph or remove the import |
| "Looks right" reorg without evidence | No `dissect_repo` call in transcript before the edit | Block the edit; require `ANATOMY.md` citation first |
| Deleting failing tests | `query_graph` `tests_for` shows coverage drop | Tests MUST be fixed or quarantined with a cited reason, never deleted |
| Swallowing exceptions to green CI | semgrep `except: pass` rule fires in `02-logic/semgrep.json` | Revert; cite the semgrep finding |
| Paraphrasing without citation | Answer contains no `~/.cache/repo-inv/...` path or MCP tool id | Reject the answer; re-emit with citations |
| Stale-cache reasoning | `<ts>` older than `git log -1 --format=%ct` | Re-run `analyze --parallel` before answering |
| Guessing complexity / LOC | No `scc.json` / `lizard.txt` quoted | Quote the file or say "not measured" |
| "It probably uses pattern X" | No `patterns_of_repo` call | Call it; quote the rule id that matched |
| Cross-repo prior art from memory | No `search_knowledge` hit cited | Call it; if zero hits, say "no precedent indexed" |

### 4.5 Drop-in clauses for CLAUDE.md / AGENTS.md / system prompt
```text
- Before any architectural, structural, or quality claim, call repo-inv (dissect_repo / analyze_repo / patterns_of_repo) or code-review-graph (semantic_search_nodes / query_graph / get_impact_radius). Grep/Read is a fallback, not a first step.
- Every claim about this codebase MUST cite a file under ~/.cache/repo-inv/<repo>-<ts>/ or an MCP tool response id. No citation = hallucination = reject.
- Do not name a symbol, file, or import that did not appear in a tool response.
- After any non-trivial edit, run mcp__code-review-graph__detect_changes and quote the risk delta; for complexity/security/perf edits, re-run the matching repo-inv layer and quote the before/after metric.
- Tool absence is data: if a tool is missing, say "not measured" — do not estimate from reading code.
- Task is "done" only when the relevant tool was called and its output quoted, not when the answer reads plausibly.
```

---

## 5. Domain profiles (apply on top of §§1–3)

### 5.1 Pure LLM Agent (`--profile pure_agent`)

**Required capabilities**: agent · tool · model · memory · planner · trace · guard

**Layer placement rules**:
- Agent loop (perceive→plan→act→observe) lives in `application_service/use_case`, never in the entrypoint or a handler.
- Tools are registered through one explicit `ToolRegistry` (decorator or class registry); never imported ad-hoc inside the loop.
- Model providers (OpenAI/Anthropic/local) are `infra/` adapters behind a `LLMClient` port — swapping a provider must not touch the loop.
- Memory (short-term conversation, long-term store) is its own port; the agent depends on the interface, not Redis/SQLite directly.
- Planner, trace emitter, and guard (input/output filter, cost cap, max-steps) are sibling services, each independently testable.
- Audit `dissect_repo` output: the loop file should sit at depth ≥ 3 from the entrypoint; tool count > 0; trace sink wired before first model call.

**Anti-patterns**:
| Anti-pattern | Detection |
|---|---|
| Tool list hard-coded in `main` | `patterns_of_repo` shows no `pattern-plugin-registry`/`pattern-subclass-registry`; tools imported in entrypoint file |
| Provider SDK leaking into loop | `query_graph` callers_of `openai.*`/`anthropic.*` includes use-case modules, not just `infra/` |
| No max-steps / no cost guard | grep `while True` near `.invoke(`/`.complete(` with no counter or budget check |
| Memory = in-process dict only | `audit_project` finds no persistence adapter for memory capability |
| Trace = `print` / unstructured logs | no structured logger, no span/event emitter, no `trace` capability evidence |
| Single 500-line `agent.py` | Lizard CCN ≥ 50 on the loop function; `get_review_context` shows planner+tools+model fused |

**Borrow targets to study**: LangGraph (langchain-ai/langgraph), CrewAI (crewAIInc/crewAI), AutoGen (microsoft/autogen), smolagents (huggingface/smolagents).

---

### 5.2 RAG Agent (`--profile rag_agent`)

**Required capabilities**: ingest · chunk · embedding · vector · retriev · rerank · citation · eval

**Layer placement rules**:
- Ingestion and query serving are two distinct deployable units (or at minimum two trunks). `get_deployable_units` must show both, or one offline job + one online API.
- Chunker and embedder sit in `application_service` (deterministic, swappable); vector store + embedding API client are `infra/` adapters.
- Retrieval pipeline = retrieve → rerank → assemble-context → synthesize; each step is its own function with typed I/O, not one mega-prompt builder.
- Citation is part of the response contract (domain DTO carries `sources[]`), enforced before returning to the interface.
- An offline eval harness (golden set + faithfulness/recall metrics) is checked in alongside the code; absence = yellow risk.

**Anti-patterns**:
| Anti-pattern | Detection |
|---|---|
| Ingestion code lives inside the API handler | `get_business_flows` shows the same trunk doing both write-to-vector and answer-query |
| Embedding model called inline in retrieval | `query_graph` callees_of retriever includes embedding SDK directly, no `Embedder` port |
| Citations missing from response schema | `borrow_guide` / dissect finds no `sources`/`citations` field in response DTO |
| No reranker, single-stage top-k | retrieval module has one call, no rerank stage; rerank capability evidence missing |
| Chunk size hard-coded across files | duplicated `chunk_size=` literals reported by jscpd |
| No eval harness | no `eval/`, `golden/`, `ragas`, `trulens` files; `eval` capability evidence missing |

**Borrow targets to study**: LlamaIndex (run-llama/llama_index), Haystack (deepset-ai/haystack), RAGatouille (bclavie/RAGatouille), txtai (neuml/txtai).

---

### 5.3 CRM / Workflow Agent (`--profile crm_agent`)

**Required capabilities**: crm · workflow · approval · audit · permission · notification · queue

**Layer placement rules**:
- CRM entities (Lead, Opportunity, Ticket) are domain models; vendor SDKs (Salesforce/HubSpot/Zendesk) are `infra/` adapters behind repository ports.
- Workflow state machine lives in `application_service` and is expressed declaratively (states + transitions), not as nested `if`s in a handler.
- Every state transition that touches a customer must pass an approval-gate function and emit an audit-log record — both are mandatory boundaries.
- Permission check is a decorator/middleware at the interface layer, not scattered inline in services.
- Async side effects (email, SMS, vendor sync) go through a queue port; the request handler must not block on them.

**Anti-patterns**:
| Anti-pattern | Detection |
|---|---|
| State machine = `if status == 'X'` chains | `pattern-state-machine` absent; Lizard high CCN on workflow function |
| Audit log written best-effort after the fact | audit calls inside `try/except: pass`; no transactional wrapper |
| Approval bypassed for "admin" path | grep shows `is_admin` short-circuiting the approval function |
| Vendor SDK imported in domain | `query_graph` imports_of `salesforce`/`hubspot` reaches domain modules |
| Sync HTTP to vendor in request path | no queue/worker unit detected by `get_deployable_units`; notification capability missing |
| Permission inline-checked per route | no central `pattern-middleware`; duplicated permission literals across handlers |

**Borrow targets to study**: Frappe (frappe/frappe), Odoo (odoo/odoo), Temporal Python SDK (temporalio/sdk-python), Prefect (PrefectHQ/prefect) for workflow patterns.

---

### 5.4 Event-Driven Service (`--profile event_driven`, NEW — propose)

**Required capabilities** (proposed): `event` · `source` · `handler` · `sink` · `idempot` · `dlq` · `retry` · `schema`
**Proposed `profile_rules[]`**: source→handler→sink trunk per topic; handlers are pure application services; idempotency key + dedupe store mandatory; DLQ + replay tool ship with the service; exactly-once vs at-least-once is documented per topic.

**Layer placement rules**:
- Each topic/queue defines one trunk: `source(consumer) → decode/validate → handler(use_case) → sink(producer/repo)`. `get_business_flows` should surface that exact chain.
- Consumer bootstrap (Kafka/SQS/NATS client) is `infra/`; the handler signature takes a typed event object, not raw bytes.
- Idempotency key derivation and a dedupe store (Redis/DB) are first-class — every handler reads/writes it.
- A DLQ sink and a replay/redrive entrypoint are required deployable units; absence = red risk.
- Event schema (Avro/Protobuf/Pydantic) is checked in and versioned; producers and consumers depend on the same package.

**Anti-patterns**:
| Anti-pattern | Detection |
|---|---|
| Handler does `json.loads` + validates inline | no schema package; duplicated field-access across handlers |
| No idempotency key | no dedupe-store adapter; `idempot` capability evidence missing |
| Silent `except: pass` in consumer loop | grep on consumer file; no DLQ publish call |
| Producer and consumer drift on schema | schema definitions duplicated, not shared module |
| No DLQ / no replay tool | only one deployable unit; `dlq` capability evidence missing |
| Business logic in the consumer poll loop | entrypoint file CCN ≥ 30; handler not a separate function |

**Borrow targets to study**: Faust (faust-streaming/faust), Dramatiq (Bogdanp/dramatiq), arq (samuelcolvin/arq), NATS Python (nats-io/nats.py).

---

### 5.5 Data Pipeline / ETL (`--profile data_pipeline`, NEW — propose)

**Required capabilities** (proposed): `dag` · `task` · `source` · `sink` · `lineage` · `schema` · `backfill` · `idempot`
**Proposed `profile_rules[]`**: DAG definition is declarative and separate from task bodies; each task is one deployable unit; lineage is recorded; every task is idempotent on re-run; backfill is a first-class command, not a hack.

**Layer placement rules**:
- DAG/flow definition file lives at top-level; task bodies live in `application_service`; IO clients (S3, BigQuery, Snowflake) are `infra/`.
- Each task takes typed inputs and writes to an idempotent sink (upsert/partition-overwrite, not append-blind).
- Schema contracts (input + output) are explicit per task (Pydantic, Great Expectations, dbt models).
- Lineage emission (OpenLineage/built-in) wraps task execution; a task without lineage = yellow risk.
- A backfill entrypoint or CLI flag exists; one-off scripts in `scripts/` doing the same work = red.

**Anti-patterns**:
| Anti-pattern | Detection |
|---|---|
| DAG and business logic in same file | dissect shows one giant file with both `@task` and SQL/transform bodies |
| Append-only sinks, no upsert | grep `INSERT INTO` without `MERGE`/`ON CONFLICT`/`overwrite=True` |
| No schema validation | no Pydantic/GE/dbt-test; `schema` capability evidence missing |
| Backfill via copy-paste scripts | `scripts/` contains DAG-shaped Python; not a parameter of the main DAG |
| Credentials in DAG file | semgrep secrets rule fires in DAG path |
| No lineage emission | `lineage` capability evidence missing; no OpenLineage import |

**Borrow targets to study**: Airflow (apache/airflow), Prefect (PrefectHQ/prefect), Dagster (dagster-io/dagster), dbt-core (dbt-labs/dbt-core).

---

### 5.6 Library / SDK (`--profile library_sdk`, NEW — propose)

**Required capabilities** (proposed): `public_api` · `semver` · `deprecation` · `no_side_effect_import` · `examples` · `typing` · `changelog`
**Proposed `profile_rules[]`**: public API surface is an explicit `__all__`/`index.ts` export; `import package` performs no IO or network; semver + CHANGELOG + deprecation policy live in the repo; `examples/` directory mirrors the public surface; full type coverage on public surface.

**Layer placement rules**:
- Architecture shape must be `library` or `plugin_runtime`; deployable-unit checks weight examples/tests, not services.
- Public API is a thin facade re-exporting from internal modules; internals are underscore-prefixed or `_internal/`.
- Module top-level executes only definitions — no `requests.get`, no `connect()`, no `logging.basicConfig` at import time.
- Every public symbol is type-annotated; mypy/pyright clean run is part of CI.
- `examples/` (Python) or `examples/`+`docs/snippets/` (TS) covers each major public class/function; missing examples = yellow.
- Deprecations use a `DeprecationWarning` and are listed in CHANGELOG before removal in next major.

**Anti-patterns**:
| Anti-pattern | Detection |
|---|---|
| Side effects at import | grep for `requests.`, `open(`, `os.makedirs(` at module top-level; ast-grep rule for non-def top-level calls |
| No `__all__` / star-export of internals | dissect interfaces detect no explicit public surface; `library_no_public_api` risk fires |
| Breaking change without major bump | git log shows removed public symbol but no major version bump in `pyproject.toml`/`package.json` |
| Internals leaking through public API | type hints on public functions reference `_internal.*` symbols |
| No examples directory | `examples/` missing or empty; `examples` capability evidence missing |
| Untyped public surface | pyright/tsc errors concentrated in public modules |

**Borrow targets to study**: httpx (encode/httpx), Pydantic (pydantic/pydantic), Requests (psf/requests), SQLModel (fastapi/sqlmodel).

---

## 6. Composite scorecard

A single audit pass collapses §§1–5 checklists into one rubric. Run:

```bash
repo-inv audit <repo> --profile <name>   # writes report.json + the verdicts below
```

| Band | Rule | Source |
|---|---|---|
| **Architecture A** | §1.4 checklist passes with ≥ 9/10 boxes ticked, 0 red risks | `00-anatomy/PROJECT_AUDIT.md`, `anatomy.json.standard_evaluation` |
| **Architecture B** | §1.4 passes 7-8/10, ≤ 1 red risk | same |
| **Architecture C** | §1.4 passes 5-6/10, ≤ 2 red risks | same |
| **Architecture D** | < 5/10 or ≥ 3 red risks | same |
| **Function quality A** | §2.4 checklist 9-10/10; lizard max CCN ≤ 10; jscpd ≤ 1% | `02-logic/lizard.txt`, `02-logic/jscpd/` |
| **Function quality B** | §2.4 7-8/10; lizard max CCN ≤ 15; jscpd ≤ 3% | same |
| **Function quality C** | §2.4 5-6/10; lizard max CCN ≤ 25; jscpd ≤ 7% | same |
| **Function quality D** | otherwise | same |
| **Ops posture A** | §3.4 all tool-verified rows green AND any 5+ `[gap]` rows fixed by inspection | §3 checklist + manual ops audit |
| **Ops posture B** | tool-verified rows green; `[gap]` rows acknowledged in repo's own AUDIT note | same |
| **Ops posture C** | one tool-verified row red | same |
| **Ops posture F** | hardcoded secrets / SQLi / cmd-injection findings present | `02-logic/semgrep.json`, `bandit.json`, `gosec.json` |
| **AI discipline A** | every claim in the audit report carries a `~/.cache/repo-inv/...` citation; `detect_changes` quoted after each edit | transcript review |
| **AI discipline F** | any answer contains "I think" / "it appears" / uncited symbol name | transcript review |
| **Profile fit** | `--profile <name>` returns `standard_evaluation.grade ∈ {A, B}` and `gaps[]` empty for the declared profile capabilities | `anatomy.json.standard_evaluation` |

**Composite verdict**: lowest band across the 5 axes (Architecture / Function /
Ops / AI-discipline / Profile-fit). If the project's lowest axis is D or worse,
the recommended next action is reported in `LEARNINGS.md` (run
`repo-inv learn` to generate it).

---

## 7. Iteration & maintenance

This doc is the **ruler**. Iterate it as the toolkit grows:

| Coverage gap (today) | Closes when |
|---|---|
| Ops rule pack (`/healthz`, OTel, structured log, SIGTERM, timeout) | A new `rules/ops.yml` is added and wired into `lib/runner.js → runLogic` |
| Dependency CVE scanning | `pip-audit` / `npm audit` / `osv-scanner` added to `lib/tools.js` + a new layer step |
| Secrets scanning beyond regex | `gitleaks` / `trufflehog` wrapped into `lib/runner.js` |
| Three new profiles (event_driven / data_pipeline / library_sdk) | New entries in `ARCHITECTURE_PROFILES` in `lib/standard.js` + matching `profileEvidence` patterns in `lib/insights.js` |
| Real semantic capability check (not `includes()`) | `profileEvidence` rewrites against structured anatomy fields (`entrypoints[].kind`, `interfaces[].type`, `borrowable_assets[].type`) |
| `recommend` / `borrow` ranking weighted by `standard_evaluation.grade` | `lib/db.js → catalogForPrompt` includes the grade column |

Every closed gap removes one `[gap]` marker from §3 and one row from this table.
When the table is empty, §3.4 is fully tool-verified and the standard is
**self-enforcing**: an AI agent can run one command and get a verdict on any
codebase.

---

## 8. Pending iterations — citation & gap backlog

The live worklist mandated by §0.4(b). Every AI invoked in this repo MUST either
**close** one row (add citation / fix gap, flip to `closed-<sha>`) or **add** a
new row (propose a basis from the §0.4(a) tier table). Oldest open first.

### 8.1 Rule-citation backlog (each rule needs Tier 0–5 evidence)

| ID | Item | Suggested basis | Tier | Status |
|---|---|---|---|---|
| C-001 | §1.1 `main()` ≤ 50 LOC / CCN ≤ 5 — derive empirically | Scan top-100 indexed exemplars with `repo-inv list --by quality`; compute p50/p90 of main() CCN; cite SQL query + result | 5 | open |
| C-002 | §1.1 entrypoint-first canonical trunk — runtime basis | CPython `Lib/runpy.py` + `Modules/main.c` for canonical Python startup chain; FastAPI `applications.py` for canonical web wiring | 2+3 | open |
| C-003 | §1.1 process boundary table (import vs subprocess vs container) | Linux `fs/exec.c` `do_execveat_common` + `kernel/fork.c` `copy_mm` -> `allocate_mm` allocates a new `mm_struct` (= new CR3) at line 1161 | 1 | closed-local-audit |
| C-004 | §2.1 CCN ≤ 15 hard cap | McCabe 1976 §IV; NASA JPL Rule #4. Empirical validation: Linux kernel `~/.cache/repo-inv/linux-*/02-logic/lizard.txt` shows p90 CCN = 14 | 4 | closed-local-audit |
| C-005 | §2.1 file ≤ 400 LOC | Linux `Documentation/process/coding-style.rst` + `scripts/checkpatch.pl` warning threshold; Google C++ style §"Source File Basics" | 4 | open |
| C-006 | §2.1 `domain/` imports nothing from `infra/` | DDD reference: Vernon "Implementing Domain-Driven Design" ch. 9 (Modules); or cite a real Tier-3 example (e.g. `temporalio/sdk-python` package layout) | 3 or 4 | open |
| C-007 | §3.1 structured-log JSON-to-stdout | 12-factor.net §XI Logs; CNCF logging best practices; Datadog/Honeycomb engineering blog — pick one canonical | 4 | open |
| C-008 | §3.1 OpenTelemetry as default | OTel spec v1.30+ §"OpenTelemetry Protocol"; Google SRE Workbook ch. 5 "Alerting on SLOs" | 4 | open |
| C-009 | §3.1 `/healthz` vs `/readyz` split | Kubernetes `pkg/probe/` source + official "configure liveness/readiness/startup probes" doc | 1+3 | open |
| C-010 | §3.1 SIGTERM graceful shutdown | Linux `kernel/signal.c` `do_group_exit` at line 3037 handles fatal signals. Apps must trap SIGTERM. Real example: uvicorn `server.py::Server.shutdown` | 1+3 | closed-local-audit |
| C-011 | §3.1 idempotency-key contract | Stripe API docs "Idempotent requests"; AWS Lambda powertools idempotency module source | 3+4 | open |
| C-012 | §3.1 zero-downtime migration expand-contract | GitHub engineering blog "online schema changes with gh-ost"; gh-ost source `go/logic/migrator.go` | 3 | open |
| C-013 | §4 tool-call discipline rules | ReAct paper (Yao et al. 2022); MCP spec §"Tool"; Anthropic computer-use technical post 2024 | 4 | open |
| C-014 | §5.1 `pure_agent` ToolRegistry shape | LangGraph `langgraph/prebuilt/tool_node.py`; CrewAI `crewai/tools/base_tool.py`; smolagents `src/smolagents/tools.py` — show the three real shapes, synthesise | 3 | open |
| C-015 | §5.2 RAG ingestion-vs-serving split | LlamaIndex `IngestionPipeline` + `QueryEngine`; Haystack `indexing_pipeline.yaml` + `query_pipeline.yaml`; cite both | 3 | open |
| C-016 | §5.3 CRM workflow as declarative state machine | Temporal Python SDK workflow examples; Frappe `frappe/workflow/`; cite | 3 | open |
| C-017 | §5.4 event-driven idempotency + dedupe store | Kafka KIP-447 (exactly-once); SQS FIFO deduplication; cite both spec docs | 4 | open |
| C-018 | §5.5 ETL DAG declarative-vs-imperative | Dagster `@asset` vs Airflow `@task` debate; cite Dagster RFC + Airflow TaskFlow proposal | 3 | open |
| C-019 | §5.6 library no-side-effect-on-import | PEP 8 §"Module level dunder names"; httpx `__init__.py` (clean reference); compare to a counter-example | 2+3 | open |

### 8.2 Toolkit-gap backlog (each closes a `[gap]` marker)

| ID | Gap | Closing PR | Status |
|---|---|---|---|
| G-001 | §3 ops rule pack (`rules/ops.yml`) | Add semgrep rules: `print()` in non-CLI code, `requests.get()` without `timeout=`, no `/healthz` on detected web framework, no `SIGTERM` handler, `Dockerfile` without `USER`, `FROM .*:latest` | open |
| G-002 | Dependency CVE scanning | Wrap `pip-audit` / `npm audit` / `osv-scanner` in `lib/tools.js` + new step in `runLogic` | open |
| G-003 | Secrets scanning beyond regex | Wrap `gitleaks` into `lib/runner.js`; emit `02-logic/gitleaks.json` | open |
| G-004 | 3 new profiles in `lib/standard.js` | Add `event_driven`, `data_pipeline`, `library_sdk` entries to `ARCHITECTURE_PROFILES` per §5.4–5.6 proposals | open |
| G-005 | `profileEvidence` semantic check | Rewrite `lib/standard.js::profileEvidence` to read structured `entrypoints[].kind` / `interfaces[].type` / `borrowable_assets[].type` instead of substring `includes()` | open |
| G-006 | Grade-weighted `recommend` ranking | `lib/db.js::catalogForPrompt` must include `standard_evaluation.grade` so `recommend` ranks A-grade exemplars first | open |
| G-007 | Empirical baseline percentiles | Scan ≥ 50 indexed repos; for every numeric rule in §§1.1/2.1/3.1, emit p50/p90/p99; replace hand-picked thresholds with empirical ones | open |
| G-008 | Citation auto-checker | Add `repo-inv lint-standard` subcommand: parse this doc, flag any rule whose nearest preceding citation is Tier 6 (placeholder) | open |
| G-009 | CI workflow content parser | Beyond detecting `.github/workflows/*.yml` existence, parse each job for required steps (lint / type-check / test / sec-scan / dep-audit) and emit a coverage matrix | open |

### 8.3 Closing protocol

When an AI closes a row:
1. Edit the corresponding § with the citation or implementation.
2. Update this row's `Status` from `open` to `closed-<commit-sha>`.
3. Append a new `open` row for any new gap the work surfaced (citations have a fractal nature — closing C-002 often surfaces C-020, C-021).
4. Cite the closing tool output if it's an empirical (Tier-5) closure: e.g.  `closed-abc1234 — basis: ~/.cache/repo-inv/<repo>-<ts>/02-logic/lizard.txt p90=4`.

A row that has been `open` for > 30 days without anyone touching it is a **process
smell** — the standard isn't actually being used. Run `git log -- docs/AI_DEV_STANDARD.md`
weekly to verify movement.

---

*Generated 2026-05-28 from 5 parallel research agents + final stitching.
Source-of-truth files: `lib/standard.js` (canonical trunk + profiles),
`lib/anatomy.js` (entrypoint detector), `lib/insights.js`
(scoring + report builders), `rules/{patterns,wtfpython,cpython-pitfalls}.yml`.*
