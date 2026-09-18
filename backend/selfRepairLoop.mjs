const TRANSIENT_CODES = new Set([
  'timeout',
  'adapter_error',
  'network_error',
  'rate_limited',
  'provider_unavailable',
]);

const NEVER_AUTO_REPAIR = new Set([
  'approval_required',
  'scope_denied',
  'budget_exceeded',
  'privacy_block',
  'schema_error',
  'vault_not_configured',
]);

const RISK_ORDER = { L0: 0, L1: 1, L2: 2, L3: 3 };

export function classifyRepair(error, {
  riskLevel = 'L1',
  idempotent = true,
  externalWrite = false,
  paid = false,
  attempt = 1,
  maxAttempts = 2,
} = {}) {
  const code = String(error?.code || 'adapter_error');
  const risk = RISK_ORDER[riskLevel] ?? 3;
  const transient = TRANSIENT_CODES.has(code);
  const forbidden = NEVER_AUTO_REPAIR.has(code);
  const safeContext = idempotent && !externalWrite && !paid && risk <= RISK_ORDER.L1;
  const canRetry = transient && !forbidden && safeContext && attempt < maxAttempts;

  return {
    code,
    transient,
    forbidden,
    safeContext,
    canRetry,
    requiresHuman: forbidden || !safeContext || !transient,
    reason: forbidden
      ? 'policy-block'
      : !safeContext
        ? 'risk-boundary'
        : transient
          ? (canRetry ? 'bounded-retry' : 'retry-budget-exhausted')
          : 'non-transient',
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function executeWithRecovery(primary, {
  fallbacks = [],
  maxAttempts = 2,
  retryDelayMs = 150,
  riskLevel = 'L1',
  idempotent = true,
  externalWrite = false,
  paid = false,
  onEvent = () => {},
} = {}) {
  if (typeof primary !== 'function') throw new TypeError('primary executor must be a function');

  const events = [];
  const emit = event => {
    const row = { at: new Date().toISOString(), ...event };
    events.push(row);
    try { onEvent(row); } catch {}
  };

  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, Number(maxAttempts) || 1); attempt += 1) {
    try {
      const result = await primary({ attempt });
      emit({ type: 'primary-success', attempt });
      return { ok: true, result, recovered: attempt > 1, route: 'primary', events };
    } catch (error) {
      lastError = error;
      const decision = classifyRepair(error, {
        riskLevel,
        idempotent,
        externalWrite,
        paid,
        attempt,
        maxAttempts,
      });
      emit({ type: 'primary-failure', attempt, code: decision.code, decision: decision.reason });
      if (!decision.canRetry) break;
      await sleep(Math.max(0, Number(retryDelayMs) || 0) * attempt);
    }
  }

  const decision = classifyRepair(lastError, {
    riskLevel,
    idempotent,
    externalWrite,
    paid,
    attempt: maxAttempts,
    maxAttempts,
  });

  if (!decision.safeContext || decision.forbidden) {
    const wrapped = Object.assign(new Error(String(lastError?.message || 'repair requires approval')), {
      code: lastError?.code || 'repair_blocked',
      cause: lastError,
      repair: decision,
      events,
    });
    throw wrapped;
  }

  for (let index = 0; index < fallbacks.length; index += 1) {
    const fallback = fallbacks[index];
    if (typeof fallback !== 'function') continue;
    try {
      const result = await fallback({ index, previousError: lastError });
      emit({ type: 'fallback-success', index });
      return { ok: true, result, recovered: true, route: `fallback-${index + 1}`, events };
    } catch (error) {
      lastError = error;
      emit({ type: 'fallback-failure', index, code: String(error?.code || 'adapter_error') });
    }
  }

  const finalError = Object.assign(new Error(String(lastError?.message || 'all recovery routes failed')), {
    code: lastError?.code || 'repair_exhausted',
    cause: lastError,
    repair: classifyRepair(lastError, {
      riskLevel,
      idempotent,
      externalWrite,
      paid,
      attempt: maxAttempts,
      maxAttempts,
    }),
    events,
  });
  throw finalError;
}
