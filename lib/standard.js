const STANDARD_ARCHITECTURE = {
  schema: 'repo-inv/standard-architecture@1',
  name: 'entrypoint-first-standard',
  principle: 'Project architecture is judged from deployable units and main trunks, not raw main() count.',
  canonical_trunk: [
    'deployable_unit',
    'entrypoint/bootstrap',
    'configuration',
    'dependency_wiring',
    'interface',
    'adapter/handler',
    'application_service/use_case',
    'domain',
    'infra/repository/client',
  ],
  deployable_unit_rules: [
    'Each independently deployed runtime has one thin entrypoint trunk.',
    'API, CLI, worker, scheduler, frontend, and library exports are different entrypoint kinds.',
    'A monolith may have multiple entrypoints, but they should reuse application/domain trunks.',
    'A microservice shape requires deployment evidence or clearly separated service units.',
  ],
  layer_rules: [
    'Entrypoint/bootstrap loads config, wires dependencies, registers interfaces, then exits.',
    'Interface/adapters translate protocol concerns into use-case calls.',
    'Application services own orchestration and transactions.',
    'Domain owns business rules and must not import framework or persistence adapters.',
    'Infrastructure implements ports: repositories, clients, queues, storage, model providers.',
  ],
  required_evidence: [
    'entrypoints',
    'deployable_units',
    'interfaces',
    'business_flows',
    'borrowable_assets',
    'risks',
  ],
  anti_patterns: [
    { id: 'heavy_entrypoint', severity: 'red', message: 'main/bootstrap contains business logic instead of wiring.' },
    { id: 'handler_business_logic', severity: 'red', message: 'controller/handler owns core business decisions.' },
    { id: 'domain_imports_infra', severity: 'red', message: 'domain depends on database/client/framework code.' },
    { id: 'duplicated_trunks', severity: 'yellow', message: 'API/CLI/worker duplicate use-case logic.' },
    { id: 'unknown_interface', severity: 'yellow', message: 'entrypoint exists but exposed interface is unclear.' },
    { id: 'deployment_gap', severity: 'yellow', message: 'many inferred units but no deployment manifest evidence.' },
    { id: 'library_no_public_api', severity: 'yellow', message: 'library has no clear export/API surface.' },
  ],
  shapes: {
    library: 'No runtime service is required; public exports/examples/tests are the API.',
    single_entry_monolith: 'One main trunk owns one runtime; good for small apps.',
    multi_entry_monolith: 'Multiple entrypoints share one codebase and should share service/domain trunks.',
    frontend_backend: 'Frontend and backend are separate deployable units with an API contract between them.',
    modular_monolith: 'One deployable app with clear internal modules and ports.',
    microservices: 'Multiple independently deployed service units with explicit APIs/events.',
    plugin_runtime: 'Package/runtime exposes extension points, CLI, plugins, or public exports.',
    mixed_workspace: 'Workspace contains multiple shapes and needs unit-level evaluation.',
  },
  score_weights: {
    entrypoints_detected: 20,
    units_classified: 20,
    interfaces_detected: 15,
    flows_constructed: 20,
    borrowables_identified: 10,
    low_anatomy_risk: 15,
  },
};

const ARCHITECTURE_PROFILES = {
  generic: { id: "generic", name: "Generic Entrypoint-First Project", required_capabilities: [], profile_rules: ["Use the base entrypoint-first trunk standard."] },
  pure_agent: { id: "pure_agent", name: "Pure Agent Runtime", required_capabilities: ["agent", "tool", "model", "memory", "planner", "trace", "guard"], profile_rules: ["Agent loop belongs in application services.", "Tools are registered behind an explicit registry.", "Model providers are infrastructure adapters.", "Memory and traces are explicit and testable."] },
  rag_agent: { id: "rag_agent", name: "RAG Agent", required_capabilities: ["ingest", "chunk", "embedding", "vector", "retriev", "rerank", "citation", "eval"], profile_rules: ["Ingestion and query serving are separate trunks or use cases.", "Vector DB and embedding clients are infrastructure adapters.", "Retrieval and answer synthesis are application services.", "Grounding and citations are response contracts."] },
  crm_agent: { id: "crm_agent", name: "CRM Agent", required_capabilities: ["crm", "workflow", "approval", "audit", "permission", "notification", "queue"], profile_rules: ["CRM entities and workflow rules belong in domain/application layers.", "CRM vendors are infrastructure adapters.", "Human approval and audit logging are mandatory boundaries.", "Frontend/API/worker trunks share workflow services."] },
};

function getStandardProfile(profile = "generic") {
  return ARCHITECTURE_PROFILES[profile] || ARCHITECTURE_PROFILES.generic;
}

function profileEvidence(anatomy, profile) {
  const haystack = [
    anatomy.architecture_shape || "",
    ...(anatomy.entrypoints || []).map(e => e.kind + " " + e.path + " " + e.reason),
    ...(anatomy.interfaces || []).map(i => i.type + " " + (i.method || "") + " " + (i.route || "") + " " + (i.file || "")),
    ...(anatomy.borrowable_assets || []).map(a => a.type + " " + a.name),
    ...(anatomy.business_flows || []).flatMap(f => f.main_trunk || []),
  ].join(" ").toLowerCase();
  return (profile.required_capabilities || []).map(capability => ({ capability, found: haystack.includes(capability) }));
}

