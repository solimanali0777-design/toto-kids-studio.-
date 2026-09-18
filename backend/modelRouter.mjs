const qualityWeight = { economy: 0.6, balanced: 1, premium: 1.5 };

function finiteOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeModel(model = {}) {
  return {
    id: String(model.id || model.model || '').trim(),
    provider: String(model.provider || 'unknown').trim(),
    enabled: model.enabled !== false,
    capabilities: Array.isArray(model.capabilities) ? [...new Set(model.capabilities.map(String))] : [],
    estimatedCostUsd: Math.max(0, finiteOr(model.estimatedCostUsd, 0)),
    latencyMs: Math.max(0, finiteOr(model.latencyMs, 999999)),
    qualityScore: Math.min(1, Math.max(0, finiteOr(model.qualityScore, 0.5))),
    reliabilityScore: Math.min(1, Math.max(0, finiteOr(model.reliabilityScore, 0.5))),
    privacy: String(model.privacy || 'standard'),
  };
}

function supports(model, required = []) {
  return required.every(capability => model.capabilities.includes(capability));
}

export function rankModels({
  catalog = [],
  requiredCapabilities = ['text'],
  budgetUsd = Infinity,
  maxLatencyMs = Infinity,
  quality = 'balanced',
  preferredProviders = [],
  requirePrivate = false,
} = {}) {
  const qWeight = qualityWeight[quality] || qualityWeight.balanced;
  const budget = finiteOr(budgetUsd, Infinity);
  const latencyLimit = finiteOr(maxLatencyMs, Infinity);
  const preferred = new Set(preferredProviders.map(String));

  return (Array.isArray(catalog) ? catalog : [])
    .map(normalizeModel)
    .filter(model =>
      model.id
      && model.enabled
      && supports(model, requiredCapabilities)
      && model.estimatedCostUsd <= budget
      && model.latencyMs <= latencyLimit
      && (!requirePrivate || ['private', 'local'].includes(model.privacy))
    )
    .map(model => {
      const costPenalty = budget === Infinity
        ? model.estimatedCostUsd
        : model.estimatedCostUsd / Math.max(budget, 0.000001);
      const latencyPenalty = latencyLimit === Infinity
        ? Math.min(1, model.latencyMs / 10000)
        : model.latencyMs / Math.max(latencyLimit, 1);
      const providerBonus = preferred.has(model.provider) ? 0.08 : 0;
      const score =
        model.qualityScore * 0.44 * qWeight
        + model.reliabilityScore * 0.34
        + providerBonus
        - costPenalty * 0.14
        - latencyPenalty * 0.08;
      return { ...model, routeScore: Number(score.toFixed(6)) };
    })
    .sort((a, b) =>
      b.routeScore - a.routeScore
      || a.estimatedCostUsd - b.estimatedCostUsd
      || a.latencyMs - b.latencyMs
      || a.id.localeCompare(b.id)
    );
}

export function selectModel(options = {}) {
  const ranked = rankModels(options);
  const selected = ranked[0] || null;
  return {
    selected,
    fallbacks: ranked.slice(1, 4),
    reason: selected ? 'best-policy-fit' : 'no-model-matches-policy',
    considered: Array.isArray(options.catalog) ? options.catalog.length : 0,
    eligible: ranked.length,
  };
}

export function buildRoutingPolicy({
  taskType = 'text',
  riskLevel = 'L1',
  paidAllowed = false,
  budgetUsd = 0,
  maxLatencyMs = 12000,
  quality = 'balanced',
} = {}) {
  const capabilityMap = {
    text: ['text'],
    vision: ['vision'],
    audio: ['audio'],
    image: ['image'],
    video: ['video'],
    multimodal: ['text', 'vision'],
  };
  const requiresPrivate = ['L3'].includes(riskLevel);
  return {
    requiredCapabilities: capabilityMap[taskType] || ['text'],
    budgetUsd: paidAllowed ? Math.max(0, finiteOr(budgetUsd, 0)) : 0,
    maxLatencyMs: Math.max(1, finiteOr(maxLatencyMs, 12000)),
    quality,
    requirePrivate: requiresPrivate,
  };
}

export const __test = { supports, finiteOr };