function evaluateAgainstStandard(anatomy, profileId = "generic") {
  const profile = getStandardProfile(profileId);
  const weights = STANDARD_ARCHITECTURE.score_weights;
  const checks = [];
  const entrypoints = anatomy.entrypoints || [];
  const units = anatomy.deployable_units || [];
  const interfaces = anatomy.interfaces || [];
  const flows = anatomy.business_flows || [];
  const assets = anatomy.borrowable_assets || [];
  const risks = anatomy.risks || [];
  const redRisks = risks.filter(r => r.severity === 'red');
  const yellowRisks = risks.filter(r => r.severity === 'yellow');

  function add(id, pass, weight, message) {
    checks.push({ id, pass, weight, message });
  }

  add('entrypoints_detected', entrypoints.length > 0, weights.entrypoints_detected, 'At least one entrypoint/main trunk is detected.');
  add('units_classified', units.length > 0, weights.units_classified, 'Deployable units are classified.');
  add('interfaces_detected', interfaces.length > 0 || anatomy.architecture_shape === 'library' || anatomy.architecture_shape === 'plugin_runtime', weights.interfaces_detected, 'Interfaces or public API/export surface are detected.');
  add('flows_constructed', flows.length > 0, weights.flows_constructed, 'Entrypoint-to-business-flow trunks are constructed.');
  add('borrowables_identified', assets.length > 0, weights.borrowables_identified, 'Borrowable skeleton/API/interface assets are identified.');
  add('low_anatomy_risk', redRisks.length === 0 && yellowRisks.length <= 2, weights.low_anatomy_risk, 'Anatomy risk level is acceptable.');

  const evidence = profileEvidence(anatomy, profile);
  for (const item of evidence) add('profile_' + item.capability, item.found, 5, profile.name + ' capability evidence: ' + item.capability);

  const score = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const gaps = checks.filter(c => !c.pass).map(c => ({ id: c.id, message: c.message }));
  const recommendations = [];
  if (!entrypoints.length) recommendations.push('Start by locating runtime/package entrypoints before reading implementation details.');
  if (interfaces.length === 0 && !['library', 'plugin_runtime'].includes(anatomy.architecture_shape)) recommendations.push('Add framework-specific route/API/command detection for each entrypoint.');
  if (flows.length && flows.some(f => f.main_trunk.includes('interface:unknown'))) recommendations.push('Resolve unknown interfaces so the trunk can be traced past bootstrap.');
  if (yellowRisks.length || redRisks.length) recommendations.push('Treat anatomy risks as architecture-review findings before copying code.');
  for (const item of evidence.filter(x => !x.found).slice(0, 8)) recommendations.push('For ' + profile.name + ', verify or add explicit evidence for: ' + item.capability + '.');
  if (!recommendations.length) recommendations.push('Use this repo as a comparable architecture reference, then inspect hotspots before copying code.');

  return {
    schema: 'repo-inv/standard-evaluation@1',
    standard: STANDARD_ARCHITECTURE.name,
    profile: profile.id,
    profile_name: profile.name,
    score,
    max_score: maxScore,
    grade: score / maxScore >= 0.85 ? 'A' : score / maxScore >= 0.7 ? 'B' : score / maxScore >= 0.5 ? 'C' : 'D',
    checks,
    gaps,
    recommendations,
  };
}

function renderStandardMarkdown(profileId = "generic") {
  const profile = getStandardProfile(profileId);
  let md = "# Standard Architecture: " + STANDARD_ARCHITECTURE.name + "\n\n";
  md += STANDARD_ARCHITECTURE.principle + "\n\n";
  md += "Profile: **" + profile.name + "** (" + profile.id + ")\n\n";
  md += "## Canonical Main Trunk\n\n";
  md += STANDARD_ARCHITECTURE.canonical_trunk.map(x => "- " + x).join("\n") + "\n\n";
  md += "## Deployable Unit Rules\n\n";
  md += STANDARD_ARCHITECTURE.deployable_unit_rules.map(x => "- " + x).join("\n") + "\n\n";
  md += "## Layer Rules\n\n";
  md += STANDARD_ARCHITECTURE.layer_rules.map(x => "- " + x).join("\n") + "\n\n";
  md += "## Anti Patterns\n\n";
  md += STANDARD_ARCHITECTURE.anti_patterns.map(x => "- " + x.severity + ": " + x.id + " - " + x.message).join("\n") + "\n\n";
  md += "## Profile Capabilities\n\n";
  md += profile.required_capabilities.length ? profile.required_capabilities.map(x => "- " + x).join("\n") + "\n\n" : "- base standard only\n\n";
  md += "## Profile Rules\n\n";
  md += profile.profile_rules.map(x => "- " + x).join("\n") + "\n";
  return md;
}

function renderEvaluationMarkdown(evaluation) {
  let md = "# Standard Evaluation\n\n";
  md += "Standard: " + evaluation.standard + "\n";
  if (evaluation.profile) md += "Profile: " + evaluation.profile_name + " (" + evaluation.profile + ")\n";
  md += "Score: " + evaluation.score + "/" + evaluation.max_score + " (" + evaluation.grade + ")\n\n";
  md += "## Checks\n\n";
  for (const c of evaluation.checks) md += "- " + (c.pass ? "PASS" : "FAIL") + " " + c.id + ": " + c.message + " (" + c.weight + ")\n";
  md += "\n## Recommendations\n\n";
  for (const r of evaluation.recommendations) md += "- " + r + "\n";
  return md;
}

module.exports = {
  STANDARD_ARCHITECTURE,
  ARCHITECTURE_PROFILES,
  getStandardProfile,
  evaluateAgainstStandard,
  renderStandardMarkdown,
  renderEvaluationMarkdown,
};
